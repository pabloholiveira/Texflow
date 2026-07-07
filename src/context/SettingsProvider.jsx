import { useEffect, useState } from 'react'
import { SettingsContext } from './settingsContext'
import { useAuth } from './authContext'
import { settingsApi } from '../services/api'
import { DEFAULT_WHATSAPP_TEMPLATE } from '../utils/whatsapp'

export function SettingsProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [whatsappTemplate, setWhatsappTemplate] = useState(DEFAULT_WHATSAPP_TEMPLATE)

  // Mesma razão do OrdersProvider/OperationsProvider: só busca depois de
  // logado, e refaz sozinho quando isAuthenticated vira true.
  useEffect(() => {
    if (!isAuthenticated) return

    settingsApi
      .getWhatsappTemplate()
      .then((data) => setWhatsappTemplate(data.value))
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

  return (
    <SettingsContext.Provider value={{ whatsappTemplate, updateWhatsappTemplate }}>
      {children}
    </SettingsContext.Provider>
  )
}
