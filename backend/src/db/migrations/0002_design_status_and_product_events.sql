-- Item 3.1 do roadmap (CLAUDE.md): fila de design por produto.
--
-- products.needs_design_rework (boolean) vira products.design_status
-- (TEXT nullable): NULL = fora da fila de design; 'pendente' → 'em_design'
-- → 'concluido' são as colunas do kanban da nova tela /design. O campo
-- needsDesignRework que o front já consome NÃO sumiu da API — virou campo
-- derivado em mapProduct (pendente/em_design → true), então badges e
-- checkbox existentes continuam funcionando sem mudança de tela.
ALTER TABLE products ADD COLUMN IF NOT EXISTS design_status TEXT
  CHECK (design_status IN ('pendente', 'em_design', 'concluido'));

UPDATE products SET design_status = 'pendente' WHERE needs_design_rework = true;

ALTER TABLE products DROP COLUMN IF EXISTS needs_design_rework;

-- Tabela GENÉRICA de eventos por produto — já nasce no formato que o item
-- 3.3 (histórico completo) planeja, decidido com o Pablo pra evitar migrar
-- uma design_status_log específica depois. Por enquanto só eventos
-- 'design_status_changed' (payload {from, to}) são gravados; 3.3 expande o
-- uso pra outros tipos. created_by é TEXT (username), sem FK pra users —
-- mesmo precedente do author de comentários.
CREATE TABLE IF NOT EXISTS product_events (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB,
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
