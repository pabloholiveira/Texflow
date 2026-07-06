import { useState } from 'react'
import Input from './Input'
import Button from './Button'
import ClientFields from './ClientFields'
import { getClientDisplayName } from '../../data/clients'

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

function ClientAutocomplete({ clients, client, onChange }) {
  const [search, setSearch] = useState('')
  const [isSelected, setIsSelected] = useState(false)

  const query = search.trim().toLowerCase()

  const matches = query
    ? clients
        .filter((item) =>
          [item.personName, item.companyName, item.document]
            .filter(Boolean)
            .some((field) => field.toLowerCase().includes(query))
        )
        .slice(0, 5)
    : []

  function handleSelect(selectedClient) {
    onChange(selectedClient)
    setIsSelected(true)
    setSearch('')
  }

  function handleClear() {
    onChange(emptyClient)
    setIsSelected(false)
  }

  function handleFieldChange(event) {
    const { name, value } = event.target
    onChange({ ...client, [name]: value })
  }

  if (isSelected) {
    return (
      <div className="client-selected">
        <div>
          <strong>{getClientDisplayName(client)}</strong>
          <p>
            {client.document} • {client.phone}
          </p>
        </div>

        <Button variant="secondary" onClick={handleClear}>
          Trocar cliente
        </Button>
      </div>
    )
  }

  return (
    <div className="client-autocomplete">
      <Input
        label="Buscar cliente existente"
        placeholder="Nome, empresa ou CPF/CNPJ"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {matches.length > 0 && (
        <div className="client-autocomplete-suggestions">
          {matches.map((match) => (
            <button
              key={match.id}
              type="button"
              className="client-autocomplete-suggestion"
              onClick={() => handleSelect(match)}
            >
              <strong>{getClientDisplayName(match)}</strong>
              <span>{match.document}</span>
            </button>
          ))}
        </div>
      )}

      <ClientFields client={client} onChange={handleFieldChange} />
    </div>
  )
}

export default ClientAutocomplete
