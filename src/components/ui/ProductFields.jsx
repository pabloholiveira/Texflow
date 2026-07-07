import { useState } from 'react'
import Input from './Input'
import SuggestibleInput from './SuggestibleInput'
import Button from './Button'
import Modal from './Modal'
import { useOrders } from '../../context/ordersContext'

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
        value={product.quantity}
        onChange={onChange}
        name="quantity"
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
