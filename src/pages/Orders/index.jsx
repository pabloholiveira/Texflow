import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import { Link } from 'react-router-dom'
import Input from '../../components/ui/Input'
import OrderCard from '../../components/ui/OrderCard'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useAuth } from '../../context/authContext'
import { isActiveOrder } from '../../data/orderStages'
import { matchesOrderSearch } from '../../data/orderSearch'

/* Só os pedidos operacionalmente ativos. Os entregues têm tela própria
   (/entregues) — eles continuam no banco, só saem da visão do dia a dia. */
function Orders() {
  const { orders } = useOrders()
  const { clients } = useClients()
  const { can } = useAuth()
  const [search, setSearch] = useState('')

  const activeOrders = orders.filter(isActiveOrder)
  const visibleOrders = activeOrders.filter((order) =>
    matchesOrderSearch(order, search, clients)
  )

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
        {/* Duas mensagens diferentes de propósito: "não achei o que você
            procurou" é outra situação de "não há pedido nenhum", e tratar
            as duas igual faria parecer que a lista está vazia. */}
        {visibleOrders.length === 0 && (
          <p className="orders-empty">
            {search.trim()
              ? `Nenhum pedido em andamento encontrado para "${search.trim()}".`
              : 'Nenhum pedido em andamento.'}
          </p>
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
