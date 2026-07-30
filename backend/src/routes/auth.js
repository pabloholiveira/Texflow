import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username])
    const user = rows[0]

    // Mesma mensagem genérica em todos os casos (usuário não existe, senha
    // errada ou conta desativada via DELETE /users/:id) — não dar a dica de
    // qual foi o motivo.
    if (!user || !user.is_active || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({ token, user: { id: user.id, username: user.username, role: user.role } })
  })
)

// Item 6: pedido de reset de senha. Fica em auth.js de propósito — é o
// único router montado ANTES do requireAuth (junto com /health), e tem que
// ser assim: quem esqueceu a senha não consegue se autenticar para pedir.
//
// Responde 200 genérico mesmo quando o usuário não existe ou está inativo,
// pela mesma razão do login logo acima: não confirmar para um estranho
// quais usernames existem. O ON CONFLICT casa com o índice parcial
// (um pendente por usuário) — pedir de novo não duplica nem dá erro.
router.post(
  '/password-reset-request',
  asyncHandler(async (req, res) => {
    const { username } = req.body

    if (!username) {
      return res.status(400).json({ error: 'Informe o usuário' })
    }

    const { rows } = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND is_active = true',
      [username]
    )

    if (rows.length > 0) {
      await pool.query(
        `INSERT INTO password_reset_requests (user_id) VALUES ($1)
         ON CONFLICT DO NOTHING`,
        [rows[0].id]
      )
    }

    res.json({
      message: 'Pedido registrado. Avise um administrador para liberar sua senha.',
    })
  })
)

export default router
