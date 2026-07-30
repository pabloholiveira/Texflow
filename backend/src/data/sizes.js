// Tamanhos que a Kavi trabalha — lista fechada, definida pelo Pablo em
// 2026-07-29. Duplicada em src/data/sizes.js (front): dois processos Node
// separados, sem import compartilhado, mesma convenção de ORDER_STAGES e de
// auth/permissions.js. Se mudar aqui, mude lá — e no CHECK da tabela
// product_sizes (migration nova, não edite a 0006 já aplicada).
//
// A ORDEM do array é a ordem de exibição, e é o motivo de ele existir: o
// banco só valida o conjunto, não sabe que '2' vem antes de '10' nem que
// 'PP' vem antes de 'EXG'.
export const SIZES = [
  '1', '2', '4', '6', '8', '10', '12', '14', '16',
  'PP', 'P', 'M', 'G', 'GG', 'EXG',
  'G1', 'G2', 'G3', 'G4',
]

// Aceita o que o front manda ([{ size, quantity }]) e devolve a grade limpa,
// ou lança com uma mensagem em português para a rota virar 400.
// Quantidade 0/vazia significa "esse tamanho não faz parte da grade", então
// a linha é descartada em vez de gravada com zero (ver CHECK quantity > 0).
export function normalizeSizes(input) {
  if (input == null) return []

  if (!Array.isArray(input)) {
    throw new Error('sizes deve ser uma lista de { size, quantity }')
  }

  const seen = new Set()

  return input
    .map((entry) => {
      const size = String(entry?.size ?? '')
      const quantity = Number(entry?.quantity)

      if (!SIZES.includes(size)) {
        throw new Error(`Tamanho inválido: "${size}". Use um de: ${SIZES.join(', ')}`)
      }
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new Error(`Quantidade inválida para o tamanho ${size}`)
      }
      if (seen.has(size)) {
        throw new Error(`Tamanho repetido na grade: ${size}`)
      }
      seen.add(size)

      return { size, quantity }
    })
    .filter((entry) => entry.quantity > 0)
    // Ordena pela ordem canônica: a grade chega na ordem em que a tela
    // montou, e quem lê depois (produção) espera P antes de GG.
    .sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
}
