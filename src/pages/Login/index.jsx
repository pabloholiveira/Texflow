import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { authApi } from '../../services/api'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import '../../styles/login.css'

function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Item 6: sem e-mail cadastrado não dá pra mandar link de recuperação, então
  // o "esqueci minha senha" registra um pedido que um admin aprova dentro do
  // sistema. Reaproveita o usuário já digitado no formulário — pedir o nome
  // de novo num prompt seria atrito à toa.
  async function handleForgotPassword() {
    if (!username) {
      alert('Digite seu usuário primeiro, depois clique em "Esqueci minha senha".')
      return
    }

    try {
      const data = await authApi.requestPasswordReset(username)
      alert(data.message)
    } catch (err) {
      alert(err.message)
    }
  }

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
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <g transform="scale(-1 1) translate(-24 0)">
              <path d="M3 18.5h18" />
              <path d="M18.5 18.5V8a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v3.5" />
              <path d="M6.5 14.5v2.5" />
              <path d="M18.5 9.5a2 2 0 1 1 0 4" />
              <path d="M11 6V4" />
            </g>
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

        <button type="button" className="login-forgot" onClick={handleForgotPassword}>
          Esqueci minha senha
        </button>
      </form>
    </div>
  )
}

export default Login
