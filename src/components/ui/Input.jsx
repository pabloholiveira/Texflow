import { useId } from 'react'

function Input({
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  name,
  step,
  // readOnly (e não disabled) quando o valor é calculado pelo sistema: um
  // campo disabled não é lido por leitor de tela nem recebe foco, e aqui o
  // número continua sendo informação que a pessoa precisa conseguir ler.
  readOnly = false,
  hint,
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
        readOnly={readOnly}
      />

      {hint && <small className="input-hint">{hint}</small>}
    </div>
  )
}

export default Input