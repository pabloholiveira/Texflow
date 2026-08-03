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
import FileInput from '../../components/ui/FileInput'
import ProductFileList from '../../components/ui/ProductFileList'
import ProductFileUpload from '../../components/ui/ProductFileUpload'
import PaymentFields from '../../components/ui/PaymentFields'
import ClientAutocomplete from '../../components/ui/ClientAutocomplete'
import OrderHistory from '../../components/ui/OrderHistory'
import { useProductList } from '../../hooks/useProductList'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { useSettings } from '../../context/settingsContext'
import { useOperations } from '../../context/operationsContext'
import { useAuth } from '../../context/authContext'
import {
  ORDER_STAGES,
  getStageState,
  getStageLabel,
} from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'
import { formatCurrency } from '../../utils/currency'
import { buildWhatsAppMessage, buildWhatsAppLink } from '../../utils/whatsapp'

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

function OrderDetails() {
  const { id } = useParams()
  const { orders, isLoading, advanceOrderStage, regressOrderStage, updateOrderInfo } =
    useOrders()
  const { clients, findOrCreateClient } = useClients()
  const { whatsappTemplate } = useSettings()
  // Uma permissão só governa a tela inteira: editar pedido, pagamento,
  // avançar/voltar etapa e adicionar produto são todos "mexer no pedido".
  const { can } = useAuth()
  const canWrite = can('orders.write')
  const { operationsData } = useOperations()
  const conferenceStepNames = operationsData
    .filter((operation) => operation.phase === 'conferencia')
    .map((operation) => operation.name)
  const order = orders.find((item) => item.id === id)
  const client = order && clients.find((item) => item.id === order.clientId)

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [amountPaidDraft, setAmountPaidDraft] = useState(0)
  /* Cobrança na retirada: o mesmo modal de pagamento, aberto pelo botão de
     fechar o pedido em vez de pelo "Registrar Pagamento". Muda o texto e o
     que acontece depois de salvar — quitou, o pedido fecha na sequência.

     `pickupWarned` é o que faz o aviso ser aviso e não trava: ele avisa uma
     vez por visita à tela; quem cancelar e clicar de novo entrega com saldo
     em aberto (a Kavi fia para cliente conhecido, e travar deixaria a pessoa
     sem saída a não ser lançar como pago o que não recebeu). */
  const [chargingForPickup, setChargingForPickup] = useState(false)
  const [pickupWarned, setPickupWarned] = useState(false)

  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false)
  const [deadlineDraft, setDeadlineDraft] = useState('')
  const [clientDraft, setClientDraft] = useState(null)

  function openEditOrderModal() {
    setDeadlineDraft(order.deadline || '')
    setClientDraft(client || emptyClient)
    setIsEditOrderModalOpen(true)
  }

  // Mesma cadeia que o NewOrder já usa ao finalizar: resolve o cliente
  // primeiro (findOrCreateClient casa pelo CPF/CNPJ — se ninguém mexeu no
  // cliente, devolve o mesmo id de volta; se trocou, devolve o do outro; se
  // digitou um cliente inédito, cria) e só então grava o pedido.
  async function saveOrderEdit() {
    if (!clientDraft.personName || !clientDraft.document || !clientDraft.phone) {
      alert('Preencha nome, CPF/CNPJ e telefone do cliente.')
      return
    }

    const clientId = await findOrCreateClient(clientDraft)
    if (!clientId) return

    const updated = await updateOrderInfo(order.id, {
      clientId,
      // Campo opcional: '' não é uma DATE válida pro Postgres, então vira
      // null (mesmo tratamento que unitPrice/vectorizationPrice já recebem).
      deadline: deadlineDraft === '' ? null : deadlineDraft,
    })
    if (updated) setIsEditOrderModalOpen(false)
  }

  function openPaymentModal(forPickup = false) {
    setAmountPaidDraft(order.amountPaid)
    setChargingForPickup(forPickup)
    setIsPaymentModalOpen(true)
  }

  function closePaymentModal() {
    setIsPaymentModalOpen(false)
    setChargingForPickup(false)
  }

  async function confirmPayment() {
    const amountPaid = amountPaidDraft === '' ? 0 : Number(amountPaidDraft)
    const updated = await updateOrderInfo(order.id, { amountPaid })
    if (!updated) return

    closePaymentModal()

    // Quitou dentro do fluxo da retirada: fecha o pedido na sequência, para
    // ninguém receber o dinheiro e esquecer o pedido aberto. Pagamento
    // parcial não fecha nada — só registra o valor.
    if (chargingForPickup && amountPaid >= order.totalValue) {
      advanceOrderStage(order.id)
    }
  }

  /* O botão de etapa. Na retirada existe o desvio da cobrança: é o último
     momento em que o cliente está na loja, então o que falta receber tem que
     aparecer antes de o pedido ser dado por encerrado. */
  function handleAdvanceStage() {
    if (order.stage === 'conferencia' && remaining > 0 && !pickupWarned) {
      setPickupWarned(true)
      openPaymentModal(true)
      return
    }

    advanceOrderStage(order.id)
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
    isSavingProduct,
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

  // Fechamento do pedido (item 1): em Conferência, o "Avançar etapa" vira
  // "Registrar retirada" — é a mesma transição, mas o nome importa: quem
  // clica está afirmando que o cliente levou a peça, e isso grava a data.
  // A trava de verdade está no servidor (409); aqui é só não oferecer o
  // botão antes da hora.
  const conferenceSteps = order.products.flatMap((item) =>
    item.workflow.filter((stage) => conferenceStepNames.includes(stage.step))
  )
  const conferencePending = conferenceSteps.some((stage) => stage.status !== 'done')
  const isDelivered = order.stage === 'entregue'
  // Quanto falta receber. Nunca negativo: se o cliente pagou adiantado a
  // mais, o que falta é zero, não um valor negativo na tela.
  const remaining = Math.max(order.totalValue - order.amountPaid, 0)

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <p>{getClientDisplayName(client)}</p>
        </div>

        {canWrite && (
          <div className="page-header-actions">
            {client?.phone && (
              <Button variant="secondary" onClick={handleSendWhatsApp}>
                Enviar por WhatsApp
              </Button>
            )}
            {/* Uma folha por peça, todas de uma vez: é o gesto de quem
                acabou de fechar o pedido e vai levar tudo para a fábrica. */}
            {products.length > 0 && (
              <a
                className="btn btn-secondary"
                href={`/pedidos/${order.id}/fichas`}
                target="_blank"
                rel="noreferrer"
              >
                Imprimir fichas
              </a>
            )}
            <Button variant="secondary" onClick={openEditOrderModal}>
              Editar Pedido
            </Button>
          </div>
        )}
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

        {order.pickedUpAt && (
          <div>
            <span>Retirado em</span>
            <strong>
              {new Date(order.pickedUpAt).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </strong>
          </div>
        )}

        <div>
          <span>Falta pagar</span>
          <strong>{formatCurrency(remaining)}</strong>
        </div>

        {canWrite && (
          <div>
            {/* Seta () => : sem ela o React passaria o evento do clique como
                primeiro argumento, e `forPickup` viraria truthy — o modal
                abriria em modo cobrança fora da retirada. */}
            <Button variant="secondary" onClick={() => openPaymentModal()}>
              Registrar Pagamento
            </Button>
          </div>
        )}
      </section>

      <section className="order-stages">
        <div className="products-panel-header">
          <h2>Etapas do Pedido</h2>

          {canWrite && (
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
                onClick={handleAdvanceStage}
                disabled={
                  isDelivered ||
                  order.stage === 'producao' ||
                  autoAdvancePending ||
                  (order.stage === 'conferencia' && conferencePending)
                }
              >
                {order.stage === 'conferencia' ? 'Registrar retirada' : 'Avançar etapa'}
              </Button>
            </div>
          )}
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

        {order.stage === 'conferencia' && conferencePending && (
          <p className="stage-hint">
            O pedido fecha quando todos os produtos passarem por lavagem,
            revisão e embalagem na tela de Conferência.
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
          {canWrite && <Button onClick={openAddModal}>Adicionar Produto</Button>}
        </div>

        {products.length === 0 && <p>Nenhum produto adicionado ainda.</p>}

        {products.map((item) => (
          <ProductCard
            key={item.id}
            product={item}
            orderId={order.id}
            onRemove={removeProduct}
            onEdit={openEditModal}
            onEditInfo={openInfoModal}
            onOpenComments={openCommentsModal}
            onOpenFiles={openFilesModal}
          />
        ))}
      </section>

      <section className="history-panel">
        <h2>Histórico</h2>
        {/* refreshToken = o próprio pedido: toda mutação o substitui no
            cache do OrdersProvider, então o histórico se atualiza sozinho
            depois de cada ação feita nesta tela. */}
        <OrderHistory orderId={order.id} refreshToken={order} />
      </section>

      <Modal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        title={addStep === 'info' ? 'Adicionar Produto' : 'Escolher Operações'}
      >
        {addStep === 'info' && (
          <>
            <ProductFields product={product} onChange={handleChange} />

            <FileInput
              label="Referências (fotos, logo do cliente, tom de tecido)"
              onChange={(event) => {
                if (event.target.files[0]) addReferenceFile(event.target.files[0])
                event.target.value = ''
              }}
            />

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
              <Button
                variant="secondary"
                onClick={goToInfoStep}
                disabled={isSavingProduct}
              >
                Voltar
              </Button>
              <Button onClick={saveNewProduct} disabled={isSavingProduct}>
                {isSavingProduct ? 'Salvando...' : 'Salvar'}
              </Button>
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
        onClose={closePaymentModal}
        title={chargingForPickup ? 'Falta pagar antes da retirada' : 'Registrar Pagamento'}
      >
        {chargingForPickup && (
          <p className="payment-warning">
            Faltam <strong>{formatCurrency(remaining)}</strong> a receber deste
            pedido. Registre o pagamento para fechar o pedido, ou cancele e clique
            de novo em "Registrar retirada" para entregar com o saldo em aberto.
          </p>
        )}

        <PaymentFields
          totalValue={order.totalValue}
          amountPaid={amountPaidDraft}
          onChange={(event) => setAmountPaidDraft(event.target.value)}
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={closePaymentModal}>
            Cancelar
          </Button>
          <Button onClick={confirmPayment}>Salvar</Button>
        </div>
      </Modal>

      <Modal
        isOpen={isEditOrderModalOpen}
        onClose={() => setIsEditOrderModalOpen(false)}
        title="Editar Pedido"
      >
        {clientDraft && (
          <>
            <ClientAutocomplete
              clients={clients}
              client={clientDraft}
              onChange={setClientDraft}
              initiallySelected={Boolean(client)}
            />

            <div className="form-grid">
              <Input
                label="Prazo de entrega"
                type="date"
                value={deadlineDraft}
                onChange={(event) => setDeadlineDraft(event.target.value)}
              />
            </div>
          </>
        )}

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIsEditOrderModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={saveOrderEdit}>Salvar</Button>
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
        <ProductFileList
          files={filesProduct?.files || []}
          orderId={order.id}
          productId={filesProduct?.id}
        />

        <ProductFileUpload
          fileDraft={fileDraft}
          onDraftChange={handleFileDraftChange}
          onFileSelect={handleFileSelect}
        />

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
