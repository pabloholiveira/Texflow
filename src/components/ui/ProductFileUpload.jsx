import Input from './Input'
import Select from './Select'
import FileInput from './FileInput'
import { FILE_CATEGORIES } from '../../data/fileCategories'

// Só os três campos do upload — sem botões, como ClientFields e ProductFields
// também fazem. Quem usa é que decide a linha de ações (o modal de Arquivos
// tem "Fechar" ao lado, a tela de Design não).
//
// Existia duplicado verbatim entre OrderDetails e NewOrder desde que arquivos
// por produto foram construídos; virou componente ao entrar num terceiro
// lugar (Design, item 5).
function ProductFileUpload({ fileDraft, onDraftChange, onFileSelect }) {
  return (
    <>
      <Select
        label="Categoria"
        name="category"
        value={fileDraft.category}
        onChange={onDraftChange}
        options={FILE_CATEGORIES}
      />

      <Input
        label="Enviado por"
        placeholder="Seu nome"
        name="uploadedBy"
        value={fileDraft.uploadedBy}
        onChange={onDraftChange}
      />

      <FileInput label="Arquivo" onChange={onFileSelect} />
    </>
  )
}

export default ProductFileUpload
