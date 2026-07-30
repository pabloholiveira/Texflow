import ProductFileList from './ProductFileList'
import { formatSizes } from '../../data/sizes'
import { formatCurrency } from '../../utils/currency'

function Field({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  )
}

// Visão completa de um produto: tudo que quem executa uma etapa precisa
// enxergar sem sair da tela onde está — dados da peça, grade de tamanhos,
// observações e os arquivos (referências do cliente e o layout aprovado).
//
// Construído no item 5 (tela de Design) e feito genérico de propósito: o
// item 4 reusa exatamente este painel dentro da Produção, em vez de manter
// duas telas parecidas em paralelo. Por isso ele não sabe nada de design nem
// de produção — recebe um produto e mostra. Não repete o número do pedido:
// os dois modais que o usam já o trazem no título.
function ProductDetailPanel({ product }) {
  return (
    <div className="product-detail-panel">
      <div className="product-detail-fields">
        <Field label="Tipo" value={product.type} />
        <Field label="Modelo" value={product.model} />
        <Field label="Cor" value={product.color} />
        <Field label="Tecido" value={product.fabric} />
        <Field label="Quantidade" value={`${product.quantity} peças`} />
        {product.sizes?.length > 0 && (
          <Field label="Tamanhos" value={formatSizes(product.sizes)} />
        )}
        {product.needsVectorization && (
          <Field
            label="Vetorizar logo"
            value={
              product.vectorizationPrice != null
                ? formatCurrency(product.vectorizationPrice)
                : 'Sim'
            }
          />
        )}
      </div>

      {product.observations && (
        <div className="product-detail-observations">
          <span>Observações</span>
          <p>{product.observations}</p>
        </div>
      )}

      <div className="product-detail-files">
        <ProductFileList
          files={product.files}
          emptyLabel="Nenhum arquivo anexado a este produto."
        />
      </div>
    </div>
  )
}

export default ProductDetailPanel
