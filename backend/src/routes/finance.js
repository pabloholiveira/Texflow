import { Router } from 'express'
import { pool } from '../db/pool.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { requireRole } from '../middleware/requireRole.js'
import { FINANCE_ROLES } from '../auth/permissions.js'

/* Visão financeira (2026-08-04). É um RELATÓRIO SOBRE VENDAS E RECEBIMENTOS,
   não um sistema financeiro: sem contas a pagar, sem despesas, sem DRE, sem
   nota fiscal. Mantém a fronteira declarada no topo do CLAUDE.md — o TexFlow
   controla fluxo de produção, e o dinheiro só aparece na medida em que já
   passa por ele (total_value, amount_paid).

   Só admin (FINANCE_ROLES). O gerente fica de fora por decisão explícita do
   Pablo, mesmo acumulando vendedora + produção.

   VENDIDO != RECEBIDO, e os nomes aqui levam isso a sério: `sold` sai de
   orders.total_value (o que foi combinado com o cliente) e `received` sai de
   orders.amount_paid (o que efetivamente entrou). Misturar os dois num campo
   chamado "receita" seria o erro mais fácil de cometer nesta tela.

   POR QUE A SÉRIE MENSAL É POR DATA DO PEDIDO, e não por data do pagamento:
   até 2026-08-04 o sistema não guardava quando cada pagamento entrou — o
   evento de pagamento só gravava o acumulado, e o pagamento feito na própria
   venda nem virava evento. Isso foi corrigido, mas só vale daqui para
   frente. A série de RECEBIMENTO por mês é a entrega 3, quando houver dado. */

const router = Router()

/* created_at é `timestamp without time zone` preenchido por now() num banco
   em UTC (conferido: Etc/UTC), e a Kavi opera em UTC-3. Sem converter, um
   pedido feito 31/07 às 21h30 no Brasil está gravado como 01/08 00h30 e
   entraria no mês seguinte. São 3 horas de atribuição errada em toda virada
   de mês — é a terceira vez que UTC morde neste projeto, depois do type
   parser de DATE e do T00:00:00 no prazo de entrega. */
const LOCAL_CREATED_AT = `(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`

// Rascunho nunca entra em número de dinheiro: é pedido que a vendedora pode
// abandonar pela metade, e /pedidos/novo cria um a cada visita.
const REAL_ORDERS = 'NOT o.is_draft'

