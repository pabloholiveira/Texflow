-- Ajuste do item 3.1 (CLAUDE.md): integração bidirecional Pedidos ↔ Design
-- e distinção entre fluxo normal e retrabalho.
--
-- 1. design_status ganha 'aprovacao' (layout enviado pro cliente aprovar) —
--    nova ordem do kanban: pendente → em_design → aprovacao → concluido.
--    Só relaxa o CHECK; é exatamente o motivo de usarmos TEXT + CHECK em
--    vez de ENUM (ver comentário no topo do schema.sql).
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_design_status_check;
ALTER TABLE products ADD CONSTRAINT products_design_status_check
  CHECK (design_status IN ('pendente', 'em_design', 'aprovacao', 'concluido'));

-- 2. design_is_rework distingue COMO o produto entrou na fila de design:
--    false = fluxo normal (pedido saiu de Venda — gatilho automático);
--    true  = retrabalho real (checkbox em Produção — cliente pediu alteração
--    depois do design pronto). O campo derivado needsDesignRework da API
--    passa a exigir os dois: está na fila E é retrabalho — assim o badge
--    "Retrabalho de design" só acende pra retrabalho de verdade, não pra
--    todo produto em design normal.
ALTER TABLE products ADD COLUMN IF NOT EXISTS design_is_rework BOOLEAN NOT NULL DEFAULT false;

-- Backfill: tudo que está na fila neste momento entrou pelo checkbox de
-- retrabalho (era o único caminho de entrada que existia até aqui).
UPDATE products SET design_is_rework = true WHERE design_status IS NOT NULL;
