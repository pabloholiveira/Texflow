import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import { reportsApi } from '../../services/api'

function formatHours(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${hours.toFixed(1)} h`
  return `${(hours / 24).toFixed(1)} dias`
}

function formatSince(isoDate) {
  const hours = (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60)
  return formatHours(hours)
}

const STATUS_LABELS = { pending: 'Pendente', in_progress: 'Em andamento' }

function Reports() {
  const [avgTimePerStep, setAvgTimePerStep] = useState([])
  const [bottlenecks, setBottlenecks] = useState({ volumeByStep: [], stuckProducts: [] })
  const [isLoading, setIsLoading] = useState(true)

  // Página própria, não um context compartilhado: nenhuma outra tela
  // consome esses dados, então não faz sentido subir isso pro mesmo padrão
  // de OrdersProvider/ClientsProvider (esses sim são estado compartilhado).
  useEffect(() => {
    Promise.all([reportsApi.avgTimePerStep(), reportsApi.bottlenecks()])
      .then(([avgTimePerStepData, bottlenecksData]) => {
        setAvgTimePerStep(avgTimePerStepData)
        setBottlenecks(bottlenecksData)
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
