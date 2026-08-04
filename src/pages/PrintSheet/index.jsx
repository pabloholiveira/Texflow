import { useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import ProductSheet from '../../components/ui/ProductSheet'
import { getClientDisplayName } from '../../data/clients'

/* Página de impressão das fichas de produção.

   Duas rotas, um componente só (a diferença é só quantos produtos entram):
     /pedidos/:id/fichas                     -> todas as peças do pedido
     /pedidos/:id/produtos/:productId/ficha  -> uma peça

   Fora do <Layout> de propósito: sem menu lateral, sem cabeçalho de tela.
   É mais previsível que renderizar a aplicação inteira e escondê-la no
   @media print — e o endereço fica compartilhável/recarregável.

   Abrir isto numa aba nova é um carregamento novo da aplicação: os
   Providers buscam da API de novo (o token vive no localStorage, então
   segue autenticado), daí o estado de "Carregando". */
function PrintSheet() {
  const { id, productId } = useParams()
  const { orders, isLoading } = useOrders()
  const { clients } = useClients()
  const hasPrinted = useRef(false)

  const order = orders.find((item) => item.id === id)
  const products = order
    ? productId
      ? order.products.filter((product) => product.id === productId)
      : order.products
    : []

  const ready = !!order && products.length > 0

  useEffect(() => {
    // Guardado por ref porque o diálogo de impressão não pode reabrir a
    // cada re-render (o cache de pedidos muda de referência sozinho).
    if (!ready || hasPrinted.current) return
    hasPrinted.current = true
    window.print()
  }, [ready])

  if (isLoading) return <p className="sheet-message">Carregando ficha...</p>
  if (!order) return <p className="sheet-message">Pedido não encontrado.</p>
  if (products.length === 0)
    return <p className="sheet-message">Produto não encontrado neste pedido.</p>

  /* O registro inteiro, não só o nome: a ficha passou a mostrar também o
     telefone (redesenho de 2026-08-04). O nome continua saindo de
     getClientDisplayName, o único lugar que decide o que se exibe de um
     cliente — empresa se houver, senão a pessoa. */
  const client = clients.find((item) => item.id === order.clientId)
  const clientName = getClientDisplayName(client)

  return (
    <div className="sheet-page">
      {/* Some na impressão (.no-print): serve para quem fechou o diálogo
          sem querer e para voltar ao pedido sem usar o botão do navegador. */}
      <div className="sheet-actions no-print">
        <button onClick={() => window.print()}>Imprimir</button>
        <Link to={`/pedidos/${order.id}`}>Voltar ao pedido</Link>
      </div>

      {products.map((product) => (
        <ProductSheet
          key={product.id}
          order={order}
          product={product}
          clientName={clientName}
          clientPhone={client?.phone}
        />
      ))}
    </div>
  )
}

export default PrintSheet
