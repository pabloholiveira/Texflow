export const initialClients = [
  {
    id: 1,
    personName: 'Maria Silva',
    companyName: 'Escola Alfa',
    document: '12.345.678/0001-90',
    phone: '(11) 91234-5678',
    email: '',
  },
  {
    id: 2,
    personName: 'João Souza',
    companyName: 'Igreja Vida',
    document: '23.456.789/0001-01',
    phone: '(11) 99876-5432',
    email: '',
  },
  {
    id: 3,
    personName: 'Ana Pereira',
    companyName: 'Empresa XP',
    document: '34.567.890/0001-12',
    phone: '(11) 93456-7890',
    email: '',
  },
]

export function getClientDisplayName(client) {
  if (!client) return 'Cliente não informado'
  return client.companyName || client.personName
}
