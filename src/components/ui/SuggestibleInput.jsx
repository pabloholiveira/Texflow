import { useId, useState } from 'react'

function SuggestibleInput({
  label,
  placeholder = '',
  name,
  value,
  onChange,
  suggestions,
}) {
  const [isFocused, setIsFocused] = useState(false)
  // Ver comentário em Input.jsx sobre por que o id vem do useId.
  const id = useId()

  const query = value.trim().toLowerCase()

  const matches = query
    ? suggestions
        .filter(
          (suggestion) =>
            suggestion.toLowerCase().includes(query) &&
            suggestion.toLowerCase() !== query
        )
        .slice(0, 5)
    : []

  function selectSuggestion(suggestion) {
    onChange({ target: { name, value: suggestion } })
    setIsFocused(false)
  }

  return (
    <div className="input-group suggestible-input">
      <label htmlFor={id}>{label}</label>

      <input
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
      />

      {isFocused && matches.length > 0 && (
        <div className="suggestion-list">
          {matches.map((suggestion) => (
            // onMouseDown (not onClick) fires before the input's onBlur hides this list
            <button
              key={suggestion}
              type="button"
              className="suggestion-item"
              onMouseDown={() => selectSuggestion(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SuggestibleInput
