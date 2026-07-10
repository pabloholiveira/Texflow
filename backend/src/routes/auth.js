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

export default router
