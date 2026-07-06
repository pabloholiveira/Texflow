function Input({
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  name,
}) {
  return (
    <div className="input-group">
      <label>{label}</label>

      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

export default Input