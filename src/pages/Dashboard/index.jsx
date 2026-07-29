import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useOperations } from '../../context/operationsContext'
import { useAuth } from '../../context/authContext'
import { getClientDisplayName } from '../../data/clients'

// Deadline vem do backend como string "YYYY-MM-DD" pura (ver pool.js), então
// dá pra comparar como texto direto, sem passar por Date/fuso horário.
function todayString() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function daysUntil(deadline, today) {
  // "T00:00:00" evita que o parser interprete a data em UTC e desloque um
  // dia pra trás dependendo do fuso do navegador.
  const diffMs = new Date(`${deadline}T00:00:00`) - new Date(`${today}T00:00:00`)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

function deadlineLabel(daysLeft) {
  if (daysLeft === 0) return 'Vence hoje'
  if (daysLeft === 1) return 'Vence amanhã'
  return `Vence em ${daysLeft} dias`
}

function Dashboard() {
  const { orders } = useOrders()
  const { clients } = useClients()
  const { operations } = useOperations()
  const { can } = useAuth()

  const activeOrders = orders.filter((order) => !order.isDraft)
  const today = todayString()

  // "Atrasado" aqui só olha o prazo (deadline < hoje) — o modelo ainda não
  // tem um conceito de "pedido entregue/concluído" que pudesse excluir um
  // pedido cujos produtos já terminaram mas passou do prazo.
  const overdueOrders = activeOrders.filter(
    (order) => order.deadline && order.deadline < today
  )
  const upcomingOrders = activeOrders
    .filter((order) => order.deadline && order.deadline >= today)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
  const dueTomorrowCount = upcomingOrders.filter(
    (order) => daysUntil(order.deadline, today) === 1
  ).length

  const allProducts = activeOrders.flatMap((order) => order.products)

  function countInProgress(operation) {
    return allProducts.filter((product) =>
      product.workflow.some((step) => step.step === operation && step.status === 'in_progress')
    ).length
  }

  // Venda/Design/Aprovação são estágios do pedido (order.stage), não
  // operações — não têm um equivalente em Produção pra filtrar, então só
  // mostram a contagem, sem virar link (ao contrário das operações abaixo).
  const ordersInStage = (stage) => activeOrders.filter((order) => order.stage === stage).length

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da produção da confecção</p>
        </div>

        {can('orders.write') && (
          <Link to="/pedidos/novo">
            <button>Novo pedido</button>
          </Link>
        )}
      </div>

      {(overdueOrders.length > 0 || dueTomorrowCount > 0) && (
        <section className="alert-box">
          <strong>🔴 Atenção</strong>
          <p>
            {overdueOrders.length} pedido(s) estão atrasados e {dueTomorrowCount} vence(m)
            amanhã.
          </p>
        </section>
      )}

      <section className="dashboard-cards">
        <div className="dashboard-card">
          <span>Pedidos ativos</span>
          <strong>{activeOrders.length}</strong>
        </div>

        <div className="dashboard-card">
          <span>Atrasados</span>
          <strong>{overdueOrders.length}</strong>
        </div>

        {operations.map((operation) => (
          <div className="dashboard-card" key={operation}>
            <span>Em {operation}</span>
            <strong>{countInProgress(operation)}</strong>
          </div>
        ))}
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <h2>Próximos vencimentos</h2>

          {upcomingOrders.length === 0 && <p>Nenhum pedido com prazo próximo.</p>}

          {upcomingOrders.slice(0, 5).map((order) => (
            <div className="deadline-item" key={order.id}>
              <strong>{order.orderNumber}</strong>
              <span>
                {getClientDisplayName(clients.find((client) => client.id === order.clientId))} •{' '}
                {deadlineLabel(daysUntil(order.deadline, today))}
              </span>
            </div>
          ))}
        </div>

        <div className="dashboard-panel">
          <h2>Fluxo da produção</h2>

          <div className="production-flow">
            <span>Venda ({ordersInStage('venda')})</span>
            <span>Design ({ordersInStage('design')})</span>
            <span>Aprovação ({ordersInStage('aprovacao')})</span>
            {operations.map((operation) => (
              <Link key={operation} to={`/producao?operacao=${encodeURIComponent(operation)}`}>
                {operation} ({countInProgress(operation)})
              </Link>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  )
}

export default Dashboard
