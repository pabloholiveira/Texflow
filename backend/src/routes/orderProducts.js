import { Router } from 'express'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getProductById, recalculateOrderTotal } from '../db/ordersQueries.js'

// Montado em app.js como '/orders/:orderId/products' — mergeParams é o
// que permite ler req.params.orderId aqui dentro, já que essa rota é
// definida com um path próprio ('/'), sem :orderId nele.
const router = Router({ mergeParams: true })

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { orderId } = req.params
    const {
      type,
      model,
      color,
      fabric,
      quantity,
      observations,
      operations = [],
      unitPrice = null,
      needsVectorization = false,
      vectorizationPrice = null,
    } = req.body

    if (!type || !quantity) {
      return res.status(400).json({ error: 'type e quantity são obrigatórios' })
    }

    const result = await withTransaction(async (client) => {
      const orderCheck = await client.query('SELECT id FROM orders WHERE id = $1', [orderId])
      if (orderCheck.rows.length === 0) return null

      const inserted = await client.query(
        `INSERT INTO products
           (order_id, type, model, color, fabric, quantity, observations, unit_price, needs_vectorization, vectorization_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          orderId,
          type,
          model,
          color,
          fabric,
          quantity,
          observations,
          unitPrice,
          needsVectorization,
          vectorizationPrice,
        ]
      )
      const productId = inserted.rows[0].id

      // Operações escolhidas na criação sempre entram como 'pending' —
      // é uma decisão de venda (quais operações), não de produção
      // (status de cada uma) — ver domain model no CLAUDE.md.
      for (const step of operations) {
        await client.query(
          'INSERT INTO product_workflow_steps (product_id, step_name, status) VALUES ($1, $2, $3)',
          [productId, step, 'pending']
        )
      }

      const orderTotalValue = await recalculateOrderTotal(client, orderId)
      return { product: await getProductById(client, productId), orderTotalValue }
    })

    if (!result) return res.status(404).json({ error: 'Pedido não encontrado' })
    res.status(201).json({ ...result.product, orderTotalValue: result.orderTotalValue })
  })
)

export default router
