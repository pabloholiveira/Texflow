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

   DUAS SÉRIES MENSAIS, com significados diferentes e de propósito:
   `sold` é por DATA DO PEDIDO (orders.created_at) e `received` é por DATA DO
   PAGAMENTO (soma dos deltas em product_events). Um pedido de julho pago em
   agosto aparece em julho na primeira e em agosto na segunda.

   O recebimento por mês só existe a partir de 04/08/2026: antes disso o
   evento de pagamento gravava apenas o acumulado, e o pagamento feito na
   própria venda nem virava evento. Os meses anteriores vêm com `received:
   null` — "não sabemos", que é diferente de "não entrou nada". */

const router = Router()

/* created_at é `timestamp without time zone` preenchido por now() num banco
   em UTC (conferido: Etc/UTC), e a Kavi opera em UTC-3. Sem converter, um
   pedido feito 31/07 às 21h30 no Brasil está gravado como 01/08 00h30 e
   entraria no mês seguinte. São 3 horas de atribuição errada em toda virada
   de mês — é a terceira vez que UTC morde neste projeto, depois do type
   parser de DATE e do T00:00:00 no prazo de entrega. */
const LOCAL_CREATED_AT = `(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')`

/* Rascunho nunca entra em número de dinheiro: é pedido que a vendedora pode
   abandonar pela metade, e /pedidos/novo cria um a cada visita.

   Cancelado também fica FORA DE TUDO — vendido, a receber e recebido —, por
   decisão do Pablo (2026-08-05). Consequência aceita e registrada: se o
   cliente pagou e o pedido foi cancelado depois, esse dinheiro some do
   relatório sem que nenhuma devolução tenha sido registrada, porque o
   TexFlow não modela devolução. */
const REAL_ORDERS = 'NOT o.is_draft AND o.cancelled_at IS NULL'

/* Janelas do filtro de período dos cartões do topo (2026-08-05).

   Mapa fechado, e não interpolação do que vem na query string: o valor
   entra direto no SQL, então aceitar texto livre aqui seria injeção.
   Chave desconhecida cai em 'all', que é o comportamento de antes.

   O recorte é pela DATA DO PEDIDO, decisão do Pablo. A alternativa era
   somar os pagamentos datados (fluxo de caixa de verdade), mas o valor
   pago só passou a ser gravado com data em 04/08/2026 e em produção ainda
   não há nenhum — os cartões marcariam R$ 0,00 enquanto a Kavi já recebeu
   de fato. Assim os dois cartões significam a mesma coisa: "dos pedidos
   feitos nesta janela, vendemos X e recebemos Y".

   NOTA: a coluna "Recebido" da tabela mensal continua sendo por data do
   PAGAMENTO. São dois sentidos convivendo na mesma tela de propósito, e é
   por isso que os rótulos dizem qual é qual. */
const PERIOD_WINDOWS = {
  all: 'TRUE',
  '30d': `${LOCAL_CREATED_AT} >= (now() AT TIME ZONE 'America/Sao_Paulo') - interval '30 days'`,
  '3m': `${LOCAL_CREATED_AT} >= (now() AT TIME ZONE 'America/Sao_Paulo') - interval '3 months'`,
  '12m': `${LOCAL_CREATED_AT} >= (now() AT TIME ZONE 'America/Sao_Paulo') - interval '12 months'`,
  year: `${LOCAL_CREATED_AT} >= date_trunc('year', now() AT TIME ZONE 'America/Sao_Paulo')`,
}

/* Junta as duas séries pela chave do mês.

   As duas listas não têm as mesmas linhas: um mês pode ter recebimento sem
   pedido novo (o cliente quitou em agosto um pedido de julho) e vice-versa.
   Por isso a união das chaves, e não um percorrer de uma delas.

   `received` fica NULL nos meses anteriores ao início da série — ali o
   sistema realmente não guardava a data do pagamento, e 0 diria "não entrou
   nada", que é diferente de "não sabemos". Depois do início, mês sem
   pagamento é 0 de verdade. */
