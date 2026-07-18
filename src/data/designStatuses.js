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
