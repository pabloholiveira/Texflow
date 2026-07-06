import { createContext, useContext } from 'react'

export const ClientsContext = createContext(null)

export function useClients() {
  return useContext(ClientsContext)
}
