import { useState } from 'react'
import { AuthContext } from './authContext'
import { authApi } from '../services/api'

// Token e usuário ficam também no localStorage (não só em useState) pra
// sobreviver a um F5 — sem isso, todo reload jogaria de volta pro /login
// mesmo com uma sessão ainda válida.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('texflow_token'))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('texflow_user')
    return stored ? JSON.parse(stored) : null
  })

  async function login(username, password) {
    try {
      const data = await authApi.login({ username, password })
      localStorage.setItem('texflow_token', data.token)
      localStorage.setItem('texflow_user', JSON.stringify(data.user))
      setToken(data.token)
      setUser(data.user)
      return true
    } catch (err) {
      alert(err.message)
      return false
    }
  }

  function logout() {
    localStorage.removeItem('texflow_token')
    localStorage.removeItem('texflow_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
