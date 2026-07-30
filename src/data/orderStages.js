export const ORDER_STAGES = [
  { value: 'venda', label: 'Venda' },
  { value: 'design', label: 'Design' },
  { value: 'aprovacao', label: 'Aprovação' },
  { value: 'producao', label: 'Em produção' },
  { value: 'conferencia', label: 'Conferência' },
  { value: 'entregue', label: 'Entregue' },
]

export function getStageState(stage, currentStage) {
  const stageIndex = ORDER_STAGES.findIndex((item) => item.value === stage)
  const currentIndex = ORDER_STAGES.findIndex(
    (item) => item.value === currentStage
  )

  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'current'
  return 'pending'
}

export function getStageLabel(stage) {
  return ORDER_STAGES.find((item) => item.value === stage)?.label ?? stage
}

// O último estágio: o cliente retirou, o trabalho acabou. Um pedido aqui é
// histórico — continua no banco (com todo o product_events e o que alimenta
// os Relatórios), mas não é mais um problema de hoje.
export const FINAL_STAGE = 'entregue'

/* "Pedido operacionalmente ativo": não é rascunho e ainda não foi entregue.

   Existe como função — em vez de cada tela escrever o seu próprio
   `orders.filter(...)` — porque era exatamente essa duplicação que fazia a
   regra ficar desalinhada: quando o estágio 'entregue' foi criado (item 1),
   três telas foram atualizadas e duas ficaram para trás (a fila de Design e,
   no backend, os Gargalos dos Relatórios), justamente por o conceito estar
   reescrito em cinco lugares com três grafias diferentes. */
export function isActiveOrder(order) {
  return !order.isDraft && order.stage !== FINAL_STAGE
}

export function isDeliveredOrder(order) {
  return !order.isDraft && order.stage === FINAL_STAGE
}

// Ativo E já fora da Venda — o recorte das telas de trabalho (Produção,
// Conferência), onde antes da venda fechar não há o que fazer.
export function isInWorkflow(order) {
  return isActiveOrder(order) && order.stage !== 'venda'
}
