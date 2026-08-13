import { Link, useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import ProductDetailPanel from '../../components/ui/ProductDetailPanel'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { getClientNameById } from '../../data/clients'
import { getStageLabel } from '../../data/orderStages'

/* Destino da leitura do QR impresso na ficha de produção.

   POR QUE UMA ROTA, E NÃO O MODAL DE DETALHE que Produção e Design já têm:
   aquele modal é estado local da tela onde vive, então não tem endereço para
   um QR apontar. Pior, ele depende do contexto da tela — a peça pode estar
   numa aba filtrada, ou estar na Conferência e não na Produção. Uma rota é
   estável: vale para qualquer peça, em qualquer etapa, para quem abrir.

   POR PEÇA, e não pelo pedido inteiro, porque é a peça que anda fisicamente
   separada pela fábrica — quem está no bordado com a camiseta na mão quer os
   dados dela, não a lista dos outros produtos do pedido. O link para o pedido
   completo cobre o outro caso (o balcão), a um toque de distância.

   SEM ENDPOINT PRÓPRIO: o produto sai do mesmo cache que todas as outras
   telas já carregam (useOrders), exatamente como a fila de Design faz. Um
   GET /products/:id seria uma segunda fonte de verdade para o mesmo dado.

   Sem `action` no ProtectedRoute: é leitura, e a matriz do projeto é "leitura
   ampla, escrita por setor" — quem está na máquina precisa justamente disto. */
function ProductView() {
  const { productId } = useParams()
  const { orders, isLoading } = useOrders()
  const { clients } = useClients()

  const order = orders.find((item) =>
    item.products.some((product) => String(product.id) === String(productId))
  )
  const product = order?.products.find(
    (item) => String(item.id) === String(productId)
  )

  // Enquanto o cache não chegou, "não encontrado" seria mentira — e é o que
  // apareceria por um instante em toda leitura de QR, que é sempre um
  // carregamento de página inteira (o celular abre o link do zero).
  if (isLoading) {
    return (
      <Layout>
        <p className="product-view-empty">Carregando peça...</p>
      </Layout>
    )
  }

  if (!product) {
    return (
      <Layout>
        <div className="page-header">
          <h1>Peça não encontrada</h1>
        </div>
        <p className="product-view-empty">
          Este código aponta para uma peça que não existe mais — ela pode ter
          sido excluída do pedido.
        </p>
        <Link className="btn btn-secondary" to="/pedidos">
          Ver todos os pedidos
        </Link>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>
            {product.type}
            {product.model ? ` — ${product.model}` : ''}
          </h1>
          <p>
            {order.orderNumber} · {getStageLabel(order.stage)}
          </p>
        </div>

        <Link className="btn btn-secondary" to={`/pedidos/${order.id}`}>
          Ver pedido completo
        </Link>
      </div>

      <section className="product-view-panel">
        <ProductDetailPanel
          product={product}
          orderNumber={order.orderNumber}
          clientName={getClientNameById(clients, order.clientId)}
        />
      </section>
    </Layout>
  )
}

export default ProductView
