import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'

function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <h2>TexFlow</h2>

      <nav>
        <NavLink to="/">Dashboard</NavLink>

        <NavLink to="/pedidos">Pedidos</NavLink>

        <NavLink to="/clientes">Clientes</NavLink>

        <NavLink to="/producao">Produção</NavLink>

        <NavLink to="/relatorios">Relatórios</NavLink>

        <NavLink to="/configuracoes">Configurações</NavLink>
      </nav>

      <div className="sidebar-user">
        {user && <span>{user.username}</span>}
        <button onClick={handleLogout}>Sair</button>
      </div>
    </aside>
  )
}

export default Sidebar