import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import '../../styles/login.css'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setIsSubmitting(true)
    const success = await login(username, password)
    setIsSubmitting(false)
    if (success) navigate('/')
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <span className="login-brand-icon" aria-hidden="true">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 12 7.5 12 10 6.5 14 17.5 16.5 12 21 12" />
          </svg>
        </span>
        <span className="login-brand-name">
          <span className="login-brand-accent">T</span>exFlow
        </span>
      </div>

      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Acesse sua conta</h1>

        <Input
          label="Usuário"
          name="username"
          placeholder="Seu usuário"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <Input
          label="Senha"
          name="password"
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}

export default Login
