import { Router } from 'express'
import bcrypt from 'bcrypt'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getUserOperations, setUserOperations } from '../db/usersQueries.js'
import { requireRole } from '../middleware/requireRole.js'
import { ROLES, ADMIN_ONLY } from '../auth/permissions.js'

const router = Router()

function isAdmin(req) {
  return req.user.role === 'admin'
}

function isSelf(req) {
  return String(req.user.id) === String(req.params.id)
}

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
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM users ORDER BY username')
    res.json(result.rows.map(mapUser))
  })
)

// Item 6: fila de pedidos de "esqueci minha senha". Estas três rotas
// precisam vir ANTES de '/:id' — o Express casa na ordem de declaração, e
// '/:id' engoliria '/password-reset-requests' lendo o caminho como um id.
// Mesma armadilha já registrada no App.jsx do front ('/pedidos/novo' antes
// de '/pedidos/:id').
//
// Senha padrão do reset (decisão do Pablo): aprovar devolve a senha para
// este valor, e a pessoa troca em Configurações > Minha Senha depois de
// entrar. O sistema NÃO obriga essa troca — não existe esse mecanismo.
const DEFAULT_PASSWORD = 'kavi2026'

router.get(
  '/password-reset-requests',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT r.id, r.status, r.created_at, u.username
         FROM password_reset_requests r
         JOIN users u ON u.id = r.user_id
        WHERE r.status = 'pendente'
        ORDER BY r.created_at`
    )
    res.json(
      rows.map((row) => ({
        id: row.id,
        username: row.username,
        status: row.status,
        createdAt: row.created_at,
      }))
    )
  })
)

router.patch(
  '/password-reset-requests/:requestId/approve',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

    // Trocar a senha e fechar o pedido na mesma transação: aprovar sem
    // trocar deixaria a pessoa esperando por algo que já foi "resolvido",
    // e trocar sem fechar deixaria o pedido para sempre na fila do admin.
    const result = await withTransaction(async (client) => {
      const found = await client.query(
        "SELECT user_id FROM password_reset_requests WHERE id = $1 AND status = 'pendente'",
        [req.params.requestId]
      )
      if (found.rows.length === 0) return null

      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
        passwordHash,
        found.rows[0].user_id,
      ])
      const updated = await client.query(
        `UPDATE password_reset_requests
            SET status = 'aprovado', resolved_at = now(), resolved_by = $1
          WHERE id = $2
        RETURNING id`,
        [req.user.username, req.params.requestId]
      )
      return updated.rows[0]
    })

    if (!result) {
      return res.status(404).json({ error: 'Pedido não encontrado ou já resolvido' })
    }

    // Devolve a senha padrão para a tela poder mostrá-la a quem aprovou —
    // é o admin que avisa a pessoa, então ele precisa saber qual é.
    res.json({ id: result.id, defaultPassword: DEFAULT_PASSWORD })
  })
)

router.patch(
  '/password-reset-requests/:requestId/reject',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const result = await pool.query(
      `UPDATE password_reset_requests
          SET status = 'recusado', resolved_at = now(), resolved_by = $1
        WHERE id = $2 AND status = 'pendente'
      RETURNING id`,
      [req.user.username, req.params.requestId]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pedido não encontrado ou já resolvido' })
    }
    res.json({ id: result.rows[0].id })
  })
)

// Admin vê qualquer um; qualquer pessoa vê a si mesma (é o que a seção
// "Minha Senha" precisa saber, sem exigir ser admin pra isso).
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!isAdmin(req) && !isSelf(req)) {
      return res.status(403).json({ error: 'Seu perfil não tem permissão para esta ação' })
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' })
    res.json(mapUser(result.rows[0]))
  })
)

// Etapas que este usuário de produção pode operar (migration 0005). Mesma
// regra de visibilidade do GET acima: admin vê de todos, cada um vê as suas.
router.get(
  '/:id/operations',
  asyncHandler(async (req, res) => {
    if (!isAdmin(req) && !isSelf(req)) {
      return res.status(403).json({ error: 'Seu perfil não tem permissão para esta ação' })
    }
    res.json(await getUserOperations(req.params.id))
  })
)

// Substitui a lista inteira de uma vez (a tela manda o conjunto final de
// checkboxes marcados) — ver setUserOperations. Só admin atribui.
router.put(
  '/:id/operations',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const { operationIds } = req.body

    if (!Array.isArray(operationIds)) {
      return res.status(400).json({ error: 'operationIds deve ser uma lista de ids' })
    }

    const target = await pool.query('SELECT id FROM users WHERE id = $1', [req.params.id])
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    await withTransaction((client) => setUserOperations(client, req.params.id, operationIds))
    res.json(await getUserOperations(req.params.id))
  })
)

// Edita `username` e `role` — troca de senha continua fora daqui (exige senha
// atual, então tem rota própria logo abaixo).
router.patch(
  '/:id',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const columnMap = { username: 'username', role: 'role' }
    const updates = Object.entries(req.body).filter(([key]) => key in columnMap)

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' })
    }

    if ('role' in req.body) {
      if (!ROLES.includes(req.body.role)) {
        return res.status(400).json({ error: `role deve ser um de: ${ROLES.join(', ')}` })
      }
      // Mesma proteção anti-tranca-fora do DELETE abaixo: um admin rebaixando
      // a si mesmo perderia na hora o acesso a esta própria tela, sem ninguém
      // pra desfazer. Rebaixar OUTRO admin segue permitido.
      if (isSelf(req)) {
        return res.status(400).json({ error: 'Não é possível trocar o próprio papel' })
      }
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
//   redefinição direta, mas agora só o admin pode fazer isso (antes dos
//   papéis por setor, bastava estar logado, porque todo autenticado era
//   'admin').
router.patch(
  '/:id/password',
  asyncHandler(async (req, res) => {
    const targetId = req.params.id
    const { currentPassword, newPassword } = req.body

    if (!isAdmin(req) && !isSelf(req)) {
      return res.status(403).json({ error: 'Seu perfil não tem permissão para esta ação' })
    }

    if (!newPassword || newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'newPassword é obrigatório e deve ter pelo menos 6 caracteres' })
    }

    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [targetId])
    const target = rows[0]
    if (!target) return res.status(404).json({ error: 'Usuário não encontrado' })

    if (isSelf(req)) {
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
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const targetId = req.params.id

    if (isSelf(req)) {
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
