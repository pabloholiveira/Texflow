import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM operations ORDER BY id')
    res.json(
      result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        position: row.sequence_position,
      }))
    )
  })
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, position = null } = req.body
    if (!name) return res.status(400).json({ error: 'name é obrigatório' })

    try {
      const result = await pool.query(
        'INSERT INTO operations (name, sequence_position) VALUES ($1, $2) RETURNING *',
        [name, position]
      )
      res.status(201).json({
        id: result.rows[0].id,
        name: result.rows[0].name,
        position: result.rows[0].sequence_position,
      })
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
  asyncHandler(async (req, res) => {
    const result = await pool.query('DELETE FROM operations WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Operação não encontrada' })
    res.status(204).send()
  })
)

export default router
