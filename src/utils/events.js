import { getStageLabel } from '../data/orderStages'
import { getDesignStatusLabel } from '../data/designStatuses'
import { formatCurrency } from './currency'

// Item 3.3: traduz um evento cru do banco (event_type + payload JSON) para
// a frase em português que aparece na timeline. Fica separado do componente
// de propósito — é lógica pura, sem JSX, do tipo que dá para conferir de
// cabeça lendo só este arquivo.

// Rótulos dos campos, para eventos que só sabem QUAIS campos mudaram
// (order_updated / product_updated guardam a lista de nomes, não os valores).
const FIELD_LABELS = {
  clientId: 'cliente',
  deadline: 'prazo',
  amountPaid: 'valor pago',
  type: 'tipo',
  model: 'modelo',
  color: 'cor',
  fabric: 'tecido',
  quantity: 'quantidade',
  sizes: 'grade de tamanhos',
  observations: 'observações do modelo',
  printObservations: 'observações de estampa e bordado',
  unitPrice: 'valor unitário',
  needsVectorization: 'vetorização',
  vectorizationPrice: 'valor da vetorização',
}

function fieldList(fields = []) {
  return fields.map((field) => FIELD_LABELS[field] ?? field).join(', ')
}

function productName(event) {
  // Produto ainda existente: o backend manda o nome montado no join.
  // Produto já excluído: só sobra o que foi guardado no payload do evento.
  if (event.productLabel) return event.productLabel
  const { type, model } = event.payload || {}
  return [type, model].filter(Boolean).join(' ') || 'produto'
}

// pending → in_progress → done. O verbo depende da direção, não só do
// destino: chegar em 'in_progress' vindo de 'pending' é iniciar, mas vindo
// de 'done' é reabrir (o caso de refazer uma etapa após achar defeito).
//
// O prefixo "Etapa" não é enfeite: os nomes das operações têm gêneros
// misturados (Corte e Bordado masculinos, Costura e Embalagem femininos),
// então nenhum particípio concorda com todos ("Corte concluída" está
// errado). Concordando com "etapa" — feminino — a frase fica correta para
// qualquer operação, inclusive as digitadas à mão em "outra operação".
function workflowPhrase({ step, from, to }) {
  if (to === 'in_progress' && from === 'pending') return `etapa ${step} iniciada`
  if (to === 'in_progress' && from === 'done') return `etapa ${step} reaberta`
  if (to === 'done') return `etapa ${step} concluída`
  if (to === 'pending') return `etapa ${step} voltou para pendente`
  return `etapa ${step}: ${from} → ${to}`
}

export function describeEvent(event) {
  const payload = event.payload || {}

  switch (event.eventType) {
    case 'order_created':
      return 'Pedido criado'

    case 'order_finalized':
      return 'Pedido finalizado'

    case 'order_updated':
      return `Dados do pedido alterados (${fieldList(payload.fields)})`

    /* Duas formas de payload convivem de propósito, e a antiga não vai
       sumir: os eventos gravados até 2026-08-04 guardavam só `amountPaid`
       (o acumulado do pedido), e os novos guardam `previous`/`current`/
       `delta`. Ler só a forma nova faria o histórico real que já está no
       banco exibir "R$ 0,00". */
    case 'payment_registered': {
      if (payload.delta === undefined) {
        return `Pagamento registrado: total pago passou a ${formatCurrency(
          Number(payload.amountPaid) || 0
        )}`
      }
      const delta = Number(payload.delta) || 0
      // Delta negativo é correção de lançamento, não dinheiro saindo —
      // chamar isso de "pagamento" na timeline confundiria quem lê.
      const label =
        delta < 0
          ? `Valor pago corrigido em ${formatCurrency(Math.abs(delta))} para menos`
          : `Pagamento registrado: ${formatCurrency(delta)}`
      return `${label} (total pago: ${formatCurrency(Number(payload.current) || 0)})`
    }

    /* O estágio vai no payload porque o cancelamento preserva onde o pedido
       parou — "cancelado ainda na Venda" e "cancelado já em Produção" são
       situações bem diferentes para quem lê o histórico depois. */
    case 'order_cancelled':
      return `Pedido cancelado${
        payload.stage ? ` na etapa ${getStageLabel(payload.stage)}` : ''
      }`

    case 'order_uncancelled':
      return `Pedido reaberto${
        payload.stage ? ` na etapa ${getStageLabel(payload.stage)}` : ''
      }`

    case 'order_stage_changed': {
      const movement = payload.direction === 'backward' ? 'voltou para' : '→'
      const base =
        payload.direction === 'backward'
          ? `Etapa do pedido ${movement} ${getStageLabel(payload.to)}`
          : `Etapa do pedido: ${getStageLabel(payload.from)} ${movement} ${getStageLabel(payload.to)}`
      // Avanço disparado pelo kanban de design, não por alguém clicando
      // "Avançar etapa" — sem isso a timeline pareceria mudar sozinha.
      return payload.trigger === 'design' ? `${base} (automático pelo design)` : base
    }

    case 'product_created':
      return `Produto adicionado: ${productName(event)} (${payload.quantity} un.)`

    case 'product_removed':
      return `Produto removido: ${productName(event)} (${payload.quantity} un.)`

    case 'product_updated':
      return `${productName(event)} — dados alterados (${fieldList(payload.fields)})`

    case 'product_operations_changed': {
      const parts = []
      if (payload.added?.length) parts.push(`+ ${payload.added.join(', ')}`)
      if (payload.removed?.length) parts.push(`− ${payload.removed.join(', ')}`)
      return `${productName(event)} — operações alteradas (${parts.join(' / ')})`
    }

    case 'workflow_step_changed':
      return `${productName(event)} — ${workflowPhrase(payload)}`

    case 'design_status_changed': {
      const base = `${productName(event)} — design: ${getDesignStatusLabel(
        payload.from
      )} → ${getDesignStatusLabel(payload.to)}`
      if (payload.trigger === 'order-stage') return `${base} (entrou na fila com o pedido)`
      if (payload.trigger === 'rework-checkbox') return `${base} (pelo retrabalho)`
      return base
    }

    case 'design_rework_flagged':
      return `${productName(event)} — marcado como retrabalho de design`

    case 'design_rework_unflagged':
      return `${productName(event)} — retrabalho de design desmarcado`

    case 'comment_added':
      return `${productName(event)} — comentário adicionado`

    case 'file_uploaded': {
      const category = payload.category === 'referencia' ? 'referência' : 'layout aprovado'
      return `${productName(event)} — arquivo enviado (${category}): ${payload.fileName}`
    }

    case 'file_deleted': {
      const category = payload.category === 'referencia' ? 'referência' : 'layout aprovado'
      return `${productName(event)} — arquivo excluído (${category}): ${payload.fileName}`
    }

    // Evento gravado por uma versão mais nova do backend do que a do front:
    // melhor mostrar o tipo cru do que sumir com a linha do histórico.
    default:
      return event.eventType
  }
}

// Agrupa por dia para a timeline poder mostrar um cabeçalho de data em vez
// de repetir a data em toda linha. Assume a lista já ordenada do mais
// recente para o mais antigo, como o backend devolve.
export function groupEventsByDay(events) {
  const groups = []

  for (const event of events) {
    const day = new Date(event.createdAt).toLocaleDateString('pt-BR')
    const last = groups[groups.length - 1]

    if (last && last.day === day) last.events.push(event)
    else groups.push({ day, events: [event] })
  }

  return groups
}
