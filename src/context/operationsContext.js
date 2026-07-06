import { createContext, useContext } from 'react'

export const OperationsContext = createContext(null)

export function useOperations() {
  return useContext(OperationsContext)
}
