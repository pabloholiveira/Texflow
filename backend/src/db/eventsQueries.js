// Item 3.3 (CLAUDE.md): log de eventos do sistema — a "histórico" do domain
// model. Antes disso, cada ponto que queria registrar algo repetia o mesmo
// INSERT na mão (eram 6 cópias, todas de design); com ~15 pontos de log
// isso não escalaria, daí o helper único.

// Sempre chamado com o `client` de uma transação em andamento, nunca com o
// pool direto: o evento e a mudança que ele descreve precisam ser gravados
// juntos ou não serem gravados (um histórico que registra o que não
// aconteceu — ou omite o que aconteceu — é pior que histórico nenhum).
//
// orderId é opcional quando há productId: o COALESCE abaixo o deriva do
// próprio produto, para que a timeline do pedido (WHERE order_id = X)
// nunca perca um evento por esquecimento de quem chamou.
export async function logEvent(client, { orderId = null, productId = null, type, payload = null, user = null }) {
  await client.query(
    `INSERT INTO product_events (order_id, product_id, event_type, payload, created_by)
     VALUES (
       COALESCE($1::bigint, (SELECT order_id FROM products WHERE id = $2::bigint)),
       $2::bigint,
       $3,
       $4,
       $5
     )`,
    [orderId, productId, type, payload ? JSON.stringify(payload) : null, user]
  )
}

// A timeline do pedido: eventos do próprio pedido E dos produtos dele, numa
// query só — é para isso que existe o order_id em toda linha (migration
// 0004). O LEFT JOIN (não INNER) é obrigatório: eventos de pedido não têm
// produto, e o product_removed tem product_id NULL de propósito.
export async function fetchOrderEvents(db, orderId) {
  const result = await db.query(
    `SELECT e.id, e.event_type, e.payload, e.created_by, e.created_at,
            e.product_id, p.type AS product_type, p.model AS product_model
       FROM product_events e
       LEFT JOIN products p ON p.id = e.product_id
      WHERE e.order_id = $1
      ORDER BY e.created_at DESC, e.id DESC`,
    [orderId]
  )

  return result.rows.map((row) => ({
    id: String(row.id),
    eventType: row.event_type,
    payload: row.payload,
    createdBy: row.created_by,
    createdAt: row.created_at,
    productId: row.product_id ? String(row.product_id) : null,
    // Descrição do produto para a UI não precisar cruzar com a lista de
    // produtos — e, no caso de um produto já excluído, o join não devolve
    // nada, então o payload do próprio evento é a única fonte que sobra.
    productLabel: row.product_type
      ? [row.product_type, row.product_model].filter(Boolean).join(' ')
      : null,
  }))
}
