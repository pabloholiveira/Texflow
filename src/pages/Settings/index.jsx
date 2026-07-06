import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { useOperations } from '../../context/operationsContext'

function Settings() {
  const { operations, addOperation, removeOperation } = useOperations()
  const [newOperation, setNewOperation] = useState('')

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

    const created = await addOperation(name)
    if (created) setNewOperation('')
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

        <div className="operations-settings-list">
          {operations.map((operation) => (
            <div className="operations-settings-item" key={operation}>
              <span>{operation}</span>
              <Button
                variant="danger"
                onClick={() => removeOperation(operation)}
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

          <Button onClick={handleAddOperation}>Adicionar</Button>
        </div>
      </section>
    </Layout>
  )
}

export default Settings
