import { useEffect, useState } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Textarea from '../../components/ui/Textarea'
import { useOperations } from '../../context/operationsContext'
import { useSettings } from '../../context/settingsContext'
import { useAuth } from '../../context/authContext'
import { usersApi } from '../../services/api'
import { WHATSAPP_PLACEHOLDERS } from '../../utils/whatsapp'
import { ROLES, ROLE_LABELS } from '../../data/permissions'

const emptyOwnPasswordDraft = {
  currentPassword: '',
  newPassword: '',
  confirmNewPassword: '',
}

function Settings() {
  const { operations, operationsData, addOperation, removeOperation } =
    useOperations()
  const [newOperation, setNewOperation] = useState('')
  const [newPosition, setNewPosition] = useState('')

  const { user, can } = useAuth()
  // Esta tela é a única que todo mundo abre mesmo sem ser admin — porque
  // "Minha Senha" mora aqui. As outras três seções são só de admin.
  const isAdmin = can('settings.admin')

  // Página própria, sem context compartilhado — mesma razão do Reports:
  // nenhuma outra tela consome a lista de usuários.
  const [users, setUsers] = useState([])
  useEffect(() => {
    // GET /users é admin-only: sem esse guard, quem não é admin abriria a
    // tela e levaria um alert de 403 na cara só pra trocar a própria senha.
    if (!isAdmin) return

    usersApi
      .list()
      .then(setUsers)
      .catch((err) => alert(err.message))
  }, [isAdmin])

  const [ownPasswordDraft, setOwnPasswordDraft] = useState(
    emptyOwnPasswordDraft
  )

  function handleOwnPasswordChange(event) {
    const { name, value } = event.target
    setOwnPasswordDraft((current) => ({ ...current, [name]: value }))
  }

  async function handleChangeOwnPassword() {
    const { currentPassword, newPassword, confirmNewPassword } =
      ownPasswordDraft

    if (!currentPassword || !newPassword) {
      alert('Preencha a senha atual e a nova senha.')
      return
    }

    if (newPassword !== confirmNewPassword) {
      alert('A confirmação não bate com a nova senha.')
      return
    }

    try {
      await usersApi.changeOwnPassword(user.id, currentPassword, newPassword)
      setOwnPasswordDraft(emptyOwnPasswordDraft)
      alert('Senha alterada com sucesso.')
    } catch (err) {
      alert(err.message)
    }
  }

  const [resetTarget, setResetTarget] = useState(null)
  const [resetPasswordDraft, setResetPasswordDraft] = useState('')

  function openResetModal(target) {
    setResetTarget(target)
    setResetPasswordDraft('')
  }

  function closeResetModal() {
    setResetTarget(null)
  }

  async function confirmResetPassword() {
    if (!resetPasswordDraft || resetPasswordDraft.length < 6) {
      alert('A senha temporária precisa ter pelo menos 6 caracteres.')
      return
    }

    try {
      await usersApi.resetPassword(resetTarget.id, resetPasswordDraft)
      alert(
        `Senha de "${resetTarget.username}" redefinida. Informe a nova senha a essa pessoa.`
      )
      closeResetModal()
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleDeactivate(target) {
    if (
      !confirm(
        `Desativar o usuário "${target.username}"? Ele não vai mais conseguir logar.`
      )
    ) {
      return
    }

    try {
      const updated = await usersApi.deactivate(target.id)
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
    } catch (err) {
      alert(err.message)
    }
  }

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

  async function handleChangeRole(target, role) {
    try {
      const updated = await usersApi.update(target.id, { role })
      setUsers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      )
    } catch (err) {
      alert(err.message)
    }
  }

  // Etapas que um usuário de produção pode operar. A lista marcada vem do
  // servidor ao abrir o modal (não fica no estado da página) e é salva
  // inteira de uma vez — o PUT substitui o conjunto.
  const [stepsTarget, setStepsTarget] = useState(null)
  const [selectedOperationIds, setSelectedOperationIds] = useState([])

  async function openStepsModal(target) {
    setStepsTarget(target)
    setSelectedOperationIds([])

    try {
      const rows = await usersApi.operations(target.id)
      setSelectedOperationIds(rows.map((row) => row.id))
    } catch (err) {
      alert(err.message)
    }
  }

  function toggleOperationId(id) {
    setSelectedOperationIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  async function saveUserOperations() {
    try {
      await usersApi.setOperations(stepsTarget.id, selectedOperationIds)
      setStepsTarget(null)
    } catch (err) {
      alert(err.message)
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

      {isAdmin && (
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
                  {operation.position != null &&
                    ` — posição ${operation.position}`}
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
              aria-label="Nome da nova operação"
              placeholder="Ex: Aplicação de strass"
              value={newOperation}
              onChange={(event) => setNewOperation(event.target.value)}
            />

            <input
              type="number"
              aria-label="Posição da nova operação (opcional)"
              placeholder="Posição (opcional)"
              value={newPosition}
              onChange={(event) => setNewPosition(event.target.value)}
            />

            <Button onClick={handleAddOperation}>Adicionar</Button>
          </div>
        </section>
      )}

      {isAdmin && (
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
      )}

      <section className="form-section">
        <h2>Minha Senha</h2>

        <Input
          label="Senha atual"
          type="password"
          name="currentPassword"
          value={ownPasswordDraft.currentPassword}
          onChange={handleOwnPasswordChange}
        />
        <Input
          label="Nova senha"
          type="password"
          name="newPassword"
          value={ownPasswordDraft.newPassword}
          onChange={handleOwnPasswordChange}
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          name="confirmNewPassword"
          value={ownPasswordDraft.confirmNewPassword}
          onChange={handleOwnPasswordChange}
        />

        <div className="modal-actions">
          <Button onClick={handleChangeOwnPassword}>Trocar Senha</Button>
        </div>
      </section>

      {isAdmin && (
        <section className="form-section">
          <h2>Usuários</h2>

          <p>
            O papel define o que cada pessoa enxerga e pode fazer. Quem é de
            Produção opera só as etapas atribuídas em "Etapas" — sem nenhuma
            marcada, não move etapa nenhuma. Trocar o papel de alguém só vale a
            partir do próximo login dessa pessoa.
          </p>

          <div className="operations-settings-list">
            {users.map((item) => (
              <div className="operations-settings-item" key={item.id}>
                <span>
                  {item.username}
                  {item.id === user?.id && ' (você)'}
                  {!item.isActive && ' — inativo'}
                </span>

                <div className="modal-actions">
                  <select
                    aria-label={`Papel de ${item.username}`}
                    value={item.role}
                    onChange={(event) =>
                      handleChangeRole(item, event.target.value)
                    }
                    // O backend recusa trocar o próprio papel (um admin se
                    // rebaixando perderia esta tela na hora, sem ninguém pra
                    // desfazer) — aqui só reflete isso.
                    disabled={item.id === user?.id}
                  >
                    {ROLES.map((role) => (
                      <option value={role} key={role}>
                        {ROLE_LABELS[role]}
                      </option>
                    ))}
                  </select>

                  {item.role === 'producao' && (
                    <Button
                      variant="secondary"
                      onClick={() => openStepsModal(item)}
                    >
                      Etapas
                    </Button>
                  )}

                  {item.id !== user?.id && (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => openResetModal(item)}
                      >
                        Redefinir Senha
                      </Button>
                      {item.isActive && (
                        <Button
                          variant="danger"
                          onClick={() => handleDeactivate(item)}
                        >
                          Desativar
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        isOpen={!!resetTarget}
        onClose={closeResetModal}
        title={
          resetTarget
            ? `Redefinir senha — ${resetTarget.username}`
            : 'Redefinir senha'
        }
      >
        <Input
          label="Senha temporária"
          type="password"
          name="resetPassword"
          value={resetPasswordDraft}
          onChange={(event) => setResetPasswordDraft(event.target.value)}
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeResetModal}>
            Cancelar
          </Button>
          <Button onClick={confirmResetPassword}>Redefinir</Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!stepsTarget}
        onClose={() => setStepsTarget(null)}
        title={stepsTarget ? `Etapas — ${stepsTarget.username}` : 'Etapas'}
      >
        <p>
          Marque as etapas que esta pessoa pode iniciar, concluir ou voltar na
          tela de Produção. Etapas digitadas à mão na venda ("outra operação")
          ficam liberadas para qualquer pessoa da produção.
        </p>

        <div className="operations-checklist">
          {operationsData.map((operation) => (
            <label key={operation.id} className="operation-option">
              <input
                type="checkbox"
                checked={selectedOperationIds.includes(operation.id)}
                onChange={() => toggleOperationId(operation.id)}
              />
              {operation.name}
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setStepsTarget(null)}>
            Cancelar
          </Button>
          <Button onClick={saveUserOperations}>Salvar</Button>
        </div>
      </Modal>
    </Layout>
  )
}

export default Settings
