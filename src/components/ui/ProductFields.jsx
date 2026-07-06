import Input from './Input'
import SuggestibleInput from './SuggestibleInput'
import { useOrders } from '../../context/ordersContext'

function getDistinctValues(products, field) {
  return [...new Set(products.map((product) => product[field]).filter(Boolean))]
}

function ProductFields({ product, onChange }) {
  const { orders } = useOrders()
  const allProducts = orders.flatMap((order) => order.products)

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
        label="Observações do modelo"
        placeholder="Ex: recorte lateral branco"
        value={product.observations}
        onChange={onChange}
        name="observations"
      />
    </div>
  )
}

export default ProductFields
