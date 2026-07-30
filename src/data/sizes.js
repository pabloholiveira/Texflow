// Tamanhos que a Kavi trabalha — lista fechada, definida pelo Pablo em
// 2026-07-29. Cópia de backend/src/data/sizes.js (dois processos Node
// separados, sem import compartilhado — mesma convenção de ORDER_STAGES e
// de permissions.js). Se mudar aqui, mude lá e no CHECK de product_sizes.
//
// A ORDEM do array é a ordem de exibição, e é o motivo de ele existir: o
// banco valida o conjunto, mas não sabe que '2' vem antes de '10'.
export const SIZES = [
  '1', '2', '4', '6', '8', '10', '12', '14', '16',
  'PP', 'P', 'M', 'G', 'GG', 'EXG',
  'G1', 'G2', 'G3', 'G4',
]

// A grade circula pelo formulário como objeto ({ P: 2, EXG: 8 }) porque é o
// formato que um campo por tamanho preenche naturalmente; a API fala em
// lista ([{ size, quantity }]). Estas duas funções são a fronteira entre os
// dois formatos — ver useProductList.
export function sizesToList(sizesMap = {}) {
  return SIZES.filter((size) => Number(sizesMap[size]) > 0).map((size) => ({
    size,
    quantity: Number(sizesMap[size]),
  }))
}

export function sizesToMap(sizesList = []) {
  return sizesList.reduce((acc, entry) => ({ ...acc, [entry.size]: entry.quantity }), {})
}

export function sumSizes(sizesMap = {}) {
  return SIZES.reduce((total, size) => total + (Number(sizesMap[size]) || 0), 0)
}

// "2 P · 8 EXG" — usado no ProductCard e (item 4) nas telas de produção.
export function formatSizes(sizesList = []) {
  return sizesList.map((entry) => `${entry.quantity} ${entry.size}`).join(' · ')
}
