-- Carimbo de quando o design do produto foi concluído.
--
-- Motivo: a coluna "Concluído" do kanban de /design só perdia um card quando
-- o PEDIDO inteiro era entregue (o filtro isActiveOrder). Como um pedido leva
-- semanas até a retirada, a coluna virava um arquivo morto crescente. Com o
-- carimbo, a tela some com o card 7 dias depois da conclusão.
--
-- Nada é apagado por causa disto: design_status continua 'concluido' e o
-- histórico do pedido (product_events) guarda todas as transições. O que
-- muda é só o que a tela mostra.
--
-- Por que uma coluna e não derivar de product_events: a página de design lê
-- do mesmo cache de pedidos que as outras telas (não há endpoint próprio),
-- então o dado precisa vir junto do produto. Mesmo precedente de
-- orders.picked_up_at (migration 0009).
ALTER TABLE products ADD COLUMN IF NOT EXISTS design_concluded_at TIMESTAMP;

-- Backfill: quem já está concluído ganha a data real da conclusão, tirada do
-- próprio histórico (o evento existe desde a migration 0002). Quem concluiu
-- antes de haver histórico cai no COALESCE e começa a contar de agora — some
-- da coluna em 7 dias, em vez de ficar lá para sempre.
UPDATE products p
SET design_concluded_at = COALESCE(
  (
    SELECT max(pe.created_at)
    FROM product_events pe
    WHERE pe.product_id = p.id
      AND pe.event_type = 'design_status_changed'
      AND pe.payload->>'to' = 'concluido'
  ),
  now()
)
WHERE p.design_status = 'concluido'
  AND p.design_concluded_at IS NULL;
