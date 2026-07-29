import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import Layout from './Layout'

// Duas checagens diferentes, na ordem:
// 1. Não logado -> vai pro /login (não é falta de permissão, é falta de sessão).
// 2. Logado mas sem a permissão da rota -> fica no app, com a tela de aviso.
//    Não redireciona em silêncio: quem digitou a URL na mão precisa entender
//    por que não entrou. O item some do menu de qualquer jeito, então essa
//    tela só aparece por URL direta ou link antigo.
function ProtectedRoute({ children, action }) {
  const { isAuthenticated, can } = useAuth()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (action && !can(action)) {
    return (
      <Layout>
        <div className="no-access">
          <h1>Sem acesso</h1>
          <p>Seu perfil não tem permissão para abrir esta tela.</p>
          <Link to="/" className="btn btn-primary">
            Voltar ao início
          </Link>
        </div>
      </Layout>
    )
  }

  return children
}

export default ProtectedRoute
