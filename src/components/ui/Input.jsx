import { useId } from 'react'

function Input({
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  name,
  step,
}) {
  // useId (React 19) gera um id único e estável por INSTÂNCIA do componente —
  // é o que permite dois <Input label="Modelo"> na mesma tela sem colidir.
  // Não dá pra usar `name` como id: o mesmo name se repete entre formulários
  // (dois "quantity" em modais diferentes, por exemplo), e id repetido faz o
  // <label> apontar pro campo errado.
  const id = useId()

  return (
    <div className="input-group">
      <label htmlFor={id}>{label}</label>

      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        step={step}
      />
    </div>
  )
}

export default Input