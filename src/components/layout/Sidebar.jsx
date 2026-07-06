import { NavLink } from 'react-router-dom'

function Sidebar() {
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
    </aside>
  )
}

export default Sidebar