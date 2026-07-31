import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import { reportsApi } from '../../services/api'
import { useClients } from '../../context/clientsContext'
import { getClientDisplayName, getClientNameById } from '../../data/clients'

// toFixed/template literal produzem "20.8"; em português é "20,8". Passa
// pelo toLocaleString('pt-BR') em vez de trocar o ponto na mão.
function decimal(value, casas = 1) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

function formatHours(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${decimal(hours)} h`
  return `${decimal(hours / 24)} dias`
}

function formatSince(isoDate) {
  const hours = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60)
  return formatHours(hours)
}

const STATUS_LABELS = { pending: 'Pendente', in_progress: 'Em andamento' }

// Inteiro sai sem casa decimal ("20 dias", não "20,0 dias"); só a média,
// que raramente é redonda, mostra a casa.
function formatDays(days) {
  if (days === null || days === undefined) return '-'
  const rounded = Math.round(days * 10) / 10
  if (rounded === 1) return '1 dia'
  return `${Number.isInteger(rounded) ? rounded : decimal(rounded)} dias`
}

// created_at e picked_up_at são TIMESTAMP (ISO completo), então viram Date
// direto. `deadline` é DATE puro ("2026-08-12") e precisa do 'T00:00:00',
// senão o parser lê como UTC e desloca um dia — mesmo cuidado do Dashboard.
function formatTimestamp(value) {
  return value ? new Date(value).toLocaleDateString('pt-BR') : '-'
}

function formatDeadline(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR') : '-'
}

// Positivo = entregue depois do prazo; negativo = adiantado; 0 = no dia;
// null = o pedido nunca teve prazo definido.
function describeDeadline(daysVsDeadline) {
  if (daysVsDeadline === null) return { label: 'Sem prazo definido', tone: 'neutral' }
  if (daysVsDeadline > 0) {
    return { label: `${formatDays(daysVsDeadline)} de atraso`, tone: 'late' }
  }
  if (daysVsDeadline === 0) return { label: 'No dia do prazo', tone: 'ontime' }
  return { label: `${formatDays(Math.abs(daysVsDeadline))} adiantado`, tone: 'ontime' }
}

function Reports() {
  const [avgTimePerStep, setAvgTimePerStep] = useState([])
  const [bottlenecks, setBottlenecks] = useState({ volumeByStep: [], stuckProducts: [] })
  const [leadTime, setLeadTime] = useState({ summary: null, orders: [] })
  const [isLoading, setIsLoading] = useState(true)

  // O nome do cliente sai daqui, não do SQL: getClientDisplayName é o único
  // lugar que decide o que exibir de um cliente (empresa se houver, senão a
  // pessoa), e o ClientsProvider já busca a lista na montagem para todos.
  const { clients } = useClients()

  // Página própria, não um context compartilhado: nenhuma outra tela
  // consome esses dados, então não faz sentido subir isso pro mesmo padrão
  // de OrdersProvider/ClientsProvider (esses sim são estado compartilhado).
  useEffect(() => {
    Promise.all([reportsApi.avgTimePerStep(), reportsApi.bottlenecks(), reportsApi.leadTime()])
      .then(([avgTimePerStepData, bottlenecksData, leadTimeData]) => {
        setAvgTimePerStep(avgTimePerStepData)
        setBottlenecks(bottlenecksData)
        setLeadTime(leadTimeData)
      })
      .catch((err) => alert(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Relatórios</h1>
          <p>
            Análises sobre um período de tempo — o retrato do momento (produção por setor, pedidos
            atrasados) já está no Dashboard.
          </p>
        </div>
      </div>

      {isLoading && <p>Carregando...</p>}

      {!isLoading && (
        <>
          <section className="dashboard-panel">
            <h2>Prazo real: da venda até a entrega</h2>

            {leadTime.summary?.deliveredCount === 0 && (
              <p>
                Nenhum pedido foi entregue ainda. Este relatório passa a ter dados assim que o
                primeiro pedido for retirado pelo cliente.
              </p>
            )}

            {leadTime.summary?.deliveredCount > 0 && (
              <>
                <div className="lead-time-summary">
                  <div>
                    <span>Prazo médio</span>
                    <strong>{formatDays(leadTime.summary.avgLeadDays)}</strong>
                    <small>
                      entre {formatDays(leadTime.summary.minLeadDays)} e{' '}
                      {formatDays(leadTime.summary.maxLeadDays)}
                    </small>
                  </div>

                  <div>
                    <span>Pedidos entregues</span>
                    <strong>{leadTime.summary.deliveredCount}</strong>
                  </div>

                  <div>
                    <span>Entregues no prazo</span>
                    <strong>
                      {leadTime.summary.onTimeCount} de {leadTime.summary.withDeadlineCount}
                    </strong>
                    {/* Só quem tinha prazo definido entra nesta conta — daí
                        o total ser diferente de "pedidos entregues". */}
                    <small>
                      {leadTime.summary.deliveredCount - leadTime.summary.withDeadlineCount > 0
                        ? `${leadTime.summary.deliveredCount - leadTime.summary.withDeadlineCount} sem prazo definido`
                        : 'todos tinham prazo definido'}
                    </small>
                  </div>
                </div>

                <div className="table-scroll">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Venda</th>
                        <th>Prazo</th>
                        <th>Retirada</th>
                        <th>Levou</th>
                        <th>Cumprimento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leadTime.orders.map((order) => {
                        const deadline = describeDeadline(order.daysVsDeadline)
                        const client = clients.find((item) => item.id === order.clientId)

                        return (
                          <tr key={order.id}>
                            <td>{order.orderNumber}</td>
                            <td>{getClientDisplayName(client)}</td>
                            <td>{formatTimestamp(order.createdAt)}</td>
                            <td>{formatDeadline(order.deadline)}</td>
                            <td>{formatTimestamp(order.pickedUpAt)}</td>
                            <td>{formatDays(order.leadDays)}</td>
                            <td>
                              <span className={`deadline-tag deadline-tag-${deadline.tone}`}>
                                {deadline.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <p className="report-note">
                  A contagem começa no momento em que o pedido foi aberto na tela de Novo Pedido —
                  é o registro mais próximo da venda que o sistema guarda.
                </p>
              </>
            )}
          </section>

          <section className="dashboard-panel">
            <h2>Tempo médio por etapa</h2>

            {avgTimePerStep.length === 0 && (
              <p>Ainda não há etapas concluídas o suficiente para calcular uma média.</p>
            )}

            {avgTimePerStep.length > 0 && (
              <div className="table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Operação</th>
                      <th>Tempo médio</th>
                      <th>Nº de conclusões consideradas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avgTimePerStep.map((row) => (
                      <tr key={row.step}>
                        <td>{row.step}</td>
                        <td>{formatHours(row.avgHours)}</td>
                        <td>{row.completions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <h2>Gargalos — volume por operação</h2>

            {bottlenecks.volumeByStep.length === 0 && <p>Nenhum pedido em produção no momento.</p>}

            {bottlenecks.volumeByStep.length > 0 && (
              <div className="table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Operação</th>
                      <th>Pendentes</th>
                      <th>Em andamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottlenecks.volumeByStep.map((row) => (
                      <tr key={row.step}>
                        <td>{row.step}</td>
                        <td>{row.pending}</td>
                        <td>{row.inProgress}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <h2>Gargalos — mais parados</h2>

            {bottlenecks.stuckProducts.length === 0 && <p>Nada parado no momento.</p>}

            {bottlenecks.stuckProducts.length > 0 && (
              <div className="table-scroll">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Cliente</th>
                      <th>Produto</th>
                      <th>Operação</th>
                      <th>Status</th>
                      <th>Há quanto tempo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bottlenecks.stuckProducts.map((row, index) => (
                      <tr key={`${row.orderNumber}-${row.step}-${index}`}>
                        <td>{row.orderNumber}</td>
                        <td>{getClientNameById(clients, row.clientId)}</td>
                        <td>{row.productType}</td>
                        <td>{row.step}</td>
                        <td>{STATUS_LABELS[row.status] || row.status}</td>
                        <td>{formatSince(row.since)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  )
}

export default Reports
