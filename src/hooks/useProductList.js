import { useState } from 'react'
import { useOrders } from '../context/ordersContext'

const emptyProduct = {
  type: '',
  model: '',
  color: '',
  fabric: '',
  quantity: '',
  observations: '',
}

export function useProductList(orderId) {
  const {
    orders,
    addProduct: addProductToOrder,
    removeProduct: removeProductFromOrder,
    updateProductWorkflow,
    addProductComment,
  } = useOrders()

  const order = orders.find((item) => item.id === orderId)
  const products = order ? order.products : []

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addStep, setAddStep] = useState('info')
  const [product, setProduct] = useState(emptyProduct)
  const [selectedSteps, setSelectedSteps] = useState([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)

  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false)
  const [commentingProductId, setCommentingProductId] = useState(null)
  const [commentDraft, setCommentDraft] = useState({ author: '', text: '' })

  function handleChange(event) {
    const { name, value } = event.target

    setProduct({
      ...product,
      [name]: value,
    })
  }

  function openAddModal() {
    setProduct(emptyProduct)
    setSelectedSteps([])
    setAddStep('info')
    setIsAddModalOpen(true)
  }

  function closeAddModal() {
    setIsAddModalOpen(false)
  }

  function goToOperationsStep() {
    if (!product.type || !product.quantity) {
      alert('Preencha pelo menos o tipo da peça e a quantidade.')
      return
    }

    setAddStep('operations')
  }

  function goToInfoStep() {
    setAddStep('info')
  }

  async function saveNewProduct() {
    const created = await addProductToOrder(orderId, {
      ...product,
      operations: selectedSteps,
    })

    if (created) closeAddModal()
  }

  function removeProduct(productId) {
    removeProductFromOrder(orderId, productId)
  }

  function openEditModal(target) {
    setEditingProductId(target.id)
    setSelectedSteps(target.workflow.map((stage) => stage.step))
    setIsEditModalOpen(true)
  }

  function closeEditModal() {
    setIsEditModalOpen(false)
    setEditingProductId(null)
  }

  // Quem calcula o status de cada etapa (preservando o que já existia) é o
  // backend agora — ver PUT /products/:id/workflow (Etapa 3) — então aqui
  // só precisamos mandar a lista de nomes escolhidos.
  async function saveWorkflow() {
    const updated = await updateProductWorkflow(orderId, editingProductId, selectedSteps)
    if (updated) closeEditModal()
  }

  const commentingProduct = products.find(
    (item) => item.id === commentingProductId
  )

  function openCommentsModal(target) {
    setCommentingProductId(target.id)
    setCommentDraft({ author: '', text: '' })
    setIsCommentsModalOpen(true)
  }

  function closeCommentsModal() {
    setIsCommentsModalOpen(false)
    setCommentingProductId(null)
  }

  function handleCommentChange(event) {
    const { name, value } = event.target
    setCommentDraft({ ...commentDraft, [name]: value })
  }

  async function addComment() {
    if (!commentDraft.author || !commentDraft.text) {
      alert('Preencha o autor e o comentário.')
      return
    }

    const created = await addProductComment(orderId, commentingProductId, {
      author: commentDraft.author,
      text: commentDraft.text,
    })

    if (created) setCommentDraft({ ...commentDraft, text: '' })
  }

  return {
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
  }
}
