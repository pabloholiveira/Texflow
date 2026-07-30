import { Router } from 'express'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { fetchOrders, mapOrder, ORDER_STAGES } from '../db/ordersQueries.js'
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
      const result = await client.query(
        `UPDATE orders SET ${setClause}, updated_at = now() WHERE id = $${values.length + 1} RETURNING id`,
        [...values, req.params.id]
      )
      if (result.rows.length === 0) return null

      // Registrar pagamento e editar o pedido usam a mesma rota, mas são
      // acontecimentos diferentes na linha do tempo — o modal de pagamento
      // manda só amountPaid, o de edição manda clientId/deadline.
      const changedFields = updates.map(([key]) => key)
      const isPayment = changedFields.length === 1 && changedFields[0] === 'amountPaid'

      await logEvent(client, {
        orderId: req.params.id,
        type: isPayment ? 'payment_registered' : 'order_updated',
        payload: isPayment
          ? { amountPaid: req.body.amountPaid }
          : { fields: changedFields },
        user: req.user.username,
      })

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
    const current = await pool.query('SELECT stage FROM orders WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

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
    const current = await pool.query('SELECT stage FROM orders WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

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

export default router
