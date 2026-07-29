import { useId } from 'react'

// Campo de arquivo com rótulo associado. Existe separado do Input porque um
// <input type="file"> é sempre NÃO-CONTROLADO — o navegador não deixa definir
// o `value` por código (seria um jeito de forjar um upload), então ele não
// tem o par value/onChange que o Input assume. Limpar o campo depois de
// escolher (`event.target.value = ''`) continua sendo tarefa de quem usa,
// como já era: aqui não há estado nenhum.
function FileInput({ label, onChange, accept }) {
  // Ver comentário em Input.jsx sobre por que o id vem do useId.
  const id = useId()

  return (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>

      <input id={id} type="file" accept={accept} onChange={onChange} />
    </div>
  )
}

export default FileInput
