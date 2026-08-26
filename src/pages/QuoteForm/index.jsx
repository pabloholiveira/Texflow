import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ClientAutocomplete from '../../components/ui/ClientAutocomplete'
import ProductFields from '../../components/ui/ProductFields'
import { quotesApi } from '../../services/api'
import { useClients } from '../../context/clientsContext'
import { formatSizes, sizesToList, sizesToMap, sumSizes } from '../../data/sizes'
import { formatCurrency } from '../../utils/currency'

/* Cadastro e edição de orçamento — uma tela só, servindo /orcamentos/novo e
   /orcamentos/:id/editar. São o mesmo formulário sobre os mesmos campos; a
   diferença é de onde os dados vêm e para onde vão (POST ou PUT).

   NÃO usa o useProductList: aquele hook é acoplado a um pedido (lê e escreve
   por `orderId` no OrdersProvider, cuida de workflow, comentários e
   arquivos). Um item de orçamento não tem nada disso. O que se reaproveita é
   o ProductFields, que é formulário controlado sobre um objeto simples e
   serve como está.

   TUDO fica em memória até "Salvar": o orçamento inteiro vai numa chamada
   só. É o que dispensa o `is_draft` que os pedidos precisam ter — e o lixo
   de rascunhos abandonados que vem junto dele. */

const emptyItem = {
  type: '',
  model: '',
  color: '',
  fabric: '',
  quantity: '',
  // Grade como objeto ({ P: 2 }) enquanto está no formulário; vira lista na
  // hora de mandar pra API — ver src/data/sizes.js.
  sizes: {},
  observations: '',
  printObservations: '',
  unitPrice: '',
  needsVectorization: false,
  vectorizationPrice: '',
}

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

// Subtotal da linha, do mesmo jeito que o servidor calcula o total:
// unitário × quantidade, mais a vetorização por fora (é serviço por peça, não
// multiplica pela quantidade).
function itemSubtotal(item) {
  const quantity = sumSizes(item.sizes) || Number(item.quantity) || 0
  const unit = Number(item.unitPrice) || 0
  return quantity * unit + (Number(item.vectorizationPrice) || 0)
}

