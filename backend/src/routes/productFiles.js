import { Router } from 'express'
import multer from 'multer'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { mapFile } from '../db/ordersQueries.js'
import { withTransaction } from '../db/withTransaction.js'
import { logEvent } from '../db/eventsQueries.js'
import { uploadBuffer, destroyByUrl } from '../services/cloudinary.js'
import { requireRole } from '../middleware/requireRole.js'
import { SALES_ROLES } from '../auth/permissions.js'

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
      `SELECT pf.* FROM product_files pf
        WHERE pf.product_id = $1
           OR pf.order_id = (SELECT order_id FROM products WHERE id = $1)
        ORDER BY pf.created_at`,
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

    const productCheck = await pool.query('SELECT id, order_id FROM products WHERE id = $1', [
      productId,
    ])
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Produto não encontrado' })
    }
    const orderId = productCheck.rows[0].order_id

    /* Quem é o dono depende da CATEGORIA (migration 0014): o layout aprovado
       é do pedido inteiro, então grava com product_id NULL e passa a valer
       para todas as peças; a referência continua do produto.

       A rota segue sendo /products/:productId/files mesmo para o layout: o
       produto é por onde a pessoa chega (ela está olhando uma peça), e daí
       sai o pedido. Uma rota separada obrigaria a tela de Design a saber de
       qual pedido é o card antes de subir, sem ganho nenhum. */
    const belongsToOrder = category === 'layout_aprovado'

    const uploaded = await uploadBuffer(req.file.buffer, {
      folder: `texflow/products/${productId}`,
    })

    const file = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO product_files (order_id, product_id, category, file_name, file_url, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          orderId,
          belongsToOrder ? null : productId,
          category,
          req.file.originalname,
          uploaded.secure_url,
          req.file.mimetype,
          uploadedBy || null,
        ]
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

// Excluir arquivo (2026-08-03). Até aqui a tabela era só-adiciona, mesmo
// precedente dos comentários — o que deixava um anexo errado na tela para
// sempre.
//
// SALES_ROLES é exatamente quem sobe arquivo hoje: a vendedora anexa a
// referência, o design anexa o layout aprovado, e o gerente acumula a
// vendedora. A produção CONSOME o layout, não o gerencia.
router.delete(
  '/:fileId',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { productId, fileId } = req.params

    /* Aceita tanto arquivo do produto quanto do pedido a que ele pertence.
       Para um layout, o :productId da URL é incidental — é só por onde a
       pessoa chegou —, mas continua servindo de escopo: impede apagar um
       arquivo de outro pedido informando um id qualquer. */
    const existing = await pool.query(
      `SELECT * FROM product_files
        WHERE id = $1
          AND (product_id = $2 OR order_id = (SELECT order_id FROM products WHERE id = $2))`,
      [fileId, productId]
    )
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Arquivo não encontrado' })
    }

    const file = existing.rows[0]

    // A ORDEM importa. Primeiro o banco (com o evento, na mesma transação),
    // só depois o Cloudinary:
    // - se o Cloudinary falhar, sobra um órfão lá — invisível, e limpável
    //   depois pelo mesmo roteiro dos 74 de 31/07;
    // - se fosse ao contrário e o banco falhasse, a tela ficaria mostrando um
    //   arquivo que não existe mais. Bem pior.
    await withTransaction(async (client) => {
      await client.query('DELETE FROM product_files WHERE id = $1', [fileId])

      await logEvent(client, {
        productId,
        type: 'file_deleted',
        payload: { category: file.category, fileName: file.file_name },
        user: req.user.username,
      })
    })

    // Fora da transação de propósito: é uma chamada de rede a outro serviço, e
    // segurar a transação aberta esperando por ela seria pior. Se falhar, o
    // registro já saiu do banco — que é o que a tela lê.
    try {
      await destroyByUrl(file.file_url)
    } catch {
      // Órfão no Cloudinary não justifica devolver erro a quem apagou: pra
      // pessoa a exclusão aconteceu, e aconteceu mesmo.
    }

    res.json({ id: Number(fileId) })
  })
)

export default router
