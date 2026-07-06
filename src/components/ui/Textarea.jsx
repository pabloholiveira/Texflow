function Textarea({ label, placeholder = '', value, onChange, name, rows = 3 }) {
  return (
    <div className="textarea-group">
      <label>{label}</label>

      <textarea
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
