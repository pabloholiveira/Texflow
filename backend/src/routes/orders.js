import { Router } from 'express'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { fetchOrders, mapOrder, ORDER_STAGES } from '../db/ordersQueries.js'

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
      return updated.rows[0]
    })

    res.status(201).json(mapOrder(order, []))
  })
)

router.patch(
  '/:id',
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

    const result = await pool.query(
      `UPDATE orders SET ${setClause}, updated_at = now() WHERE id = $${values.length + 1} RETURNING id`,
      [...values, req.params.id]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

router.patch(
  '/:id/finalize',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      'UPDATE orders SET is_draft = false, updated_at = now() WHERE id = $1 RETURNING id',
      [req.params.id]
    )
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

router.patch(
  '/:id/advance-stage',
  asyncHandler(async (req, res) => {
    const current = await pool.query('SELECT stage FROM orders WHERE id = $1', [req.params.id])
    if (current.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' })

    const currentIndex = ORDER_STAGES.indexOf(current.rows[0].stage)
    const nextStage = ORDER_STAGES[currentIndex + 1]

    if (nextStage) {
      await withTransaction(async (client) => {
        await client.query(
          'UPDATE orders SET stage = $1, updated_at = now() WHERE id = $2',
          [nextStage, req.params.id]
        )

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
            await client.query(
              `INSERT INTO product_events (product_id, event_type, payload, created_by)
               VALUES ($1, 'design_status_changed', $2, $3)`,
              [
                row.id,
                JSON.stringify({ from: null, to: 'pendente', trigger: 'order-stage' }),
                req.user.username,
              ]
            )
          }
        }
      })
    }

    const [order] = await fetchOrders('WHERE id = $1', [req.params.id])
    res.json(order)
  })
)

export default router
