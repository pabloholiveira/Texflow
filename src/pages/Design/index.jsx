import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ProductDetailPanel from '../../components/ui/ProductDetailPanel'
import ProductFileUpload from '../../components/ui/ProductFileUpload'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useAuth } from '../../context/authContext'
import { useProductFiles } from '../../hooks/useProductFiles'
import {
  DESIGN_STATUSES,
  DESIGN_DONE_VISIBLE_DAYS,
  isDesignCardVisible,
} from '../../data/designStatuses'
import { isActiveOrder } from '../../data/orderStages'
import { getClientNameById } from '../../data/clients'

// Fila de design por PRODUTO (item 3.1 do roadmap — ver CLAUDE.md). Dois
// caminhos de entrada: automático (pedido sai de Venda → todos os produtos
// entram como 'pendente', fluxo normal) e manual (checkbox de retrabalho em
// Produção → 'pendente' com o marcador de retrabalho, que vira badge no
// card). Mover cards aqui empurra o estágio do pedido junto (gatilho no
// servidor, remapeado 2026-07-11): o último produto a entrar em Aprovação
// avança o pedido Design→Aprovação, e o último a Concluir avança
// Aprovação→Em produção. Lê direto do cache compartilhado (useOrders),
// igual Produção — não existe um GET /design-queue dedicado de propósito:
// os pedidos já estão no front, criar outro endpoint seria uma segunda
// fonte de verdade sem necessidade.

// Identidade da peça no título do modal — pedido e cliente moram dentro
// do painel de detalhe.
function nomeDoProduto(product) {
  return product.model ? `${product.type} — ${product.model}` : product.type
}

