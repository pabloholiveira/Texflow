import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { useOperations } from '../../context/operationsContext'

function Settings() {
  const { operations, operationsData, addOperation, removeOperation } = useOperations()
  const [newOperation, setNewOperation] = useState('')
  const [newPosition, setNewPosition] = useState('')

  async function handleAddOperation() {
    const name = newOperation.trim()

    if (!name) {
      alert('Preencha o nome da operação.')
      return
    }

    if (operations.includes(name)) {
      alert('Essa operação já existe.')
      return
    }

    const position = newPosition.trim() === '' ? null : Number(newPosition)
    const created = await addOperation(name, position)
    if (created) {
      setNewOperation('')
      setNewPosition('')
    }
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Configurações</h1>
          <p>Gerencie as operações de produção disponíveis no sistema</p>
        </div>
      </div>

      <section className="form-section">
        <h2>Operações de Produção</h2>

        <p>
          A posição define quando uma etapa pode começar: ela só libera
          "Iniciar" quando todas as etapas de posição menor (dentre as que o
          produto realmente tem) já estiverem concluídas. Etapas na mesma
          posição não dependem umas das outras. Deixe em branco para uma
          operação que não participa dessa checagem.
        </p>

        <div className="operations-settings-list">
          {operationsData.map((operation) => (
            <div className="operations-settings-item" key={operation.id}>
              <span>
                {operation.name}
                {operation.position != null && ` — posição ${operation.position}`}
              </span>
              <Button
                variant="danger"
                onClick={() => removeOperation(operation.name)}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>

        <div className="operation-custom">
          <input
            type="text"
            placeholder="Ex: Aplicação de strass"
            value={newOperation}
            onChange={(event) => setNewOperation(event.target.value)}
          />

          <input
            type="number"
            placeholder="Posição (opcional)"
            value={newPosition}
            onChange={(event) => setNewPosition(event.target.value)}
          />

          <Button onClick={handleAddOperation}>Adicionar</Button>
        </div>
      </section>
    </Layout>
  )
}

export default Settings
