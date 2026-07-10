-- Item 1.2 do roadmap "Fechamentos rápidos" (CLAUDE.md), aplicado à mão no
-- banco local na hora — esta migration existe pra levar a mesma mudança pra
-- qualquer outro ambiente (Railway incluso) via `npm run migrate`, já que
-- 0000_schema.sql (CREATE TABLE IF NOT EXISTS) não altera uma tabela que já
-- existe.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
