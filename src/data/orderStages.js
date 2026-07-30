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
