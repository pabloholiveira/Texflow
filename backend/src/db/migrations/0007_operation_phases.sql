-- Item 2 (Conferência), parte 1: o modelo. Decisão do Pablo em 2026-07-29 —
-- Lavagem, Revisão/Finalização e Embalagem saem do kanban de Produção e
-- passam a viver numa aba própria, operada pela vendedora. A Produção fica só
-- com a fabricação (Corte, Costura, Bordado, Silk, DTF).
--
-- Isso NÃO cria uma tabela nova nem um status novo: as três continuam sendo
-- operations do mesmo catálogo, e a Conferência é uma visão filtrada sobre o
-- product_workflow_steps que já existe. Duas colunas dão conta.

-- 1. `phase` diz de quem é a etapa. É dela que saem, da mesma fonte: quais
--    abas cada tela mostra E quem tem permissão de mover a etapa (ver
--    PATCH /products/:id/workflow/:step). Sem essa coluna, a alternativa
--    seria uma lista de nomes espalhada pelo código — que quebraria no dia
--    em que alguém renomeasse uma operação em Configurações.
ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS phase TEXT NOT NULL DEFAULT 'producao'
  CHECK (phase IN ('producao', 'conferencia'));

-- 2. `auto_add` = a etapa entra sozinha em todo produto novo, sem a vendedora
--    marcar. Vale para Revisão/Finalização e Embalagem (tudo é conferido e
--    embalado antes de entregar), mas NÃO para Lavagem: nem toda peça é
--    lavada, e obrigá-la viraria clique de mentirinha. Como coluna, e não
--    como dois nomes fixos no código, porque o catálogo é configurável por
--    princípio (ver domain model no CLAUDE.md).
ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS auto_add BOOLEAN NOT NULL DEFAULT false;

UPDATE operations
   SET phase = 'conferencia'
 WHERE name IN ('Lavagem', 'Revisão/Finalização', 'Embalagem');

UPDATE operations
   SET auto_add = true
 WHERE name IN ('Revisão/Finalização', 'Embalagem');

-- 3. Reposicionamento. As posições antigas eram Revisão/Finalização=3,
--    Lavagem=4, Embalagem=5 — ou seja, o gate de sequência exigia REVISÃO
--    ANTES DE LAVAGEM, o inverso da sequência de Conferência combinada
--    (Lavagem → Revisão/Finalização → Embalagem). Sem esta troca, a
--    vendedora não conseguiria iniciar a Lavagem.
UPDATE operations SET sequence_position = 3 WHERE name = 'Lavagem';
UPDATE operations SET sequence_position = 4 WHERE name = 'Revisão/Finalização';
UPDATE operations SET sequence_position = 5 WHERE name = 'Embalagem';
