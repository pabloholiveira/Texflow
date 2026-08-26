import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import { quotesApi } from '../../services/api'
import { useClients } from '../../context/clientsContext'
import { useOrders } from '../../context/ordersContext'
import { getClientDisplayName } from '../../data/clients'
import { formatSizes } from '../../data/sizes'
import { getQuoteStatus, getQuoteStatusLabel } from '../../data/quoteStatuses'
import { formatCurrency } from '../../utils/currency'

function formatDate(value) {
  if (!value) return '-'
  // Coluna DATE trafega como texto puro; sem o T00:00:00 o navegador lê como
  // UTC e mostra o dia anterior no Brasil (a mesma armadilha da ficha
  // impressa, onde deadline e createdAt precisam de tratamentos diferentes).
  return new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR')
}

function itemSubtotal(item) {
  return (item.unitPrice || 0) * item.quantity + (item.vectorizationPrice || 0)
}

function QuoteDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clients } = useClients()
  const { refreshOrders } = useOrders()

  const [quote, setQuote] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [deadline, setDeadline] = useState('')
  const [isConverting, setIsConverting] = useState(false)

  useEffect(() => {
    quotesApi
      .get(id)
      .then((data) => {
        setQuote(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [id])

  async function handleReject() {
    try {
      setQuote(await quotesApi.reject(id))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleReopen() {
    try {
      setQuote(await quotesApi.reopen(id))
    } catch (err) {
      alert(err.message)
    }
  }

  async function handleConvert() {
    setIsConverting(true)
    try {
      const { orderId } = await quotesApi.convert(id, deadline || null)

      /* Rebusca ANTES de navegar, e é obrigatório: o pedido nasceu na rota
         de orçamentos, por fora do OrdersProvider, então o cache dele não
         conhece esse id — e OrderDetails lê justamente do cache. Sem esta
         linha, converter levava para uma tela "Pedido não encontrado"
         (pego na verificação no navegador, não no teste de API). */
      await refreshOrders()

      // Vai direto para o pedido novo: é lá que o trabalho continua (escolher
      // as etapas de cada peça, anexar referências, registrar pagamento).
      navigate(`/pedidos/${orderId}`)
    } catch (err) {
      alert(err.message)
      setIsConverting(false)
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <p>Carregando orçamento...</p>
      </Layout>
    )
  }

  if (error || !quote) {
    return (
      <Layout>
        <p>{error || 'Orçamento não encontrado.'}</p>
      </Layout>
    )
  }

  const status = getQuoteStatus(quote)
  const client = clients.find((item) => item.id === quote.clientId)
  const isConverted = !!quote.convertedAt

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>{quote.quoteNumber}</h1>
          <p>
            <span className={`quote-status quote-status-${status}`}>
              {getQuoteStatusLabel(status)}
            </span>
          </p>
        </div>

        <div className="quote-actions">
          {/* Convertido não se edita nem se recusa: a partir daí o combinado
              vive no pedido, e a proposta fica como documento do que o
              cliente aprovou. É o ponto inteiro de copiar em vez de
              promover. O servidor barra os dois com 409 — isto aqui só
              evita oferecer o que vai falhar. */}
          {!isConverted && status !== 'recusado' && (
            <>
              <Link to={`/orcamentos/${quote.id}/editar`}>
                <button className="btn btn-secondary">Editar</button>
              </Link>
              <Button variant="secondary" onClick={handleReject}>
                Marcar como recusado
              </Button>
              <Button onClick={() => setIsConvertModalOpen(true)}>Converter em pedido</Button>
            </>
          )}

          {status === 'recusado' && (
            <Button variant="secondary" onClick={handleReopen}>
              Reabrir orçamento
            </Button>
          )}
        </div>
      </div>

      {isConverted && (
        <div className="quote-converted-banner">
          <span>
            Este orçamento virou pedido em {new Date(quote.convertedAt).toLocaleDateString('pt-BR')}.
          </span>
          {/* O link só existe enquanto o pedido existir: converted_order_id é
              ON DELETE SET NULL, e o fato da conversão (converted_at) fica de
              pé mesmo sem ele. */}
          {quote.convertedOrderId && (
            <Link to={`/pedidos/${quote.convertedOrderId}`}>Ver pedido</Link>
          )}
        </div>
      )}

      <section className="order-info">
        <div>
          <span>Cliente</span>
          <p>{getClientDisplayName(client)}</p>
        </div>
        <div>
          <span>Telefone</span>
          <p>{client?.phone || '-'}</p>
        </div>
        <div>
          <span>Validade da proposta</span>
          <p>{formatDate(quote.validUntil)}</p>
        </div>
        <div>
          <span>Criado em</span>
          <p>{new Date(quote.createdAt).toLocaleDateString('pt-BR')}</p>
        </div>
        <div>
          <span>Peças</span>
          <p>{quote.items.length}</p>
        </div>
        <div>
          <span>Valor total</span>
          <p>{formatCurrency(quote.totalValue)}</p>
        </div>
      </section>

      {quote.observations && (
        <section className="quote-section">
          <span className="quote-section-label">Observações</span>
          <p>{quote.observations}</p>
        </section>
      )}

      <section className="products-panel">
        <h2>Peças da proposta</h2>

        {quote.items.map((item) => (
          <div className="quote-item" key={item.id}>
            <div>
              <strong>
                {item.type}
                {item.model ? ` — ${item.model}` : ''}
              </strong>
              <p>
                {[item.color, item.fabric].filter(Boolean).join(' · ')}
                {item.color || item.fabric ? ' · ' : ''}
                {item.quantity} peças
              </p>
              {item.sizes.length > 0 && (
                <p className="quote-item-sizes">{formatSizes(item.sizes)}</p>
              )}
              {item.observations && <p className="quote-item-sizes">{item.observations}</p>}
              {item.printObservations && (
                <p className="quote-item-sizes">Estampa: {item.printObservations}</p>
              )}
              {item.needsVectorization && (
                <p className="quote-item-sizes">
                  Vetorização: {formatCurrency(item.vectorizationPrice || 0)}
                </p>
              )}
            </div>

            <div className="quote-item-value">
              <strong>{formatCurrency(itemSubtotal(item))}</strong>
              <span>
                {item.unitPrice ? `${formatCurrency(item.unitPrice)} cada` : 'sem valor'}
              </span>
            </div>
          </div>
        ))}

        <p className="quote-total">Total do orçamento: {formatCurrency(quote.totalValue)}</p>
      </section>

      <Modal
        isOpen={isConvertModalOpen}
        onClose={() => setIsConvertModalOpen(false)}
        title="Converter em pedido"
      >
        <p className="confirm-text">
          As {quote.items.length} peça(s) desta proposta viram produtos de um pedido novo, com os
          mesmos valores. O orçamento continua guardado como o que foi combinado.
        </p>

        <Input
          label="Prazo de entrega"
          type="date"
          name="deadline"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value)}
          /* Perguntado aqui, e não copiado da validade da proposta: "este
             preço vale até" e "fica pronto em" são datas de naturezas
             diferentes. Opcional — dá para definir depois em Editar Pedido. */
          hint="Opcional. Pode ser definido depois nos detalhes do pedido."
        />

        <p className="confirm-hint">
          As etapas de produção de cada peça são escolhidas no pedido, em "Editar Etapas" — o
          orçamento não as guarda.
        </p>

        <div className="modal-actions">
          <Button variant="secondary" onClick={() => setIsConvertModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConvert} disabled={isConverting}>
            {isConverting ? 'Convertendo...' : 'Converter'}
          </Button>
        </div>
      </Modal>
    </Layout>
  )
}

export default QuoteDetails
