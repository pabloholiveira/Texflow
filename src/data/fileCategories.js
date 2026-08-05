// As duas categorias de arquivo por produto (ver domain model no CLAUDE.md):
// 'referencia' é o material que a vendedora recebe do cliente na própria
// venda; 'layout_aprovado' é o mockup aprovado, consultado depois por toda a
// produção. Mesmo formato { value, label } de orderStages.js e
// designStatuses.js — os rótulos viviam duplicados entre NewOrder e
// OrderDetails, tanto no <select> quanto no ternário que traduz a categoria
// na lista de arquivos.
/* As duas têm DONOS diferentes desde 2026-08-05 (migration 0014): a
   referência é do produto e o layout aprovado é do PEDIDO — subir num
   produto faz valer em todos. O `hint` existe porque isso não é dedutível
   olhando a lista: sem ele, alguém excluiria "o layout desta peça" achando
   que as outras seguiriam com o arquivo. */
export const FILE_CATEGORIES = [
  { value: 'referencia', label: 'Referência', hint: null },
  {
    value: 'layout_aprovado',
    label: 'Layout aprovado',
    hint: 'Vale para o pedido inteiro — aparece em todas as peças.',
  },
]

export function getFileCategoryLabel(value) {
  return FILE_CATEGORIES.find((category) => category.value === value)?.label || value
}
