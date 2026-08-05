import { useState } from 'react'
import { FILE_CATEGORIES } from '../../data/fileCategories'
import { useAuth } from '../../context/authContext'
import { useOrders } from '../../context/ordersContext'
import Button from './Button'
import Modal from './Modal'

// Lista os arquivos de um produto agrupados pelas duas categorias, em vez de
// uma lista corrida — quem está na produção procura "o layout aprovado", não
// "o terceiro arquivo".
//
// Excluir (2026-08-03) é opcional: só aparece quando quem chama passa orderId
// e productId E a pessoa tem 'orders.write'. Sem os ids o componente segue
// só-de-leitura, que é o padrão seguro — nenhuma tela ganha o botão por
// acidente.
//
// A permissão vem do contexto, não por prop: o componente é usado em três
// telas e as três teriam que repassar a mesma coisa. Mesma decisão já tomada
// no ProductCard.
function ProductFileList({
  files = [],
  emptyLabel = 'Nenhum arquivo ainda.',
  orderId,
  productId,
}) {
  const { can } = useAuth()
  const { removeProductFile } = useOrders()

  // Guarda o arquivo inteiro, não só o id: o modal precisa do NOME pra
  // escrever na confirmação. Ver o arquivo que se está prestes a apagar é o
  // que evita apagar o errado — motivo de isto ser um Modal e não um
  // confirm() do navegador, que a pessoa aprende a clicar no automático.
  const [fileToDelete, setFileToDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const canDelete = Boolean(orderId && productId && can('orders.write'))

  async function confirmDelete() {
    setIsDeleting(true)
    const removed = await removeProductFile(orderId, productId, fileToDelete.id)
    setIsDeleting(false)
    // Só fecha se deu certo — se falhou, o alerta do provider já apareceu e o
    // modal fica aberto mostrando de qual arquivo se tratava.
    if (removed) setFileToDelete(null)
  }

  if (files.length === 0) return <p className="product-files-empty">{emptyLabel}</p>

  return (
    <div className="product-files">
      {FILE_CATEGORIES.map((category) => {
        const ofCategory = files.filter((file) => file.category === category.value)
        if (ofCategory.length === 0) return null

        return (
          <div className="product-files-group" key={category.value}>
            <h4>{category.label}</h4>
            {category.hint && <p className="product-files-hint">{category.hint}</p>}

            <ul>
              {ofCategory.map((file) => (
                <li key={file.id}>
                  {/* rel="noreferrer" junto com target="_blank": sem ele a
                      página aberta consegue mexer na que a abriu. */}
                  <a href={file.fileUrl} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                  {file.uploadedBy && <span>por {file.uploadedBy}</span>}

                  {canDelete && (
                    <button
                      type="button"
                      className="product-file-delete"
                      onClick={() => setFileToDelete(file)}
                      aria-label={`Excluir ${file.fileName}`}
                    >
                      Excluir
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <Modal
        isOpen={Boolean(fileToDelete)}
        onClose={() => !isDeleting && setFileToDelete(null)}
        title="Excluir arquivo"
      >
        <p className="confirm-text">
          Excluir <strong>{fileToDelete?.fileName}</strong>?
        </p>
        <p className="confirm-hint">
          O arquivo sai do sistema e do armazenamento. Esta ação não pode ser
          desfeita.
        </p>

        <div className="modal-actions">
          <Button
            variant="secondary"
            onClick={() => setFileToDelete(null)}
            disabled={isDeleting}
          >
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmDelete} disabled={isDeleting}>
            {isDeleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default ProductFileList
