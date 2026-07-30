import { useEffect, useState } from 'react'
import { SettingsContext } from './settingsContext'
import { useAuth } from './authContext'
import { settingsApi } from '../services/api'
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  DEFAULT_WHATSAPP_READY_TEMPLATE,
} from '../utils/whatsapp'

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE)
  // Segunda mensagem: "pedido pronto para retirada" (item 2, parte 2).
  const [whatsappReadyTemplate, setWhatsappReadyTemplate] = useState(
    DEFAULT_WHATSAPP_READY_TEMPLATE
  )

  // Mesma razão do OrdersProvider/OperationsProvider: só busca depois de
  // logado, e refaz sozinho quando isAuthenticated vira true.
  useEffect(() => {
    if (!isAuthenticated) return

    settingsApi
      .getWhatsappTemplate()
      .then((data) => setWhatsappTemplate(data.value))
      .catch((err) => alert(err.message))

    settingsApi
      .getWhatsappReadyTemplate()
      .then((data) => setWhatsappReadyTemplate(data.value))
      .catch((err) => alert(err.message))
  }, [isAuthenticated])

  async function updateWhatsappTemplate(value) {
    try {
      const data = await settingsApi.updateWhatsappTemplate(value)
      setWhatsappTemplate(data.value)
      return data.value
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function updateWhatsappReadyTemplate(value) {
    try {
      const data = await settingsApi.updateWhatsappReadyTemplate(value)
      setWhatsappReadyTemplate(data.value)
      return data.value
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        whatsappTemplate,
        updateWhatsappTemplate,
        whatsappReadyTemplate,
        updateWhatsappReadyTemplate,
      }}
    >
      {children}
    </SettingsContext.Provider>
  )
}
