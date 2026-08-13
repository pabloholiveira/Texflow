import Logo from './Logo'
import OperationIcon from './OperationIcon'

// product.sizes já chega da API como lista na ordem canônica dos tamanhos
// (sizesToList/sizesToMap são a fronteira do formulário, não daqui).

/* Uma folha de produção, por PRODUTO — é a peça que anda fisicamente
   separada pela fábrica (depois da aprovação cada produto segue seu próprio
   workflow: a camiseta pode estar na Costura enquanto o boné já está no
   Bordado). Uma folha por pedido acompanharia peças que não andam juntas.

   Componente próprio, e não o ProductDetailPanel com um `if (impressao)`:
   o painel é feito para tela (link clicável do Cloudinary, botão de upload,
   cores do tema), e papel é preto no branco, tipografia grande e espaço
   para rubrica. Juntar os dois faria toda mudança em uma das visões
   arriscar a outra. O que se reaproveita são os ajudantes de dados
   (sizesToList, getClientDisplayName), não a marcação.

   NÃO leva valores (unitário, subtotal, vetorização): a ficha circula pela
   fábrica e pode ir à mão de costureira externa — decisão do Pablo,
   reafirmada no redesenho de 2026-08-04. */

/* Ícones de apoio do cabeçalho. Inline como em toda a aplicação (nenhuma
   lib de ícones), traçado e não preenchido: no papel um ícone cheio vira
   borrão em impressora de fábrica. */
const CALENDAR_ICON = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>
)

const PERSON_ICON = (
  <>
    <circle cx="12" cy="8" r="4" />
    <path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
  </>
)

const PHONE_ICON = (
  <>
    <path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3z" />
  </>
)

function SheetIcon({ children, className = 'sheet-icon' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

// Rótulo pequeno em maiúsculas + valor grande, o par que se repete no
// cabeçalho (data do pedido, cliente, telefone).
function SheetField({ icon, label, value }) {
  return (
    <div className="sheet-field">
      <SheetIcon>{icon}</SheetIcon>
      <div>
        <span className="sheet-field-label">{label}</span>
        <strong className="sheet-field-value">{value}</strong>
      </div>
    </div>
  )
}

function ProductSheet({ order, product, clientName, clientPhone }) {
  const sizes = product.sizes ?? []

  return (
    <article className="sheet">
      <header className="sheet-header">
        <Logo className="sheet-brand" />

        {/* Prazo em caixa própria: é o dado que a fábrica olha primeiro. */}
        <div className="sheet-deadline">
          <SheetIcon className="sheet-deadline-icon">{CALENDAR_ICON}</SheetIcon>
          <div>
            <span className="sheet-field-label">Prazo de entrega</span>
            <strong className="sheet-deadline-value">
              {formatDate(order.deadline, { dateOnly: true })}
            </strong>
          </div>
        </div>
      </header>

      <div className="sheet-identity">
        {/* order.orderNumber, nunca order.id: são colunas diferentes e o id
            numérico não é o código que a Kavi lê em voz alta. */}
        <h1 className="sheet-order-number">{order.orderNumber}</h1>
        <SheetField
          icon={CALENDAR_ICON}
          label="Data do pedido"
          value={formatDate(order.createdAt)}
        />
      </div>

      <div className="sheet-parties">
        <SheetField icon={PERSON_ICON} label="Cliente" value={clientName} />
        <SheetField
          icon={PHONE_ICON}
          label="Telefone"
          value={clientPhone || 'Não informado'}
        />
      </div>

      <section className="sheet-section">
        <h3 className="sheet-section-title">Produto</h3>
        <div className="sheet-product-box">
          <h2 className="sheet-product-name">
            {product.type}
            {product.model ? ` — ${product.model}` : ''}
          </h2>
          <div className="sheet-attrs">
            <div className="sheet-attr">
              <span className="sheet-field-label">Cor</span>
              <strong>{product.color || '-'}</strong>
            </div>
            <div className="sheet-attr">
              <span className="sheet-field-label">Tecido</span>
              <strong>{product.fabric || '-'}</strong>
            </div>
            <div className="sheet-attr">
              <span className="sheet-field-label">Modelo</span>
              <strong>{product.model || '-'}</strong>
            </div>
            <div className="sheet-attr">
              <span className="sheet-field-label">Quantidade total</span>
              <strong className="sheet-attr-strong">
                {product.quantity} peças
              </strong>
            </div>
          </div>
        </div>
      </section>

      {/* Dois blocos rotulados, e não um texto corrido: detalhe de construção
          é instrução para a costura, posicionamento é instrução para
          bordado/silk/DTF. Emendados, cada setor teria que ler a instrução do
          outro para achar a sua — e é justamente o posicionamento o que mais
          gera dúvida no chão de fábrica se não estiver junto da peça. */}
      {product.observations && (
        <section className="sheet-section">
          <h3 className="sheet-section-title">Observações do modelo</h3>
          <p className="sheet-observations">{product.observations}</p>
        </section>
      )}

      {product.printObservations && (
        <section className="sheet-section">
          <h3 className="sheet-section-title">Estampa e bordado</h3>
          <p className="sheet-observations">{product.printObservations}</p>
        </section>
      )}

      {product.needsVectorization && (
        <p className="sheet-note">Logo precisa de vetorização.</p>
      )}

      {sizes.length > 0 && (
        <section className="sheet-section">
          <h3 className="sheet-section-title">Grade de tamanhos</h3>
          {/* Tamanhos no cabeçalho e quantidades embaixo: é como a costureira
              lê ("quantas P, quantas G"), não como par nome/valor. Só entram
              os tamanhos com quantidade — o servidor descarta os zerados. */}
          <table className="sheet-table sheet-sizes">
            <thead>
              <tr>
                {sizes.map((item) => (
                  <th key={item.size}>{item.size}</th>
                ))}
                <th className="sheet-total-cell">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {sizes.map((item) => (
                  <td key={item.size}>{item.quantity}</td>
                ))}
                <td className="sheet-total-cell">
                  <strong>{product.quantity}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      <section className="sheet-section">
        <h3 className="sheet-section-title">Etapas de produção</h3>
        {/* A lista é a do produto, não uma sequência fixa: só as etapas que
            esta peça realmente tem, já na ordem real de produção (o backend
            ordena por operations.sequence_position). Data e responsável ficam
            em branco de propósito — é o que a pessoa preenche na máquina. */}
        <table className="sheet-table sheet-checklist">
          <thead>
            <tr>
              <th>OK</th>
              <th>Etapa</th>
              <th>Data</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {product.workflow.map((stage) => (
              <tr key={stage.step}>
                <td className="sheet-checkbox"></td>
                <td>
                  <span className="sheet-step">
                    <OperationIcon
                      step={stage.step}
                      className="sheet-step-icon"
                    />
                    {stage.step}
                  </span>
                </td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </article>
  )
}

/* Duas colunas com tipos diferentes, e tratá-las igual erra numa delas:
   `deadline` é DATE puro ('2026-08-30') e precisa do T00:00:00, senão o
   navegador lê como UTC e mostra o dia anterior no Brasil; `createdAt` é
   TIMESTAMP e já vem com hora, então acrescentar o sufixo o quebraria. */
function formatDate(value, { dateOnly = false } = {}) {
  if (!value) return dateOnly ? 'A combinar' : '-'
  const parsed = dateOnly ? new Date(`${value}T00:00:00`) : new Date(value)
  return parsed.toLocaleDateString('pt-BR')
}

export default ProductSheet
