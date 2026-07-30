import { FILE_CATEGORIES } from '../../data/fileCategories'

// Lista os arquivos de um produto agrupados pelas duas categorias, em vez de
// uma lista corrida — quem está na produção procura "o layout aprovado", não
// "o terceiro arquivo". Só de leitura: o upload é o ProductFileUpload.
function ProductFileList({ files = [], emptyLabel = 'Nenhum arquivo ainda.' }) {
  if (files.length === 0) return <p className="product-files-empty">{emptyLabel}</p>

  return (
    <div className="product-files">
      {FILE_CATEGORIES.map((category) => {
        const ofCategory = files.filter((file) => file.category === category.value)
        if (ofCategory.length === 0) return null

        return (
          <div className="product-files-group" key={category.value}>
            <h4>{category.label}</h4>

            <ul>
              {ofCategory.map((file) => (
                <li key={file.id}>
                  {/* rel="noreferrer" junto com target="_blank": sem ele a
                      página aberta consegue mexer na que a abriu. */}
                  <a href={file.fileUrl} target="_blank" rel="noreferrer">
                    {file.fileName}
                  </a>
                  {file.uploadedBy && <span>por {file.uploadedBy}</span>}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default ProductFileList
