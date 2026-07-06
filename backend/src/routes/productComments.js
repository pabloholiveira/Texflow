import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { mapComment } from '../db/ordersQueries.js'

// Montado em app.js como '/products/:productId/comments' — mergeParams
// permite ler req.params.productId aqui, mesmo essa rota sendo definida
// com um path próprio ('/'), sem :productId nele (mesmo padrão de
// orderProducts.js).
const router = Router({ mergeParams: true })

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    const result = await pool.query(
      'SELECT * FROM product_comments WHERE product_id = $1 ORDER BY created_at',
      [productId]
    )
    res.json(result.rows.map(mapComment))
  })
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    const { author, text } = req.body

    if (!author || !text) {
      return res.status(400).json({ error: 'author e text são obrigatórios' })
    }

    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [productId])
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    const result = await pool.query(
      'INSERT INTO product_comments (product_id, author, text) VALUES ($1, $2, $3) RETURNING *',
      [productId, author, text]
    )
    res.status(201).json(mapComment(result.rows[0]))
  })
)

export default router
