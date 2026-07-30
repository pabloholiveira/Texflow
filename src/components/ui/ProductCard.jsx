import Button from './Button'
import { formatCurrency } from '../../utils/currency'
import { useAuth } from '../../context/authContext'
import { formatSizes } from '../../data/sizes'

function getOverallStatus(workflow) {
  if (!workflow || workflow.length === 0) {
    return { key: 'pending', label: 'Não iniciado' }
  }

  if (workflow.every((stage) => stage.status === 'done')) {
    return { key: 'done', label: 'Concluído' }
  }

  if (workflow.some((stage) => stage.status !== 'pending')) {
    return { key: 'progress', label: 'Em andamento' }
  }

  return { key: 'pending', label: 'Não iniciado' }
}

function ProductCard({ product, onRemove, onEdit, onEditInfo, onOpenComments, onOpenFiles }) {
  const overallStatus = getOverallStatus(product.workflow)
  // O card lê a permissão direto do contexto em vez de receber por prop: ele
  // é usado em três telas (NewOrder, OrderDetails e o modal de Produção), e
  // todas as três teriam que repassar a mesma coisa. Comentários e arquivos
  // ficam com todo mundo — quem está na produção precisa registrar ocorrência
  // e consultar o layout aprovado.
  const { can } = useAuth()
  const canWrite = can('orders.write')

  return (
    <div className="product-card">
      <div className="product-card-header">
        <div>
          <strong>
            🧥 {product.type} {product.color}
          </strong>

          <p>{product.model || 'Modelo não informado'}</p>
        </div>

        <span className={`product-status product-status-${overallStatus.key}`}>
          {overallStatus.label}
        </span>
      </div>

      <div className="product-card-info">
        <div>
          <span>Tecido</span>
          <strong>{product.fabric || '-'}</strong>
        </div>

        <div>
          <span>Quantidade</span>
          <strong>{product.quantity} peças</strong>
        </div>

        {product.sizes?.length > 0 && (
          <div>
            <span>Tamanhos</span>
            <strong>{formatSizes(product.sizes)}</strong>
          </div>
        )}

        <div>
          <span>Cor</span>
          <strong>{product.color || '-'}</strong>
        </div>

        <div>
          <span>Valor unitário</span>
          <strong>{product.unitPrice != null ? formatCurrency(product.unitPrice) : '-'}</strong>
        </div>

        {product.unitPrice != null && (
          <div>
            <span>Subtotal</span>
            <strong>{formatCurrency(product.unitPrice * product.quantity)}</strong>
          </div>
        )}

        {product.needsVectorization && (
          <div>
            <span>Vetorização</span>
            <strong>
              {product.vectorizationPrice != null
                ? formatCurrency(product.vectorizationPrice)
                : '-'}
            </strong>
          </div>
        )}
      </div>

      {product.observations && (
        <div className="product-card-notes">
          <span>Observações</span>
          <p>{product.observations}</p>
        </div>
      )}

      {product.workflow?.length > 0 && (
        <div className="product-workflow">
          {product.workflow.map((stage) => (
            <span
              className={`workflow-chip workflow-chip-${stage.status}`}
              key={stage.step}
            >
              {stage.step}
            </span>
          ))}
        </div>
      )}

      <div className="product-card-actions">
        {canWrite && (
          <Button variant="secondary" onClick={() => onEdit(product)}>
            Editar Etapas
          </Button>
        )}

        {canWrite && (
          <Button variant="secondary" onClick={() => onEditInfo(product)}>
            Editar Dados
          </Button>
        )}

        <Button variant="secondary" onClick={() => onOpenComments(product)}>
          Comentários{product.comments?.length > 0 ? ` (${product.comments.length})` : ''}
        </Button>

        <Button variant="secondary" onClick={() => onOpenFiles(product)}>
          Arquivos{product.files?.length > 0 ? ` (${product.files.length})` : ''}
        </Button>

        {canWrite && (
          <Button variant="danger" onClick={() => onRemove(product.id)}>
            Excluir
          </Button>
        )}
      </div>
    </div>
  )
}

export default ProductCard