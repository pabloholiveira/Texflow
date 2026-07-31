import Layout from '../../components/layout/Layout'
import { Link } from 'react-router-dom'
import OrderCard from '../../components/ui/OrderCard'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useAuth } from '../../context/authContext'
import { isActiveOrder } from '../../data/orderStages'

/* Só os pedidos operacionalmente ativos. Os entregues têm tela própria
   (/entregues) — eles continuam no banco, só saem da visão do dia a dia. */
function Orders() {
  const { orders } = useOrders()
  const { clients } = useClients()
  const { can } = useAuth()

  const visibleOrders = orders.filter(isActiveOrder)

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Pedidos</h1>
          <p>Acompanhe os pedidos e seus produtos</p>
        </div>

        {can('orders.write') && (
          <Link to="/pedidos/novo">
            <button>Novo Pedido</button>
          </Link>
        )}
      </div>

      <section className="orders-list">
        {visibleOrders.length === 0 && (
          <p className="orders-empty">Nenhum pedido em andamento.</p>
        )}

        {visibleOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            client={clients.find((item) => item.id === order.clientId)}
          />
        ))}
      </section>
    </Layout>
  )
}

export default Orders
