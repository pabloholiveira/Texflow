import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import { financeApi } from '../../services/api'
import { useClients } from '../../context/clientsContext'
import { getClientNameById } from '../../data/clients'
import { formatCurrency } from '../../utils/currency'
import { getStageLabel } from '../../data/orderStages'
import Select from '../../components/ui/Select'

/* Períodos dos cartões do topo. O recorte é pela DATA DO PEDIDO — os dois
   cartões respondem "dos pedidos feitos nesta janela, vendemos X e
   recebemos Y". Não é fluxo de caixa: o valor pago só passou a ser gravado
   com data em 04/08/2026, então somar pagamentos datados marcaria R$ 0,00
   enquanto a Kavi já recebeu de fato. Decisão do Pablo.

   'all' é o padrão para quem abre a tela ver o mesmo de antes. */
const PERIODS = [
  { value: 'all', label: 'Tudo', short: 'total' },
  { value: '30d', label: 'Últimos 30 dias', short: 'últimos 30 dias' },
  { value: '3m', label: 'Últimos 3 meses', short: 'últimos 3 meses' },
  { value: '12m', label: 'Últimos 12 meses', short: 'últimos 12 meses' },
  { value: 'year', label: 'Este ano', short: 'este ano' },
]

function periodShort(value) {
  return PERIODS.find((p) => p.value === value)?.short ?? 'total'
}

/* Visão financeira — só admin (a rota carrega action="finance.view", e o
   servidor barra de novo em FINANCE_ROLES).

   É um RELATÓRIO SOBRE VENDAS E RECEBIMENTOS, não um sistema financeiro:
   sem contas a pagar, sem despesas, sem DRE, sem nota fiscal. Mantém a
   fronteira do topo do CLAUDE.md.

   A distinção que a tela inteira precisa preservar: VENDIDO é o que foi
   combinado com o cliente e RECEBIDO é o que entrou. São números diferentes,
   e chamar qualquer um dos dois de "receita" apagaria a diferença justamente
   onde ela importa.

   E os dois contam por datas diferentes: vendido pela data do pedido,
   recebido pela data do pagamento. Nos meses anteriores a 04/08/2026 o
   recebido vem null — "não sabemos" — porque o sistema não guardava a data;
   exibir R$ 0,00 ali afirmaria algo falso.

   Busca com useState/useEffect local, sem context: nenhuma outra tela
   consome estes dados — mesma decisão já tomada em Reports. */

// Rótulo do mês a partir de 'YYYY-MM', sem passar por Date: `new
// Date('2026-08')` é interpretado como UTC e, em UTC-3, volta como julho.
const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

function monthLabel(month) {
  if (!month) return ''
  const [year, index] = month.split('-')
  return `${MONTH_NAMES[Number(index) - 1]} de ${year}`
}

