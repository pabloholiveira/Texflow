// Cópia da matriz de permissões que vive no backend
// (backend/src/auth/permissions.js). Aqui ela serve só para ESCONDER da tela
// o que a pessoa não pode fazer — quem de fato barra é sempre o servidor.
// Mesma duplicação deliberada de ORDER_STAGES: são dois processos Node
// separados, sem import compartilhado, então mudou aqui, mude lá.
//
// 'design' acumula tudo de 'vendedora' e soma o que é dele (mover card no
// kanban de design) — por isso aparece nos mesmos grupos, não em um isolado.
const SALES_ROLES = ['admin', 'vendedora', 'design']
const DESIGN_ROLES = ['admin', 'design']
const PRODUCTION_ROLES = ['admin', 'producao']
const ADMIN_ONLY = ['admin']

// Ação -> papéis que podem. Chaves com nome de ação (e não de tela) porque a
// mesma permissão governa vários lugares: 'orders.write' esconde o botão
// "Novo Pedido" na lista, a rota /pedidos/novo, "Avançar etapa" e os botões
// de editar/excluir dentro do ProductCard.
export const PERMISSIONS = {
  'orders.write': SALES_ROLES,
  'clients.manage': SALES_ROLES,
  'reports.view': SALES_ROLES,
  'design.move': DESIGN_ROLES,
  // Marcar retrabalho origina uma demanda de design — vem de quem fala com o
  // cliente ou do designer, não da produção (mesma regra do backend).
  'design.rework': SALES_ROLES,
  'production.move': PRODUCTION_ROLES,
  'settings.admin': ADMIN_ONLY,
}

export function can(user, action) {
  return !!user && (PERMISSIONS[action] || []).includes(user.role)
}

// Rótulos em português para o select de papel em Configurações.
export const ROLE_LABELS = {
  admin: 'Administrador',
  vendedora: 'Vendedora',
  design: 'Design',
  producao: 'Produção',
}

export const ROLES = Object.keys(ROLE_LABELS)
