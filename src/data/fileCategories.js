// As duas categorias de arquivo por produto (ver domain model no CLAUDE.md):
// 'referencia' é o material que a vendedora recebe do cliente na própria
// venda; 'layout_aprovado' é o mockup aprovado, consultado depois por toda a
// produção. Mesmo formato { value, label } de orderStages.js e
// designStatuses.js — os rótulos viviam duplicados entre NewOrder e
// OrderDetails, tanto no <select> quanto no ternário que traduz a categoria
// na lista de arquivos.
export const FILE_CATEGORIES = [
  { value: 'referencia', label: 'Referência' },
  { value: 'layout_aprovado', label: 'Layout aprovado' },
]

export function getFileCategoryLabel(value) {
  return FILE_CATEGORIES.find((category) => category.value === value)?.label || value
}
