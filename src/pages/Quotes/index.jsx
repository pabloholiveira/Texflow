import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Input from '../../components/ui/Input'
import { quotesApi } from '../../services/api'
import { useClients } from '../../context/clientsContext'
import { getClientNameById } from '../../data/clients'
import { matchesQuoteSearch } from '../../data/orderSearch'
import { getQuoteStatus, getQuoteStatusLabel } from '../../data/quoteStatuses'
import { formatCurrency } from '../../utils/currency'

/* Lista de orçamentos.

   Busca com useState/useEffect na própria tela, SEM Provider compartilhado —
   mesma decisão de Relatórios, Financeiro e OrderHistory: nenhuma outra tela
   consome orçamentos, e os Providers existem porque várias telas precisam da
   mesma lista.

   Aqui isso tem um segundo motivo, mais forte: um QuotesProvider buscaria na
   montagem para TODO mundo, e a rota é fechada em SALES_ROLES — quem é da
   produção tomaria um 403 no login, exatamente o problema que obrigou
   GET /clients e GET /operations a ficarem abertos a todos os papéis. */

// Recortes por status. "Em aberto" é o padrão porque convertidos e recusados
// só crescem: deixá-los à frente repetiria a coluna "Concluído" do design,
// que virou arquivo morto até ganhar validade de 7 dias.
const FILTERS = [
  { value: 'aberto', label: 'Em aberto' },
  { value: 'convertido', label: 'Convertidos' },
  { value: 'recusado', label: 'Recusados' },
  { value: 'vencido', label: 'Vencidos' },
  { value: 'todos', label: 'Todos' },
]

function formatValidUntil(validUntil) {
  if (!validUntil) return 'sem validade'
  // Coluna DATE, que trafega como texto puro 'YYYY-MM-DD' (type-parser em
  // pool.js). O sufixo T00:00:00 é obrigatório: sem ele o navegador lê a
  // string como UTC e mostra o dia anterior no Brasil.
  return `até ${new Date(`${validUntil}T00:00:00`).toLocaleDateString('pt-BR')}`
}

function Quotes() {
  const { clients } = useClients()
  const [quotes, setQuotes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('aberto')

  // Cadeia .then() dentro do próprio efeito (não uma função async chamada
  // dele): react-hooks/set-state-in-effect proíbe a segunda forma. Mesmo
  // formato de Reports e OrderHistory.
  useEffect(() => {
    quotesApi
      .list()
      .then((data) => {
        setQuotes(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [])

  const visibleQuotes = quotes
    .filter((quote) => filter === 'todos' || getQuoteStatus(quote) === filter)
    .filter((quote) => matchesQuoteSearch(quote, search, clients))

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Orçamentos</h1>
          <p>Propostas enviadas ao cliente, antes de virarem pedido</p>
        </div>

        <Link to="/orcamentos/novo">
          <button>Novo Orçamento</button>
        </Link>
      </div>

      <div className="tabs">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            className={filter === item.value ? 'active' : ''}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="orders-search">
        <Input
          label="Buscar orçamento"
          name="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Número, cliente, CPF/CNPJ ou peça"
        />
      </div>

      {isLoading && <p>Carregando orçamentos...</p>}
      {error && <p className="orders-empty">{error}</p>}

      {!isLoading && !error && (
        <section className="orders-list">
          {/* Três situações diferentes, três mensagens: não achar o termo
              buscado não é a mesma coisa que não haver orçamento naquele
              recorte, nem que não haver nenhum orçamento. */}
          {visibleQuotes.length === 0 && (
            <p className="orders-empty">
              {search.trim()
                ? `Nenhum orçamento encontrado para "${search.trim()}".`
                : quotes.length === 0
                  ? 'Nenhum orçamento cadastrado ainda.'
                  : 'Nenhum orçamento neste filtro.'}
            </p>
          )}

          {visibleQuotes.map((quote) => {
            const status = getQuoteStatus(quote)

            return (
              <Link key={quote.id} to={`/orcamentos/${quote.id}`} className="order-card quote-card">
                <div>
                  <strong>{quote.quoteNumber}</strong>
                  {/* getClientNameById já devolve "Cliente não informado"
                      quando não acha — e um orçamento pode legitimamente não
                      ter cliente ainda. */}
                  <p>{getClientNameById(clients, quote.clientId)}</p>
                </div>

                <div>
                  <span>Validade</span>
                  <p>{formatValidUntil(quote.validUntil)}</p>
                </div>

                <div>
                  <span>Status</span>
                  <p>
                    <span className={`quote-status quote-status-${status}`}>
                      {getQuoteStatusLabel(status)}
                    </span>
                  </p>
                </div>

                <div>
                  <span>Peças</span>
                  <p>{quote.items.length}</p>
                </div>

                <div>
                  <span>Valor</span>
                  <p>{formatCurrency(quote.totalValue)}</p>
                </div>
              </Link>
            )
          })}
        </section>
      )}
    </Layout>
  )
}

export default Quotes
