import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import { useOrders } from '../../context/ordersContext'

const COLUMNS = [
  { status: 'pendente', label: 'Pendente' },
  { status: 'em_design', label: 'Em design' },
  { status: 'aprovacao', label: 'Aprovação' },
  { status: 'concluido', label: 'Concluído' },
]

// Fila de design por PRODUTO (item 3.1 do roadmap — ver CLAUDE.md). Dois
// caminhos de entrada: automático (pedido sai de Venda → todos os produtos
// entram como 'pendente', fluxo normal) e manual (checkbox de retrabalho em
// Produção → 'pendente' com o marcador de retrabalho, que vira badge no
// card). Mover cards aqui empurra o estágio do pedido junto (gatilho no
// servidor, remapeado 2026-07-11): o último produto a entrar em Aprovação
// avança o pedido Design→Aprovação, e o último a Concluir avança
// Aprovação→Em produção. Lê direto do cache compartilhado (useOrders),
// igual Produção — não existe um GET /design-queue dedicado de propósito:
// os pedidos já estão no front, criar outro endpoint seria uma segunda
// fonte de verdade sem necessidade.
function Design() {
  const { orders, setProductDesignStatus } = useOrders()

  const queue = orders
    .filter((order) => !order.isDraft)
    .flatMap((order) =>
      order.products
        .filter((product) => product.designStatus)
        .map((product) => ({
          product,
          orderId: order.id,
          orderNumber: order.orderNumber,
        }))
    )

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Design</h1>
          <p>Fila de trabalho de design por produto</p>
        </div>
      </div>

      <div className="kanban-board design-board">
        {COLUMNS.map((column) => {
          const items = queue.filter(
            (item) => item.product.designStatus === column.status
          )

          return (
            <div className="kanban-column" key={column.status}>
              <h2>{column.label}</h2>

              {items.length === 0 && (
                <p className="kanban-empty">Nenhum produto aqui</p>
              )}

              {items.map((item) => (
                <div className="kanban-card" key={item.product.id}>
                  {item.product.needsDesignRework && (
                    <span className="rework-badge">Retrabalho de design</span>
                  )}
                  <strong>
                    {item.product.type}
                    {item.product.model ? ` — ${item.product.model}` : ''}
                  </strong>

                  <p>
                    <Link
                      className="design-card-order"
                      to={`/pedidos/${item.orderId}`}
                    >
                      {item.orderNumber}
                    </Link>
                    {item.product.color ? ` • ${item.product.color}` : ''}
                    {item.product.quantity ? ` • ${item.product.quantity} peças` : ''}
                  </p>

                  <div className="kanban-card-actions">
                    {column.status === 'pendente' && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setProductDesignStatus(item.orderId, item.product.id, 'em_design')
                        }
                      >
                        Iniciar
                      </Button>
                    )}

                    {column.status === 'em_design' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setProductDesignStatus(item.orderId, item.product.id, 'pendente')
                          }
                        >
                          Voltar
                        </Button>
                        <Button
                          onClick={() =>
                            setProductDesignStatus(item.orderId, item.product.id, 'aprovacao')
                          }
                        >
                          Enviar pra Aprovação
                        </Button>
                      </>
                    )}

                    {column.status === 'aprovacao' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            setProductDesignStatus(item.orderId, item.product.id, 'em_design')
                          }
                        >
                          Voltar
                        </Button>
                        <Button
                          onClick={() =>
                            setProductDesignStatus(item.orderId, item.product.id, 'concluido')
                          }
                        >
                          Concluir
                        </Button>
                      </>
                    )}

                    {column.status === 'concluido' && (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setProductDesignStatus(item.orderId, item.product.id, 'em_design')
                        }
                      >
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </Layout>
  )
}

export default Design
