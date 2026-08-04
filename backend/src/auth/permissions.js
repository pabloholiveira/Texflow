// Matriz de permissões por papel, fixa no código (decisão do Pablo: sem tela
// de administração de permissões — ajustar quem pode o quê é mudança pontual
// aqui). Os grupos abaixo são a fonte da verdade do backend; o front tem uma
// cópia em src/data/permissions.js, que serve só para ESCONDER o que a pessoa
// não pode fazer. Quem de fato barra é sempre este lado — mesmo motivo pelo
// qual ORDER_STAGES é duplicado entre os dois processos (Node separado, sem
// import compartilhado): se mudar aqui, mude lá também.
export const ROLES = ['admin', 'vendedora', 'design', 'producao', 'gerente']

// 'design' acumula tudo de 'vendedora' e soma o que é dele (mover card no
// kanban de design) — por isso aparece nos dois grupos abaixo, e não em um
// grupo isolado. Na prática 'design' só não tem: Configurações e mover etapa
// de produção.
//
// 'gerente' acumula pela mesma lógica, mas do outro lado: tudo da vendedora
// MAIS a produção inteira. Ele fica a um passo do admin de propósito — não
// entra em ADMIN_ONLY (Configurações) nem em FINANCE_ROLES (a tela
// /financeiro, construída em 2026-08-04).
export const SALES_ROLES = ['admin', 'vendedora', 'design', 'gerente']
export const DESIGN_ROLES = ['admin', 'design']
export const PRODUCTION_ROLES = ['admin', 'producao', 'gerente']
export const ADMIN_ONLY = ['admin']

/* Quem vê a tela /financeiro. Hoje é o mesmo conjunto que ADMIN_ONLY, e
   mesmo assim é uma constante própria: são decisões independentes que
   apenas coincidem. Se um dia a Elaine quiser que o gerente veja o
   faturamento sem ganhar Configurações, mexe-se aqui e nada mais — com uma
   constante compartilhada, o mesmo edit abriria as duas coisas. */
export const FINANCE_ROLES = ['admin']

// Papéis que operam QUALQUER etapa, sem passar pela atribuição individual da
// tabela user_operations. O gerente entra aqui porque o sentido dele é cobrir
// quem faltou — pré-atribuir etapa por etapa anularia isso. Quem é 'producao'
// continua limitado ao que foi atribuído.
export const ALL_STEPS_ROLES = ['admin', 'gerente']
