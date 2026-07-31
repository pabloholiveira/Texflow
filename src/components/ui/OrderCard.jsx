import { Link } from 'react-router-dom'
import { getStageLabel, isDeliveredOrder } from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'

// picked_up_at é TIMESTAMP (não DATE), então chega como ISO completo e pode
// virar Date direto — sem o truque do 'T00:00:00' que as datas de prazo
// precisam por serem DATE puro (ver Dashboard/whatsapp.js).
function formatPickupDate(pickedUpAt) {
  if (!pickedUpAt) return '-'
  return new Date(pickedUpAt).toLocaleDateString('pt-BR')
}

/* O card de um pedido na lista, usado por /pedidos e por /entregues.

   A coluna de data é DERIVADA do estágio do próprio pedido, não recebida por
   prop: num pedido entregue o prazo já não diz nada — o que se consulta é
   quando o cliente retirou. Derivando aqui, qualquer lista futura que mostre
   um pedido entregue acerta sozinha, sem quem chama ter que lembrar. */
function OrderCard({ order, client }) {
  const delivered = isDeliveredOrder(order)

  return (
    <Link to={`/pedidos/${order.id}`} className="order-card">
      <div>
        <strong>{order.orderNumber}</strong>
        <p>{getClientDisplayName(client)}</p>
        {order.products.some((product) => product.needsDesignRework) && (
          <span className="rework-badge">Retrabalho de design pendente</span>
        )}
      </div>

      <div>
        <span>{delivered ? 'Retirado em' : 'Prazo'}</span>
        <p>{delivered ? formatPickupDate(order.pickedUpAt) : order.deadline || '-'}</p>
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
}

export default OrderCard
