import { useState } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Textarea from '../../components/ui/Textarea'
import { useOperations } from '../../context/operationsContext'
import { useSettings } from '../../context/settingsContext'
import { WHATSAPP_PLACEHOLDERS } from '../../utils/whatsapp'

function Settings() {
  const { operations, operationsData, addOperation, removeOperation } = useOperations()
  const [newOperation, setNewOperation] = useState('')
  const [newPosition, setNewPosition] = useState('')

  const { whatsappTemplate, updateWhatsappTemplate } = useSettings()
  const [templateDraft, setTemplateDraft] = useState(whatsappTemplate)

  // whatsappTemplate chega depois de um fetch assíncrono (o valor inicial
  // do context é só um placeholder padrão) — ajustar isso num useEffect
  // dispara o lint react-hooks/set-state-in-effect, então em vez disso
  // sincroniza durante a própria renderização (padrão recomendado pelo
  // React pra "ajustar estado quando um valor de fora muda"): compara com a
  // última versão vista e, se mudou, atualiza os dois de uma vez.
  const [lastSeenTemplate, setLastSeenTemplate] = useState(whatsappTemplate)
  if (whatsappTemplate !== lastSeenTemplate) {
    setLastSeenTemplate(whatsappTemplate)
    setTemplateDraft(whatsappTemplate)
  }

  async function handleSaveTemplate() {
    if (!templateDraft.trim()) {
      alert('A mensagem não pode ficar vazia.')
      return
    }

    await updateWhatsappTemplate(templateDraft)
  }

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

      <section className="form-section">
        <h2>Mensagem do WhatsApp</h2>

        <p>
          Usada pelo botão "Enviar por WhatsApp" em Detalhes do Pedido. Use as
          variáveis abaixo — elas são trocadas pelos dados reais do pedido na
          hora de enviar:
        </p>

        <ul className="whatsapp-placeholders-list">
          {WHATSAPP_PLACEHOLDERS.map((placeholder) => (
            <li key={placeholder.token}>
              <code>{placeholder.token}</code> — {placeholder.description}
            </li>
          ))}
        </ul>

        <Textarea
          label="Mensagem"
          value={templateDraft}
          onChange={(event) => setTemplateDraft(event.target.value)}
          rows={10}
        />

        <div className="modal-actions">
          <Button onClick={handleSaveTemplate}>Salvar Mensagem</Button>
        </div>
      </section>
    </Layout>
  )
}

export default Settings
