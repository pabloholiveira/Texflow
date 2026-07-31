// Mesmo papel de orderStages.js, para o status de design do produto (item
// 3.1): a lista na ordem das colunas do kanban de /design, mais o tradutor
// de valor do banco para rótulo de tela. Ficava só dentro da página Design
// até o histórico (item 3.3) precisar dos mesmos nomes — em vez de repetir
// os rótulos nos dois lugares, virou um módulo compartilhado.
export const DESIGN_STATUSES = [
  { value: 'pendente', label: 'Pendente' },
  { value: 'em_design', label: 'Em design' },
  { value: 'aprovacao', label: 'Aprovação' },
  { value: 'concluido', label: 'Concluído' },
]

export function getDesignStatusLabel(status) {
  if (!status) return 'Fora da fila'
  return DESIGN_STATUSES.find((item) => item.value === status)?.label ?? status
}

// Por quantos dias um design concluído continua aparecendo na coluna
// "Concluído". Antes disto o card só saía quando o PEDIDO era entregue, o
// que leva semanas — a coluna virava um arquivo morto crescente.
export const DESIGN_DONE_VISIBLE_DAYS = 7

/* Some da tela, não do banco: `designStatus` continua 'concluido' e o
   histórico do pedido guarda todas as transições. A coluna é uma caixa de
   saída recente ("o que acabei de entregar para a produção"), não um
   arquivo — para consultar design antigo existe o pedido.

   Sem carimbo (`designConcludedAt` nulo) o card FICA visível: é o que
   acontece se o backend for mais antigo que esta regra, e sumir com um card
   por falta de dado seria pior que mostrá-lo a mais. */
export function isDesignCardVisible(product) {
  if (product.designStatus !== 'concluido') return true
  if (!product.designConcludedAt) return true

  const dias = (Date.now() - new Date(product.designConcludedAt)) / 86400000
  return dias < DESIGN_DONE_VISIBLE_DAYS
}
