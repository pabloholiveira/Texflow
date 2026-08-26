import { pool } from './pool.js'
import { toNumber } from './ordersQueries.js'
import { SIZES, normalizeSizes } from '../data/sizes.js'

function groupBy(rows, key) {
  return rows.reduce((acc, row) => {
    const groupKey = row[key]
    if (!acc[groupKey]) acc[groupKey] = []
    acc[groupKey].push(row)
    return acc
  }, {})
}

export function mapQuoteItem(itemRow, sizeRows = []) {
  return {
    id: itemRow.id,
    quoteId: itemRow.quote_id,
    type: itemRow.type,
    model: itemRow.model,
    color: itemRow.color,
    fabric: itemRow.fabric,
    quantity: itemRow.quantity,
    sizes: sizeRows.map((row) => ({ size: row.size, quantity: row.quantity })),
    observations: itemRow.observations,
    printObservations: itemRow.print_observations,
    unitPrice: toNumber(itemRow.unit_price),
    needsVectorization: itemRow.needs_vectorization,
    vectorizationPrice: toNumber(itemRow.vectorization_price),
  }
}

export function mapQuote(quoteRow, items = []) {
  return {
    id: quoteRow.id,
    quoteNumber: quoteRow.quote_number,
    clientId: quoteRow.client_id,
    validUntil: quoteRow.valid_until,
    observations: quoteRow.observations,
    totalValue: toNumber(quoteRow.total_value),
    // O status NÃO vem daqui: é derivado destes três campos mais a data de
    // hoje, no front (src/data/quoteStatuses.js). Mandar um `status` pronto
    // criaria um segundo dono da mesma regra — e um "vencido" calculado no
    // servidor ficaria velho na tela de quem deixou a aba aberta.
    rejectedAt: quoteRow.rejected_at,
    convertedAt: quoteRow.converted_at,
    convertedOrderId: quoteRow.converted_order_id,
    createdAt: quoteRow.created_at,
    updatedAt: quoteRow.updated_at,
    items,
  }
}

// Mesma estratégia do fetchOrders: queries simples e agrupamento em JS, em
// vez de json_agg no SQL.
export async function fetchQuotes(whereSql = '', params = []) {
  const quotesResult = await pool.query(
    `SELECT * FROM quotes ${whereSql} ORDER BY created_at DESC`,
    params
  )
  const quotes = quotesResult.rows
  if (quotes.length === 0) return []

  const quoteIds = quotes.map((quote) => quote.id)
  const itemsResult = await pool.query(
    `SELECT * FROM quote_items WHERE quote_id = ANY($1::bigint[])
      ORDER BY position, id`,
    [quoteIds]
  )
  const items = itemsResult.rows
  const itemIds = items.map((item) => item.id)

  // Ordem canônica dos tamanhos como array literal — o banco valida o
  // conjunto, mas não sabe que '2' vem antes de '10'. Mesma solução do
  // fetchOrders para product_sizes.
  const sizesResult = itemIds.length
    ? await pool.query(
        `SELECT * FROM quote_item_sizes
          WHERE quote_item_id = ANY($1::bigint[])
          ORDER BY array_position($2::text[], size)`,
        [itemIds, SIZES]
      )
    : { rows: [] }

  const sizesByItem = groupBy(sizesResult.rows, 'quote_item_id')
  const itemsByQuote = groupBy(items, 'quote_id')

  return quotes.map((quote) =>
    mapQuote(
      quote,
      (itemsByQuote[quote.id] || []).map((item) =>
        mapQuoteItem(item, sizesByItem[item.id] || [])
      )
    )
  )
}

// Mesma fórmula de recalculateOrderTotal, inclusive a vetorização somada por
// fora (ela é um serviço por peça, não multiplica pela quantidade).
export async function recalculateQuoteTotal(db, quoteId) {
  const result = await db.query(
    `UPDATE quotes
     SET total_value = (
       SELECT COALESCE(SUM(unit_price * quantity), 0) + COALESCE(SUM(vectorization_price), 0)
       FROM quote_items
       WHERE quote_id = $1
     )
     WHERE id = $1
     RETURNING total_value`,
    [quoteId]
  )
  return toNumber(result.rows[0].total_value)
}

// Valida e limpa a lista de itens que a tela mandou. Lança com mensagem em
// português para a rota virar 400 — mesmo contrato do normalizeSizes.
export function normalizeQuoteItems(input) {
  if (input == null) return []
  if (!Array.isArray(input)) throw new Error('items deve ser uma lista')

  return input.map((item, index) => {
    const sizes = normalizeSizes(item?.sizes)
    const sizesTotal = sizes.reduce((sum, entry) => sum + entry.quantity, 0)
    const quantity = sizesTotal > 0 ? sizesTotal : Number(item?.quantity) || 0

    if (!item?.type) {
      throw new Error(`O item ${index + 1} precisa do tipo da peça`)
    }
    if (quantity <= 0) {
      throw new Error(`O item ${index + 1} precisa da quantidade (ou da grade de tamanhos)`)
    }

    return {
      type: item.type,
      model: item.model ?? null,
      color: item.color ?? null,
      fabric: item.fabric ?? null,
      quantity,
      observations: item.observations ?? null,
      printObservations: item.printObservations ?? null,
      // '' não é NUMERIC válido no Postgres — mesmo tratamento que
      // unitPrice/vectorizationPrice já recebem nas rotas de produto.
      unitPrice: item.unitPrice === '' || item.unitPrice == null ? null : Number(item.unitPrice),
      needsVectorization: !!item.needsVectorization,
      vectorizationPrice:
        item.vectorizationPrice === '' || item.vectorizationPrice == null
          ? null
          : Number(item.vectorizationPrice),
      sizes,
      position: index,
    }
  })
}

// Substitui o conjunto inteiro de itens (apaga e regrava), em vez de um CRUD
// item a item como o de produtos. Cabe aqui e não lá porque um item de
// orçamento não tem nada a preservar: sem workflow com status andado, sem
// arquivo, sem comentário. Regravar é a operação real — a tela manda a
// proposta como ela ficou.
export async function replaceQuoteItems(db, quoteId, items) {
  await db.query('DELETE FROM quote_items WHERE quote_id = $1', [quoteId])

  for (const item of items) {
    const inserted = await db.query(
      `INSERT INTO quote_items
         (quote_id, type, model, color, fabric, quantity, observations,
          print_observations, unit_price, needs_vectorization, vectorization_price, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [
        quoteId,
        item.type,
        item.model,
        item.color,
        item.fabric,
        item.quantity,
        item.observations,
        item.printObservations,
        item.unitPrice,
        item.needsVectorization,
        item.vectorizationPrice,
        item.position,
      ]
    )

    for (const { size, quantity } of item.sizes) {
      await db.query(
        'INSERT INTO quote_item_sizes (quote_item_id, size, quantity) VALUES ($1, $2, $3)',
        [inserted.rows[0].id, size, quantity]
      )
    }
  }
}
