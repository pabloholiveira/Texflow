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
} from '../db/ordersQueries.js'

const router = Router()

// Item 3.1 (CLAUDE.md): status de design do produto — as colunas do kanban
// da tela /design. null = tira o produto da fila. Toda transição real vira
// uma linha em product_events ('design_status_changed', payload {from, to}),
// na mesma transação — é a semente do histórico do item 3.3.
const DESIGN_STATUSES = ['pendente', 'em_design', 'aprovacao', 'concluido']

router.patch(
  '/:id/design-status',
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
        await client.query(
          `INSERT INTO product_events (product_id, event_type, payload, created_by)
           VALUES ($1, 'design_status_changed', $2, $3)`,
          [req.params.id, JSON.stringify({ from, to: status, trigger: 'manual' }), req.user.username]
        )
      }

      // Gatilho 2 da integração Pedidos ↔ Design (CLAUDE.md, item 3.1):
      // o ÚLTIMO produto do pedido a concluir design avança o pedido de
      // 'design' pra 'aprovacao' automaticamente. Retrabalho não dispara
      // nada aqui — o pedido de um retrabalho típico já está em 'producao',
      // então o guard de stage segura.
      if (status === 'concluido') {
        await client.query(
          `UPDATE orders SET stage = 'aprovacao', updated_at = now()
           WHERE id = $1 AND stage = 'design'
             AND NOT EXISTS (
               SELECT 1 FROM products
               WHERE order_id = $1 AND design_status IS DISTINCT FROM 'concluido'
             )`,
          [orderId]
        )
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
router.patch(
  '/:id/design-rework',
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
        await client.query(
          `INSERT INTO product_events (product_id, event_type, payload, created_by)
           VALUES ($1, 'design_status_changed', $2, $3)`,
          [
            req.params.id,
            JSON.stringify({ from, to: newStatus, trigger: 'rework-checkbox' }),
            req.user.username,
          ]
        )
      }
      if (value !== wasRework) {
        await client.query(
          `INSERT INTO product_events (product_id, event_type, payload, created_by)
           VALUES ($1, $2, $3, $4)`,
          [
            req.params.id,
            value ? 'design_rework_flagged' : 'design_rework_unflagged',
            JSON.stringify({ designStatus: newStatus }),
            req.user.username,
          ]
        )
      }

      return getProductById(client, req.params.id)
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json(result)
  })
)

router.patch(
  '/:id',
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
    const updates = Object.entries(req.body).filter(([key]) => key in columnMap)

    if (updates.length === 0) {
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
      const updated = await client.query(
        `UPDATE products SET ${setClause} WHERE id = $${values.length + 1} RETURNING order_id`,
        [...values, req.params.id]
      )
      if (updated.rows.length === 0) return null

      const orderTotalValue = await recalculateOrderTotal(client, updated.rows[0].order_id)
      return { product: await getProductById(client, req.params.id), orderTotalValue }
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json({ ...result.product, orderTotalValue: result.orderTotalValue })
  })
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // ON DELETE CASCADE em product_workflow_steps e product_comments
    // (schema.sql) já cuida de limpar o que depende deste produto.
    // Precisa do order_id antes de excluir pra poder recalcular o total
    // depois — por isso virou uma transação em vez de um DELETE isolado.
    const result = await withTransaction(async (client) => {
      const deleted = await client.query(
        'DELETE FROM products WHERE id = $1 RETURNING order_id',
        [req.params.id]
      )
      if (deleted.rows.length === 0) return null

      const totalValue = await recalculateOrderTotal(client, deleted.rows[0].order_id)
      return { totalValue }
    })

    if (!result) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json(result)
  })
)

router.put(
  '/:id/workflow',
  asyncHandler(async (req, res) => {
    const productId = req.params.id
    const desired = new Set(req.body.operations || [])

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
      const stepOperation = await pool.query(
        'SELECT sequence_position FROM operations WHERE name = $1',
        [step]
      )
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

    // Status e evento gravados juntos, na mesma transação: os Relatórios
    // (tempo médio por etapa, gargalos) dependem desse log estar sempre
    // consistente com o status atual — ver product_workflow_events no schema.
    await withTransaction(async (client) => {
      await client.query(
        'UPDATE product_workflow_steps SET status = $1 WHERE product_id = $2 AND step_name = $3',
        [nextStatus, id, step]
      )
      await client.query(
        'INSERT INTO product_workflow_events (workflow_step_id, from_status, to_status) VALUES ($1, $2, $3)',
        [current.rows[0].workflow_step_id, previousStatus, nextStatus]
      )
    })

    res.json(await getProductById(pool, id))
  })
)

export default router
