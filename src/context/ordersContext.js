import { createContext, useContext } from 'react'

export const OrdersContext = createContext(null)

export function useOrders() {
  return useContext(OrdersContext)
}
