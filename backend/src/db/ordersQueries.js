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

// Operações na mesma sequence_position são independentes entre si — só
// dependem de quem está numa posição menor. Steps sem operação
// correspondente no catálogo (entradas livres de "outra operação") ou sem
// posição definida ficam de fora da checagem, dos dois lados: nunca travam
// e nunca são travados. Usado só para liberar o INÍCIO de uma etapa
// (pending -> in_progress) — ver PATCH /products/:id/workflow/:step.
export async function findBlockingSteps(db, productId, stepPosition) {
  const result = await db.query(
    `SELECT pws.step_name
     FROM product_workflow_steps pws
     JOIN operations op ON op.name = pws.step_name
     WHERE pws.product_id = $1
       AND op.sequence_position < $2
       AND pws.status != 'done'`,
    [productId, stepPosition]
  )
  return result.rows.map((row) => row.step_name)
}

// Postgres NUMERIC volta do node-pg como string (evita perda de precisão
// por padrão) — sem essa conversão o front receberia "28.00" em vez de 28.
// Ver Funcionalidades comerciais (item 1) no CLAUDE.md.
function toNumber(value) {
  return value === null ? null : Number(value)
}

// Recalcula orders.total_value a partir dos produtos atuais — chamado
// dentro da mesma transação de criar/editar/excluir um produto, nunca
// isolado (evitaria ficar dessincronizado se a outra parte falhasse).
// Devolve o total já convertido, pra rota não precisar de outro SELECT.
export async function recalculateOrderTotal(db, orderId) {
  const result = await db.query(
    `UPDATE orders
     SET total_value = (
       SELECT COALESCE(SUM(unit_price * quantity), 0) + COALESCE(SUM(vectorization_price), 0)
       FROM products
       WHERE order_id = $1
     )
     WHERE id = $1
     RETURNING total_value`,
    [orderId]
  )
  return toNumber(result.rows[0].total_value)
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

export function mapFile(fileRow) {
  return {
    id: fileRow.id,
    category: fileRow.category,
    fileName: fileRow.file_name,
    fileUrl: fileRow.file_url,
    fileType: fileRow.file_type,
    uploadedBy: fileRow.uploaded_by,
    createdAt: fileRow.created_at,
  }
}

export function mapProduct(productRow, workflowRows = [], commentRows = [], fileRows = []) {
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
    unitPrice: toNumber(productRow.unit_price),
    needsVectorization: productRow.needs_vectorization,
    vectorizationPrice: toNumber(productRow.vectorization_price),
    workflow: workflowRows.map((step) => ({
      step: step.step_name,
      status: step.status,
    })),
    // Ordem cronológica (mais antigo primeiro) — igual ao array que
    // OrdersProvider.addProductComment monta. "Mais novo primeiro" é
    // decisão de exibição do ProductCard (`.slice().reverse()`), não algo
    // que a API precisa devolver já invertido.
    comments: commentRows.map(mapComment),
    files: fileRows.map(mapFile),
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
    totalValue: toNumber(orderRow.total_value),
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

  const filesResult = productIds.length
    ? await pool.query(
        'SELECT * FROM product_files WHERE product_id = ANY($1::bigint[]) ORDER BY created_at',
        [productIds]
      )
    : { rows: [] }

  const workflowByProduct = groupBy(workflowResult.rows, 'product_id')
  const commentsByProduct = groupBy(commentsResult.rows, 'product_id')
  const filesByProduct = groupBy(filesResult.rows, 'product_id')
  const productsByOrder = groupBy(products, 'order_id')

  return orders.map((order) =>
    mapOrder(
      order,
      (productsByOrder[order.id] || []).map((product) =>
        mapProduct(
          product,
          workflowByProduct[product.id] || [],
          commentsByProduct[product.id] || [],
          filesByProduct[product.id] || []
        )
      )
    )
  )
}

// Busca um único produto (com workflow, comentários e arquivos) — usado
// depois de criar/editar um produto, para devolver o estado atualizado.
// Aceita tanto `pool` quanto um `client` de transação, já que os dois
// expõem `.query`.
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
  const filesResult = await db.query(
    'SELECT * FROM product_files WHERE product_id = $1 ORDER BY created_at',
    [productId]
  )

  return mapProduct(
    productResult.rows[0],
    workflowResult.rows,
    commentsResult.rows,
    filesResult.rows
  )
}
