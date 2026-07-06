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
    addProductFile,
  } = useOrders()

  const order = orders.find((item) => item.id === orderId)
  const products = order ? order.products : []

  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addStep, setAddStep] = useState('info')
  const [product, setProduct] = useState(emptyProduct)
  const [selectedSteps, setSelectedSteps] = useState([])

  // Referências (fotos, logo, tom de tecido) escolhidas durante o cadastro
  // do produto — ficam só como File do navegador até o produto existir de
  // verdade (ver saveNewProduct), já que não dá pra anexar arquivo a um
  // product_id que ainda não foi criado.
  const [referenceFiles, setReferenceFiles] = useState([])

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)

  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false)
  const [commentingProductId, setCommentingProductId] = useState(null)
  const [commentDraft, setCommentDraft] = useState({ author: '', text: '' })

  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false)
  const [filesProductId, setFilesProductId] = useState(null)
  const [fileDraft, setFileDraft] = useState({ category: 'referencia', uploadedBy: '' })
  const [selectedFile, setSelectedFile] = useState(null)

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
    setReferenceFiles([])
    setAddStep('info')
    setIsAddModalOpen(true)
  }

  function addReferenceFile(file) {
    setReferenceFiles((current) => [...current, file])
  }

  function removeReferenceFile(index) {
    setReferenceFiles((current) => current.filter((_, i) => i !== index))
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

    if (!created) return

    // Só depois do produto existir de verdade (tem um id real) é que dá pra
    // subir as referências escolhidas durante o cadastro.
    for (const file of referenceFiles) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('category', 'referencia')
      await addProductFile(orderId, created.id, formData)
    }

    closeAddModal()
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

  const filesProduct = products.find((item) => item.id === filesProductId)

  function openFilesModal(target) {
    setFilesProductId(target.id)
    setFileDraft({ category: 'referencia', uploadedBy: '' })
    setSelectedFile(null)
    setIsFilesModalOpen(true)
  }

  function closeFilesModal() {
    setIsFilesModalOpen(false)
    setFilesProductId(null)
  }

  function handleFileDraftChange(event) {
    const { name, value } = event.target
    setFileDraft({ ...fileDraft, [name]: value })
  }

  function handleFileSelect(event) {
    setSelectedFile(event.target.files[0] || null)
  }

  async function uploadFile() {
    if (!selectedFile) {
      alert('Escolha um arquivo.')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('category', fileDraft.category)
    if (fileDraft.uploadedBy) formData.append('uploadedBy', fileDraft.uploadedBy)

    const created = await addProductFile(orderId, filesProductId, formData)
    if (created) setSelectedFile(null)
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
    selectedFile,
    handleFileDraftChange,
    handleFileSelect,
    openFilesModal,
    closeFilesModal,
    uploadFile,
  }
}
