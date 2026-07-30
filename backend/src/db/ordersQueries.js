import { pool } from './pool.js'
import { SIZES } from '../data/sizes.js'

// Precisa espelhar src/data/orderStages.js e a lógica de
// getNextStatus/getPreviousStatus do OrdersProvider.jsx do front-end —
// o backend roda num processo Node separado e não importa esse arquivo,
// então esta é a versão "de verdade" para o servidor. Se a ordem dos
// estágios mudar no front, atualize aqui também.
export const ORDER_STAGES = ['venda', 'design', 'aprovacao', 'producao', 'conferencia']

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

// Substitui a grade inteira do produto (apaga e regrava) — a tela manda o
// conjunto final de tamanhos preenchidos, então essa é a operação real, não
// adiciona/remove item a item. Mesma decisão de setUserOperations.
export async function saveProductSizes(db, productId, sizes) {
  await db.query('DELETE FROM product_sizes WHERE product_id = $1', [productId])

  for (const { size, quantity } of sizes) {
    await db.query(
      'INSERT INTO product_sizes (product_id, size, quantity) VALUES ($1, $2, $3)',
      [productId, size, quantity]
    )
  }
}

// products.quantity vira a SOMA da grade quando existe grade. Roda sempre na
// mesma transação de gravar a grade — quantidade e grade divergirem seria
// pior que qualquer uma das duas estar errada sozinha, porque o valor total
// do pedido (unit_price * quantity) sai da quantidade, e ninguém saberia
// qual dos dois números acreditar.
//
// Sem grade nenhuma, NÃO mexe na quantidade: os produtos que já existem (e
// os que a vendedora preferir informar só o total) seguem com o número
// digitado à mão. Devolve a quantidade final, seja ela derivada ou não.
export async function recalculateProductQuantity(db, productId) {
  const result = await db.query(
    `UPDATE products p
     SET quantity = COALESCE(
       (SELECT SUM(quantity) FROM product_sizes WHERE product_id = p.id),
       p.quantity
     )
     WHERE p.id = $1
     RETURNING quantity`,
    [productId]
  )
  return result.rows[0]?.quantity ?? null
}

// Etapas que entram sozinhas em todo produto novo (operations.auto_add,
// migration 0007) — hoje Revisão/Finalização e Embalagem. Consultado na
// criação do produto E na edição de etapas: sem reaplicar na edição, salvar
// o formulário (que nem mostra essas duas) apagaria as duas do produto.
export async function getAutoAddOperationNames(db) {
  const result = await db.query('SELECT name FROM operations WHERE auto_add = true')
  return result.rows.map((row) => row.name)
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

export function mapProduct(
  productRow,
  workflowRows = [],
  commentRows = [],
  fileRows = [],
  sizeRows = []
) {
  return {
    id: productRow.id,
    orderId: productRow.order_id,
    type: productRow.type,
    model: productRow.model,
    color: productRow.color,
    fabric: productRow.fabric,
    quantity: productRow.quantity,
    // Grade de tamanhos (migration 0006). Já vem ordenada pela query; a
    // ordem canônica (2 antes de 10, PP antes de EXG) mora em data/sizes.js,
    // não no banco.
    sizes: sizeRows.map((row) => ({ size: row.size, quantity: row.quantity })),
    observations: productRow.observations,
    designStatus: productRow.design_status,
    designIsRework: productRow.design_is_rework,
    // Derivado (itens 3.1 + ajuste de integração): needsDesignRework agora
    // significa "retrabalho ATIVO" — está na fila (qualquer status antes de
    // concluido) E entrou como retrabalho (design_is_rework). Produto em
    // fluxo normal de design fica na fila sem acender badge/checkbox nenhum.
    needsDesignRework:
      productRow.design_is_rework &&
      ['pendente', 'em_design', 'aprovacao'].includes(productRow.design_status),
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
    amountPaid: toNumber(orderRow.amount_paid),
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

  // ORDER BY não é enfeite: sem ele o Postgres devolve na ordem física das
  // linhas, que MUDA quando uma etapa é atualizada (um UPDATE reposiciona a
  // linha) — na prática a etapa que acabou de ser movida pulava para o fim
  // da lista, embaralhando os chips do ProductCard e a lista do modal de
  // Produção a cada clique. Ordena pela sequência real de produção; etapa
  // fora do catálogo ("outra operação") não tem posição e vai para o fim,
  // com o id desempatando para a ordem ser sempre a mesma.
  const workflowResult = productIds.length
    ? await pool.query(
        `SELECT pws.* FROM product_workflow_steps pws
           LEFT JOIN operations op ON op.name = pws.step_name
          WHERE pws.product_id = ANY($1::bigint[])
          ORDER BY op.sequence_position NULLS LAST, pws.id`,
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

  // ORDER BY pela posição no array de tamanhos: o banco não conhece a ordem
  // canônica, então ela entra aqui como array literal (mesmo conteúdo de
  // data/sizes.js). Sem isso a grade voltaria em ordem arbitrária.
  const sizesResult = productIds.length
    ? await pool.query(
        `SELECT * FROM product_sizes
          WHERE product_id = ANY($1::bigint[])
          ORDER BY array_position($2::text[], size)`,
        [productIds, SIZES]
      )
    : { rows: [] }

  const workflowByProduct = groupBy(workflowResult.rows, 'product_id')
  const commentsByProduct = groupBy(commentsResult.rows, 'product_id')
  const filesByProduct = groupBy(filesResult.rows, 'product_id')
  const sizesByProduct = groupBy(sizesResult.rows, 'product_id')
  const productsByOrder = groupBy(products, 'order_id')

  return orders.map((order) =>
    mapOrder(
      order,
      (productsByOrder[order.id] || []).map((product) =>
        mapProduct(
          product,
          workflowByProduct[product.id] || [],
          commentsByProduct[product.id] || [],
          filesByProduct[product.id] || [],
          sizesByProduct[product.id] || []
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

  // Mesma ordenação do fetchOrders — ver comentário lá.
  const workflowResult = await db.query(
    `SELECT pws.* FROM product_workflow_steps pws
       LEFT JOIN operations op ON op.name = pws.step_name
      WHERE pws.product_id = $1
      ORDER BY op.sequence_position NULLS LAST, pws.id`,
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
  const sizesResult = await db.query(
    `SELECT * FROM product_sizes WHERE product_id = $1
      ORDER BY array_position($2::text[], size)`,
    [productId, SIZES]
  )

  return mapProduct(
    productResult.rows[0],
    workflowResult.rows,
    commentsResult.rows,
    filesResult.rows,
    sizesResult.rows
  )
}
