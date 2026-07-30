import { formatCurrency } from './currency'

// Duplicado em backend/src/routes/settings.js (processo Node separado, sem
// import compartilhado) — mesma razão do ORDER_STAGES duplicado entre
// backend/frontend. Usado como valor inicial no SettingsProvider, antes do
// GET /settings/whatsapp-template resolver.
export const DEFAULT_WHATSAPP_TEMPLATE = `Olá! Aqui estão os detalhes do seu pedido *{{pedido}}*:

Produtos:
{{produtos}}

Valor total: {{valorTotal}}
Valor pago: {{valorPago}}
Falta pagar na retirada: {{faltaPagar}}

Prazo de entrega: {{prazo}}`

// Mostrado em Configurações como legenda de quais variáveis existem.
// Segunda mensagem: pedido pronto para retirada (item 2, parte 2).
// Duplicada de backend/src/routes/settings.js pelo mesmo motivo da primeira
// — dois processos Node, sem import compartilhado. Usa os mesmos tokens.
export const DEFAULT_WHATSAPP_READY_TEMPLATE = `Olá! Seu pedido *{{pedido}}* está pronto para retirada. 🎉

Produtos:
{{produtos}}

Valor total: {{valorTotal}}
Valor pago: {{valorPago}}
Falta pagar na retirada: {{faltaPagar}}`

export const WHATSAPP_PLACEHOLDERS = [
  { token: '{{pedido}}', description: 'Número do pedido (ex: PED-2026-0007)' },
  { token: '{{produtos}}', description: 'Lista dos produtos, um por linha' },
  { token: '{{valorTotal}}', description: 'Valor total do pedido' },
  { token: '{{valorPago}}', description: 'Valor já pago' },
  { token: '{{faltaPagar}}', description: 'Quanto falta pagar na retirada' },
  { token: '{{prazo}}', description: 'Prazo de entrega (ou "A combinar")' },
]

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

function buildProductLines(products) {
  return products
    .map((product) => {
      const priceInfo =
        product.unitPrice != null
          ? ` — ${formatCurrency(product.unitPrice)}/un = ${formatCurrency(product.unitPrice * product.quantity)}`
          : ''
      return `• ${product.type}${product.model ? ` (${product.model})` : ''} — ${product.quantity} un.${priceInfo}`
    })
    .join('\n')
}

// Substituição simples de {{placeholder}} por texto — não é um motor de
// template de verdade (sem condicionais/loop no template em si), só troca
// os tokens fixos abaixo. Suficiente pro que Configurações precisa hoje.
export function buildWhatsAppMessage(order, products, template) {
  const remaining = Math.max(order.totalValue - order.amountPaid, 0)

  const values = {
    '{{pedido}}': order.orderNumber,
    '{{produtos}}': buildProductLines(products),
    '{{valorTotal}}': formatCurrency(order.totalValue),
    '{{valorPago}}': formatCurrency(order.amountPaid),
    '{{faltaPagar}}': formatCurrency(remaining),
    '{{prazo}}': formatDeadline(order.deadline),
  }

  return Object.entries(values).reduce(
    (message, [token, value]) => message.split(token).join(value),
    template
  )
}

export function buildWhatsAppLink(phone, message) {
  return `https://wa.me/${toWhatsAppNumber(phone)}?text=${encodeURIComponent(message)}`
}