function QuoteForm() {
  const { id } = useParams()
  const isEditing = !!id
  const navigate = useNavigate()
  const { clients, findOrCreateClient } = useClients()

  const [clientDraft, setClientDraft] = useState(emptyClient)
  // Id do cliente que veio do orçamento e ainda não virou objeto. Existe
  // porque as duas buscas são independentes: o ClientsProvider pode ainda
  // não ter respondido quando o orçamento chegar.
  const [pendingClientId, setPendingClientId] = useState(null)
  const [validUntil, setValidUntil] = useState('')
  const [observations, setObservations] = useState('')
  const [items, setItems] = useState([])

  const [isLoading, setIsLoading] = useState(isEditing)
  const [loadError, setLoadError] = useState(null)

  const [isItemModalOpen, setIsItemModalOpen] = useState(false)
  const [itemDraft, setItemDraft] = useState(emptyItem)
  // Índice do item em edição, ou null quando é um item novo.
  const [editingIndex, setEditingIndex] = useState(null)

  // Mesma trava do salvar produto (useProductList): o estado é o que a tela
  // lê, o ref é o que barra o segundo clique — dois cliques no mesmo tick
  // leriam o estado ainda como false, porque o React só re-renderiza depois.
  const [isSaving, setIsSaving] = useState(false)
  const savingRef = useRef(false)

  useEffect(() => {
    if (!isEditing) return

    quotesApi
      .get(id)
      .then((quote) => {
        setPendingClientId(quote.clientId)
        setValidUntil(quote.validUntil || '')
        setObservations(quote.observations || '')
        setItems(
          quote.items.map((item) => ({
            ...item,
            // A API fala em lista de tamanhos; o formulário, em objeto.
            sizes: sizesToMap(item.sizes),
            unitPrice: item.unitPrice ?? '',
            vectorizationPrice: item.vectorizationPrice ?? '',
            model: item.model ?? '',
            color: item.color ?? '',
            fabric: item.fabric ?? '',
            observations: item.observations ?? '',
            printObservations: item.printObservations ?? '',
          }))
        )
        setLoadError(null)
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setIsLoading(false))
    // Busca UMA vez. `clients` fora das dependências de propósito: com ela
    // aqui, qualquer mudança na lista de clientes rebuscaria o orçamento e
    // sobrescreveria o que a pessoa já tivesse editado na tela.
  }, [id, isEditing])

  /* Resolve o cliente do orçamento quando a lista finalmente chega —
     ajustando estado durante o render, que é o padrão documentado do React
     para "derivar de uma prop/estado que mudou" e o mesmo já usado no
     SettingsProvider. A alternativa (useEffect) esbarra na regra
     react-hooks/set-state-in-effect, que já apareceu quatro vezes aqui.

     O pendingClientId é zerado depois de usado, e é isso que impede o
     efeito colateral óbvio: sem ele, clicar em "Trocar cliente" (que zera o
     clientDraft) faria esta linha repor o cliente antigo no render seguinte. */
  if (pendingClientId !== null && clients.length > 0) {
    setClientDraft(clients.find((item) => item.id === pendingClientId) || emptyClient)
    setPendingClientId(null)
  }

  // Forma funcional pelo mesmo motivo do useProductList: o checkbox de
  // vetorização do ProductFields dispara duas mudanças seguidas no mesmo
  // handler, e a segunda partiria do estado congelado antes da primeira.
  function handleItemChange(event) {
    const { name, value } = event.target
    setItemDraft((current) => ({ ...current, [name]: value }))
  }

  function openNewItem() {
    setItemDraft(emptyItem)
    setEditingIndex(null)
    setIsItemModalOpen(true)
  }

  function openEditItem(index) {
    setItemDraft(items[index])
    setEditingIndex(index)
    setIsItemModalOpen(true)
  }

  function saveItem() {
    const quantity = sumSizes(itemDraft.sizes) || Number(itemDraft.quantity) || 0

    // Mesma validação do servidor, aqui só para a pessoa não perder o que
    // digitou num alert vindo da API depois de fechar o modal.
    if (!itemDraft.type || quantity <= 0) {
      alert('Informe o tipo da peça e a quantidade (ou a grade de tamanhos).')
      return
    }

    setItems((current) =>
      editingIndex === null
        ? [...current, itemDraft]
        : current.map((item, index) => (index === editingIndex ? itemDraft : item))
    )
    setIsItemModalOpen(false)
  }

  function removeItem(index) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  async function handleSave() {
    if (savingRef.current) return

    if (items.length === 0) {
      alert('Adicione pelo menos uma peça ao orçamento.')
      return
    }

    savingRef.current = true
    setIsSaving(true)

    /* Três caminhos, e todos caem na mesma linha por o match ser por
       `document` (mesma cadeia do "Finalizar Pedido"): cliente já
       selecionado devolve o mesmo id, cliente inédito digitado à mão é
       criado, e nada preenchido deixa o orçamento sem cliente — que é
       permitido aqui, ao contrário do pedido, porque no começo da conversa
       a vendedora pode ter só a peça e o preço.

       Descartar o que foi digitado quando não há id seria pior: os cinco
       campos ficam na tela, a pessoa preenche, e o dado sumiria calado. */
    let clientId = clientDraft.id || null
    if (!clientId && clientDraft.document) {
      clientId = await findOrCreateClient(clientDraft)
      if (!clientId) {
        // findOrCreateClient já alertou o erro e devolveu null.
        savingRef.current = false
        setIsSaving(false)
        return
      }
    }

    const payload = {
      clientId,
      validUntil: validUntil || null,
      observations: observations || null,
      items: items.map((item) => ({
        ...item,
        sizes: sizesToList(item.sizes),
      })),
    }

    try {
      const quote = isEditing
        ? await quotesApi.update(id, payload)
        : await quotesApi.create(payload)
      navigate(`/orcamentos/${quote.id}`)
    } catch (err) {
      // As telas de orçamento chamam a API direto, sem passar pelos mutators
      // do Provider (que alertam sozinhos e devolvem null) — então o alert
      // acontece aqui, mantendo o mesmo comportamento visível de sempre.
      alert(err.message)
      savingRef.current = false
      setIsSaving(false)
    }
  }

  const total = items.reduce((sum, item) => sum + itemSubtotal(item), 0)

  if (isLoading) {
    return (
      <Layout>
        <p>Carregando orçamento...</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <p>{loadError}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}</h1>
          <p>Monte a proposta com as peças e os valores</p>
        </div>
      </div>

      {/* .quote-section, e NÃO .order-info: aquela é uma GRADE de 3 colunas
          feita para pares rótulo/valor, então o <h2> virava uma célula ao
          lado dos campos em vez de título, e o cartão do cliente ficava
          espremido num terço da largura. */}
      <section className="quote-section">
        <h2>Cliente e validade</h2>

        <ClientAutocomplete
          /* O `key` é o que faz o modo compacto valer também quando o
             cliente é resolvido DEPOIS da montagem (a lista chega
             assíncrona): `initiallySelected` só é lido no primeiro render,
             então sem remontar os 5 campos nasceriam editáveis com os dados
             do cliente — e alterar o CPF ali editaria o CADASTRO dele,
             achando que era só trocar o vínculo do orçamento. */
          key={clientDraft.id || 'novo'}
          clients={clients}
          client={clientDraft}
          onChange={setClientDraft}
          initiallySelected={!!clientDraft.id}
        />

        <div className="form-grid">
          <Input
            label="Validade da proposta"
            type="date"
            name="validUntil"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
            hint="Até quando este preço vale. Não é o prazo de entrega."
          />

          <Input
            label="Observações"
            name="observations"
            placeholder="Ex: preço válido para pagamento à vista"
            value={observations}
            onChange={(event) => setObservations(event.target.value)}
          />
        </div>
      </section>

      <section className="products-panel">
        <div className="page-header">
          <h2>Peças</h2>
          <Button onClick={openNewItem}>Adicionar Peça</Button>
        </div>

        {items.length === 0 && <p className="orders-empty">Nenhuma peça no orçamento ainda.</p>}

        {items.map((item, index) => (
          <div className="quote-item" key={index}>
            <div>
              <strong>
                {item.type}
                {item.model ? ` — ${item.model}` : ''}
              </strong>
              <p>
                {[item.color, item.fabric].filter(Boolean).join(' · ')}
                {item.color || item.fabric ? ' · ' : ''}
                {sumSizes(item.sizes) || item.quantity} peças
              </p>
              {sumSizes(item.sizes) > 0 && (
                <p className="quote-item-sizes">{formatSizes(sizesToList(item.sizes))}</p>
              )}
              {item.needsVectorization && (
                <p className="quote-item-sizes">
                  Vetorização: {formatCurrency(Number(item.vectorizationPrice) || 0)}
                </p>
              )}
            </div>

            <div className="quote-item-value">
              <strong>{formatCurrency(itemSubtotal(item))}</strong>
              <span>
                {item.unitPrice ? `${formatCurrency(Number(item.unitPrice))} cada` : 'sem valor'}
              </span>
            </div>

            <div className="quote-item-actions">
              <Button variant="secondary" onClick={() => openEditItem(index)}>
                Editar
              </Button>
              <Button variant="danger" onClick={() => removeItem(index)}>
                Remover
              </Button>
            </div>
          </div>
        ))}

        <p className="quote-total">Total do orçamento: {formatCurrency(total)}</p>
      </section>

      <div className="finalize-order">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Orçamento'}
        </Button>
      </div>

      <Modal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        title={editingIndex === null ? 'Adicionar Peça' : 'Editar Peça'}
      >
        {/* O mesmo componente do cadastro de produto, sem adaptação: um item
            de orçamento tem exatamente os mesmos campos descritivos e de
            preço. O que ele não tem — etapas, arquivos, comentários — mora
            fora do ProductFields. */}
        <ProductFields product={itemDraft} onChange={handleItemChange} />

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIsItemModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={saveItem}>Salvar</Button>
        </div>
      </Modal>
    </Layout>
  )
}

export default QuoteForm
