import { Router } from 'express'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { fetchOrders, mapOrder, toNumber, ORDER_STAGES } from '../db/ordersQueries.js'
import { logEvent, fetchOrderEvents } from '../db/eventsQueries.js'
import { requireRole } from '../middleware/requireRole.js'
import { SALES_ROLES } from '../auth/permissions.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await fetchOrders())
  })
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' })
    res.json(order)
  })
)

router.post(
  '/',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { clientId = null, deadline = null } = req.body

    // order_number precisa existir e ser único desde o INSERT, mas só
    // conseguimos calcular o valor final ("PED-2026-0007") depois de saber
    // o id gerado — por isso: insere com um placeholder, pega o id via
    // RETURNING, e só então faz o UPDATE com o número real, tudo na mesma
    // transação (client.release() só acontece depois do COMMIT).
    const order = await withTransaction(async (client) => {
      const inserted = await client.query(
        `INSERT INTO orders (order_number, client_id, deadline)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        ['pendente', clientId, deadline]
      )
      const { id, created_at } = inserted.rows[0]
      const orderNumber = `PED-${created_at.getFullYear()}-${String(id).padStart(4, '0')}`

      const updated = await client.query(
        'UPDATE orders SET order_number = $1 WHERE id = $2 RETURNING *',
        [orderNumber, id]
      )

      await logEvent(client, {
        orderId: id,
        type: 'order_created',
        payload: { orderNumber },
        user: req.user.username,
      })

      return updated.rows[0]
    })

    res.status(201).json(mapOrder(order, []))
  })
)

router.patch(
  '/:id',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const columnMap = { clientId: 'client_id', deadline: 'deadline', amountPaid: 'amount_paid' }
    const updates = Object.entries(req.body).filter(([key]) => key in columnMap)

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' })
    }

    const setClause = updates
      .map(([key], index) => `${columnMap[key]} = $${index + 1}`)
      .join(', ')
    const values = updates.map(([, value]) => value)

    // Virou transação por causa do log: a mudança e o evento que a descreve
    // precisam ser gravados juntos (ver logEvent).
    const updatedId = await withTransaction(async (client) => {
      /* Lê o valor pago ANTES do UPDATE para conseguir o delta — sem ele o
         evento só sabe o acumulado, e "quanto entrou neste mês" vira uma
         conta de diferença entre eventos consecutivos, que quebra quando
         falta um deles. O FOR UPDATE trava a linha até o COMMIT: sem isso,
         dois pagamentos simultâneos no mesmo pedido leriam o mesmo
         `previous` e gravariam deltas somando errado. */
      const before = await client.query(
        'SELECT amount_paid FROM orders WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (before.rows.length === 0) return null

      const result = await client.query(
        `UPDATE orders SET ${setClause}, updated_at = now() WHERE id = $${values.length + 1} RETURNING id, amount_paid`,
        [...values, req.params.id]
      )
      if (result.rows.length === 0) return null

      /* Registrar pagamento e editar o pedido usam a mesma rota, mas são
         acontecimentos diferentes na linha do tempo — e podem acontecer na
         MESMA chamada: "Finalizar Pedido" manda clientId e amountPaid
         juntos, o que é uma edição E uma entrada de dinheiro.

         Até 2026-08-04 isto era um ou-exclusivo ("é pagamento só se
         amountPaid for o único campo"), e por isso o pagamento da venda —
         normalmente o maior — nunca virava payment_registered: era gravado
         como order_updated, cujo payload guarda só os nomes dos campos.
         O valor não ia para lugar nenhum. Agora os dois são independentes. */
      const changedFields = updates.map(([key]) => key)
      const previous = toNumber(before.rows[0].amount_paid)
      const current = toNumber(result.rows[0].amount_paid)

      // Sem mudança de valor não há pagamento: antes isto gravava um evento
      // a cada clique em Salvar, mesmo repetindo o mesmo número.
      if (changedFields.includes('amountPaid') && current !== previous) {
        await logEvent(client, {
          orderId: req.params.id,
          type: 'payment_registered',
          // delta negativo é correção de lançamento, não recebimento — o
          // relatório precisa distinguir as duas coisas, e só o acumulado
          // não permitia isso.
          payload: { previous, current, delta: Number((current - previous).toFixed(2)) },
          user: req.user.username,
        })
      }

      const otherFields = changedFields.filter((field) => field !== 'amountPaid')
      if (otherFields.length > 0) {
        await logEvent(client, {
          orderId: req.params.id,
          type: 'order_updated',
          payload: { fields: otherFields },
          user: req.user.username,
        })
      }

      return result.rows[0].id
    })

    if (!updatedId) return res.status(404).json({ error: 'Pedido não encontrado' })

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

router.patch(
  '/:id/finalize',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const finalized = await withTransaction(async (client) => {
      const result = await client.query(
        'UPDATE orders SET is_draft = false, updated_at = now() WHERE id = $1 RETURNING id',
        [req.params.id]
      )
      if (result.rows.length === 0) return null

      await logEvent(client, {
        orderId: req.params.id,
        type: 'order_finalized',
        user: req.user.username,
      })
      return true
    })

    if (!finalized) return res.status(404).json({ error: 'Pedido não encontrado' })

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

router.patch(
  '/:id/advance-stage',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const current = await pool.query(
      'SELECT stage, cancelled_at FROM orders WHERE id = $1',
      [req.params.id]
    )
    if (current.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

    // Pedido cancelado não anda no fluxo. Sem esta trava seria só uma dica de
    // tela: a rota continuaria aceitando, e um clique reabriria o pedido pela
    // porta dos fundos, sem passar por "Reabrir pedido".
    if (current.rows[0].cancelled_at) {
      return res
        .status(409)
        .json({ error: 'Pedido cancelado. Reabra o pedido antes de avançar a etapa.' })
    }

    const currentIndex = ORDER_STAGES.indexOf(current.rows[0].stage)
    const nextStage = ORDER_STAGES[currentIndex + 1]

    // Entrar em 'entregue' é o fechamento do pedido (item 1) e tem duas
    // particularidades. A primeira: é o ÚNICO avanço com trava de verdade no
    // servidor — o pedido só fecha depois que todos os produtos concluíram
    // todas as suas etapas de Conferência (decisão do Pablo). É diferente do
    // "Avançar etapa" desabilitado na tela em Design/Aprovação, que é só
    // dica visual; aqui dizer que entregou sem ter conferido é um erro de
    // registro que ninguém desfaz depois.
    if (nextStage === 'entregue') {
      const pending = await pool.query(
        `SELECT pws.step_name
           FROM product_workflow_steps pws
           JOIN products p ON p.id = pws.product_id
           JOIN operations op ON op.name = pws.step_name
          WHERE p.order_id = $1
            AND op.phase = 'conferencia'
            AND pws.status <> 'done'
          LIMIT 5`,
        [req.params.id]
      )

      if (pending.rows.length > 0) {
        const names = [...new Set(pending.rows.map((row) => row.step_name))]
        return res.status(409).json({
          error: `Conferência ainda não terminou: ${names.join(', ')}`,
        })
      }
    }

    if (nextStage) {
      await withTransaction(async (client) => {
        // A segunda particularidade: além do estágio, grava QUANDO o cliente
        // retirou — é o dado que um relatório de prazo real vai querer, e
        // que o estágio sozinho não guarda.
        await client.query(
          `UPDATE orders
              SET stage = $1,
                  updated_at = now(),
                  picked_up_at = CASE WHEN $1 = 'entregue' THEN now() ELSE picked_up_at END
            WHERE id = $2`,
          [nextStage, req.params.id]
        )

        await logEvent(client, {
          orderId: req.params.id,
          type: 'order_stage_changed',
          payload: { from: current.rows[0].stage, to: nextStage, direction: 'forward' },
          user: req.user.username,
        })

        // Gatilho 1 da integração Pedidos ↔ Design (CLAUDE.md, item 3.1):
        // sair de Venda coloca todos os produtos do pedido na fila de design
        // como 'pendente' (fluxo normal, não retrabalho — design_is_rework
        // fica false). Produtos que já estivessem na fila não são resetados.
        if (nextStage === 'design') {
          const entered = await client.query(
            `UPDATE products SET design_status = 'pendente', design_is_rework = false
             WHERE order_id = $1 AND design_status IS NULL RETURNING id`,
            [req.params.id]
          )
          for (const row of entered.rows) {
            await logEvent(client, {
              orderId: req.params.id,
              productId: row.id,
              type: 'design_status_changed',
              payload: { from: null, to: 'pendente', trigger: 'order-stage' },
              user: req.user.username,
            })
          }
        }
      })
    }

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

// Espelho do advance-stage, um estágio por vez na direção contrária.
// Voltar SÓ muda o estágio — não mexe em workflow de produção, não tira
// produto da fila de design e não apaga nada (decisão do Pablo, 2026-07-11):
// regressão existe para corrigir um avanço errado, não para desfazer
// trabalho. Se o pedido voltar para 'design' e o último produto concluir o
// design de novo, o gatilho automático Design→Aprovação (em
// PATCH /products/:id/design-status) dispara normalmente.
router.patch(
  '/:id/regress-stage',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const current = await pool.query(
      'SELECT stage, cancelled_at FROM orders WHERE id = $1',
      [req.params.id]
    )
    if (current.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

    // Mesma trava do avanço: cancelado sai do fluxo nos dois sentidos.
    if (current.rows[0].cancelled_at) {
      return res
        .status(409)
        .json({ error: 'Pedido cancelado. Reabra o pedido antes de voltar a etapa.' })
    }

    const currentIndex = ORDER_STAGES.indexOf(current.rows[0].stage)
    const previousStage = ORDER_STAGES[currentIndex - 1]

    if (previousStage) {
      await withTransaction(async (client) => {
        // Sair de 'entregue' limpa o carimbo de retirada: a regressão existe
        // para corrigir um clique errado, e deixar uma data de retirada num
        // pedido que não foi retirado é pior que não ter data nenhuma.
        await client.query(
          `UPDATE orders
              SET stage = $1,
                  updated_at = now(),
                  picked_up_at = CASE WHEN stage = 'entregue' THEN NULL ELSE picked_up_at END
            WHERE id = $2`,
          [previousStage, req.params.id]
        )
        await logEvent(client, {
          orderId: req.params.id,
          type: 'order_stage_changed',
          payload: { from: current.rows[0].stage, to: previousStage, direction: 'backward' },
          user: req.user.username,
        })
      })
    }

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

// Timeline do pedido (item 3.3): eventos do pedido e dos produtos dele,
// já ordenados do mais recente para o mais antigo. Não é embutido no
// GET /orders porque o histórico cresce sem limite e só interessa quando
// alguém abre um pedido específico — carregar isso em toda listagem seria
// desperdício.
router.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    const orderCheck = await pool.query('SELECT id FROM orders WHERE id = $1', [req.params.id])
    if (orderCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado' })
    }

    res.json(await fetchOrderEvents(pool, req.params.id))
  })
)

/* Cancelar e reabrir (2026-08-05).

   Duas rotas explícitas em vez de um toggle: cancelar é destrutivo do ponto
   de vista operacional (o pedido some das telas de trabalho) e reabrir é o
   contrário — um único endpoint que "inverte" esconderia qual das duas
   coisas quem chamou queria fazer, e um clique repetido faria o oposto do
   esperado.

   SALES_ROLES inclui o design, que acumula tudo da vendedora por decisão já
   registrada; o gerente também está aí. Confirmado com o Pablo. */
router.patch(
  '/:id/cancel',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const cancelled = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT stage, cancelled_at FROM orders WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (current.rows.length === 0) return { error: 404 }

      const { stage, cancelled_at: alreadyCancelled } = current.rows[0]
      if (alreadyCancelled) return { error: 409, message: 'Pedido já está cancelado.' }

      /* Pedido entregue não se cancela: a peça saiu e o dinheiro entrou.
         Registrar cancelamento aqui seria um erro que ninguém desfaz, e o
         pedido sumiria do Financeiro levando junto um recebimento real. */
      if (stage === 'entregue') {
        return {
          error: 409,
          message: 'Pedido já entregue não pode ser cancelado.',
        }
      }

      await client.query('UPDATE orders SET cancelled_at = now(), updated_at = now() WHERE id = $1', [
        req.params.id,
      ])

      // O estágio vai no payload porque a coluna preserva onde o pedido
      // estava, e "cancelado ainda na Venda" conta uma história diferente de
      // "cancelado já em Produção".
      await logEvent(client, {
        orderId: req.params.id,
        type: 'order_cancelled',
        payload: { stage },
        user: req.user.username,
      })
      return { ok: true }
    })

    if (cancelled.error === 404) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (cancelled.error) return res.status(cancelled.error).json({ error: cancelled.message })

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

router.patch(
  '/:id/uncancel',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const reopened = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT stage, cancelled_at FROM orders WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (current.rows.length === 0) return { error: 404 }
      if (!current.rows[0].cancelled_at)
        return { error: 409, message: 'Pedido não está cancelado.' }

      /* Volta para o mesmo estágio em que parou — é o que a coluna separada
         permite e um `stage = 'cancelado'` teria destruído. */
      await client.query('UPDATE orders SET cancelled_at = NULL, updated_at = now() WHERE id = $1', [
        req.params.id,
      ])

      await logEvent(client, {
        orderId: req.params.id,
        type: 'order_uncancelled',
        payload: { stage: current.rows[0].stage },
        user: req.user.username,
      })
      return { ok: true }
    })

    if (reopened.error === 404) return res.status(404).json({ error: 'Pedido não encontrado' })
    if (reopened.error) return res.status(reopened.error).json({ error: reopened.message })

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

export default router
