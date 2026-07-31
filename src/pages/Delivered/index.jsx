import Layout from '../../components/layout/Layout'
import OrderCard from '../../components/ui/OrderCard'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { isDeliveredOrder } from '../../data/orderStages'

/* Tela própria (e não uma aba dentro de Pedidos): o pedido entregue é
   histórico, uma consulta de outra natureza que a lista do dia a dia — quem
   abre aqui está procurando um pedido antigo, não acompanhando o trabalho.

   Nada é excluído do banco: os product_events e tudo que alimenta os
   Relatórios continuam lá. O que muda é só onde o pedido aparece. */
function Delivered() {
  const { orders } = useOrders()
  const { clients } = useClients()

  const deliveredOrders = orders.filter(isDeliveredOrder)

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Entregues</h1>
          <p>Histórico dos pedidos já retirados pelo cliente</p>
        </div>
      </div>

      <section className="orders-list">
        {deliveredOrders.length === 0 && (
          <p className="orders-empty">Nenhum pedido entregue ainda.</p>
        )}

        {deliveredOrders.map((order) => (
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

export default Delivered
