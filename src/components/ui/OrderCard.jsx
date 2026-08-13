import { Link } from 'react-router-dom'
import { getStageLabel, isDeliveredOrder } from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'


function formatPickupDate(pickedUpAt) {
  if (!pickedUpAt) return '-'
  return new Date(pickedUpAt).toLocaleDateString('pt-BR')
}


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