router.get(
  '/overview',
  requireRole(...FINANCE_ROLES),
  asyncHandler(async (req, res) => {
    // 'YYYY-MM'; sem o parâmetro, o mês corrente no fuso do Brasil.
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null

    const [totals, monthly, byType, byClient, openOrders] = await Promise.all([
      /* Números do MOMENTO, não de um mês: "a receber" é uma dívida que
         existe hoje, e amarrá-la a um mês não faria sentido — um pedido de
         julho ainda em aberto continua sendo dinheiro a receber em agosto. */
      pool.query(`
        SELECT
          COALESCE(SUM(o.total_value), 0) AS sold_total,
          COALESCE(SUM(o.amount_paid), 0) AS received_total,
          COALESCE(SUM(o.total_value - o.amount_paid) FILTER (WHERE o.amount_paid < o.total_value), 0) AS outstanding,
          COUNT(*) FILTER (WHERE o.amount_paid < o.total_value) AS open_count
        FROM orders o
        WHERE ${REAL_ORDERS}
      `),

      // Série dos últimos 12 meses, para a tela comparar mês a mês sem uma
      // requisição por mês.
      pool.query(`
        SELECT
          to_char(date_trunc('month', ${LOCAL_CREATED_AT}), 'YYYY-MM') AS month,
          COUNT(*) AS orders,
          COALESCE(SUM(o.total_value), 0) AS sold,
          COALESCE(SUM(o.amount_paid), 0) AS received
        FROM orders o
        WHERE ${REAL_ORDERS}
          AND ${LOCAL_CREATED_AT} >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '11 months'
        GROUP BY 1
        ORDER BY 1
      `),

      /* Por tipo de produto: unit_price * quantity, e NÃO um rateio de
         total_value — o total do pedido inclui vetorização, que não pertence
         a nenhum tipo de peça. Produto sem preço fica de fora da soma em vez
         de entrar como zero e diluir a média. */
      pool.query(
        `
        SELECT
          p.type,
          COALESCE(SUM(p.unit_price * p.quantity), 0) AS sold,
          SUM(p.quantity) AS pieces,
          COUNT(*) AS products
        FROM products p
        JOIN orders o ON o.id = p.order_id
        WHERE ${REAL_ORDERS}
          AND p.unit_price IS NOT NULL
          AND ($1::text IS NULL OR to_char(date_trunc('month', ${LOCAL_CREATED_AT}), 'YYYY-MM') = $1)
        GROUP BY p.type
        ORDER BY sold DESC
      `,
        [month]
      ),

      /* Devolve client_id CRU, nunca o nome montado em SQL. getClientDisplayName
         (src/data/clients.js) é o único lugar que decide o que se exibe de um
         cliente, e o COALESCE daqui erraria: company_name está gravado como
         string vazia, não NULL, e COALESCE só pula NULL — a sondagem feita no
         planejamento devolveu nome em branco exatamente por isso. */
      pool.query(`
        SELECT
          o.client_id,
          COUNT(*) AS orders,
          COALESCE(SUM(o.total_value), 0) AS sold,
          COALESCE(SUM(o.amount_paid), 0) AS received,
          COALESCE(SUM(o.total_value - o.amount_paid), 0) AS outstanding
        FROM orders o
        WHERE ${REAL_ORDERS} AND o.client_id IS NOT NULL
        GROUP BY o.client_id
        ORDER BY sold DESC
      `),

      // Quem deve, pedido a pedido — "a receber" sem os nomes vira um número
      // que ninguém sabe cobrar.
      pool.query(`
        SELECT
          o.id, o.order_number, o.client_id, o.stage, o.deadline,
          o.total_value, o.amount_paid,
          (o.total_value - o.amount_paid) AS outstanding
        FROM orders o
        WHERE ${REAL_ORDERS} AND o.amount_paid < o.total_value
        ORDER BY outstanding DESC
      `),
    ])

    const num = (value) => Number(value ?? 0)

    res.json({
      month,
      totals: {
        sold: num(totals.rows[0].sold_total),
        received: num(totals.rows[0].received_total),
        outstanding: num(totals.rows[0].outstanding),
        openOrders: Number(totals.rows[0].open_count),
      },
      monthly: monthly.rows.map((row) => ({
        month: row.month,
        orders: Number(row.orders),
        sold: num(row.sold),
        received: num(row.received),
      })),
      byType: byType.rows.map((row) => ({
        type: row.type,
        sold: num(row.sold),
        pieces: Number(row.pieces),
        products: Number(row.products),
      })),
      byClient: byClient.rows.map((row) => ({
        /* client_id é bigint, e o node-pg devolve bigint como STRING. O
           resto da API repassa cru (mapOrder, rota de clientes), então o
           front compara string com string. Converter para Number aqui
           quebrava getClientNameById em silêncio: a busca por igualdade
           estrita não casava e TODA linha saía "Cliente não informado". */
        clientId: row.client_id,
        orders: Number(row.orders),
        sold: num(row.sold),
        received: num(row.received),
        outstanding: num(row.outstanding),
      })),
      openOrders: openOrders.rows.map((row) => ({
        // Ids crus pelo mesmo motivo do byClient acima.
        id: row.id,
        orderNumber: row.order_number,
        clientId: row.client_id,
        stage: row.stage,
        deadline: row.deadline,
        totalValue: num(row.total_value),
        amountPaid: num(row.amount_paid),
        outstanding: num(row.outstanding),
      })),
    })
  })
)

export default router
