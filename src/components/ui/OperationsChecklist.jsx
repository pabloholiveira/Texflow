import { useState } from 'react'
import { useOperations } from '../../context/operationsContext'
import Button from './Button'

function OperationsChecklist({ selectedSteps, onChange }) {
  const { operations } = useOperations()
  const [customStep, setCustomStep] = useState('')

  const extraSteps = selectedSteps.filter(
    (step) => !operations.includes(step)
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
