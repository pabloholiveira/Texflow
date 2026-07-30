import { Router } from 'express'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getProductById,
  getNextStatus,
  getPreviousStatus,
  findBlockingSteps,
  recalculateOrderTotal,
  saveProductSizes,
  recalculateProductQuantity,
  getAutoAddOperationNames,
} from '../db/ordersQueries.js'
import { normalizeSizes } from '../data/sizes.js'
import { logEvent } from '../db/eventsQueries.js'
import { canOperateStep } from '../db/usersQueries.js'
import { requireRole } from '../middleware/requireRole.js'
import { SALES_ROLES, DESIGN_ROLES, PRODUCTION_ROLES } from '../auth/permissions.js'

const router = Router()

// Item 3.1 (CLAUDE.md): status de design do produto — as colunas do kanban
// da tela /design. null = tira o produto da fila. Toda transição real vira
// uma linha em product_events ('design_status_changed', payload {from, to}),
// na mesma transação — é a semente do histórico do item 3.3.
const DESIGN_STATUSES = ['pendente', 'em_design', 'aprovacao', 'concluido']

router.patch(
  '/:id/design-status',
  requireRole(...DESIGN_ROLES),
  asyncHandler(async (req, res) => {
    const { status } = req.body

    if (status !== null && !DESIGN_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status deve ser null ou um de: ${DESIGN_STATUSES.join(', ')}`,
      })
    }

    const result = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT design_status, order_id FROM products WHERE id = $1',
        [req.params.id]
      )
      if (current.rows.length === 0) return null

      const from = current.rows[0].design_status
      const orderId = current.rows[0].order_id

      if (from !== status) {
        await client.query('UPDATE products SET design_status = $1 WHERE id = $2', [
          status,
          req.params.id,
        ])
        await logEvent(client, {
          orderId,
          productId: req.params.id,
          type: 'design_status_changed',
          payload: { from, to: status, trigger: 'manual' },
          user: req.user.username,
        })
      }

      // Gatilho 2 da integração Pedidos ↔ Design (remapeado 2026-07-11 —
      // pedido do Pablo): cada avanço de coluna no kanban de design, de
      // "Em Design" em diante, empurra o estágio do pedido junto. Duas
      // checagens de ESTADO (não de transição), rodadas em sequência após
      // qualquer mudança, na mesma transação:
      //   1. todos os produtos em 'aprovacao' ou além  → design    → aprovacao
      //   2. todos os produtos 'concluido'             → aprovacao → producao
      // Rodar as duas em sequência cobre o caso de pulo (tudo já concluído
      // com o pedido ainda em design avança duas vezes, direto a producao).
      // Retrabalho não dispara nada aqui — o pedido de um retrabalho típico
      // já está em 'producao', então os guards de stage seguram. E mover um
      // card pra trás nunca regride estágio (não há UPDATE na outra direção).
      if (from !== status) {
        const toApproval = await client.query(
          `UPDATE orders SET stage = 'aprovacao', updated_at = now()
           WHERE id = $1 AND stage = 'design'
             AND NOT EXISTS (
               SELECT 1 FROM products
               WHERE order_id = $1
                 AND (design_status IS NULL OR design_status NOT IN ('aprovacao', 'concluido'))
             )`,
          [orderId]
        )
        const toProduction = await client.query(
          `UPDATE orders SET stage = 'producao', updated_at = now()
           WHERE id = $1 AND stage = 'aprovacao'
             AND NOT EXISTS (
               SELECT 1 FROM products
               WHERE order_id = $1 AND design_status IS DISTINCT FROM 'concluido'
             )`,
          [orderId]
        )

        // Avanço automático também entra no histórico, e marcado como
        // trigger 'design' — senão a timeline mostraria o pedido mudando de
        // estágio sozinho, sem explicar por quê. rowCount diz se o UPDATE
        // realmente pegou (as condições acima podem não ter sido satisfeitas).
        if (toApproval.rowCount > 0) {
          await logEvent(client, {
            orderId,
            type: 'order_stage_changed',
            payload: { from: 'design', to: 'aprovacao', direction: 'forward', trigger: 'design' },
            user: req.user.username,
          })
        }
        if (toProduction.rowCount > 0) {
          await logEvent(client, {
            orderId,
            type: 'order_stage_changed',
            payload: { from: 'aprovacao', to: 'producao', direction: 'forward', trigger: 'design' },
            user: req.user.username,
          })
        }
      }

      const orderStage = await client.query('SELECT stage FROM orders WHERE id = $1', [orderId])
      const product = await getProductById(client, req.params.id)
      return { product, orderStage: orderStage.rows[0].stage }
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    // orderStage vai junto (mesmo padrão do orderTotalValue) — o gatilho
    // acima pode ter avançado o estágio, e o front atualiza sem refetch.
    res.json({ ...result.product, orderStage: result.orderStage })
  })
)

// Checkbox "Retrabalho de design" (Produção) — intenção diferente de mover
// card no kanban, por isso rota própria. Marcar: entra/reentra na fila como
// 'pendente' com design_is_rework = true. Desmarcar: limpa a flag; se o
// card ainda estava 'pendente' (ninguém começou), sai da fila junto — um
// flag acidental não deixa lixo; se já estava em andamento, o card fica na
// coluna onde está (só perde o marcador de retrabalho).
// Marcar retrabalho é originar uma demanda de design — quem descobre isso é
// quem fala com o cliente (vendedora) ou o próprio designer, não a produção.
// Por isso SALES_ROLES e não DESIGN_ROLES, mesmo o checkbox morando na tela
// de Produção.
router.patch(
  '/:id/design-rework',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { value } = req.body

    if (typeof value !== 'boolean') {
      return res.status(400).json({ error: 'value deve ser true ou false' })
    }

    const result = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT design_status, design_is_rework FROM products WHERE id = $1',
        [req.params.id]
      )
      if (current.rows.length === 0) return null

      const { design_status: from, design_is_rework: wasRework } = current.rows[0]

      let newStatus = from
      if (value && (from === null || from === 'concluido')) newStatus = 'pendente'
      if (!value && from === 'pendente') newStatus = null

      await client.query(
        'UPDATE products SET design_status = $1, design_is_rework = $2 WHERE id = $3',
        [newStatus, value, req.params.id]
      )

      if (newStatus !== from) {
        await logEvent(client, {
          productId: req.params.id,
          type: 'design_status_changed',
          payload: { from, to: newStatus, trigger: 'rework-checkbox' },
          user: req.user.username,
        })
      }
      if (value !== wasRework) {
        await logEvent(client, {
          productId: req.params.id,
          type: value ? 'design_rework_flagged' : 'design_rework_unflagged',
          payload: { designStatus: newStatus },
          user: req.user.username,
        })
      }

      return getProductById(client, req.params.id)
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json(result)
  })
)

router.patch(
  '/:id',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const columnMap = {
      type: 'type',
      model: 'model',
      color: 'color',
      fabric: 'fabric',
      quantity: 'quantity',
      observations: 'observations',
      unitPrice: 'unit_price',
      needsVectorization: 'needs_vectorization',
      vectorizationPrice: 'vectorization_price',
    }
    // A grade de tamanhos não entra no columnMap: mora em outra tabela e é
    // gravada por saveProductSizes, não por UPDATE em products.
    const hasSizes = 'sizes' in req.body
    let normalizedSizes = []
    if (hasSizes) {
      try {
        normalizedSizes = normalizeSizes(req.body.sizes)
      } catch (err) {
        return res.status(400).json({ error: err.message })
      }
    }

    const updates = Object.entries(req.body).filter(([key]) => {
      if (!(key in columnMap)) return false
      // Com grade preenchida, a quantidade é derivada dela — ignora o que o
      // front mandou em `quantity` em vez de gravar e sobrescrever logo em
      // seguida (ver recalculateProductQuantity).
      if (key === 'quantity' && normalizedSizes.length > 0) return false
      return true
    })

    if (updates.length === 0 && !hasSizes) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' })
    }

    const setClause = updates
      .map(([key], index) => `${columnMap[key]} = $${index + 1}`)
      .join(', ')
    const values = updates.map(([, value]) => value)

    // Transação: preço ou quantidade podem estar entre os campos mudando,
    // e o total do pedido (orders.total_value) precisa refletir isso na
    // mesma operação — ver recalculateOrderTotal (Funcionalidades comerciais
    // no CLAUDE.md).
    const result = await withTransaction(async (client) => {
      // Editar SÓ a grade é um caso válido (nenhuma coluna de products muda),
      // e aí não há UPDATE pra dizer se o produto existe — daí o SELECT.
      const found = await client.query('SELECT order_id FROM products WHERE id = $1', [
        req.params.id,
      ])
      if (found.rows.length === 0) return null
      const orderId = found.rows[0].order_id

      if (updates.length > 0) {
        await client.query(
          `UPDATE products SET ${setClause} WHERE id = $${values.length + 1}`,
          [...values, req.params.id]
        )
      }

      if (hasSizes) {
        await saveProductSizes(client, req.params.id, normalizedSizes)
        await recalculateProductQuantity(client, req.params.id)
      }

      await logEvent(client, {
        orderId,
        productId: req.params.id,
        type: 'product_updated',
        payload: {
          fields: [...updates.map(([key]) => key), ...(hasSizes ? ['sizes'] : [])],
          ...(hasSizes ? { sizes: normalizedSizes } : {}),
        },
        user: req.user.username,
      })

      const orderTotalValue = await recalculateOrderTotal(client, orderId)
      return { product: await getProductById(client, req.params.id), orderTotalValue }
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json({ ...result.product, orderTotalValue: result.orderTotalValue })
  })
)

router.delete(
  '/:id',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    // ON DELETE CASCADE em product_workflow_steps e product_comments
    // (schema.sql) já cuida de limpar o que depende deste produto.
    // Precisa do order_id antes de excluir pra poder recalcular o total
    // depois — por isso virou uma transação em vez de um DELETE isolado.
    const result = await withTransaction(async (client) => {
      const deleted = await client.query(
        'DELETE FROM products WHERE id = $1 RETURNING order_id, type, model, quantity',
        [req.params.id]
      )
      if (deleted.rows.length === 0) return null

      const { order_id: orderId, type, model, quantity } = deleted.rows[0]

      // product_id fica NULL de propósito: o FK é ON DELETE CASCADE, então
      // um evento apontando para o produto recém-excluído sumiria junto com
      // ele — justamente o evento que mais importa preservar. A descrição do
      // produto vai no payload, única fonte que sobra depois da exclusão.
      await logEvent(client, {
        orderId,
        type: 'product_removed',
        payload: { type, model, quantity },
        user: req.user.username,
      })

      const totalValue = await recalculateOrderTotal(client, orderId)
      return { totalValue }
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json(result)
  })
)

// Escolher QUAIS operações o produto precisa é decisão de venda (domain model
// no CLAUDE.md), não de produção — por isso SALES_ROLES aqui, enquanto mover
// o STATUS de uma etapa (rota logo abaixo) é PRODUCTION_ROLES.
router.put(
  '/:id/workflow',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const productId = req.params.id
    // As etapas automáticas (auto_add) entram na lista mesmo sem virem do
    // formulário — a tela nem as exibe, então sem isto salvar uma edição de
    // etapas apagaria a Revisão/Finalização e a Embalagem do produto.
    const desired = new Set([
      ...(req.body.operations || []),
      ...(await getAutoAddOperationNames(pool)),
    ])

    // Espelha saveWorkflow (useProductList.js): só quem é realmente novo
    // entra como 'pending'; quem já existia mantém o status como está;
    // quem foi desmarcado é removido.
    const product = await withTransaction(async (client) => {
      const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId])
      if (productCheck.rows.length === 0) return null

      const currentResult = await client.query(
        'SELECT step_name FROM product_workflow_steps WHERE product_id = $1',
        [productId]
      )
      const current = new Set(currentResult.rows.map((row) => row.step_name))

      const toAdd = [...desired].filter((step) => !current.has(step))
      const toRemove = [...current].filter((step) => !desired.has(step))

      for (const step of toAdd) {
        await client.query(
          'INSERT INTO product_workflow_steps (product_id, step_name, status) VALUES ($1, $2, $3)',
          [productId, step, 'pending']
        )
      }

      if (toRemove.length > 0) {
        await client.query(
          'DELETE FROM product_workflow_steps WHERE product_id = $1 AND step_name = ANY($2::text[])',
          [productId, toRemove]
        )
      }

      if (toAdd.length > 0 || toRemove.length > 0) {
        await logEvent(client, {
          productId,
          type: 'product_operations_changed',
          payload: { added: toAdd, removed: toRemove },
          user: req.user.username,
        })
      }

      return getProductById(client, productId)
    })

    if (!product) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json(product)
  })
)

router.patch(
  '/:id/workflow/:step',
  asyncHandler(async (req, res) => {
    const { id, step } = req.params
    const { direction } = req.body

    // Gate de AUTORIZAÇÃO — não dá pra resolver no requireRole da rota
    // porque depende de QUAL etapa está sendo movida (migration 0007):
    // - fase 'conferencia' (Lavagem, Revisão/Finalização, Embalagem) é da
    //   vendedora, o fechamento comercial da peça;
    // - fase 'producao' é da produção, e ainda passa pelo canOperateStep,
    //   que confere se ESTA pessoa tem ESTA etapa atribuída (migration 0005).
    // Etapa fora do catálogo ("outra operação" digitada na venda) não tem
    // fase: cai em 'producao', o mesmo tratamento que sempre teve.
    const stepOperation = await pool.query(
      'SELECT phase, sequence_position FROM operations WHERE name = $1',
      [step]
    )
    const phase = stepOperation.rows[0]?.phase ?? 'producao'

    if (phase === 'conferencia') {
      if (!SALES_ROLES.includes(req.user.role)) {
        return res.status(403).json({
          error: `A etapa "${step}" é da Conferência, feita pela vendedora`,
        })
      }
    } else {
      if (!PRODUCTION_ROLES.includes(req.user.role)) {
        return res.status(403).json({
          error: 'Seu perfil não tem permissão para esta ação',
        })
      }
      if (!(await canOperateStep(req.user, step))) {
        return res.status(403).json({
          error: `Você não tem permissão para operar a etapa "${step}"`,
        })
      }
    }

    const current = await pool.query(
      'SELECT id AS workflow_step_id, status FROM product_workflow_steps WHERE product_id = $1 AND step_name = $2',
      [id, step]
    )
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Etapa não encontrada para este produto' })
    }

    // Gate de sequência: só trava o INÍCIO (pending -> in_progress). Uma vez
    // iniciada, a etapa anda livre — ver modelo de "posição em camadas" no
    // CLAUDE.md (domain model).
    if (direction === 'forward' && current.rows[0].status === 'pending') {
      const stepPosition = stepOperation.rows[0]?.sequence_position

      if (stepPosition != null) {
        const blockingSteps = await findBlockingSteps(pool, id, stepPosition)
        if (blockingSteps.length > 0) {
          return res.status(409).json({
            error: `Não é possível iniciar "${step}" antes de concluir: ${blockingSteps.join(', ')}`,
          })
        }
      }
    }

    const previousStatus = current.rows[0].status
    const nextStatus =
      direction === 'forward' ? getNextStatus(previousStatus) : getPreviousStatus(previousStatus)

    // Status e eventos gravados juntos, na mesma transação: os Relatórios
    // (tempo médio por etapa, gargalos) dependem desse log estar sempre
    // consistente com o status atual — ver product_workflow_events no schema.
    //
    // A transição é gravada em DUAS tabelas de propósito (decisão do Pablo,
    // item 3.3): product_workflow_events continua sendo a fonte especializada
    // dos Relatórios (com a query de LAG() já verificada, que não vale a pena
    // arriscar), e product_events recebe a mesma informação para a timeline
    // do pedido ler tudo de uma fonte só. É duplicação de dado, mas este é o
    // ÚNICO lugar do sistema que muda status de etapa, então as duas não têm
    // como divergir sem alguém mexer justamente aqui.
    const result = await withTransaction(async (client) => {
      await client.query(
        'UPDATE product_workflow_steps SET status = $1 WHERE product_id = $2 AND step_name = $3',
        [nextStatus, id, step]
      )
      await client.query(
        'INSERT INTO product_workflow_events (workflow_step_id, from_status, to_status) VALUES ($1, $2, $3)',
        [current.rows[0].workflow_step_id, previousStatus, nextStatus]
      )
      await logEvent(client, {
        productId: id,
        type: 'workflow_step_changed',
        payload: { step, from: previousStatus, to: nextStatus, direction },
        user: req.user.username,
      })

      // Gatilho producao -> conferencia (item 2, parte 2): quando TODA a
      // fabricação de TODOS os produtos do pedido termina, o pedido passa
      // para Conferência sozinho. Mesma forma dos gatilhos do kanban de
      // design: checagem de ESTADO (não de transição), na mesma transação,
      // e sem caminho de volta — mover uma etapa para trás não regride
      // estágio, igual ao resto do sistema.
      //
      // Só olha etapas de fase 'producao': as três da Conferência (e as
      // "outra operação" sem fase, que caem em producao) não podem segurar
      // a entrada na própria Conferência.
      const orderRow = await client.query('SELECT order_id FROM products WHERE id = $1', [id])
      const orderId = orderRow.rows[0].order_id

      const toConference = await client.query(
        `UPDATE orders SET stage = 'conferencia', updated_at = now()
          WHERE id = $1 AND stage = 'producao'
            AND NOT EXISTS (
              SELECT 1
                FROM product_workflow_steps pws
                JOIN products p ON p.id = pws.product_id
                LEFT JOIN operations op ON op.name = pws.step_name
               WHERE p.order_id = $1
                 AND COALESCE(op.phase, 'producao') = 'producao'
                 AND pws.status <> 'done'
            )`,
        [orderId]
      )

      if (toConference.rowCount > 0) {
        await logEvent(client, {
          orderId,
          type: 'order_stage_changed',
          payload: {
            from: 'producao',
            to: 'conferencia',
            direction: 'forward',
            trigger: 'producao-concluida',
          },
          user: req.user.username,
        })
      }

      const stageRow = await client.query('SELECT stage FROM orders WHERE id = $1', [orderId])
      return { product: await getProductById(client, id), orderStage: stageRow.rows[0].stage }
    })

    // orderStage vai junto (mesmo padrão do design-status): o gatilho acima
    // pode ter mudado o estágio, e o front atualiza sem refetch.
    res.json({ ...result.product, orderStage: result.orderStage })
  })
)

export default router