function Design() {
  const { orders, setProductDesignStatus } = useOrders()
  const { clients } = useClients()
  // Quem não é do design (ou admin) enxerga a fila mas não move card — a
  // matriz é "leitura ampla, escrita por setor". Gate num lugar só, em volta
  // do bloco inteiro de ações, em vez de repetir a condição nos quatro
  // botões: menos chance de esquecer um (foi assim que os botões sumiram
  // desta tela em 2026-07-25).
  const { can } = useAuth()
  const canMove = can('design.move')

  // Item 5 (2026-07-30): clicar no produto abre a visão detalhada, com as
  // referências que a vendedora recebeu do cliente e o upload do layout
  // aprovado — que as etapas de produção passam a consultar (item 4).
  const [detailTarget, setDetailTarget] = useState(null)
  const {
    fileDraft,
    resetFileDraft,
    handleFileDraftChange,
    handleFileSelect,
    uploadFile,
  } = useProductFiles()

  const queue = orders
    // Pedido entregue sai da fila: como TODO produto dele está com
    // designStatus = 'concluido', ele ficaria parado na coluna "Concluído"
    // para sempre. Ao contrário de Produção/Conferência, aqui não há piso de
    // 'venda' — a fila de design é justamente onde o pedido entra ao sair da
    // Venda, e produto marcado para retrabalho pode aparecer em qualquer
    // estágio posterior.
    .filter(isActiveOrder)
    .flatMap((order) =>
      order.products
        // Concluído há mais de 7 dias sai da tela (não do banco) — sem isso
        // a última coluna só perdia um card quando o pedido era entregue.
        .filter((product) => product.designStatus && isDesignCardVisible(product))
        .map((product) => ({
          product,
          orderId: order.id,
          orderNumber: order.orderNumber,
          clientName: getClientNameById(clients, order.clientId),
        }))
    )

  function openDetail(item) {
    setDetailTarget({ orderId: item.orderId, productId: item.product.id })
    // Nesta tela o que se sobe é o layout aprovado, não referência — daí o
    // padrão diferente do modal de Arquivos do pedido.
    resetFileDraft('layout_aprovado')
  }

  // Relê da fila em vez de guardar o produto no estado: assim o painel
  // acompanha sozinho o upload que acabou de acontecer (o OrdersProvider
  // troca o produto no cache), sem refetch nem estado duplicado.
  const detail = detailTarget
    ? queue.find(
        (item) =>
          item.orderId === detailTarget.orderId &&
          item.product.id === detailTarget.productId
      )
    : null

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Design</h1>
          <p>Fila de trabalho de design por produto</p>
        </div>
      </div>

      <div className="kanban-board design-board">
        {DESIGN_STATUSES.map((column) => {
          const items = queue.filter(
            (item) => item.product.designStatus === column.value
          )

          return (
            <div className="kanban-column" key={column.value}>
              <h2>{column.label}</h2>

              {/* Sem esta linha, sumir com um card viraria mistério para quem
                  está usando a tela. */}
              {column.value === 'concluido' && (
                <p className="kanban-column-hint">
                  Últimos {DESIGN_DONE_VISIBLE_DAYS} dias
                </p>
              )}

              {items.length === 0 && (
                <p className="kanban-empty">Nenhum produto aqui</p>
              )}

              {items.map((item) => (
                <div className="kanban-card" key={item.product.id}>
                  {item.product.needsDesignRework && (
                    <span className="rework-badge">Retrabalho de design</span>
                  )}

                  <button
                    className="kanban-card-title"
                    onClick={() => openDetail(item)}
                  >
                    {item.product.type}
                    {item.product.model ? ` — ${item.product.model}` : ''}
                  </button>

                  <p>
                    <Link
                      className="design-card-order"
                      to={`/pedidos/${item.orderId}`}
                    >
                      {item.orderNumber}
                    </Link>
                    {` — ${item.clientName}`}
                    {item.product.color ? ` • ${item.product.color}` : ''}
                    {item.product.quantity ? ` • ${item.product.quantity} peças` : ''}
                  </p>

                  {item.product.files?.length > 0 && (
                    <span className="design-card-files">
                      {item.product.files.length} arquivo
                      {item.product.files.length > 1 ? 's' : ''}
                    </span>
                  )}

                  {canMove && (
                    <div className="kanban-card-actions">
                      {column.value === 'pendente' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setProductDesignStatus(item.orderId, item.product.id, 'em_design')
                          }
                        >
                          Iniciar
                        </Button>
                      )}

                      {column.value === 'em_design' && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setProductDesignStatus(item.orderId, item.product.id, 'pendente')
                            }
                          >
                            Voltar
                          </Button>
                          <Button
                            onClick={() =>
                              setProductDesignStatus(item.orderId, item.product.id, 'aprovacao')
                            }
                          >
                            Enviar pra Aprovação
                          </Button>
                        </>
                      )}

                      {column.value === 'aprovacao' && (
                        <>
                          <Button
                            variant="secondary"
                            onClick={() =>
                              setProductDesignStatus(item.orderId, item.product.id, 'em_design')
                            }
                          >
                            Voltar
                          </Button>
                          <Button
                            onClick={() =>
                              setProductDesignStatus(item.orderId, item.product.id, 'concluido')
                            }
                          >
                            Concluir
                          </Button>
                        </>
                      )}

                      {column.value === 'concluido' && (
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setProductDesignStatus(item.orderId, item.product.id, 'em_design')
                          }
                        >
                          Reabrir
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
        isOpen={!!detail}
        onClose={() => setDetailTarget(null)}
        title={
          detail
            ? nomeDoProduto(detail.product)
            : 'Produto'
        }
      >
        {detail && (
          <>
            <ProductDetailPanel
              product={detail.product}
              orderNumber={detail.orderNumber}
              clientName={detail.clientName}
              orderId={detail.orderId}
            />

            <a
              className="btn btn-secondary sheet-link"
              href={`/pedidos/${detail.orderId}/produtos/${detail.product.id}/ficha`}
              target="_blank"
              rel="noreferrer"
            >
              Imprimir ficha
            </a>

            {canMove && (
              <div className="design-upload">
                <h4>Enviar arquivo</h4>
                <p>
                  Suba aqui o PDF do layout aprovado — ele fica visível para
                  corte, costura, bordado e estampa.
                </p>

                <ProductFileUpload
                  fileDraft={fileDraft}
                  onDraftChange={handleFileDraftChange}
                  onFileSelect={handleFileSelect}
                />
              </div>
            )}

            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setDetailTarget(null)}>
                Fechar
              </Button>
              {canMove && (
                <Button onClick={() => uploadFile(detail.orderId, detail.product.id)}>
                  Enviar Arquivo
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>
    </Layout>
  )
}

export default Design
