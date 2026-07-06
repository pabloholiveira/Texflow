import { useEffect, useState } from 'react'
import { ClientsContext } from './clientsContext'
import { useAuth } from './authContext'
import { clientsApi } from '../services/api'

export function ClientsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [clients, setClients] = useState([])

  // Mesma razão do OrdersProvider: só busca depois de logado, e refaz
  // sozinho quando isAuthenticated vira true.
  useEffect(() => {
    if (!isAuthenticated) {
      setClients([])
      return
    }

    clientsApi
      .list()
      .then(setClients)
      .catch((err) => alert(err.message))
  }, [isAuthenticated])

  function upsertClient(client) {
    setClients((current) => {
      const exists = current.some((item) => item.id === client.id)
      return exists
        ? current.map((item) => (item.id === client.id ? client : item))
        : [...current, client]
    })
  }

  async function addClient(client) {
    try {
      const created = await clientsApi.create(client)
      upsertClient(created)
      return created
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  // Espelha o findOrCreateClient de antes: casa só por `document`, cria se
  // não achar. Continua devolvendo só o id (mesmo contrato de antes) porque
  // é só isso que NewOrder precisa pra montar { clientId }.
  async function findOrCreateClient(clientInfo) {
    try {
      const client = await clientsApi.findOrCreate(clientInfo)
      upsertClient(client)
      return client.id
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  return (
    <ClientsContext.Provider value={{ clients, addClient, findOrCreateClient }}>
      {children}
    </ClientsContext.Provider>
  )
}
