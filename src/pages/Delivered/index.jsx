import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import Input from '../../components/ui/Input'
import OrderCard from '../../components/ui/OrderCard'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { isDeliveredOrder } from '../../data/orderStages'
import { matchesOrderSearch } from '../../data/orderSearch'

/* Tela própria (e não uma aba dentro de Pedidos): o pedido entregue é
   histórico, uma consulta de outra natureza que a lista do dia a dia — quem
   abre aqui está procurando um pedido antigo, não acompanhando o trabalho.

   Nada é excluído do banco: os product_events e tudo que alimenta os
   Relatórios continuam lá. O que muda é só onde o pedido aparece.

   A busca é a mesma de /pedidos (matchesOrderSearch): é justamente aqui,
   no histórico, que procurar por nome ou número mais importa. */
function Delivered() {
  const { orders } = useOrders()
  const { clients } = useClients()
  const [search, setSearch] = useState('')

  const deliveredOrders = orders
    .filter(isDeliveredOrder)
    .filter((order) => matchesOrderSearch(order, search, clients))

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Entregues</h1>
          <p>Histórico dos pedidos já retirados pelo cliente</p>
        </div>
      </div>

      <div className="orders-search">
        <Input
          label="Buscar pedido"
          name="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Número, cliente, CPF/CNPJ ou produto"
        />
      </div>

      <section className="orders-list">
        {deliveredOrders.length === 0 && (
          <p className="orders-empty">
            {search.trim()
              ? `Nenhum pedido entregue encontrado para "${search.trim()}".`
              : 'Nenhum pedido entregue ainda.'}
          </p>
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
