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
import { useProductList } from '../../hooks/useProductList'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

function NewOrder() {
  const navigate = useNavigate()
  const { orders, createOrder, finalizeOrder, updateOrderInfo } = useOrders()
  const { clients, findOrCreateClient } = useClients()
  const [orderId, setOrderId] = useState(null)
  const hasCreatedOrder = useRef(false)
  const [clientDraft, setClientDraft] = useState(emptyClient)

  // StrictMode invokes effects twice in dev to catch impure side effects;
  // this guard keeps createOrder() from running twice and creating a duplicate order.
  useEffect(() => {
    if (hasCreatedOrder.current) return
    hasCreatedOrder.current = true
    createOrder().then((id) => {
      if (id) setOrderId(id)
    })
  }, [createOrder])

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
    referenceFiles,
    addReferenceFile,
    removeReferenceFile,
    removeProduct,
    isEditModalOpen,
    openEditModal,
    closeEditModal,
    saveWorkflow,
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

  async function handleFinalizeOrder() {
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

    // Cada passo só segue se o anterior deu certo — se algum falhar, o
    // Provider já mostrou o alert() com o motivo, então só paramos aqui.
    const clientId = await findOrCreateClient(clientDraft)
    if (!clientId) return

    const updated = await updateOrderInfo(orderId, { clientId })
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
            onOpenComments={openCommentsModal}
            onOpenFiles={openFilesModal}
           />
        ))}
      </section>

      <section className="finalize-order">
        <Button onClick={handleFinalizeOrder}>Finalizar Pedido</Button>
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

        <Input
          label="Autor"
          placeholder="Seu nome"
          name="author"
          value={commentDraft.author}
          onChange={handleCommentChange}
        />

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

export default NewOrder
