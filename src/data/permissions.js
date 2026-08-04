// Cópia da matriz de permissões que vive no backend
// (backend/src/auth/permissions.js). Aqui ela serve só para ESCONDER da tela
// o que a pessoa não pode fazer — quem de fato barra é sempre o servidor.
// Mesma duplicação deliberada de ORDER_STAGES: são dois processos Node
// separados, sem import compartilhado, então mudou aqui, mude lá.
//
// 'design' acumula tudo de 'vendedora' e soma o que é dele (mover card no
// kanban de design) — por isso aparece nos mesmos grupos, não em um isolado.
//
// 'gerente' acumula pela mesma lógica, do outro lado: tudo da vendedora MAIS
// a produção inteira. Fica a um passo do admin de propósito — sem
// Configurações e sem a tela /financeiro (FINANCE_ROLES).
const SALES_ROLES = ['admin', 'vendedora', 'design', 'gerente']
const DESIGN_ROLES = ['admin', 'design']
const PRODUCTION_ROLES = ['admin', 'producao', 'gerente']
const ADMIN_ONLY = ['admin']

/* Quem vê a tela /financeiro. Hoje coincide com ADMIN_ONLY, e ainda assim é
   constante própria: são decisões independentes. Liberar o faturamento para
   o gerente um dia não deve, no mesmo edit, entregar Configurações a ele. */
const FINANCE_ROLES = ['admin']

// Papéis que operam qualquer etapa, sem passar pela atribuição individual
// (user_operations). Espelha ALL_STEPS_ROLES do backend.
export const ALL_STEPS_ROLES = ['admin', 'gerente']

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
  'finance.view': FINANCE_ROLES,
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
  gerente: 'Gerente',
}

export const ROLES = Object.keys(ROLE_LABELS)
