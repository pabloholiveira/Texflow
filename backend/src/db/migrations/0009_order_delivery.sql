-- Item 1: fechamento do pedido. Até aqui não havia como dizer "o cliente
-- buscou, acabou" — o pedido ficava em Conferência para sempre.

-- Sexto e último estágio. Só relaxa o CHECK (mesma razão de TEXT + CHECK em
-- vez de ENUM, ver topo do schema.sql).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_stage_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_stage_check
  CHECK (stage IN ('venda', 'design', 'aprovacao', 'producao', 'conferencia', 'entregue'));

-- Quando o cliente retirou. O estágio já diz QUE retirou; esta coluna diz
-- QUANDO, que é o que um relatório futuro de prazo real (venda → entrega)
-- vai precisar — decisão do Pablo, que escolheu estágio E carimbo, não só um
-- dos dois. NULL enquanto não foi entregue; volta a NULL se alguém regredir
-- o estágio por engano (a regressão existe pra corrigir clique errado).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP;
