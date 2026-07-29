import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/requireRole.js'
import { SALES_ROLES } from '../auth/permissions.js'

const router = Router()

function mapClient(row) {
  return {
    id: row.id,
    personName: row.person_name,
    companyName: row.company_name,
    document: row.document,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
  }
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM clients ORDER BY person_name')
    res.json(result.rows.map(mapClient))
  })
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id])
    if (result.rows.length === 0) return res.status(404).json({ error: 'Cliente não encontrado' })
    res.json(mapClient(result.rows[0]))
  })
)

router.patch(
  '/:id',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const columnMap = {
      personName: 'person_name',
      companyName: 'company_name',
      document: 'document',
      phone: 'phone',
      email: 'email',
    }
    const updates = Object.entries(req.body).filter(([key]) => key in columnMap)

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' })
    }

    const setClause = updates
      .map(([key], index) => `${columnMap[key]} = $${index + 1}`)
      .join(', ')
    const values = updates.map(([, value]) => value)

    try {
      const result = await pool.query(
        `UPDATE clients SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
        [...values, req.params.id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Cliente não encontrado' })
      }
      res.json(mapClient(result.rows[0]))
    } catch (err) {
      // Mesma regra do POST: document tem UNIQUE no banco, então editar pro
      // documento de outro cliente já cadastrado cai aqui.
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Já existe um cliente com este documento' })
      }
      throw err
    }
  })
)

router.post(
  '/',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { personName, companyName = null, document, phone, email = null } = req.body

    if (!personName || !document || !phone) {
      return res.status(400).json({ error: 'personName, document e phone são obrigatórios' })
    }

    try {
      const result = await pool.query(
        `INSERT INTO clients (person_name, company_name, document, phone, email)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [personName, companyName, document, phone, email]
      )
      res.status(201).json(mapClient(result.rows[0]))
    } catch (err) {
      // 23505 = unique_violation — já existe um cliente com esse `document`
      // (mesma regra que hoje é um `alert()` na tela de Clientes).
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Já existe um cliente com este documento' })
      }
      throw err
    }
  })
)

// Espelha findOrCreateClient do ClientsProvider: casa só por `document`
// (nunca por telefone — números podem ser compartilhados entre pessoas,
// documento não; decisão já registrada no CLAUDE.md). Cria um cliente novo
// só se não achar nenhum com esse documento.
router.post(
  '/find-or-create',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { personName, companyName = null, document, phone, email = null } = req.body

    if (!document) {
      return res.status(400).json({ error: 'document é obrigatório' })
    }

    const existing = await pool.query('SELECT * FROM clients WHERE document = $1', [document])
    if (existing.rows.length > 0) {
      return res.json(mapClient(existing.rows[0]))
    }

    if (!personName || !phone) {
      return res
        .status(400)
        .json({ error: 'personName e phone são obrigatórios para criar um cliente novo' })
    }

    try {
      const created = await pool.query(
        `INSERT INTO clients (person_name, company_name, document, phone, email)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [personName, companyName, document, phone, email]
      )
      res.status(201).json(mapClient(created.rows[0]))
    } catch (err) {
      // Corrida rara: duas requisições fizeram o SELECT antes de qualquer
      // uma inserir. Quem perder a corrida do UNIQUE só busca de novo e
      // devolve o registro que a outra acabou de criar, em vez de dar 500.
      if (err.code === '23505') {
        const raceExisting = await pool.query('SELECT * FROM clients WHERE document = $1', [
          document,
        ])
        return res.json(mapClient(raceExisting.rows[0]))
      }
      throw err
    }
  })
)

export default router
