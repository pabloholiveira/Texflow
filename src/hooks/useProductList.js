import { useRef, useState } from 'react'
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
  printObservations: '',
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

  // Salvar um produto espera o servidor de propósito (o produto precisa ter um
  // id real antes de qualquer arquivo ser anexado), e isso leva de 1 a vários
  // segundos. Sem sinal na tela a pessoa acha que travou e clica de novo —
  // criando dois produtos. Daí o par estado + ref:
  //   - o estado é o que a tela lê (botão desabilitado, texto "Salvando...");
  //   - o ref é a trava de verdade. Dois cliques no mesmo tick leriam o estado
  //     ainda como `false` (o React só re-renderiza depois), enquanto o ref
  //     muda na hora. Mesma razão do hasCreatedOrder em NewOrder.
  const [isSavingProduct, setIsSavingProduct] = useState(false)
  const savingProductRef = useRef(false)

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

  // Ignora o fechamento enquanto salva. O Modal chama isto pelo X, pelo Esc e
  // pelo clique no fundo — barrar aqui cobre os três de uma vez, em vez de
  // tratar cada um. Fechar no meio faria parecer que a gravação foi cancelada,
  // quando na verdade ela seguiria até o fim no servidor.
  function closeAddModal() {
    if (savingProductRef.current) return
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
    if (savingProductRef.current) return
    savingProductRef.current = true
    setIsSavingProduct(true)

    try {
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

      // O `return` aqui ainda passa pelo finally (que libera a trava), mas
      // não fecha o modal — que é o certo quando a gravação falhou: o que foi
      // digitado continua na tela.
      if (!created) return

      // Só depois do produto existir de verdade (tem um id real) é que dá pra
      // subir as referências escolhidas durante o cadastro.
      //
      // Em paralelo, não uma esperando a outra: cada upload é uma ida ao
      // Cloudinary, então em série o tempo era a SOMA de todas. Com Promise.all
      // passa a ser o da mais lenta.
      await Promise.all(
        referenceFiles.map((file) => {
          const formData = new FormData()
          formData.append('file', file)
          formData.append('category', 'referencia')
          return addProductFile(orderId, created.id, formData)
        })
      )

      // Fecha direto, sem passar pelo closeAddModal: o guard de lá existe pra
      // barrar o fechamento iniciado pela PESSOA (X, Esc, clique no fundo)
      // durante a gravação — este aqui é o fechamento do próprio sucesso.
      setIsAddModalOpen(false)
    } finally {
      savingProductRef.current = false
      setIsSavingProduct(false)
    }
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
      printObservations: target.printObservations || '',
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
    selectedFile,
    handleFileDraftChange,
    handleFileSelect,
    openFilesModal,
    closeFilesModal,
    uploadFile,
  }
}
