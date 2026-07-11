import { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import OperationsChecklist from '../../components/ui/OperationsChecklist'
import Textarea from '../../components/ui/Textarea'
import ProductCard from '../../components/ui/ProductCard'
import ProductFields from '../../components/ui/ProductFields'
import PaymentFields from '../../components/ui/PaymentFields'
import { useProductList } from '../../hooks/useProductList'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useSettings } from '../../context/settingsContext'
import {
  ORDER_STAGES,
  getStageState,
  getStageLabel,
} from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'
import { formatCurrency } from '../../utils/currency'
import { buildWhatsAppMessage, buildWhatsAppLink } from '../../utils/whatsapp'

function OrderDetails() {
  const { id } = useParams()
  const { orders, isLoading, advanceOrderStage, regressOrderStage, updateOrderInfo } =
    useOrders()
  const { clients } = useClients()
  const { whatsappTemplate } = useSettings()
  const order = orders.find((item) => item.id === id)
  const client = order && clients.find((item) => item.id === order.clientId)

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [amountPaidDraft, setAmountPaidDraft] = useState(0)

  function openPaymentModal() {
    setAmountPaidDraft(order.amountPaid)
    setIsPaymentModalOpen(true)
  }

  async function confirmPayment() {
    const updated = await updateOrderInfo(order.id, {
      amountPaid: amountPaidDraft === '' ? 0 : Number(amountPaidDraft),
    })
    if (updated) setIsPaymentModalOpen(false)
  }

  // Só abre um link wa.me pré-preenchido — envio continua manual, sem API
  // oficial do WhatsApp Business (item 4 do roadmap comercial).
  function handleSendWhatsApp() {
    const message = buildWhatsAppMessage(order, products, whatsappTemplate)
    window.open(buildWhatsAppLink(client.phone, message), '_blank')
  }

  const {
    products,
    product,
    handleChange,
    selectedSteps,
    setSelectedSteps,
    isAddModalOpen,
    addStep,
    openAddModal,
    closeAddModal,
    goToOperationsStep,
    goToInfoStep,
    saveNewProduct,
    referenceFiles,
    addReferenceFile,
    removeReferenceFile,
    removeProduct,
    isEditModalOpen,
    openEditModal,
    closeEditModal,
    saveWorkflow,
    isInfoModalOpen,
    infoDraft,
    handleInfoDraftChange,
    openInfoModal,
    closeInfoModal,
    saveInfoEdit,
    isCommentsModalOpen,
    commentingProduct,
    commentDraft,
    handleCommentChange,
    openCommentsModal,
    closeCommentsModal,
    addComment,
    isFilesModalOpen,
    filesProduct,
    fileDraft,
    handleFileDraftChange,
    handleFileSelect,
    openFilesModal,
    closeFilesModal,
    uploadFile,
  } = useProductList(id)

  if (isLoading) {
    return (
      <Layout>
        <p>Carregando pedido...</p>
      </Layout>
    )
  }

  if (!order) {
    return (
      <Layout>
        <p>Pedido não encontrado.</p>
      </Layout>
    )
  }

  // Design → Aprovação e Aprovação → Em produção são transições do sistema
  // (disparam sozinhas conforme os cards andam no kanban de design — ver o
  // gatilho em PATCH /products/:id/design-status), então o "Avançar etapa"
  // fica desabilitado enquanto a automação daquele estágio ainda tem
  // trabalho pendente. Cada estágio espelha a condição do seu próprio
  // gatilho; se nada está pendente (ex: alguém voltou o estágio por engano
  // — a automação só dispara em MUDANÇA de status, então não re-avançaria
  // sozinha), o botão reabilita, senão o pedido ficaria preso.
  const waitingDesignApproval =
    order.stage === 'design' &&
    order.products.some(
      (item) =>
        item.designStatus && !['aprovacao', 'concluido'].includes(item.designStatus)
    )
  const waitingDesignConclusion =
    order.stage === 'aprovacao' &&
    order.products.some(
      (item) => item.designStatus && item.designStatus !== 'concluido'
    )
  const autoAdvancePending = waitingDesignApproval || waitingDesignConclusion

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <p>{getClientDisplayName(client)}</p>
        </div>

        <div className="page-header-actions">
          {client?.phone && (
            <Button variant="secondary" onClick={handleSendWhatsApp}>
              Enviar por WhatsApp
            </Button>
          )}
          <button>Editar Pedido</button>
        </div>
      </div>

      <section className="order-info">
        <div>
          <span>Prazo</span>
          <strong>{order.deadline || '-'}</strong>
        </div>

        <div>
          <span>Status Comercial</span>
          <strong>{getStageLabel(order.stage)}</strong>
        </div>

        <div>
          <span>Produtos</span>
          <strong>{products.length}</strong>
        </div>

        <div>
          <span>Valor total</span>
          <strong>{formatCurrency(order.totalValue)}</strong>
        </div>

        <div>
          <span>Valor pago</span>
          <strong>{formatCurrency(order.amountPaid)}</strong>
        </div>

        <div>
          <span>Falta pagar</span>
          <strong>{formatCurrency(Math.max(order.totalValue - order.amountPaid, 0))}</strong>
        </div>

        <div>
          <Button variant="secondary" onClick={openPaymentModal}>
            Registrar Pagamento
          </Button>
        </div>
      </section>

      <section className="order-stages">
        <div className="products-panel-header">
          <h2>Etapas do Pedido</h2>

          <div className="stage-actions">
            <Button
              variant="secondary"
              onClick={() => regressOrderStage(order.id)}
              disabled={order.stage === 'venda'}
            >
              Voltar etapa
            </Button>

            <Button
              variant="secondary"
              onClick={() => advanceOrderStage(order.id)}
              disabled={order.stage === 'producao' || autoAdvancePending}
            >
              Avançar etapa
            </Button>
          </div>
        </div>

        <div className="stage-list">
          {ORDER_STAGES.map((stage) => (
            <div
              key={stage.value}
              className={`stage-chip stage-chip-${getStageState(
                stage.value,
                order.stage
              )}`}
            >
              {stage.label}
            </div>
          ))}
        </div>

        {waitingDesignApproval && (
          <p className="stage-hint">
            O pedido avança para Aprovação automaticamente quando o design de
            todos os produtos for enviado para aprovação do cliente.
          </p>
        )}

        {waitingDesignConclusion && (
          <p className="stage-hint">
            O pedido avança para Em produção automaticamente quando o design
            de todos os produtos for concluído.
          </p>
        )}
      </section>

      <section className="products-panel">
        <div className="products-panel-header">
          <h2>Produtos</h2>
          <Button onClick={openAddModal}>Adicionar Produto</Button>
        </div>

        {products.length === 0 && <p>Nenhum produto adicionado ainda.</p>}

        {products.map((item) => (
          <ProductCard
            key={item.id}
            product={item}
            onRemove={removeProduct}
            onEdit={openEditModal}
            onEditInfo={openInfoModal}
            onOpenComments={openCommentsModal}
            onOpenFiles={openFilesModal}
          />
        ))}
      </section>

      <Modal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        title={addStep === 'info' ? 'Adicionar Produto' : 'Escolher Operações'}
      >
        {addStep === 'info' && (
          <>
            <ProductFields product={product} onChange={handleChange} />

            <div className="input-group">
              <label>Referências (fotos, logo do cliente, tom de tecido)</label>
              <input
                type="file"
                onChange={(event) => {
                  if (event.target.files[0]) addReferenceFile(event.target.files[0])
                  event.target.value = ''
                }}
              />
            </div>

            {referenceFiles.length > 0 && (
              <ul className="reference-files-list">
                {referenceFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`}>
                    {file.name}
                    <button type="button" onClick={() => removeReferenceFile(index)}>
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="modal-actions">
              <Button variant="secondary" onClick={closeAddModal}>
                Cancelar
              </Button>
              <Button onClick={goToOperationsStep}>Próximo</Button>
            </div>
          </>
        )}

        {addStep === 'operations' && (
          <>
            <OperationsChecklist
              selectedSteps={selectedSteps}
              onChange={setSelectedSteps}
            />

            <div className="modal-actions">
              <Button variant="secondary" onClick={goToInfoStep}>
                Voltar
              </Button>
              <Button onClick={saveNewProduct}>Salvar</Button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={closeEditModal}
        title="Editar Produto — Operações"
      >
        <OperationsChecklist
          selectedSteps={selectedSteps}
          onChange={setSelectedSteps}
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeEditModal}>
            Cancelar
          </Button>
          <Button onClick={saveWorkflow}>Salvar</Button>
        </div>
      </Modal>

      <Modal isOpen={isInfoModalOpen} onClose={closeInfoModal} title="Editar Produto — Dados">
        <ProductFields product={infoDraft} onChange={handleInfoDraftChange} />

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeInfoModal}>
            Cancelar
          </Button>
          <Button onClick={saveInfoEdit}>Salvar</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Registrar Pagamento"
      >
        <PaymentFields
          totalValue={order.totalValue}
          amountPaid={amountPaidDraft}
          onChange={(event) => setAmountPaidDraft(event.target.value)}
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmPayment}>Salvar</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isCommentsModalOpen}
        onClose={closeCommentsModal}
        title={
          commentingProduct
            ? `Comentários — ${commentingProduct.type}`
            : 'Comentários'
        }
      >
        <p className="comments-hint">
          Visível apenas internamente — nunca para o cliente.
        </p>

        <div className="comments-list">
          {(!commentingProduct?.comments ||
            commentingProduct.comments.length === 0) && (
            <p>Nenhum comentário ainda.</p>
          )}

          {commentingProduct?.comments
            ?.slice()
            .reverse()
            .map((comment) => (
              <div className="comment-item" key={comment.id}>
                <div className="comment-item-header">
                  <strong>{comment.author}</strong>
                  <span>
                    {new Date(comment.createdAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
                <p>{comment.text}</p>
              </div>
            ))}
        </div>

        <Textarea
          label="Comentário"
          placeholder="Ex: Cliente aprovou alteração"
          name="text"
          value={commentDraft.text}
          onChange={handleCommentChange}
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeCommentsModal}>
            Fechar
          </Button>
          <Button onClick={addComment}>Adicionar Comentário</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isFilesModalOpen}
        onClose={closeFilesModal}
        title={filesProduct ? `Arquivos — ${filesProduct.type}` : 'Arquivos'}
      >
        <div className="comments-list">
          {(!filesProduct?.files || filesProduct.files.length === 0) && (
            <p>Nenhum arquivo ainda.</p>
          )}

          {filesProduct?.files?.map((file) => (
            <div className="comment-item" key={file.id}>
              <div className="comment-item-header">
                <strong>
                  <a href={file.fileUrl} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                </strong>
                <span>
                  {file.category === 'referencia' ? 'Referência' : 'Layout aprovado'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="input-group">
          <label>Categoria</label>
          <select name="category" value={fileDraft.category} onChange={handleFileDraftChange}>
            <option value="referencia">Referência</option>
            <option value="layout_aprovado">Layout aprovado</option>
          </select>
        </div>

        <Input
          label="Enviado por"
          placeholder="Seu nome"
          name="uploadedBy"
          value={fileDraft.uploadedBy}
          onChange={handleFileDraftChange}
        />

        <div className="input-group">
          <label>Arquivo</label>
          <input type="file" onChange={handleFileSelect} />
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeFilesModal}>
            Fechar
          </Button>
          <Button onClick={uploadFile}>Enviar Arquivo</Button>
        </div>
      </Modal>
    </Layout>
  )
}

export default OrderDetails