// Mês corrente no fuso do Brasil — o mesmo recorte que o servidor usa para
// agrupar, senão a tela abriria num mês e os números viriam de outro.
function currentMonth() {
  const now = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })
  )
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month, step) {
  const [year, index] = month.split('-').map(Number)
  const date = new Date(year, index - 1 + step, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/* receiptsSince vem como 'YYYY-MM-DD' puro (formatado no SQL). Precisa do
   T00:00:00 pelo mesmo motivo do prazo de entrega: sem ele o navegador lê
   como UTC e, em UTC-3, mostra o dia anterior. */
function formatDateOnly(value) {
  if (!value) return ''
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function variation(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function Finance() {
  const { clients } = useClients()
  const [month, setMonth] = useState(currentMonth)
  const [period, setPeriod] = useState('all')
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Cadeia .then() em vez de função async no corpo do efeito: chamar
    // setState depois de um await ali dentro viola react-hooks/set-state-in-
    // effect. Mesmo formato de Reports e OrderHistory.
    financeApi
      .overview(month, period)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err.message))
      // Só desliga, nunca religa: numa troca de mês os números antigos ficam
      // na tela até os novos chegarem, em vez de piscar "Carregando".
      .finally(() => setIsLoading(false))
  }, [month, period])

  const monthly = data?.monthly ?? []
  const thisMonth = monthly.find((row) => row.month === month)
  const previousMonth = monthly.find((row) => row.month === shiftMonth(month, -1))
  const soldVariation = variation(thisMonth?.sold ?? 0, previousMonth?.sold ?? 0)

  /* received === null significa "o sistema não guardava a data do pagamento
     naquele mês" — bem diferente de zero. Mostrar R$ 0,00 ali seria afirmar
     que nada entrou, que é falso e faz a série parecer uma queda brusca. */
  const hasReceipts = Boolean(data?.receiptsSince)
  const anyCorrection = monthly.some((row) => row.corrections < 0)
  const money = (value) => (value === null ? '—' : formatCurrency(value))

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Financeiro</h1>
          <p>Vendas e recebimentos — visão do administrador</p>
        </div>
      </div>

      {error && <p className="finance-error">{error}</p>}
      {isLoading && !data && <p>Carregando...</p>}

      {data && (
        <>
          <div className="finance-period">
            <Select
              label="Período"
              name="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              options={PERIODS}
            />
          </div>

          {/* Os dois primeiros cartões respondem ao período, pela data do
              pedido. "A receber" NÃO — é dívida de hoje, não fluxo: um
              pedido de julho ainda em aberto é dinheiro a receber agora, e
              escondê-lo num recorte de 30 dias faria a cobrança perder o
              que importa. O rótulo de cada um diz a qual grupo pertence. */}
          <section className="finance-cards">
            <div className="finance-card">
              <span className="finance-card-label">
                Vendido ({periodShort(period)})
              </span>
              <strong className="finance-card-value">
                {formatCurrency(data.totals.sold)}
              </strong>
              <span className="finance-card-hint">
                {data.totals.ordersInPeriod === 1
                  ? '1 pedido no período'
                  : `${data.totals.ordersInPeriod} pedidos no período`}
              </span>
            </div>
            <div className="finance-card">
              <span className="finance-card-label">
                Recebido ({periodShort(period)})
              </span>
              <strong className="finance-card-value">
                {formatCurrency(data.totals.received)}
              </strong>
              <span className="finance-card-hint">
                Já pago desses mesmos pedidos
              </span>
            </div>
            <div className="finance-card finance-card-alert">
              <span className="finance-card-label">A receber (hoje)</span>
              <strong className="finance-card-value">
                {formatCurrency(data.totals.outstanding)}
              </strong>
              <span className="finance-card-hint">
                {data.totals.openOrders === 1
                  ? '1 pedido em aberto'
                  : `${data.totals.openOrders} pedidos em aberto`}
                {' '}— não muda com o período
              </span>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-panel-header">
              <h2>Vendido e recebido por mês</h2>
              <div className="finance-month-nav">
                <button onClick={() => setMonth(shiftMonth(month, -1))}>
                  ← Mês anterior
                </button>
                <strong>{monthLabel(month)}</strong>
                <button
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  disabled={month >= currentMonth()}
                >
                  Próximo mês →
                </button>
              </div>
            </div>

            <div className="finance-month-summary">
              <div>
                <span className="finance-card-label">Vendido no mês</span>
                {/* A variação fica AQUI, colada ao mês que ela descreve. Ao
                    lado do mês anterior — onde estava — lia-se como se o mês
                    passado é que tivesse caído. */}
                <strong>
                  {formatCurrency(thisMonth?.sold ?? 0)}
                  {soldVariation !== null && (
                    <span
                      className={`finance-variation ${
                        soldVariation >= 0 ? 'finance-up' : 'finance-down'
                      }`}
                    >
                      {soldVariation >= 0 ? '▲' : '▼'}{' '}
                      {Math.abs(soldVariation).toLocaleString('pt-BR', {
                        maximumFractionDigits: 0,
                      })}
                      % vs. mês anterior
                    </span>
                  )}
                </strong>
              </div>
              <div>
                <span className="finance-card-label">Recebido no mês</span>
                <strong>{money(thisMonth?.received ?? null)}</strong>
              </div>
              <div>
                <span className="finance-card-label">Pedidos no mês</span>
                <strong>{thisMonth?.orders ?? 0}</strong>
              </div>
              <div>
                <span className="finance-card-label">
                  Vendido no mês anterior ({monthLabel(shiftMonth(month, -1))})
                </span>
                <strong>{formatCurrency(previousMonth?.sold ?? 0)}</strong>
              </div>
            </div>

            {/* Série completa: a comparação com um mês só esconde tendência —
                dois meses ruins seguidos contam outra história. */}
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Pedidos</th>
                    <th>Vendido</th>
                    <th>Recebido</th>
                    {anyCorrection && <th>Correções</th>}
                  </tr>
                </thead>
                <tbody>
                  {monthly.length === 0 && (
                    <tr>
                      <td colSpan={anyCorrection ? 5 : 4}>
                        Nenhum pedido nos últimos 12 meses.
                      </td>
                    </tr>
                  )}
                  {monthly
                    .slice()
                    .reverse()
                    .map((row) => (
                      <tr
                        key={row.month}
                        className={row.month === month ? 'finance-row-active' : ''}
                      >
                        <td>{monthLabel(row.month)}</td>
                        <td>{row.orders}</td>
                        <td>{formatCurrency(row.sold)}</td>
                        <td>{money(row.received)}</td>
                        {anyCorrection && (
                          <td className={row.corrections < 0 ? 'finance-owed' : ''}>
                            {row.corrections < 0 ? formatCurrency(row.corrections) : '—'}
                          </td>
                        )}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* As duas colunas têm significados diferentes, e a tela tem que
                dizer isso: "Vendido" é por data do pedido, "Recebido" é por
                data do pagamento. O mesmo dinheiro pode cair em meses
                diferentes nas duas. */}
            <p className="finance-note">
              <strong>Vendido</strong> conta pela data do pedido;{' '}
              <strong>Recebido</strong>, pela data do pagamento — um pedido de
              um mês pago no seguinte aparece em cada coluna num mês diferente.
              {hasReceipts ? (
                <>
                  {' '}
                  O recebimento por mês passou a ser registrado em{' '}
                  {formatDateOnly(data.receiptsSince)}; antes disso o sistema
                  não guardava a data do pagamento, e os meses anteriores
                  aparecem como <strong>—</strong> (não sabemos), e não como R$
                  0,00.
                </>
              ) : (
                <>
                  {' '}
                  Ainda não há nenhum pagamento registrado com data, então a
                  coluna Recebido aparece como <strong>—</strong> em todos os
                  meses.
                </>
              )}
            </p>
          </section>

          <section className="finance-panel">
            <h2>Vendido por tipo de produto — {monthLabel(month)}</h2>
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Peças</th>
                    <th>Produtos</th>
                    <th>Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byType.length === 0 && (
                    <tr>
                      <td colSpan={4}>Nenhum produto com preço neste mês.</td>
                    </tr>
                  )}
                  {data.byType.map((row) => (
                    <tr key={row.type}>
                      <td>{row.type}</td>
                      <td>{row.pieces}</td>
                      <td>{row.products}</td>
                      <td>{formatCurrency(row.sold)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Produto sem preço fica de fora em vez de entrar como zero. */}
            <p className="finance-note">
              Considera apenas produtos com preço unitário preenchido. A
              vetorização não entra aqui, por não pertencer a um tipo de peça.
            </p>
          </section>

          <section className="finance-panel">
            <h2>Por cliente (todos os períodos)</h2>
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Pedidos</th>
                    <th>Vendido</th>
                    <th>Recebido</th>
                    <th>A receber</th>
                  </tr>
                </thead>
                <tbody>
                  {data.byClient.length === 0 && (
                    <tr>
                      <td colSpan={5}>Nenhum pedido com cliente vinculado.</td>
                    </tr>
                  )}
                  {data.byClient.map((row) => (
                    <tr key={row.clientId}>
                      {/* O nome sai de getClientDisplayName, único dono da
                          regra empresa-vs-pessoa — a API devolve clientId
                          cru de propósito. */}
                      <td>{getClientNameById(clients, row.clientId)}</td>
                      <td>{row.orders}</td>
                      <td>{formatCurrency(row.sold)}</td>
                      <td>{formatCurrency(row.received)}</td>
                      <td className={row.outstanding > 0 ? 'finance-owed' : ''}>
                        {formatCurrency(row.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="finance-panel">
            <h2>Pedidos em aberto</h2>
            <div className="table-scroll">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Pedido</th>
                    <th>Cliente</th>
                    <th>Etapa</th>
                    <th>Total</th>
                    <th>Pago</th>
                    <th>Falta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.openOrders.length === 0 && (
                    <tr>
                      <td colSpan={6}>Nenhum pedido em aberto. Tudo quitado.</td>
                    </tr>
                  )}
                  {data.openOrders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderNumber}</td>
                      <td>{getClientNameById(clients, order.clientId)}</td>
                      <td>{getStageLabel(order.stage)}</td>
                      <td>{formatCurrency(order.totalValue)}</td>
                      <td>{formatCurrency(order.amountPaid)}</td>
                      <td className="finance-owed">
                        {formatCurrency(order.outstanding)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </Layout>
  )
}

export default Finance
