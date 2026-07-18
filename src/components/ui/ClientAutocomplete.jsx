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

// initiallySelected: começa no modo compacto ("cliente selecionado" +
// "Trocar cliente") em vez do modo busca/cadastro. Serve pra quem já tem um
// cliente vinculado (editar um pedido existente): sem isso os 5 campos
// nasceriam editáveis e daria pra alterar o CPF do cliente sem querer,
// achando que era só uma troca — que é justamente o que o modo compacto
// evita. No cadastro de um pedido novo continua false (não há cliente ainda).
function ClientAutocomplete({ clients, client, onChange, initiallySelected = false }) {
  const [search, setSearch] = useState('')
  const [isSelected, setIsSelected] = useState(initiallySelected)

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
