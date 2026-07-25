import { Router } from 'express'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getProductById, recalculateOrderTotal } from '../db/ordersQueries.js'
import { logEvent } from '../db/eventsQueries.js'

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
      const orderCheck = await client.query('SELECT id, stage FROM orders WHERE id = $1', [orderId])
      if (orderCheck.rows.length === 0) return null

      // Produto criado num pedido que já saiu de Venda entra direto na fila
      // de design (fluxo normal, não retrabalho) — senão ficaria invisível
      // pro designer. Ver gatilho 1 em orders.js/advance-stage.
      //
      // O teste aqui é "saiu de Venda", NÃO "está em Design": os gatilhos do
      // kanban de design avançam o estágio do pedido sozinhos, então quando
      // alguém adiciona um produto o pedido já pode ter passado para
      // Aprovação ou Produção. Enquanto isto checava stage === 'design', o
      // produto novo nascia fora da fila nesses dois casos e ninguém do
      // design ficava sabendo dele (relatado pelo Pablo em 2026-07-25).
      // Produto novo sempre precisa de arte — o designer nunca viu aquela
      // peça — e isso vale igual em qualquer estágio depois da venda.
      //
      // O estágio do pedido NÃO regride por causa disso (decisão do Pablo):
      // os outros produtos podem já estar em produção de verdade. Um pedido
      // em Aprovação, porém, deixa de avançar sozinho para Produção até o
      // produto novo concluir o design, porque o gatilho 2 exige TODOS os
      // produtos em 'concluido' — o freio sai de graça, sem regra nova.
      const entersDesignQueue = orderCheck.rows[0].stage !== 'venda'

      const inserted = await client.query(
        `INSERT INTO products
           (order_id, type, model, color, fabric, quantity, observations, unit_price, needs_vectorization, vectorization_price, design_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
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
          entersDesignQueue ? 'pendente' : null,
        ]
      )
      const productId = inserted.rows[0].id

      await logEvent(client, {
        orderId,
        productId,
        type: 'product_created',
        payload: { type, model, quantity, operations },
        user: req.user.username,
      })

      if (entersDesignQueue) {
        await logEvent(client, {
          orderId,
          productId,
          type: 'design_status_changed',
          payload: { from: null, to: 'pendente', trigger: 'order-stage' },
          user: req.user.username,
        })
      }

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
