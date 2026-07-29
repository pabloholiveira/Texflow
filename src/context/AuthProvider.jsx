import { useEffect, useState } from 'react'
import { AuthContext } from './authContext'
import { authApi, usersApi } from '../services/api'
import { can as canDo } from '../data/permissions'

// Token e usuário ficam também no localStorage (não só em useState) pra
// sobreviver a um F5 — sem isso, todo reload jogaria de volta pro /login
// mesmo com uma sessão ainda válida.
export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('texflow_token'))
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('texflow_user')
    return stored ? JSON.parse(stored) : null
  })
  // Etapas que este usuário de produção pode operar. Só serve pra esconder
  // botão — o backend confere de novo em canOperateStep. Fica aqui (e não no
  // OperationsProvider) porque é dado DO USUÁRIO logado, não do catálogo.
  const [allowedSteps, setAllowedSteps] = useState([])

  useEffect(() => {
    // Só quem é 'producao' tem lista: admin passa por tudo e os outros papéis
    // não movem etapa nenhuma, então nem vale a requisição.
    if (!token || user?.role !== 'producao') return

    usersApi
      .operations(user.id)
      .then((rows) => setAllowedSteps(rows.map((row) => row.name)))
      .catch(() => setAllowedSteps([]))
  }, [token, user])

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
    setAllowedSteps([])
  }

  // `can('orders.write')` já amarrado no usuário logado, pra cada tela não
  // precisar repetir `can(user, ...)`.
  function can(action) {
    return canDo(user, action)
  }

  // Espelha canOperateStep do backend (usersQueries.js), inclusive as duas
  // isenções: admin passa por tudo, e etapa fora do catálogo ("outra
  // operação", digitada à mão na venda) é livre pra qualquer um da produção.
  // `catalog` vem de useOperations() na tela que chama — este contexto não
  // conhece o catálogo de operações.
  function canOperateStep(step, catalog = []) {
    if (!canDo(user, 'production.move')) return false
    if (user.role === 'admin') return true
    if (!catalog.includes(step)) return true
    return allowedSteps.includes(step)
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!token, login, logout, can, canOperateStep, allowedSteps }}
    >
      {children}
    </AuthContext.Provider>
  )
}
