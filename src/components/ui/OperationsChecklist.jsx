import { useState } from 'react'
import { useOperations } from '../../context/operationsContext'
import Button from './Button'

function OperationsChecklist({ selectedSteps, onChange }) {
  const { operationsData } = useOperations()
  const [customStep, setCustomStep] = useState('')

  // Etapas automáticas (auto_add — Revisão/Finalização e Embalagem) não
  // aparecem: entram sozinhas em todo produto e o servidor as reaplica em
  // toda edição, então oferecer um checkbox delas só confundiria. Lavagem
  // continua na lista, porque é opcional de propósito.
  const operations = operationsData
    .filter((operation) => !operation.autoAdd)
    .map((operation) => operation.name)

  // extraSteps é o mecanismo que mantém visível uma etapa que o produto tem
  // mas o catálogo não oferece mais (uma "outra operação" digitada à mão, ou
  // uma operação removida em Configurações). As automáticas precisam ficar
  // de fora dele também: como acabaram de sair de `operations`, elas cairiam
  // aqui e voltariam à tela justamente ao editar um produto que já as tem.
  const autoAddNames = operationsData
    .filter((operation) => operation.autoAdd)
    .map((operation) => operation.name)

  const extraSteps = selectedSteps.filter(
    (step) => !operations.includes(step) && !autoAddNames.includes(step)
  )
  const options = [...operations, ...extraSteps]

  function toggleStep(step) {
    if (selectedSteps.includes(step)) {
      onChange(selectedSteps.filter((item) => item !== step))
    } else {
      onChange([...selectedSteps, step])
    }
  }

  function addCustomStep() {
    const step = customStep.trim()

    if (!step || selectedSteps.includes(step)) return

    onChange([...selectedSteps, step])
    setCustomStep('')
  }

  return (
    <div className="operations-checklist">
      {options.map((step) => (
        <label key={step} className="operation-option">
          <input
            type="checkbox"
            checked={selectedSteps.includes(step)}
            onChange={() => toggleStep(step)}
          />
          {step}
        </label>
      ))}

      <div className="operation-custom">
        <input
          type="text"
          aria-label="Outra operação"
          placeholder="Outra operação"
          value={customStep}
          onChange={(event) => setCustomStep(event.target.value)}
        />

        <Button variant="secondary" onClick={addCustomStep}>
          Adicionar
        </Button>
      </div>
    </div>
  )
}

export default OperationsChecklist
