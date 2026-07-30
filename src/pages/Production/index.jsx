import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ProductDetailPanel from '../../components/ui/ProductDetailPanel'
import { useOrders } from '../../context/ordersContext'
import { useOperations } from '../../context/operationsContext'
import { useAuth } from '../../context/authContext'
import { formatSizes } from '../../data/sizes'

const STATUS_COLUMNS = [
  { key: 'pending', label: 'Pendente' },
  { key: 'in_progress', label: 'Em andamento' },
  { key: 'done', label: 'Concluído' },
]

function getStatusLabel(status) {
  return STATUS_COLUMNS.find((column) => column.key === status)?.label
}

function Production() {
  const { orders, moveProductStepStatus, toggleProductDesignRework } =
    useOrders()
  // Só as etapas de fabricação: Lavagem, Revisão/Finalização e Embalagem
  // saíram daqui (item 2) e viraram a aba Conferência, operada pela
  // vendedora. O filtro lê operations.phase, não uma lista de nomes.
  const { operationsData } = useOperations()
  const operations = operationsData
    .filter((operation) => operation.phase === 'producao')
    .map((operation) => operation.name)
  // canOperateStep espelha o gate do backend: além do papel, um usuário de
  // produção só mexe nas etapas atribuídas a ele. Precisa do catálogo
  // (`operations`) porque etapa fora dele — a "outra operação" digitada na
  // venda — é livre pra qualquer um da produção.
  const { can, canOperateStep } = useAuth()
  const [detailTarget, setDetailTarget] = useState(null)
  const [searchParams] = useSearchParams()

  // `operations` chega vazio no primeiro render (ainda buscando da API), e
  // `useState(operations[0])` só usaria esse valor inicial uma vez — por
  // isso a aba ativa é derivada no render (com fallback pra primeira
  // operação) em vez de guardada como seu próprio estado sincronizado.
  // O valor inicial vem de "?operacao=" na URL quando existe (link vindo do
  // Dashboard) — se não vier ninguém, cai no fallback de sempre.
  const [manuallySelectedOperation, setManuallySelectedOperation] = useState(
    searchParams.get('operacao')
  )
  const selectedOperation = manuallySelectedOperation ?? operations[0]

  const allProducts = orders
    // Desde a integração Design ↔ Produção (item 3.1): produção roda em
    // paralelo com design a partir do momento em que o pedido sai de Venda —
    // não espera mais a aprovação.
    // Pedido entregue sai do quadro: o trabalho acabou e ele só ocuparia
    // espaço. Antes da Venda também não aparece (nada a fabricar ainda).
    .filter(
      (order) => !order.isDraft && order.stage !== 'venda' && order.stage !== 'entregue'
    )
    .flatMap((order) =>
      order.products.map((product) => ({
        ...product,
        orderId: order.id,
        orderNumber: order.orderNumber,
      }))
    )

  function openDetail(orderId, productId) {
    setDetailTarget({ orderId, productId })
  }

  function closeDetail() {
    setDetailTarget(null)
  }

  const itemsForOperation = allProducts
    .map((product) => ({
      product,
      stage: product.workflow.find((stage) => stage.step === selectedOperation),
    }))
    .filter((item) => item.stage)

  // Uma checagem só para a aba aberta (todos os cards da coluna são da mesma
  // etapa); no modal de detalhe a checagem é por etapa, já que ele lista
  // todas as operações do produto de uma vez.
  const canMoveSelected = canOperateStep(selectedOperation, operations)

  const detailProduct = detailTarget
    ? allProducts.find(
        (product) =>
          product.orderId === detailTarget.orderId &&
          product.id === detailTarget.productId
      )
    : null

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Produção</h1>
          <p>Acompanhe o andamento de cada operação</p>
        </div>
      </div>

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

              {columnItems.length === 0 && (
                <p className="kanban-empty">Nenhum produto aqui</p>
              )}

              {columnItems.map((item) => (
                <div
                  className="kanban-card"
                  key={`${item.product.orderId}-${item.product.id}`}
                >
                  <button
                    className="kanban-card-title"
                    onClick={() =>
                      openDetail(item.product.orderId, item.product.id)
                    }
                  >
                    {item.product.type} — {item.product.model}
                  </button>

                  <p>{item.product.orderNumber}</p>

                  {/* Item 4: o card mostra o essencial da peça sem precisar
                      abrir nada — cor, tecido e quantidade são o que a pessoa
                      confere antes de pegar o trabalho. O resto (observações,
                      layout aprovado) fica no detalhe, a um clique. */}
                  <p className="kanban-card-meta">
                    {[
                      item.product.color,
                      item.product.fabric,
                      `${item.product.quantity} peças`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>

                  {item.product.sizes?.length > 0 && (
                    <p className="kanban-card-meta">{formatSizes(item.product.sizes)}</p>
                  )}

                  {item.product.files?.some(
                    (file) => file.category === 'layout_aprovado'
                  ) && <span className="layout-badge">Layout aprovado</span>}

                  {item.product.needsDesignRework && (
                    <span className="rework-badge">Retrabalho de design</span>
                  )}

                  <div className="kanban-card-actions">
                    {canMoveSelected && column.key !== 'pending' && (
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

                    {canMoveSelected && column.key !== 'done' && (
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
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <Modal
        isOpen={!!detailProduct}
        onClose={closeDetail}
        title={
          detailProduct
            ? `${detailProduct.type} — ${detailProduct.orderNumber}`
            : ''
        }
      >
        {detailProduct && (
          <>
            {/* Mesmo painel da tela de Design (item 5) — dados da peça,
                grade de tamanhos, observações e os arquivos, incluindo o
                layout aprovado que bordado/silk/costura precisam consultar. */}
            <ProductDetailPanel product={detailProduct} />

            <div className="product-detail-workflow">
              {detailProduct.workflow.map((stage) => (
                <div className="product-detail-stage" key={stage.step}>
                  <div>
                    <strong>{stage.step}</strong>
                    <span
                      className={`workflow-chip workflow-chip-${stage.status}`}
                    >
                      {getStatusLabel(stage.status)}
                    </span>
                  </div>

                  <div className="product-detail-stage-actions">
                    {canOperateStep(stage.step, operations) && (
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
                    )}

                    {canOperateStep(stage.step, operations) && (
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
                    )}
                  </div>
                </div>
              ))}
            </div>

            {can('design.rework') && (
              <label className="rework-flag">
                <input
                  type="checkbox"
                  checked={!!detailProduct.needsDesignRework}
                  onChange={() =>
                    toggleProductDesignRework(
                      detailProduct.orderId,
                      detailProduct.id
                    )
                  }
                />
                Precisa retrabalho de design
              </label>
            )}
          </>
        )}
      </Modal>
    </Layout>
  )
}

export default Production
