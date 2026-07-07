function Input({
  label,
  type = 'text',
  placeholder = '',
  value,
  onChange,
  name,
  step,
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
        step={step}
      />
    </div>
  )
}

export default Input