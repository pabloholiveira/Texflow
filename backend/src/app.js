import express from 'express'
import cors from 'cors'
import { pool } from './db/pool.js'
import ordersRouter from './routes/orders.js'
import orderProductsRouter from './routes/orderProducts.js'
import productsRouter from './routes/products.js'
import productCommentsRouter from './routes/productComments.js'
import productFilesRouter from './routes/productFiles.js'
import clientsRouter from './routes/clients.js'
import operationsRouter from './routes/operations.js'

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1')
      res.json({ status: 'ok', database: 'connected' })
    } catch {
      res.status(503).json({ status: 'degraded', database: 'unavailable' })
    }
  })

  // Path mais específico primeiro, mesma regra já seguida nas rotas do
  // front-end (App.jsx) para não deixar um path genérico "engolir" outro.
  app.use('/orders/:orderId/products', orderProductsRouter)
  app.use('/orders', ordersRouter)
  app.use('/products/:productId/comments', productCommentsRouter)
  app.use('/products/:productId/files', productFilesRouter)
  app.use('/products', productsRouter)
  app.use('/clients', clientsRouter)
  app.use('/operations', operationsRouter)

  // Middleware de erro: precisa ser o último app.use e ter 4 argumentos —
  // é assim que o Express reconhece que é um error handler, não uma rota.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  })

  return app
}
