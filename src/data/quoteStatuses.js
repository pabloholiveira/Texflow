/* Vocabulário dos orçamentos, no mesmo formato { value, label } de
   orderStages.js e designStatuses.js.

   O STATUS É DERIVADO, não é coluna no banco (decisão do Pablo). O motivo
   prático: "vencido" muda sozinho com a passagem do tempo, e nenhum código
   roda no dia do vencimento para gravar isso — uma coluna `status` estaria
   mentindo em todo orçamento vencido desde a última vez que alguém o tocou.
   Derivar é a única forma de o status nunca ficar velho. */
export const QUOTE_STATUSES = [
  { value: 'aberto', label: 'Em aberto' },
  { value: 'convertido', label: 'Convertido' },
  { value: 'recusado', label: 'Recusado' },
  { value: 'vencido', label: 'Vencido' },
]

// Data de hoje como 'YYYY-MM-DD' montada dos campos LOCAIS, de propósito.
// `new Date('2026-09-30')` seria interpretado como UTC e, no Brasil (UTC-3),
// viraria 29/09 às 21h — o mesmo tipo de erro de fuso que já mordeu a ficha
// impressa e o Financeiro. Comparar as duas datas como texto ISO funciona
// porque a ordem lexicográfica desse formato é a ordem cronológica.
function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/* A precedência importa: um orçamento convertido depois do vencimento é
   convertido, não vencido — o que aconteceu de verdade vale mais que o
   prazo que passou. Por isso a ordem dos ifs é fato, fato, prazo. */
export function getQuoteStatus(quote) {
  if (quote.convertedAt) return 'convertido'
  if (quote.rejectedAt) return 'recusado'
  // Vale até o fim do dia da validade: só vence a partir do dia seguinte.
  if (quote.validUntil && quote.validUntil < todayIso()) return 'vencido'
  return 'aberto'
}

export function getQuoteStatusLabel(status) {
  return QUOTE_STATUSES.find((item) => item.value === status)?.label || status
}

// Em aberto = ainda é uma proposta viva, esperando resposta do cliente. É o
// recorte padrão da lista: convertidos e recusados só crescem, e deixá-los
// à frente repetiria o problema da coluna "Concluído" do design, que virou
// arquivo morto até ganhar validade de 7 dias.
export function isOpenQuote(quote) {
  return getQuoteStatus(quote) === 'aberto'
}
