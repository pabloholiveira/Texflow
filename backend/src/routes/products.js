import { Router } from 'express'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getProductById, getNextStatus, getPreviousStatus } from '../db/ordersQueries.js'

const router = Router()

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const columnMap = {
      type: 'type',
      model: 'model',
      color: 'color',
      fabric: 'fabric',
      quantity: 'quantity',
      observations: 'observations',
      needsDesignRework: 'needs_design_rework',
    }
    const updates = Object.entries(req.body).filter(([key]) => key in columnMap)

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo válido para atualizar' })
    }

    const setClause = updates
      .map(([key], index) => `${columnMap[key]} = $${index + 1}`)
      .join(', ')
    const values = updates.map(([, value]) => value)

    const result = await pool.query(
      `UPDATE products SET ${setClause} WHERE id = $${values.length + 1} RETURNING id`,
      [...values, req.params.id]
    )

    if (result.rows.length === 0) return res.status(404).json({ error: 'Produto não encontrado' })

    res.json(await getProductById(pool, req.params.id))
  })
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    // ON DELETE CASCADE em product_workflow_steps e product_comments
    // (schema.sql) já cuida de limpar o que depende deste produto.
    const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id])
    if (result.rowCount === 0) return res.status(404).json({ error: 'Produto não encontrado' })
    res.status(204).send()
  })
)

router.put(
  '/:id/workflow',
  asyncHandler(async (req, res) => {
    const productId = req.params.id
    const desired = new Set(req.body.operations || [])

    // Espelha saveWorkflow (useProductList.js): só quem é realmente novo
    // entra como 'pending'; quem já existia mantém o status como está;
    // quem foi desmarcado é removido.
    const product = await withTransaction(async (client) => {
      const productCheck = await client.query('SELECT id FROM products WHERE id = $1', [productId])
      if (productCheck.rows.length === 0) return null

      const currentResult = await client.query(
        'SELECT step_name FROM product_workflow_steps WHERE product_id = $1',
        [productId]
      )
      const current = new Set(currentResult.rows.map((row) => row.step_name))

      const toAdd = [...desired].filter((step) => !current.has(step))
      const toRemove = [...current].filter((step) => !desired.has(step))

      for (const step of toAdd) {
        await client.query(
          'INSERT INTO product_workflow_steps (product_id, step_name, status) VALUES ($1, $2, $3)',
          [productId, step, 'pending']
        )
      }

      if (toRemove.length > 0) {
        await client.query(
          'DELETE FROM product_workflow_steps WHERE product_id = $1 AND step_name = ANY($2::text[])',
          [productId, toRemove]
        )
      }

      return getProductById(client, productId)
    })

    if (!product) return res.status(404).json({ error: 'Produto não encontrado' })
    res.json(product)
  })
)

router.patch(
  '/:id/workflow/:step',
  asyncHandler(async (req, res) => {
    const { id, step } = req.params
    const { direction } = req.body

    const current = await pool.query(
      'SELECT status FROM product_workflow_steps WHERE product_id = $1 AND step_name = $2',
      [id, step]
    )
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Etapa não encontrada para este produto' })
    }

    const nextStatus =
      direction === 'forward'
        ? getNextStatus(current.rows[0].status)
        : getPreviousStatus(current.rows[0].status)

    await pool.query(
      'UPDATE product_workflow_steps SET status = $1 WHERE product_id = $2 AND step_name = $3',
      [nextStatus, id, step]
    )

    res.json(await getProductById(pool, id))
  })
)

export default router