function mergeMonths(soldRows, receivedRows, sinceMonth) {
  const byMonth = new Map()

  for (const row of soldRows) {
    byMonth.set(row.month, {
      month: row.month,
      orders: Number(row.orders),
      sold: Number(row.sold ?? 0),
      received: null,
      corrections: 0,
      payments: 0,
    })
  }

  for (const row of receivedRows) {
    const entry = byMonth.get(row.month) ?? {
      month: row.month,
      orders: 0,
      sold: 0,
      received: null,
      corrections: 0,
      payments: 0,
    }
    entry.received = Number(row.received ?? 0)
    entry.corrections = Number(row.corrections ?? 0)
    entry.payments = Number(row.payments ?? 0)
    byMonth.set(row.month, entry)
  }

  for (const entry of byMonth.values()) {
    if (entry.received === null && sinceMonth && entry.month >= sinceMonth) {
      entry.received = 0
    }
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

router.get(
  '/overview',
  requireRole(...FINANCE_ROLES),
  asyncHandler(async (req, res) => {
    // 'YYYY-MM'; sem o parâmetro, o mês corrente no fuso do Brasil.
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : null
    const period = PERIOD_WINDOWS[req.query.period] ? req.query.period : 'all'
    const periodWindow = PERIOD_WINDOWS[period]

    const [totals, monthly, received, receiptsSince, byType, byClient, openOrders] = await Promise.all([
      /* Números do MOMENTO, não de um mês: "a receber" é uma dívida que
         existe hoje, e amarrá-la a um mês não faria sentido — um pedido de
         julho ainda em aberto continua sendo dinheiro a receber em agosto. */
      pool.query(`
        SELECT
          -- Vendido e recebido respondem ao período (pela data do pedido)...
          COALESCE(SUM(o.total_value) FILTER (WHERE ${periodWindow}), 0) AS sold_total,
          COALESCE(SUM(o.amount_paid) FILTER (WHERE ${periodWindow}), 0) AS received_total,
          COUNT(*) FILTER (WHERE ${periodWindow}) AS orders_in_period,
          -- ...mas "a receber" NÃO: é dívida de hoje, não fluxo. Um pedido de
          -- julho ainda em aberto é dinheiro a receber agora, e escondê-lo
          -- num recorte de 30 dias faria a cobrança perder o que importa.
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
          COALESCE(SUM(o.total_value), 0) AS sold
        FROM orders o
        WHERE ${REAL_ORDERS}
          AND ${LOCAL_CREATED_AT} >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') - interval '11 months'
        GROUP BY 1
        ORDER BY 1
      `),

      /* RECEBIDO por mês — a série que exigiu a entrega 1.

         Sai de product_events, não de orders.amount_paid: a coluna só sabe o
         acumulado de hoje, e a pergunta aqui é em QUE MÊS o dinheiro entrou.

         jsonb_exists(payload,'delta') é o filtro que separa as duas eras do
         evento. Até 04/08/2026 o payload guardava só `amountPaid`, e aquele
         número é o ACUMULADO do pedido — somá-lo como se fosse entrada
         inflaria o mês e contaria o mesmo dinheiro várias vezes. Esses
         eventos ficam de fora de propósito, e a tela diz desde quando a
         série é confiável em vez de fingir que cobre tudo.

         (Uso jsonb_exists() em vez do operador `?` só para não deixar um
         ponto de interrogação solto no SQL, que confunde quem lê esperando
         um placeholder.)

         Soma LÍQUIDA dos deltas: um delta negativo é correção de lançamento,
         e ignorá-lo faria o mês somar dinheiro que não entrou. `corrections`
         vem à parte para a tela conseguir explicar um mês que ficou menor do
         que o esperado. */
      pool.query(`
        SELECT
          to_char(date_trunc('month', (e.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo')), 'YYYY-MM') AS month,
          COALESCE(SUM((e.payload->>'delta')::numeric), 0) AS received,
          COALESCE(SUM((e.payload->>'delta')::numeric) FILTER (WHERE (e.payload->>'delta')::numeric < 0), 0) AS corrections,
          COUNT(*) AS payments
        FROM product_events e
        JOIN orders o ON o.id = e.order_id
        WHERE e.event_type = 'payment_registered'
          AND jsonb_exists(e.payload, 'delta')
          AND ${REAL_ORDERS}
        GROUP BY 1
        ORDER BY 1
      `),

      /* Desde quando a série existe — derivado do próprio dado, não uma data
         fixa no código: ninguém precisa lembrar de atualizar constante, e num
         banco novo (ou local) a resposta continua certa.

         Formatado em SQL, e não em JS: MIN() sobre timestamp devolveria um
         Date que o node-pg interpreta no fuso do processo Node, e um
         toISOString() depois disso poderia deslocar o dia (e o mês, numa
         virada). Aqui a conta de fuso já foi feita e o que sai é texto. */
      pool.query(`
        SELECT
          to_char(MIN(local_at), 'YYYY-MM-DD') AS since_date,
          to_char(MIN(local_at), 'YYYY-MM') AS since_month
        FROM (
          SELECT (e.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS local_at
          FROM product_events e
          WHERE e.event_type = 'payment_registered' AND jsonb_exists(e.payload, 'delta')
        ) t
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
      period,
      totals: {
        sold: num(totals.rows[0].sold_total),
        received: num(totals.rows[0].received_total),
        ordersInPeriod: Number(totals.rows[0].orders_in_period),
        outstanding: num(totals.rows[0].outstanding),
        openOrders: Number(totals.rows[0].open_count),
      },
      /* Desde quando o recebimento por mês é confiável. Null = ainda não há
         nenhum pagamento no formato novo, e a tela precisa dizer isso em vez
         de mostrar zeros que pareceriam "não recebemos nada". */
      receiptsSince: receiptsSince.rows[0].since_date,

      /* Vendido e recebido na MESMA linha do mês, mas de fontes diferentes:
         `sold` vem de orders (data do pedido) e `received` da soma dos deltas
         (data do pagamento). Um pedido de julho pago em agosto aparece em
         julho na primeira coluna e em agosto na segunda — é isso que a tela
         quer mostrar, não um erro.

         `received: null` quando o mês é anterior ao início da série. Zero
         seria mentira: significa "não sabemos", não "não entrou nada". */
      monthly: mergeMonths(monthly.rows, received.rows, receiptsSince.rows[0].since_month),
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
