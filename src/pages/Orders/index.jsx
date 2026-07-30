import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import { Link } from 'react-router-dom'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useAuth } from '../../context/authContext'
import { getStageLabel, isActiveOrder, isDeliveredOrder } from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'

// Aba dentro da própria tela, não uma rota nova: é a mesma lista, o mesmo
// card e os mesmos dados que o useOrders() já tem em memória — só muda o
// filtro. Rota separada custaria item no menu, permissão nova nas duas
// cópias de permissions.js e a renderização duplicada, sem nada em troca.
// Mesma forma de .tabs que Produção e Conferência já usam.
const TABS = [
  { key: 'ativos', label: 'Em andamento', matches: isActiveOrder },
  { key: 'entregues', label: 'Entregues', matches: isDeliveredOrder },
]

// picked_up_at é TIMESTAMP (não DATE), então chega como ISO completo e pode
// virar Date direto — sem o truque do 'T00:00:00' que as datas de prazo
// precisam por serem DATE puro (ver Dashboard/whatsapp.js).
function formatPickupDate(pickedUpAt) {
  if (!pickedUpAt) return '-'
  return new Date(pickedUpAt).toLocaleDateString('pt-BR')
}

function Orders() {
  const { orders } = useOrders()
  const { clients } = useClients()
  const { can } = useAuth()
  const [selectedTab, setSelectedTab] = useState('ativos')

  const activeTab = TABS.find((tab) => tab.key === selectedTab)
  const visibleOrders = orders.filter(activeTab.matches)

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

      <div className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={tab.key === selectedTab ? 'active' : ''}
            onClick={() => setSelectedTab(tab.key)}
          >
            {tab.label} ({orders.filter(tab.matches).length})
          </button>
        ))}
      </div>

      <section className="orders-list">
        {visibleOrders.length === 0 && (
          <p className="orders-empty">
            {selectedTab === 'ativos'
              ? 'Nenhum pedido em andamento.'
              : 'Nenhum pedido entregue ainda.'}
          </p>
        )}

        {visibleOrders.map((order) => {
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

              {/* Na aba de entregues o prazo já não diz nada — o que
                  interessa consultar é quando o cliente retirou. */}
              {selectedTab === 'entregues' ? (
                <div>
                  <span>Retirado em</span>
                  <p>{formatPickupDate(order.pickedUpAt)}</p>
                </div>
              ) : (
                <div>
                  <span>Prazo</span>
                  <p>{order.deadline || '-'}</p>
                </div>
              )}

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
