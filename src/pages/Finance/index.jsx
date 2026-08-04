import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import { financeApi } from '../../services/api'
import { useClients } from '../../context/clientsContext'
import { getClientNameById } from '../../data/clients'
import { formatCurrency } from '../../utils/currency'
import { getStageLabel } from '../../data/orderStages'

/* Visão financeira — só admin (a rota carrega action="finance.view", e o
   servidor barra de novo em FINANCE_ROLES).

   É um RELATÓRIO SOBRE VENDAS E RECEBIMENTOS, não um sistema financeiro:
   sem contas a pagar, sem despesas, sem DRE, sem nota fiscal. Mantém a
   fronteira do topo do CLAUDE.md.

   A distinção que a tela inteira precisa preservar: VENDIDO é o que foi
   combinado com o cliente (total_value) e RECEBIDO é o que entrou
   (amount_paid). São números diferentes, e chamar qualquer um dos dois de
   "receita" apagaria a diferença justamente onde ela importa.

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

function variation(current, previous) {
  if (!previous) return null
  return ((current - previous) / previous) * 100
}

function Finance() {
  const { clients } = useClients()
  const [month, setMonth] = useState(currentMonth)
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    // Cadeia .then() em vez de função async no corpo do efeito: chamar
    // setState depois de um await ali dentro viola react-hooks/set-state-in-
    // effect. Mesmo formato de Reports e OrderHistory.
    financeApi
      .overview(month)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err.message))
      // Só desliga, nunca religa: numa troca de mês os números antigos ficam
      // na tela até os novos chegarem, em vez de piscar "Carregando".
      .finally(() => setIsLoading(false))
  }, [month])

  const monthly = data?.monthly ?? []
  const thisMonth = monthly.find((row) => row.month === month)
  const previousMonth = monthly.find((row) => row.month === shiftMonth(month, -1))
  const soldVariation = variation(thisMonth?.sold ?? 0, previousMonth?.sold ?? 0)

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
          {/* Números do momento. "A receber" não pertence a mês nenhum: um
              pedido de julho ainda em aberto é dinheiro a receber hoje. */}
          <section className="finance-cards">
            <div className="finance-card">
              <span className="finance-card-label">Vendido (total)</span>
              <strong className="finance-card-value">
                {formatCurrency(data.totals.sold)}
              </strong>
              <span className="finance-card-hint">Soma de todos os pedidos</span>
            </div>
            <div className="finance-card">
              <span className="finance-card-label">Recebido (total)</span>
              <strong className="finance-card-value">
                {formatCurrency(data.totals.received)}
              </strong>
              <span className="finance-card-hint">O que já entrou</span>
            </div>
            <div className="finance-card finance-card-alert">
              <span className="finance-card-label">A receber</span>
              <strong className="finance-card-value">
                {formatCurrency(data.totals.outstanding)}
              </strong>
              <span className="finance-card-hint">
                {data.totals.openOrders === 1
                  ? '1 pedido em aberto'
                  : `${data.totals.openOrders} pedidos em aberto`}
              </span>
            </div>
          </section>

          <section className="finance-panel">
            <div className="finance-panel-header">
              <h2>Vendido por mês</h2>
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
                <span className="finance-card-label">Pedidos no mês</span>
                <strong>{thisMonth?.orders ?? 0}</strong>
              </div>
              <div>
                <span className="finance-card-label">
                  Mês anterior ({monthLabel(shiftMonth(month, -1))})
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
                  </tr>
                </thead>
                <tbody>
                  {monthly.length === 0 && (
                    <tr>
                      <td colSpan={3}>Nenhum pedido nos últimos 12 meses.</td>
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
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* A série é por DATA DO PEDIDO, e a tela precisa dizer isso: até
                04/08/2026 o sistema não guardava quando cada pagamento
                entrou, então "recebido no mês" ainda não existe. */}
            <p className="finance-note">
              A série é por data do pedido. O recebimento mês a mês ainda não
              aparece aqui: o valor pago só passou a ser registrado com data em
              04/08/2026, então os meses anteriores não têm essa informação.
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
