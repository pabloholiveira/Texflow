import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/authContext'
import { ROLE_LABELS } from '../../data/permissions'

// Ícones outline (stroke, não preenchidos) — SVG inline, nenhuma lib externa.
const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    // Painéis assimétricos (widgets) — escolhido pelo Pablo entre variantes.
    icon: (
      <>
        <rect x="3" y="3" width="8" height="18" rx="1.5" />
        <rect x="14" y="3" width="7" height="8" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
  },
  {
    to: '/pedidos',
    label: 'Pedidos',
    icon: (
      <>
        <path d="M16 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
        <path d="M9 7h6M9 11h6M9 15h4" />
      </>
    ),
  },
  {
    to: '/clientes',
    label: 'Clientes',
    // `action` casa com a chave em src/data/permissions.js; sem action, o
    // item aparece para todo mundo. Mesma chave usada pra proteger a rota em
    // App.jsx — esconder do menu sem proteger a rota seria só maquiagem.
    action: 'clients.manage',
    // Silhueta única de pessoa (não o par de usuários).
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
      </>
    ),
  },
  {
    to: '/design',
    label: 'Design',
    // Lápis — trabalho de arte/design.
    icon: (
      <>
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        <path d="M15 5l4 4" />
      </>
    ),
  },
  {
    to: '/producao',
    label: 'Produção',
    icon: (
      <>
        <path d="M12 2l8.5 5v10L12 22l-8.5-5V7L12 2z" />
        <path d="M12 22v-10" />
        <path d="M3.5 7l8.5 5 8.5-5" />
      </>
    ),
  },
  {
    to: '/conferencia',
    label: 'Conferência',
    // Prancheta com check — conferir antes de entregar.
    icon: (
      <>
        <path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z" />
        <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
        <path d="M9 13l2 2 4-4" />
      </>
    ),
  },
  {
    to: '/relatorios',
    label: 'Relatórios',
    action: 'reports.view',
    icon: (
      <>
        <path d="M4 20V10" />
        <path d="M10 20V4" />
        <path d="M16 20v-7" />
        <path d="M22 20H2" />
      </>
    ),
  },
  {
    to: '/configuracoes',
    label: 'Configurações',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
  },
]

function Sidebar() {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()

  const visibleItems = NAV_ITEMS.filter((item) => !item.action || can(item.action))

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-brand-icon" aria-hidden="true">
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
        <span className="sidebar-brand-name">
          <span className="sidebar-brand-accent">T</span>exFlow
        </span>
      </div>

      <nav>
        {visibleItems.map((item) => (
          <NavLink to={item.to} key={item.to}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {item.icon}
            </svg>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        {user && (
          <span>
            {user.username}
            {/* Papel visível: sem isso, "sumiu o menu Clientes" vira mistério
                para quem está usando o sistema. */}
            <small className="sidebar-user-role">{ROLE_LABELS[user.role] || user.role}</small>
          </span>
        )}
        <button onClick={handleLogout}>Sair</button>
      </div>
    </aside>
  )
}

export default Sidebar
