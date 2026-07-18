-- Item 3.3 (CLAUDE.md): histórico completo por pedido/produto.
--
-- A product_events nasceu no item 3.1 só para o log de design, então exigia
-- um product_id. Um evento de PEDIDO (mudança de estágio, pagamento,
-- finalização) não tem produto nenhum a que se ligar, e por isso não tinha
-- onde ser gravado. Aqui a tabela deixa de ser "eventos de produto" e passa
-- a ser o log de eventos do sistema inteiro:
--
--   * order_id  — sempre preenchido, inclusive em evento de produto (o
--     logEvent deriva a partir do produto quando não vem explícito). É isso
--     que faz a timeline do pedido ser UMA query (WHERE order_id = X) que já
--     traz junto tudo que aconteceu com os produtos dele.
--   * product_id — agora nulável: evento puramente de pedido não tem produto.
--     Também é o que permite registrar a REMOÇÃO de um produto: o FK é
--     ON DELETE CASCADE, então um evento amarrado ao produto excluído
--     desapareceria junto com ele; product_removed é gravado com
--     product_id NULL e a descrição do produto no payload.
--
-- O nome da tabela continua product_events (renomear obrigaria a mexer em
-- schema.sql, na migration 0002 e em todos os pontos de leitura/escrita, sem
-- ganho funcional) — mas o escopo dela hoje é maior do que o nome sugere.

ALTER TABLE product_events
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE product_events
  ALTER COLUMN product_id DROP NOT NULL;

-- Backfill: as linhas que já existem (só eventos de design) sabem o pedido
-- por meio do produto.
UPDATE product_events e
   SET order_id = p.order_id
  FROM products p
 WHERE p.id = e.product_id
   AND e.order_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_product_events_order_id ON product_events (order_id);
CREATE INDEX IF NOT EXISTS idx_product_events_product_id ON product_events (product_id);
