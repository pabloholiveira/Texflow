import { pool } from './pool.js'

// Precisa espelhar src/data/orderStages.js e a lógica de
// getNextStatus/getPreviousStatus do OrdersProvider.jsx do front-end —
// o backend roda num processo Node separado e não importa esse arquivo,
// então esta é a versão "de verdade" para o servidor. Se a ordem dos
// estágios mudar no front, atualize aqui também.
export const ORDER_STAGES = ['venda', 'design', 'aprovacao', 'producao']

export function getNextStatus(status) {
  if (status === 'pending') return 'in_progress'
  return 'done'
}

export function getPreviousStatus(status) {
  if (status === 'done') return 'in_progress'
  return 'pending'
}

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const groupKey = row[key]
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(row)
    return acc
  }, {})
}

export function mapComment(commentRow) {
  return {
    id: commentRow.id,
    author: commentRow.author,
    text: commentRow.text,
    createdAt: commentRow.created_at,
  }
}

export function mapProduct(productRow, workflowRows = [], commentRows = []) {
  return {
    id: productRow.id,
    orderId: productRow.order_id,
    type: productRow.type,
    model: productRow.model,
    color: productRow.color,
    fabric: productRow.fabric,
    quantity: productRow.quantity,
    observations: productRow.observations,
    needsDesignRework: productRow.needs_design_rework,
    workflow: workflowRows.map((step) => ({
      step: step.step_name,
      status: step.status,
    })),
    // Ordem cronológica (mais antigo primeiro) — igual ao array que
    // OrdersProvider.addProductComment monta. "Mais novo primeiro" é
    // decisão de exibição do ProductCard (`.slice().reverse()`), não algo
    // que a API precisa devolver já invertido.
    comments: commentRows.map(mapComment),
  }
}

export function mapOrder(orderRow, products = []) {
  return {
    id: orderRow.id,
    orderNumber: orderRow.order_number,
    clientId: orderRow.client_id,
    deadline: orderRow.deadline,
    stage: orderRow.stage,
    isDraft: orderRow.is_draft,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at,
    products,
  }
}

// Busca pedidos (todos, ou filtrados via whereSql) já com produtos e
// workflow embutidos, no mesmo formato aninhado que o front-end espera de
// `order.products` — três queries simples + agrupamento em JS, em vez de
// um JOIN/json_agg complexo em SQL.
export async function fetchOrders(whereSql = '', params = []) {
  const ordersResult = await pool.query(
    `SELECT * FROM orders ${whereSql} ORDER BY created_at`,
    params
  )
  const orders = ordersResult.rows
  if (orders.length === 0) return []

  const orderIds = orders.map((order) => order.id)
  const productsResult = await pool.query(
    'SELECT * FROM products WHERE order_id = ANY($1::bigint[]) ORDER BY created_at',
    [orderIds]
  )
  const products = productsResult.rows
  const productIds = products.map((product) => product.id)

  const workflowResult = productIds.length
    ? await pool.query(
        'SELECT * FROM product_workflow_steps WHERE product_id = ANY($1::bigint[])',
        [productIds]
      )
    : { rows: [] }

  const commentsResult = productIds.length
    ? await pool.query(
        'SELECT * FROM product_comments WHERE product_id = ANY($1::bigint[]) ORDER BY created_at',
        [productIds]
      )
    : { rows: [] }

  const workflowByProduct = groupBy(workflowResult.rows, 'product_id')
  const commentsByProduct = groupBy(commentsResult.rows, 'product_id')
  const productsByOrder = groupBy(products, 'order_id')

  return orders.map((order) =>
    mapOrder(
      order,
      (productsByOrder[order.id] || []).map((product) =>
        mapProduct(
          product,
          workflowByProduct[product.id] || [],
          commentsByProduct[product.id] || []
        )
      )
    )
  )
}

// Busca um único produto (com workflow e comentários) — usado depois de
// criar/editar um produto, para devolver o estado atualizado. Aceita tanto
// `pool` quanto um `client` de transação, já que os dois expõem `.query`.
export async function getProductById(db, productId) {
  const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId])
  if (productResult.rows.length === 0) return null

  const workflowResult = await db.query(
    'SELECT * FROM product_workflow_steps WHERE product_id = $1',
    [productId]
  )
  const commentsResult = await db.query(
    'SELECT * FROM product_comments WHERE product_id = $1 ORDER BY created_at',
    [productId]
  )

  return mapProduct(productResult.rows[0], workflowResult.rows, commentsResult.rows)
}
