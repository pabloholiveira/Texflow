// Matriz de permissões por papel, fixa no código (decisão do Pablo: sem tela
// de administração de permissões — ajustar quem pode o quê é mudança pontual
// aqui). Os grupos abaixo são a fonte da verdade do backend; o front tem uma
// cópia em src/data/permissions.js, que serve só para ESCONDER o que a pessoa
// não pode fazer. Quem de fato barra é sempre este lado — mesmo motivo pelo
// qual ORDER_STAGES é duplicado entre os dois processos (Node separado, sem
// import compartilhado): se mudar aqui, mude lá também.
export const ROLES = ['admin', 'vendedora', 'design', 'producao']

// 'design' acumula tudo de 'vendedora' e soma o que é dele (mover card no
// kanban de design) — por isso aparece nos dois grupos abaixo, e não em um
// grupo isolado. Na prática 'design' só não tem: Configurações e mover etapa
// de produção.
export const SALES_ROLES = ['admin', 'vendedora', 'design']
export const DESIGN_ROLES = ['admin', 'design']
export const PRODUCTION_ROLES = ['admin', 'producao']
export const ADMIN_ONLY = ['admin']
