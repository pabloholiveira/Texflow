import { useState } from 'react'
import { useOrders } from '../context/ordersContext'

const emptyDraft = { category: 'referencia', uploadedBy: '' }

// Estado do formulário de upload de arquivo de produto, extraído do
// useProductList (item 5, 2026-07-30). O motivo da extração: o useProductList
// é montado com UM pedido (`useProductList(orderId)`), e a tela de Design
// trabalha com produtos de vários pedidos ao mesmo tempo — ela não tem um
// orderId só pra passar.
//
// Por isso `uploadFile` recebe orderId e productId como argumentos, em vez de
// pegá-los do fechamento: quem chama é que sabe de qual produto se trata.
// O useProductList continua expondo `uploadFile()` sem argumentos (ele TEM um
// pedido só), delegando pra cá — nenhuma tela que já usava precisou mudar.
export function useProductFiles() {
  const { addProductFile } = useOrders()

  const [fileDraft, setFileDraft] = useState(emptyDraft)
  const [selectedFile, setSelectedFile] = useState(null)

  // A categoria inicial é parâmetro porque o contexto muda o padrão sensato:
  // no cadastro do produto o que se anexa é referência; na tela de Design o
  // que se sobe é o layout aprovado.
  function resetFileDraft(category = 'referencia') {
    setFileDraft({ ...emptyDraft, category })
    setSelectedFile(null)
  }

  function handleFileDraftChange(event) {
    const { name, value } = event.target
    setFileDraft((current) => ({ ...current, [name]: value }))
  }

  function handleFileSelect(event) {
    setSelectedFile(event.target.files[0] || null)
  }

  async function uploadFile(orderId, productId) {
    if (!selectedFile) {
      alert('Escolha um arquivo.')
      return null
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('category', fileDraft.category)
    if (fileDraft.uploadedBy) formData.append('uploadedBy', fileDraft.uploadedBy)

    const created = await addProductFile(orderId, productId, formData)
    if (created) setSelectedFile(null)
    return created
  }

  return {
    fileDraft,
    selectedFile,
    resetFileDraft,
    handleFileDraftChange,
    handleFileSelect,
    uploadFile,
  }
}
