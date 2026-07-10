import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

// Nunca inclui password_hash na resposta.
function mapUser(row) {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM users ORDER BY username')
    res.json(result.rows.map(mapUser))
  })
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' })
    res.json(mapUser(result.rows[0]))
  })
)

// Só edita `username` por enquanto — troca de senha é a Etapa 1.3 (exige
// senha atual, então merece sua própria rota em vez de entrar no columnMap
// genérico daqui).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const columnMap = { username: 'username' }
    const updates = Object.entries(req.body).filter(([key]) => key in columnMap)

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' })
    }

    const setClause = updates.map(([key], index) => `${columnMap[key]} = $${index + 1}`).join(', ')
    const values = updates.map(([, value]) => value)

    try {
      const result = await pool.query(
        `UPDATE users SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Usuário não encontrado' })
      }
      res.json(mapUser(result.rows[0]))
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Já existe um usuário com este username' })
      }
      throw err
    }
  })
)

// Soft delete (is_active = false), nunca DELETE FROM — ver comentário em
// schema.sql. Duas travas antes de desativar, pra não deixar o sistema sem
// nenhum jeito de logar de volta:
// 1. Não pode desativar a si mesmo (evita se trancar fora por engano).
// 2. Não pode desativar o último usuário ativo restante.
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const targetId = req.params.id

    if (String(req.user.id) === String(targetId)) {
      return res.status(400).json({ error: 'Não é possível desativar o próprio usuário' })
    }

    const { rows: activeUsers } = await pool.query(
      'SELECT id FROM users WHERE is_active = true'
    )
    if (activeUsers.length <= 1 && activeUsers.some((u) => String(u.id) === String(targetId))) {
      return res
        .status(400)
        .json({ error: 'Não é possível desativar o único usuário ativo restante' })
    }

    const result = await pool.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING *',
      [targetId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }
    res.json(mapUser(result.rows[0]))
  })
)

export default router
