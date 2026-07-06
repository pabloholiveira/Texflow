import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import OperationsChecklist from '../../components/ui/OperationsChecklist'
import Textarea from '../../components/ui/Textarea'
import ProductCard from '../../components/ui/ProductCard'
import ProductFields from '../../components/ui/ProductFields'
import { useProductList } from '../../hooks/useProductList'
import { useOrders } from '../../context/ordersContext'
import { useClients } from '../../context/clientsContext'
import {
  ORDER_STAGES,
  getStageState,
  getStageLabel,
} from '../../data/orderStages'
import { getClientDisplayName } from '../../data/clients'

function OrderDetails() {
  const { id } = useParams()
  const { orders, isLoading, advanceOrderStage } = useOrders()
  const { clients } = useClients()
  const order = orders.find((item) => item.id === id)
  const client = order && clients.find((item) => item.id === order.clientId)

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

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <p>{getClientDisplayName(client)}</p>
        </div>

        <button>Editar Pedido</button>
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
      </section>

      <section className="order-stages">
        <div className="products-panel-header">
          <h2>Etapas do Pedido</h2>

          <Button
            variant="secondary"
            onClick={() => advanceOrderStage(order.id)}
            disabled={order.stage === 'producao'}
          >
            Avançar etapa
          </Button>
        </div>

        <div className="stage-list">
          {ORDER_STAGES.filter((stage) => stage.value !== 'producao').map(
            (stage) => (
              <div
                key={stage.value}
                className={`stage-chip stage-chip-${getStageState(
                  stage.value,
                  order.stage
                )}`}
              >
                {stage.label}
              </div>
            )
          )}
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
    </Layout>
  )
}

export default OrderDetails
