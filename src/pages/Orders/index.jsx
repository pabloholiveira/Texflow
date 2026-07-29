import Layout from '../../components/layout/Layout'
import { Link } from 'react-router-dom'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useAuth } from '../../context/authContext'
import { getStageLabel } from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'

function Orders() {
  const { orders } = useOrders()
  const { clients } = useClients()
  const { can } = useAuth()
  const finalizedOrders = orders.filter((order) => !order.isDraft)

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
        {finalizedOrders.map((order) => {
          const client = clients.find((item) => item.id === order.clientId)

          return (
            <Link
              to={`/pedidos/${order.id}`}
              className="order-card"
              key={order.id}
            >
              <div>
                <strong>{order.orderNumber}</strong>
                <p>{getClientDisplayName(client)}</p>
                {order.products.some(
                  (product) => product.needsDesignRework
                ) && (
                  <span className="rework-badge">
                    Retrabalho de design pendente
                  </span>
                )}
              </div>

              <div>
                <span>Prazo</span>
                <p>{order.deadline || '-'}</p>
              </div>

              <div>
                <span>Status</span>
                <p>{getStageLabel(order.stage)}</p>
              </div>

              <div>
                <span>Produtos</span>
                <p>{order.products.length}</p>
              </div>
            </Link>
          )
        })}
      </section>
    </Layout>
  )
}

export default Orders
