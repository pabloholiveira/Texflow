export const initialClients = [
  {
    id: 1,
    personName: 'Maria Silva',
    companyName: 'Colégio D. Pedro',
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

/* Atalho para quem só tem o `clientId` do pedido em mãos — os quadros de
   Produção/Conferência/Design achatam produtos e precisam etiquetar o nome
   do cliente em cada um.

   Existe para que a busca na lista continue passando por
   getClientDisplayName, que é o único lugar que decide o que se exibe de um
   cliente (empresa se houver, senão a pessoa). Antes disto, a seção
   "Prontos para retirada" da Conferência lia `client.personName` na mão e
   mostrava a pessoa mesmo quando o cliente era uma empresa. */
export function getClientNameById(clients, clientId) {
  return getClientDisplayName(clients.find((client) => client.id === clientId))
}
