import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/requireRole.js'
import { ADMIN_ONLY } from '../auth/permissions.js'

const router = Router()

function mapOperation(row) {
  return {
    id: row.id,
    name: row.name,
    position: row.sequence_position,
    phase: row.phase,
    autoAdd: row.auto_add,
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    // Ordena pela sequência de produção, não por id: a ordem em que as
    // operações foram cadastradas não diz nada, e as abas de Produção e de
    // Conferência saem daqui. Na Conferência isso é gritante — Lavagem (3)
    // precisa vir antes de Revisão/Finalização (4), mas Revisão tem id menor
    // porque foi semeada antes. Sem posição vai para o fim, id desempata.
    const result = await pool.query(
      'SELECT * FROM operations ORDER BY sequence_position NULLS LAST, id'
    )
    res.json(result.rows.map(mapOperation))
  })
)

router.post(
  '/',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const { name, position = null, phase = 'producao', autoAdd = false } = req.body
    if (!name) return res.status(400).json({ error: 'name é obrigatório' })
    if (!['producao', 'conferencia'].includes(phase)) {
      return res.status(400).json({ error: "phase deve ser 'producao' ou 'conferencia'" })
    }

    try {
      const result = await pool.query(
        `INSERT INTO operations (name, sequence_position, phase, auto_add)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, position, phase, autoAdd]
      )
      res.status(201).json(mapOperation(result.rows[0]))
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Essa operação já existe' })
      }
      throw err
    }
  })
)

// Remove por id, não por nome: nomes de operação como "Revisão/Finalização"
// têm uma barra — usar o nome cru como parâmetro de rota quebraria o
// roteamento, já que o Express trata "/" como separador de path.
router.delete(
  '/:id',
  requireRole(...ADMIN_ONLY),
  asyncHandler(async (req, res) => {
    const result = await pool.query('DELETE FROM operations WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Operação não encontrada' })
    res.status(204).send()
  })
)

export default router
