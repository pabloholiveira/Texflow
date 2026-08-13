import { useState } from 'react'
import Input from './Input'
import SuggestibleInput from './SuggestibleInput'
import Button from './Button'
import Modal from './Modal'
import { useOrders } from '../../context/ordersContext'
import { SIZES, sumSizes } from '../../data/sizes'

function getDistinctValues(products, field) {
  return [...new Set(products.map((product) => product[field]).filter(Boolean))]
}

// Dispara duas mudanças (needsVectorization + vectorizationPrice) através
// do mesmo `onChange` genérico usado pelos outros campos — funciona porque
// handleChange/handleInfoDraftChange (useProductList.js) usam a forma
// funcional do setState, então duas chamadas seguidas não se pisam.
function emitFieldChange(onChange, name, value) {
  onChange({ target: { name, value } })
}

function ProductFields({ product, onChange }) {
  const { orders } = useOrders()
  const allProducts = orders.flatMap((order) => order.products)

  // A grade circula pelo formulário como objeto ({ P: 2, EXG: 8 }) — ver
  // src/data/sizes.js. Vazia = produto sem grade, que continua tendo a
  // quantidade digitada à mão (é o caso de todos os produtos que já existem).
  const sizesMap = product.sizes || {}
  const sizesTotal = sumSizes(sizesMap)
  const hasSizes = sizesTotal > 0

  function handleSizeChange(size, rawValue) {
    const next = { ...sizesMap }

    // Campo apagado ou zerado = esse tamanho sai da grade, em vez de ficar
    // gravado com zero (o banco recusa quantity = 0 justamente por isso).
    if (rawValue === '' || Number(rawValue) <= 0) {
      delete next[size]
    } else {
      next[size] = Number(rawValue)
    }

    emitFieldChange(onChange, 'sizes', next)
  }

  // Só existe enquanto o modal de "quanto cobrar pela vetorização" está
  // aberto — não é o valor final, que só é gravado ao confirmar.
  const [isAskingVectorizationPrice, setIsAskingVectorizationPrice] = useState(false)
  const [vectorizationPriceDraft, setVectorizationPriceDraft] = useState('')

  function handleVectorizationCheckboxChange(event) {
    if (event.target.checked) {
      setVectorizationPriceDraft(product.vectorizationPrice ?? '')
      setIsAskingVectorizationPrice(true)
      return
    }

    // Desmarcar não pergunta de novo — limpa os dois campos direto.
    emitFieldChange(onChange, 'needsVectorization', false)
    emitFieldChange(onChange, 'vectorizationPrice', null)
  }

  function confirmVectorizationPrice() {
    emitFieldChange(onChange, 'needsVectorization', true)
    emitFieldChange(
      onChange,
      'vectorizationPrice',
      vectorizationPriceDraft === '' ? null : Number(vectorizationPriceDraft)
    )
    setIsAskingVectorizationPrice(false)
  }

  function cancelVectorizationPrice() {
    // needsVectorization nunca chegou a ser setado (só ao confirmar), então
    // não precisa desfazer nada além de fechar o modal.
    setIsAskingVectorizationPrice(false)
  }

  return (
    <div className="form-grid">
      <Input
        label="Tipo da peça"
        placeholder="Ex: Camiseta, Boné, Polo"
        value={product.type}
        onChange={onChange}
        name="type"
      />

      <SuggestibleInput
        label="Modelo"
        placeholder="Ex: Raglan, Tradicional"
        value={product.model}
        onChange={onChange}
        name="model"
        suggestions={getDistinctValues(allProducts, 'model')}
      />

      <SuggestibleInput
        label="Cor"
        placeholder="Ex: Azul marinho"
        value={product.color}
        onChange={onChange}
        name="color"
        suggestions={getDistinctValues(allProducts, 'color')}
      />

      <SuggestibleInput
        label="Tecido"
        placeholder="Ex: PV, algodão"
        value={product.fabric}
        onChange={onChange}
        name="fabric"
        suggestions={getDistinctValues(allProducts, 'fabric')}
      />

      <Input
        label="Quantidade"
        type="number"
        placeholder="Ex: 50"
        // Com grade preenchida a quantidade é a soma dela, calculada no
        // servidor — o campo vira espelho, pra ninguém digitar 12 embaixo de
        // uma grade que soma 10 (o valor do pedido sai desse número).
        value={hasSizes ? sizesTotal : product.quantity}
        onChange={onChange}
        name="quantity"
        readOnly={hasSizes}
        hint={hasSizes ? 'Somado da grade de tamanhos abaixo' : undefined}
      />

      <Input
        label="Valor unitário (R$)"
        type="number"
        step="0.01"
        placeholder="Ex: 28.00"
        value={product.unitPrice}
        onChange={onChange}
        name="unitPrice"
      />

      <Input
        label="Observações do modelo"
        placeholder="Ex: recorte lateral branco"
        value={product.observations}
        onChange={onChange}
        name="observations"
      />

      {/* Campo separado do de cima, e o par de rótulos é o que faz a divisão
          ficar óbvia para quem preenche: um é instrução de costura, o outro é
          instrução de bordado/silk/DTF. Continua texto livre — o domínio
          decidiu não estruturar posicionamento em lado/frente/costas. */}
      <Input
        label="Observações de estampa e bordado"
        placeholder="Ex: logo na frente, número nas costas"
        value={product.printObservations}
        onChange={onChange}
        name="printObservations"
      />

      <div className="size-grid-field">
        <span className="size-grid-label">Grade de tamanhos</span>
        <p className="size-grid-help">
          Preencha quantas peças de cada tamanho. Deixe em branco os que não
          fazem parte do pedido.
        </p>

        <div className="size-grid">
          {SIZES.map((size) => (
            <label className="size-cell" key={size}>
              <span>{size}</span>
              <input
                type="number"
                min="0"
                value={sizesMap[size] ?? ''}
                onChange={(event) => handleSizeChange(size, event.target.value)}
              />
            </label>
          ))}
        </div>

        {hasSizes && (
          <p className="size-grid-total">Total da grade: {sizesTotal} peças</p>
        )}
      </div>

      <label className="vectorization-checkbox">
        <input
          type="checkbox"
          checked={product.needsVectorization || isAskingVectorizationPrice}
          onChange={handleVectorizationCheckboxChange}
        />
        Vetorizar logo
        {product.needsVectorization && !isAskingVectorizationPrice && (
          <button
            type="button"
            onClick={() => {
              setVectorizationPriceDraft(product.vectorizationPrice ?? '')
              setIsAskingVectorizationPrice(true)
            }}
          >
            Alterar valor
          </button>
        )}
      </label>

      <Modal
        isOpen={isAskingVectorizationPrice}
        onClose={cancelVectorizationPrice}
        title="Vetorizar logo"
      >
        <Input
          label="Valor cobrado (R$)"
          type="number"
          step="0.01"
          placeholder="Ex: 15.00"
          value={vectorizationPriceDraft}
          onChange={(event) => setVectorizationPriceDraft(event.target.value)}
          name="vectorizationPriceDraft"
        />

        <div className="modal-actions">
          <Button variant="secondary" onClick={cancelVectorizationPrice}>
            Cancelar
          </Button>
          <Button onClick={confirmVectorizationPrice}>Confirmar</Button>
        </div>
      </Modal>
    </div>
  )
}

export default ProductFields
