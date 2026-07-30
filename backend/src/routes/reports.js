import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/requireRole.js'
import { SALES_ROLES } from '../auth/permissions.js'

const router = Router()

router.get(
  '/avg-time-per-step',
  requireRole(...SALES_ROLES),
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
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    // Recorte: pedido que já saiu de Venda e ainda não foi entregue — o
    // mesmo "operacionalmente ativo" das telas de trabalho (isInWorkflow em
    // src/data/orderStages.js; processos separados, sem import compartilhado,
    // igual a ORDER_STAGES).
    //
    // Piso em Venda: desde a integração Design ↔ Produção (item 3.1),
    // produção roda em paralelo com design a partir daí, então é desse ponto
    // em diante que gargalo vira sinal real. Antes disso toda etapa está
    // 'pending' por definição — ninguém pode ter começado.
    //
    // Teto em Entregue: a trava de entrega só exige as etapas de CONFERÊNCIA
    // concluídas, não as de fabricação. Sem este filtro, um pedido entregue
    // com uma Costura que ninguém marcou como concluída apareceria em
    // "mais parados" para sempre, com o contador crescendo — gargalo é um
    // problema de hoje, e um pedido entregue não é mais de hoje.
    const volumeResult = await pool.query(`
      SELECT pws.step_name, pws.status, COUNT(*) AS total
      FROM product_workflow_steps pws
      JOIN products p ON p.id = pws.product_id
      JOIN orders o ON o.id = p.order_id
      WHERE o.is_draft = false AND o.stage NOT IN ('venda', 'entregue') AND pws.status != 'done'
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
      WHERE o.is_draft = false AND o.stage NOT IN ('venda', 'entregue') AND pws.status != 'done'
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

// Prazo real venda -> entrega. Só existe porque a migration 0009 passou a
// carimbar orders.picked_up_at ao avançar para 'entregue' (item 1 do roadmap
// de produção) — antes disso não havia como saber QUANDO o cliente retirou.
//
// MARCO INICIAL = orders.created_at, e vale entender por quê:
//   - `order_finalized` (o clique em "Finalizar Pedido") seria semanticamente
//     mais preciso, mas o evento só passou a ser gravado no item 3.3 e HOJE
//     NÃO EXISTE NENHUM no banco — o relatório sairia vazio.
//   - `created_at` é quando a vendedora abriu "Novo Pedido" (a tela cria o
//     rascunho na montagem). Distorção conhecida: se ela abrir e só finalizar
//     dias depois, a contagem começa cedo demais. Na prática o preenchimento
//     é na mesma sessão, e o desvio é pequeno perto de um ciclo de semanas.
//   - Misturar os dois (COALESCE do evento com o created_at) foi descartado:
//     daria uma média com dois significados diferentes dentro dela, pior que
//     um proxy consistente.
//
// Subtração de ::date (não de timestamp) porque a pergunta é "quantos dias",
// do jeito que uma pessoa conta — não frações de hora.
router.get(
  '/lead-time',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    // Agregado sobre TODOS os entregues; a tabela abaixo traz só os últimos
    // 20. Duas queries em vez de uma para o resumo continuar correto quando
    // houver centenas de entregas, sem mandar todas pela rede.
    const summaryResult = await pool.query(`
      SELECT
        COUNT(*) AS delivered_count,
        AVG(picked_up_at::date - created_at::date) AS avg_lead_days,
        MIN(picked_up_at::date - created_at::date) AS min_lead_days,
        MAX(picked_up_at::date - created_at::date) AS max_lead_days,
        COUNT(deadline) AS with_deadline_count,
        COUNT(*) FILTER (WHERE deadline IS NOT NULL AND picked_up_at::date <= deadline) AS on_time_count,
        COUNT(*) FILTER (WHERE deadline IS NOT NULL AND picked_up_at::date > deadline) AS late_count
      FROM orders
      WHERE is_draft = false AND picked_up_at IS NOT NULL
    `)

    const ordersResult = await pool.query(`
      SELECT
        id,
        order_number,
        client_id,
        created_at,
        deadline,
        picked_up_at,
        (picked_up_at::date - created_at::date) AS lead_days,
        -- Positivo = entregue depois do prazo; negativo = adiantado; NULL
        -- quando o pedido nunca teve prazo definido.
        CASE WHEN deadline IS NULL THEN NULL
             ELSE (picked_up_at::date - deadline) END AS days_vs_deadline
      FROM orders
      WHERE is_draft = false AND picked_up_at IS NOT NULL
      ORDER BY picked_up_at DESC
      LIMIT 20
    `)

    const s = summaryResult.rows[0]

    res.json({
      summary: {
        deliveredCount: Number(s.delivered_count),
        // AVG devolve NUMERIC (string no node-pg) e é NULL sem nenhuma linha —
        // mesma armadilha de tipo já documentada em ordersQueries.toNumber.
        avgLeadDays: s.avg_lead_days === null ? null : Number(s.avg_lead_days),
        minLeadDays: s.min_lead_days === null ? null : Number(s.min_lead_days),
        maxLeadDays: s.max_lead_days === null ? null : Number(s.max_lead_days),
        withDeadlineCount: Number(s.with_deadline_count),
        onTimeCount: Number(s.on_time_count),
        lateCount: Number(s.late_count),
      },
      orders: ordersResult.rows.map((row) => ({
        id: row.id,
        orderNumber: row.order_number,
        // clientId cru, não o nome montado no SQL: getClientDisplayName
        // (src/data/clients.js) é o único lugar que decide o que exibir de um
        // cliente, e replicar aquele COALESCE aqui criaria um segundo dono
        // da mesma regra.
        clientId: row.client_id,
        createdAt: row.created_at,
        deadline: row.deadline,
        pickedUpAt: row.picked_up_at,
        leadDays: Number(row.lead_days),
        daysVsDeadline: row.days_vs_deadline === null ? null : Number(row.days_vs_deadline),
      })),
    })
  })
)

export default router
