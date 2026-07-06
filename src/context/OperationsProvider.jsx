import { useEffect, useState } from 'react'
import { OperationsContext } from './operationsContext'
import { useAuth } from './authContext'
import { operationsApi } from '../services/api'

export function OperationsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  // Guarda {id, name} internamente (precisa do id pra poder chamar DELETE
  // /operations/:id), mas expõe `operations` como string[] pra Settings,
  // Production e OperationsChecklist não precisarem mudar nada.
  const [operationsData, setOperationsData] = useState([])

  // Mesma razão do OrdersProvider: só busca depois de logado, e refaz
  // sozinho quando isAuthenticated vira true. Não reseta `operationsData` no
  // ramo "não autenticado" (ver comentário equivalente em OrdersProvider).
  useEffect(() => {
    if (!isAuthenticated) return

    operationsApi
      .list()
      .then(setOperationsData)
      .catch((err) => alert(err.message))
  }, [isAuthenticated])

  async function addOperation(name, position = null) {
    try {
      const created = await operationsApi.create(name, position)
      setOperationsData((current) => [...current, created])
      return created
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function removeOperation(name) {
    const target = operationsData.find((item) => item.name === name)
    if (!target) return null

    try {
      await operationsApi.remove(target.id)
      setOperationsData((current) => current.filter((item) => item.id !== target.id))
      return target
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  const operations = operationsData.map((item) => item.name)

  return (
    <OperationsContext.Provider
      value={{ operations, operationsData, addOperation, removeOperation }}
    >
      {children}
    </OperationsContext.Provider>
  )
}
