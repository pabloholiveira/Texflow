import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Duplicado em src/utils/whatsapp.js do front-end (processo Node separado,
// sem import compartilhado) — mesma razão do ORDER_STAGES duplicado entre
// backend/frontend. Só usado como valor inicial antes de qualquer PUT.
const DEFAULT_WHATSAPP_TEMPLATE = `Olá! Aqui estão os detalhes do seu pedido *{{pedido}}*:

Produtos:
{{produtos}}

Valor total: {{valorTotal}}
Valor pago: {{valorPago}}
Falta pagar na retirada: {{faltaPagar}}

Prazo de entrega: {{prazo}}`

router.get(
  '/whatsapp-template',
  asyncHandler(async (req, res) => {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'whatsapp_template'")
    res.json({ value: result.rows[0]?.value ?? DEFAULT_WHATSAPP_TEMPLATE })
  })
)

router.put(
  '/whatsapp-template',
  asyncHandler(async (req, res) => {
    const { value } = req.body
    if (!value) return res.status(400).json({ error: 'value é obrigatório' })

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('whatsapp_template', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [value]
    )
    res.json({ value })
  })
)

export default router
