import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get(
  '/avg-time-per-step',
  asyncHandler(async (req, res) => {
    // Como o status só anda em sequência estrita (pending -> in_progress ->
    // done, podendo voltar), o evento imediatamente anterior a um 'done' é
    // sempre o 'in_progress' que iniciou aquela etapa — LAG() pareia os dois
    // por workflow_step_id, ordenado no tempo.
    const { rows } = await pool.query(`
      WITH ordered_events AS (
        SELECT
          workflow_step_id,
          to_status,
          changed_at,
          LAG(to_status) OVER (PARTITION BY workflow_step_id ORDER BY changed_at) AS prev_to_status,
          LAG(changed_at) OVER (PARTITION BY workflow_step_id ORDER BY changed_at) AS prev_changed_at
        FROM product_workflow_events
      ),
      durations AS (
        SELECT
          pws.step_name,
          EXTRACT(EPOCH FROM (oe.changed_at - oe.prev_changed_at)) AS duration_seconds
        FROM ordered_events oe
        JOIN product_workflow_steps pws ON pws.id = oe.workflow_step_id
        WHERE oe.to_status = 'done' AND oe.prev_to_status = 'in_progress'
      )
      SELECT step_name, AVG(duration_seconds) AS avg_seconds, COUNT(*) AS completions
      FROM durations
      GROUP BY step_name
      ORDER BY step_name
    `)

    res.json(
      rows.map((row) => ({
        step: row.step_name,
        avgHours: Number(row.avg_seconds) / 3600,
        completions: Number(row.completions),
      }))
    )
  })
)

router.get(
  '/bottlenecks',
  asyncHandler(async (req, res) => {
    // Só pedidos que já saíram de Venda — desde a integração Design ↔
    // Produção (item 3.1), produção roda em paralelo com design a partir
    // daí, então é desse ponto em diante que gargalo vira sinal real.
    // Pedidos ainda em Venda ficam de fora (toda etapa 'pending' por
    // definição, ninguém pode ter começado).
    const volumeResult = await pool.query(`
      SELECT pws.step_name, pws.status, COUNT(*) AS total
      FROM product_workflow_steps pws
      JOIN products p ON p.id = pws.product_id
      JOIN orders o ON o.id = p.order_id
      WHERE o.is_draft = false AND o.stage != 'venda' AND pws.status != 'done'
      GROUP BY pws.step_name, pws.status
      ORDER BY pws.step_name
    `)

    const volumeByStep = {}
    for (const row of volumeResult.rows) {
      volumeByStep[row.step_name] ??= { step: row.step_name, pending: 0, inProgress: 0 }
      if (row.status === 'pending') volumeByStep[row.step_name].pending = Number(row.total)
      if (row.status === 'in_progress') volumeByStep[row.step_name].inProgress = Number(row.total)
    }

    // "since" = quando a etapa entrou no status atual (último evento) ou,
    // se nunca mudou de status, quando foi criada (created_at) — a mesma
    // referência usada em product_workflow_steps.created_at.
    const stuckResult = await pool.query(`
      SELECT
        pws.step_name,
        pws.status,
        o.order_number,
        p.type AS product_type,
        COALESCE(last_event.changed_at, pws.created_at) AS since
      FROM product_workflow_steps pws
      JOIN products p ON p.id = pws.product_id
      JOIN orders o ON o.id = p.order_id
      LEFT JOIN LATERAL (
        SELECT changed_at FROM product_workflow_events pwe
        WHERE pwe.workflow_step_id = pws.id
        ORDER BY changed_at DESC
        LIMIT 1
      ) last_event ON true
      WHERE o.is_draft = false AND o.stage != 'venda' AND pws.status != 'done'
      ORDER BY since ASC
      LIMIT 10
    `)

    res.json({
      volumeByStep: Object.values(volumeByStep),
      stuckProducts: stuckResult.rows.map((row) => ({
        step: row.step_name,
        status: row.status,
        orderNumber: row.order_number,
        productType: row.product_type,
        since: row.since,
      })),
    })
  })
)

export default router
