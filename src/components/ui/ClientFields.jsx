import Input from './Input'

function ClientFields({ client, onChange }) {
  return (
    <div className="form-grid">
      <Input
        label="Nome do cliente"
        placeholder="Nome da pessoa de contato"
        name="personName"
        value={client.personName}
        onChange={onChange}
      />

      <Input
        label="Nome da empresa (opcional)"
        placeholder="Ex: Escola Alfa"
        name="companyName"
        value={client.companyName}
        onChange={onChange}
      />

      <Input
        label="CPF/CNPJ"
        placeholder="000.000.000-00"
        name="document"
        value={client.document}
        onChange={onChange}
      />

      <Input
        label="Telefone"
        placeholder="(11) 90000-0000"
        name="phone"
        value={client.phone}
        onChange={onChange}
      />

      <Input
        label="Email (opcional)"
        placeholder="contato@empresa.com"
        name="email"
        value={client.email}
        onChange={onChange}
      />
    </div>
  )
}

export default ClientFields
