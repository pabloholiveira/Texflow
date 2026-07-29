import { useId } from 'react'

function Textarea({ label, placeholder = '', value, onChange, name, rows = 3 }) {
  // Ver comentário em Input.jsx sobre por que o id vem do useId.
  const id = useId()

  return (
    <div className="textarea-group">
      <label htmlFor={id}>{label}</label>

      <textarea
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        rows={rows}
      />
    </div>
  )
}

export default Textarea
