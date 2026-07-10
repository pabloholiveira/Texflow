import { Router } from 'express'
import bcrypt from 'bcrypt'
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

// Item 1.3 do roadmap (CLAUDE.md): duas situações na mesma rota, porque a
// regra de negócio muda conforme quem está trocando —
// - Trocando a própria senha (id === req.user.id): exige currentPassword e
//   confere com bcrypt.compare antes de aceitar a nova.
// - Redefinindo a senha de outro usuário: não exige currentPassword — é uma
//   redefinição direta (o sistema é uso interno, sem papéis por setor ainda
//   — hoje todo autenticado é 'admin' — então não há verificação extra de
//   permissão além de "estar logado", mesma limitação já registrada no
//   restante do CLAUDE.md sobre a role única).
router.patch(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const targetId = req.params.id
    const { currentPassword, newPassword } = req.body

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'newPassword é obrigatório e deve ter pelo menos 6 caracteres' })
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [targetId])
    const target = rows[0]
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' })

    const isSelf = String(req.user.id) === String(targetId)
    if (isSelf) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ error: 'currentPassword é obrigatório para trocar a própria senha' })
      }
      const matches = await bcrypt.compare(currentPassword, target.password_hash)
      if (!matches) {
        // 403, não 401: um 401 fora de /auth/login é tratado pelo front
        // (src/services/api.js) como sessão expirada e desloga na hora — a
        // pessoa está autenticada normalmente, só errou a senha atual.
        return res.status(403).json({ error: 'Senha atual incorreta' })
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      targetId,
    ])
    res.json(mapUser(target))
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
