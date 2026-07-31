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
   fábrica e pode ir à mão de costureira externa — decisão do Pablo. */
function ProductSheet({ order, product, clientName }) {
  const sizes = product.sizes ?? []
  const hasLayout = product.files?.some((file) => file.category === 'layout_aprovado')

  return (
    <article className="sheet">
      <header className="sheet-header">
        <div>
          <h1>{order.orderNumber}</h1>
          <p>{clientName}</p>
        </div>
        <div className="sheet-header-right">
          <span>Prazo de entrega</span>
          <strong>{formatDeadline(order.deadline)}</strong>
        </div>
      </header>

      <h2 className="sheet-product">
        {product.type}
        {product.model ? ` — ${product.model}` : ''}
      </h2>

      <table className="sheet-table">
        <tbody>
          <tr>
            <th>Cor</th>
            <td>{product.color || '-'}</td>
            <th>Tecido</th>
            <td>{product.fabric || '-'}</td>
          </tr>
          <tr>
            <th>Quantidade</th>
            <td>
              <strong>{product.quantity} peças</strong>
            </td>
            <th>Layout aprovado</th>
            <td>{hasLayout ? 'Anexado no sistema' : 'Não anexado'}</td>
          </tr>
        </tbody>
      </table>

      {sizes.length > 0 && (
        <section className="sheet-section">
          <h3>Grade de tamanhos</h3>
          <table className="sheet-table sheet-sizes">
            <thead>
              <tr>
                {sizes.map((item) => (
                  <th key={item.size}>{item.size}</th>
                ))}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {sizes.map((item) => (
                  <td key={item.size}>{item.quantity}</td>
                ))}
                <td>
                  <strong>{product.quantity}</strong>
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      )}

      {product.observations && (
        <section className="sheet-section">
          <h3>Observações</h3>
          {/* Onde vive "bordado no peito esquerdo", "silk frente e manga" —
              texto livre por decisão de domínio, e o que mais gera dúvida no
              chão de fábrica se não estiver junto da peça. */}
          <p className="sheet-observations">{product.observations}</p>
        </section>
      )}

      {product.needsVectorization && (
        <p className="sheet-note">Logo precisa de vetorização.</p>
      )}

      <section className="sheet-section">
        <h3>Etapas</h3>
        {/* As etapas já vêm na sequência real de produção (o backend ordena
            por operations.sequence_position). Data e rubrica ficam em branco
            de propósito: é o que a pessoa preenche na máquina. */}
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
                <td>{stage.step}</td>
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

// Mesmo cuidado de fuso do Dashboard/whatsapp.js: deadline é DATE puro
// ('2026-08-30'); sem o T00:00:00 o navegador lê como UTC e mostra o dia
// anterior no Brasil.
function formatDeadline(deadline) {
  if (!deadline) return 'A combinar'
  return new Date(`${deadline}T00:00:00`).toLocaleDateString('pt-BR')
}

export default ProductSheet
