import { formatCurrency } from './currency'

// Assume sempre Brasil (mesmo domínio de todo o resto do app — Kavi é uma
// confecção brasileira, UI em português) — se o telefone já vier com o "55"
// na frente (raro, mas possível se alguém digitar assim), não duplica.
function toWhatsAppNumber(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length >= 12) return digits
  return `55${digits}`
}

function formatDeadline(deadline) {
  if (!deadline) return 'A combinar'
  // "T00:00:00" evita que o parser interprete a data em UTC e desloque um
  // dia pra trás dependendo do fuso do navegador (mesmo cuidado do Dashboard).
  return new Date(`${deadline}T00:00:00`).toLocaleDateString('pt-BR')
}

export function buildWhatsAppMessage(order, products) {
  const productLines = products.map((product) => {
    const priceInfo =
      product.unitPrice != null
        ? ` — ${formatCurrency(product.unitPrice)}/un = ${formatCurrency(product.unitPrice * product.quantity)}`
        : ''
    return `• ${product.type}${product.model ? ` (${product.model})` : ''} — ${product.quantity} un.${priceInfo}`
  })

  const remaining = Math.max(order.totalValue - order.amountPaid, 0)

  return [
    `Olá! Aqui estão os detalhes do seu pedido *${order.orderNumber}*:`,
    '',
    'Produtos:',
    ...productLines,
    '',
    `Valor total: ${formatCurrency(order.totalValue)}`,
    `Valor pago: ${formatCurrency(order.amountPaid)}`,
    `Falta pagar na retirada: ${formatCurrency(remaining)}`,
    '',
    `Prazo de entrega: ${formatDeadline(order.deadline)}`,
  ].join('\n')
}

export function buildWhatsAppLink(phone, message) {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`
}
