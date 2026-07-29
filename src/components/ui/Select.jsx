import { useId } from 'react'

// Espelha a forma de props do Input (label/name/value/onChange), mais
// `options: [{ value, label }]`. Era um arquivo vazio desde o começo do
// projeto; ganhou implementação agora porque o <select> de "Categoria" no
// modal de arquivos estava duplicado verbatim entre NewOrder e OrderDetails,
// e consertar o rótulo nos dois lugares seria duplicar o conserto também.
function Select({ label, name, value, onChange, options = [] }) {
  // Ver comentário em Input.jsx sobre por que o id vem do useId.
  const id = useId()

  return (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>

      <select id={id} name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option value={option.value} key={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export default Select
