import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/requireRole.js'
import { ADMIN_ONLY } from '../auth/permissions.js'

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

// Segunda mensagem (item 2, parte 2): avisar o cliente que o pedido
// terminou a Conferência e está pronto para retirada. Usa os mesmos
// {{placeholders}} da primeira — quem substitui é buildWhatsAppMessage.
const DEFAULT_WHATSAPP_READY_TEMPLATE = `Olá! Seu pedido *{{pedido}}* está pronto para retirada. 🎉

Produtos:
{{produtos}}

Valor total: {{valorTotal}}
Valor pago: {{valorPago}}
Falta pagar na retirada: {{faltaPagar}}`

router.get(
  '/whatsapp-ready-template',
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      "SELECT value FROM settings WHERE key = 'whatsapp_ready_template'"
    )
    res.json({ value: result.rows[0]?.value ?? DEFAULT_WHATSAPP_READY_TEMPLATE })
  })
)

router.put(
  '/whatsapp-ready-template',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const { value } = req.body
    if (!value) return res.status(400).json({ error: 'value é obrigatório' })

    await pool.query(
      `INSERT INTO settings (key, value) VALUES ('whatsapp_ready_template', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [value]
    )
    res.json({ value })
  })
)

router.get(
  '/whatsapp-template',
  asyncHandler(async (req, res) => {
    const result = await pool.query("SELECT value FROM settings WHERE key = 'whatsapp_template'")
    res.json({ value: result.rows[0]?.value ?? DEFAULT_WHATSAPP_TEMPLATE })
  })
)

router.put(
  '/whatsapp-template',
  requireRole(...ADMIN_ONLY),
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
