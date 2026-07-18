import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { mapFile } from '../db/ordersQueries.js'
import { withTransaction } from '../db/withTransaction.js'
import { logEvent } from '../db/eventsQueries.js'
import { uploadBuffer } from '../services/cloudinary.js'

// Montado em app.js como '/products/:productId/files' — mesmo padrão de
// productComments.js (mergeParams pra ler req.params.productId).
const router = Router({ mergeParams: true })

// memoryStorage: o arquivo nunca toca o disco do container (que no Railway
// é efêmero de qualquer forma) — fica só em memória até ser repassado pro
// Cloudinary via stream.
const upload = multer({ storage: multer.memoryStorage() })

const CATEGORIES = ['referencia', 'layout_aprovado']

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    const result = await pool.query(
      'SELECT * FROM product_files WHERE product_id = $1 ORDER BY created_at',
      [productId]
    )
    res.json(result.rows.map(mapFile))
  })
)

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const { productId } = req.params
    const { category, uploadedBy } = req.body

    if (!req.file) {
      return res.status(400).json({ error: 'file é obrigatório' })
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ error: `category deve ser um de: ${CATEGORIES.join(', ')}` })
    }

    const productCheck = await pool.query('SELECT id FROM products WHERE id = $1', [productId])
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }

    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: `texflow/products/${productId}`,
    })

    const file = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO product_files (product_id, category, file_name, file_url, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [productId, category, req.file.originalname, uploaded.secure_url, req.file.mimetype, uploadedBy || null]
      )

      await logEvent(client, {
        productId,
        type: 'file_uploaded',
        payload: { category, fileName: req.file.originalname },
        user: req.user.username,
      })

      return result.rows[0]
    })

    res.status(201).json(mapFile(file))
  })
)

export default router
