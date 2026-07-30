import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ProductDetailPanel from '../../components/ui/ProductDetailPanel'
import { useOrders } from '../../context/ordersContext'
import { useOperations } from '../../context/operationsContext'
import { useClients } from '../../context/clientsContext'
import { useSettings } from '../../context/settingsContext'
import { useAuth } from '../../context/authContext'
import { buildWhatsAppMessage, buildWhatsAppLink } from '../../utils/whatsapp'

const STATUS_COLUMNS = [
  { key: 'pending', label: 'Pendente' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'done', label: 'Concluído' },
]

function getStatusLabel(status) {
  return STATUS_COLUMNS.find((column) => column.key === status)?.label
}

// Item 2: o fechamento comercial da peça — Lavagem → Revisão/Finalização →
// Embalagem — que saiu do kanban de Produção e passou a ser da vendedora.
//
// Mesma forma da tela de Produção de propósito (abas por etapa + três
// colunas de status): é o mesmo gesto, sobre a mesma tabela
// (product_workflow_steps), só que filtrado por operations.phase. Quem já
// sabe usar Produção sabe usar isto.
function Conference() {
  const { orders, moveProductStepStatus } = useOrders()
  const { operationsData } = useOperations()
  const { clients } = useClients()
  const { whatsappReadyTemplate } = useSettings()
  const { can } = useAuth()
  const canOperate = can('orders.write')

  const [detailTarget, setDetailTarget] = useState(null)
  const [manuallySelectedOperation, setManuallySelectedOperation] = useState(null)

  const operations = operationsData
    .filter((operation) => operation.phase === 'conferencia')
    .map((operation) => operation.name)
  const selectedOperation = manuallySelectedOperation ?? operations[0]

  // Mesmo recorte da Produção: pedido real que já saiu da Venda.
  const visibleOrders = orders.filter((order) => !order.isDraft && order.stage !== 'venda')

  const allProducts = visibleOrders.flatMap((order) =>
    order.products.map((product) => ({
      ...product,
      orderId: order.id,
      orderNumber: order.orderNumber,
    }))
  )

  const itemsForOperation = allProducts
    .map((product) => ({
      product,
      stage: product.workflow.find((stage) => stage.step === selectedOperation),
    }))
    .filter((item) => item.stage)

  const detailProduct = detailTarget
    ? allProducts.find(
        (product) =>
          product.orderId === detailTarget.orderId && product.id === detailTarget.productId
      )
    : null

  // Pedido pronto = todo produto dele terminou TODAS as suas etapas de
  // conferência. "Pronto" é derivado, não um estágio próprio (decisão do
  // Pablo) — é aqui que ele vira o aviso ao cliente.
  const conferenceStepNames = operations
  const readyOrders = visibleOrders.filter((order) => {
    const conferenceSteps = order.products.flatMap((product) =>
      product.workflow.filter((stage) => conferenceStepNames.includes(stage.step))
    )
    return conferenceSteps.length > 0 && conferenceSteps.every((stage) => stage.status === 'done')
  })

  // Só monta o link wa.me com a mensagem pronta — o envio continua sendo um
  // clique humano, sem API oficial do WhatsApp Business (mesma decisão do
  // item 4 do roadmap comercial).
  function notifyClient(order) {
    const client = clients.find((item) => item.id === order.clientId)

    if (!client?.phone) {
      alert('Esse cliente não tem telefone cadastrado.')
      return
    }

    const message = buildWhatsAppMessage(order, order.products, whatsappReadyTemplate)
    window.open(buildWhatsAppLink(client.phone, message), '_blank')
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Conferência</h1>
          <p>Lavagem, revisão e embalagem antes da entrega</p>
        </div>
      </div>

      {readyOrders.length > 0 && (
        <section className="ready-orders">
          <h2>Prontos para retirada</h2>

          {readyOrders.map((order) => {
            const client = clients.find((item) => item.id === order.clientId)

            return (
              <div className="ready-order" key={order.id}>
                <div>
                  <strong>{order.orderNumber}</strong>
                  <span>{client?.personName || 'Cliente não informado'}</span>
                </div>

                {canOperate && (
                  <Button onClick={() => notifyClient(order)}>Avisar cliente</Button>
                )}
              </div>
            )
          })}
        </section>
      )}

      <div className="tabs">
        {operations.map((operation) => (
          <button
            key={operation}
            className={operation === selectedOperation ? 'active' : ''}
            onClick={() => setManuallySelectedOperation(operation)}
          >
            {operation}
          </button>
        ))}
      </div>

      <div className="kanban-board">
        {STATUS_COLUMNS.map((column) => {
          const columnItems = itemsForOperation.filter(
            (item) => item.stage.status === column.key
          )

          return (
            <div className="kanban-column" key={column.key}>
              <h2>{column.label}</h2>

              {columnItems.length === 0 && <p className="kanban-empty">Nenhum produto aqui</p>}

              {columnItems.map((item) => (
                <div
                  className="kanban-card"
                  key={`${item.product.orderId}-${item.product.id}`}
                >
                  <button
                    className="kanban-card-title"
                    onClick={() =>
                      setDetailTarget({
                        orderId: item.product.orderId,
                        productId: item.product.id,
                      })
                    }
                  >
                    {item.product.type} — {item.product.model}
                  </button>

                  <p>{item.product.orderNumber}</p>

                  <p className="kanban-card-meta">
                    {[item.product.color, `${item.product.quantity} peças`]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>

                  {canOperate && (
                    <div className="kanban-card-actions">
                      {column.key !== 'pending' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            moveProductStepStatus(
                              item.product.orderId,
                              item.product.id,
                              selectedOperation,
                              'backward'
                            )
                          }
                        >
                          Voltar
                        </Button>
                      )}

                      {column.key !== 'done' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            moveProductStepStatus(
                              item.product.orderId,
                              item.product.id,
                              selectedOperation,
                              'forward'
                            )
                          }
                        >
                          {column.key === 'pending' ? 'Iniciar' : 'Concluir'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <Modal
        isOpen={!!detailProduct}
        onClose={() => setDetailTarget(null)}
        title={detailProduct ? `${detailProduct.type} — ${detailProduct.orderNumber}` : ''}
      >
        {detailProduct && (
          <>
            <ProductDetailPanel product={detailProduct} />

            <div className="product-detail-workflow">
              {detailProduct.workflow
                .filter((stage) => conferenceStepNames.includes(stage.step))
                .map((stage) => (
                  <div className="product-detail-stage" key={stage.step}>
                    <div>
                      <strong>{stage.step}</strong>
                      <span className={`workflow-chip workflow-chip-${stage.status}`}>
                        {getStatusLabel(stage.status)}
                      </span>
                    </div>

                    {canOperate && (
                      <div className="product-detail-stage-actions">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            moveProductStepStatus(
                              detailProduct.orderId,
                              detailProduct.id,
                              stage.step,
                              'backward'
                            )
                          }
                          disabled={stage.status === 'pending'}
                        >
                          Voltar
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() =>
                            moveProductStepStatus(
                              detailProduct.orderId,
                              detailProduct.id,
                              stage.step,
                              'forward'
                            )
                          }
                          disabled={stage.status === 'done'}
                        >
                          Avançar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}
      </Modal>
    </Layout>
  )
}

export default Conference
