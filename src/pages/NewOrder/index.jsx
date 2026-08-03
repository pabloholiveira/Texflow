import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductCard from '../../components/ui/ProductCard'
import Layout from '../../components/layout/Layout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import OperationsChecklist from '../../components/ui/OperationsChecklist'
import Textarea from '../../components/ui/Textarea'
import ClientAutocomplete from '../../components/ui/ClientAutocomplete'
import ProductFields from '../../components/ui/ProductFields'
import FileInput from '../../components/ui/FileInput'
import ProductFileList from '../../components/ui/ProductFileList'
import ProductFileUpload from '../../components/ui/ProductFileUpload'
import PaymentFields from '../../components/ui/PaymentFields'
import { useProductList } from '../../hooks/useProductList'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import { formatCurrency } from '../../utils/currency'

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

function NewOrder() {
  const navigate = useNavigate()
  const { orders, isLoading, createOrder, finalizeOrder, updateOrderInfo } = useOrders()
  const { clients, findOrCreateClient } = useClients()
  const [orderId, setOrderId] = useState(null)
  const hasCreatedOrder = useRef(false)
  const [clientDraft, setClientDraft] = useState(emptyClient)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [amountPaidDraft, setAmountPaidDraft] = useState(0)

  // StrictMode invokes effects twice in dev to catch impure side effects;
  // this guard keeps createOrder() from running twice and creating a duplicate order.
  //
  // Espera isLoading virar false antes de criar: ao abrir /pedidos/novo por
  // um carregamento de página cheio (não uma navegação client-side), o
  // OrdersProvider começa a buscar GET /orders no mesmo instante em que este
  // efeito dispararia o POST /orders — se a resposta do GET (que ainda não
  // inclui o rascunho recém-criado) chegar DEPOIS do POST, ela sobrescreve
  // `orders` no estado e apaga o rascunho, travando a tela em "Preparando
  // novo pedido..." pra sempre. Esperar a busca inicial terminar primeiro
  // garante a ordem (busca sempre antes de criar), eliminando a corrida em
  // vez de só torcer pra ela não acontecer.
  useEffect(() => {
    if (hasCreatedOrder.current) return
    if (isLoading) return
    hasCreatedOrder.current = true
    createOrder().then((id) => {
      if (id) setOrderId(id)
    })
  }, [createOrder, isLoading])

  const order = orders.find((item) => item.id === orderId)

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
  } = useProductList(orderId)

  function handleOrderInfoChange(event) {
    const { name, value } = event.target
    updateOrderInfo(orderId, { [name]: value })
  }

  // Só valida cliente/produtos e abre o modal de pagamento — finalizar de
  // verdade só acontece em confirmFinalizeOrder, depois que a pessoa
  // registrar quanto foi pago (item 3 do roadmap comercial).
  function handleFinalizeClick() {
    if (!clientDraft.personName) {
      alert('Preencha o nome do cliente antes de finalizar o pedido.')
      return
    }

    if (!clientDraft.document) {
      alert('Preencha o CPF/CNPJ do cliente antes de finalizar o pedido.')
      return
    }

    if (!clientDraft.phone) {
      alert('Preencha o telefone do cliente antes de finalizar o pedido.')
      return
    }

    if (products.length === 0) {
      alert('Adicione pelo menos um produto antes de finalizar o pedido.')
      return
    }

    setAmountPaidDraft(0)
    setIsPaymentModalOpen(true)
  }

  function handlePaymentDraftChange(event) {
    setAmountPaidDraft(event.target.value)
  }

  async function confirmFinalizeOrder() {
    // Cada passo só segue se o anterior deu certo — se algum falhar, o
    // Provider já mostrou o alert() com o motivo, então só paramos aqui.
    const clientId = await findOrCreateClient(clientDraft)
    if (!clientId) return

    const updated = await updateOrderInfo(orderId, {
      clientId,
      amountPaid: amountPaidDraft === '' ? 0 : Number(amountPaidDraft),
    })
    if (!updated) return

    const finalized = await finalizeOrder(orderId)
    if (!finalized) return

    navigate(`/pedidos/${orderId}`)
  }

  if (!order) {
    return (
      <Layout>
        <p>Preparando novo pedido...</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Novo Pedido</h1>
          <p>Cadastro de um novo pedido — {order.orderNumber}</p>
        </div>
      </div>

      <section className="form-section">
        <h2>Informações Gerais</h2>

        <ClientAutocomplete
          clients={clients}
          client={clientDraft}
          onChange={setClientDraft}
        />

        <div className="form-grid">
          <Input label="Vendedor" placeholder="Nome do vendedor" />
          <Input
            label="Prazo de entrega"
            type="date"
            name="deadline"
            value={order.deadline || ''}
            onChange={handleOrderInfoChange}
          />
        </div>
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

      <section className="finalize-order">
        <span>Valor total: {formatCurrency(order.totalValue)}</span>
        <Button onClick={handleFinalizeClick}>Finalizar Pedido</Button>
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
        onClose={() => setIsPaymentModalOpen(false)}
        title="Pagamento"
      >
        <PaymentFields
          totalValue={order.totalValue}
          amountPaid={amountPaidDraft}
          onChange={handlePaymentDraftChange}
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={confirmFinalizeOrder}>Confirmar e Finalizar</Button>
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
          orderId={orderId}
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

export default NewOrder
