import { useState } from 'react'
import { useOrders } from '../context/ordersContext'
import { useAuth } from '../context/authContext'
import { sizesToList, sizesToMap, sumSizes } from '../data/sizes'
import { useProductFiles } from './useProductFiles'

const emptyProduct = {
  type: '',
  model: '',
  color: '',
  fabric: '',
  quantity: '',
  // Grade de tamanhos como objeto ({ P: 2 }) enquanto está no formulário;
  // vira lista na hora de mandar pra API — ver src/data/sizes.js.
  sizes: {},
  observations: '',
  unitPrice: '',
  needsVectorization: false,
  vectorizationPrice: '',
}

export function useProductList(orderId) {
  const {
    orders,
    addProduct: addProductToOrder,
    removeProduct: removeProductFromOrder,
    updateProductInfo,
    updateProductWorkflow,
    addProductComment,
    addProductFile,
  } = useOrders()
  const { user } = useAuth()

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

  // "Editar Dados" (tipo/modelo/cor/tecido/quantidade/valor) é um modal
  // separado de "Editar Etapas" acima — mesma ideia de um botão por
  // modal focado numa coisa só, já usada em Comentários/Arquivos.
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false)
  const [infoProductId, setInfoProductId] = useState(null)
  const [infoDraft, setInfoDraft] = useState(emptyProduct)

  const [isCommentsModalOpen, setIsCommentsModalOpen] = useState(false)
  const [commentingProductId, setCommentingProductId] = useState(null)
  const [commentDraft, setCommentDraft] = useState({ author: '', text: '' })

  const [isFilesModalOpen, setIsFilesModalOpen] = useState(false)
  const [filesProductId, setFilesProductId] = useState(null)
  // O formulário de upload em si mora num hook próprio (item 5): a tela de
  // Design precisa da mesma lógica, mas trabalha com produtos de vários
  // pedidos e não pode usar o useProductList, que é de um pedido só.
  const {
    fileDraft,
    selectedFile,
    resetFileDraft,
    handleFileDraftChange,
    handleFileSelect,
    uploadFile: uploadProductFile,
  } = useProductFiles()

  // Forma funcional (current => ...), não `{ ...product, ... }` direto: o
  // checkbox de vetorização (ProductFields) chama isso duas vezes seguidas
  // (needsVectorization e vectorizationPrice) na mesma função — com a forma
  // antiga, a segunda chamada partiria do `product` "congelado" de antes da
  // primeira, apagando-a. A forma funcional sempre parte do estado mais
  // recente, mesmo entre duas chamadas síncronas seguidas.
  function handleChange(event) {
    const { name, value } = event.target
    setProduct((current) => ({ ...current, [name]: value }))
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
    // Grade preenchida já define a quantidade (o servidor soma), então ela
    // vale como resposta pra "quantas peças?".
    if (!product.type || (!product.quantity && sumSizes(product.sizes) === 0)) {
      alert('Preencha o tipo da peça e a quantidade (ou a grade de tamanhos).')
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
      // String vazia não é um NUMERIC válido pro Postgres — vira null
      // (mesmo tratamento do "Editar Dados", ver saveInfoEdit).
      unitPrice: product.unitPrice === '' ? null : Number(product.unitPrice),
      vectorizationPrice:
        product.vectorizationPrice === '' ? null : Number(product.vectorizationPrice),
      sizes: sizesToList(product.sizes),
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

  function openInfoModal(target) {
    setInfoProductId(target.id)
    setInfoDraft({
      type: target.type,
      model: target.model || '',
      color: target.color || '',
      fabric: target.fabric || '',
      quantity: target.quantity,
      sizes: sizesToMap(target.sizes),
      observations: target.observations || '',
      unitPrice: target.unitPrice ?? '',
      needsVectorization: target.needsVectorization,
      vectorizationPrice: target.vectorizationPrice ?? '',
    })
    setIsInfoModalOpen(true)
  }

  function closeInfoModal() {
    setIsInfoModalOpen(false)
    setInfoProductId(null)
  }

  // Mesma razão da forma funcional em handleChange, acima.
  function handleInfoDraftChange(event) {
    const { name, value } = event.target
    setInfoDraft((current) => ({ ...current, [name]: value }))
  }

  async function saveInfoEdit() {
    if (!infoDraft.type || (!infoDraft.quantity && sumSizes(infoDraft.sizes) === 0)) {
      alert('Preencha o tipo da peça e a quantidade (ou a grade de tamanhos).')
      return
    }

    // Campo opcional: string vazia não é um NUMERIC válido pro Postgres,
    // então vira null (mesmo significado de "valor não informado" que a
    // coluna já usa).
    const updated = await updateProductInfo(orderId, infoProductId, {
      ...infoDraft,
      unitPrice: infoDraft.unitPrice === '' ? null : Number(infoDraft.unitPrice),
      vectorizationPrice:
        infoDraft.vectorizationPrice === '' ? null : Number(infoDraft.vectorizationPrice),
      sizes: sizesToList(infoDraft.sizes),
    })
    if (updated) closeInfoModal()
  }

  const commentingProduct = products.find(
    (item) => item.id === commentingProductId
  )

  function openCommentsModal(target) {
    setCommentingProductId(target.id)
    // Autor vem do usuário logado, não é mais digitado à mão — ver
    // "Estilo de trabalho"/roadmap no CLAUDE.md, item 1.1.
    setCommentDraft({ author: user?.username || '', text: '' })
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
    if (!commentDraft.text) {
      alert('Escreva um comentário.')
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
    resetFileDraft()
    setIsFilesModalOpen(true)
  }

  function closeFilesModal() {
    setIsFilesModalOpen(false)
    setFilesProductId(null)
  }

  // Esta tela tem um pedido só, então continua expondo uploadFile() sem
  // argumentos — quem recebe orderId/productId é o hook compartilhado.
  async function uploadFile() {
    await uploadProductFile(orderId, filesProductId)
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
    selectedFile,
    handleFileDraftChange,
    handleFileSelect,
    openFilesModal,
    closeFilesModal,
    uploadFile,
  }
}
