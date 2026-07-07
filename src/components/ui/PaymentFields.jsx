import Input from './Input'
import { formatCurrency } from '../../utils/currency'

// Sem categoria separada de "integral/metade/outro" — é só um valor
// numérico; os botões de atalho só preenchem o mesmo campo, "quanto falta"
// é sempre totalValue - amountPaid. Ver item 3 do roadmap comercial no
// CLAUDE.md.
function PaymentFields({ totalValue, amountPaid, onChange }) {
  const paidNumber = amountPaid === '' ? 0 : Number(amountPaid)
  const remaining = Math.max(totalValue - paidNumber, 0)

  function setAmountPaid(value) {
    onChange({ target: { name: 'amountPaid', value } })
  }

  return (
    <div className="form-grid">
      <p>Valor total do pedido: {formatCurrency(totalValue)}</p>

      <Input
        label="Valor pago (R$)"
        type="number"
        step="0.01"
        value={amountPaid}
        onChange={onChange}
        name="amountPaid"
      />

      <div className="payment-quick-buttons">
        <button type="button" onClick={() => setAmountPaid(totalValue)}>
          Pagou tudo
        </button>
        <button type="button" onClick={() => setAmountPaid(totalValue / 2)}>
          Pagou metade
        </button>
      </div>

      <p>Falta pagar na retirada: {formatCurrency(remaining)}</p>
    </div>
  )
}

export default PaymentFields
