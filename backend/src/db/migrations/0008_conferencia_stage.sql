-- Item 2 (Conferência), parte 2: o estágio do pedido e o backfill.

-- 1. Novo estágio entre 'producao' e a entrega. O pedido entra nele sozinho
--    quando TODA a fabricação de TODOS os produtos termina — gatilho em
--    PATCH /products/:id/workflow/:step, espelhando os gatilhos que o kanban
--    de design já dispara. Só relaxa o CHECK; é exatamente o motivo de
--    usarmos TEXT + CHECK em vez de ENUM (ver topo do schema.sql).
--    'entregue' fica para o item 1 (fechamento do pedido).
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_stage_check;
ALTER TABLE orders
  ADD CONSTRAINT orders_stage_check
  CHECK (stage IN ('venda', 'design', 'aprovacao', 'producao', 'conferencia'));

-- 2. Backfill pedido pelo Pablo: os produtos que já existem nasceram antes da
--    entrada automática (migration 0007), então não têm Revisão/Finalização
--    nem Embalagem — passariam direto pela Conferência sem ninguém conferir.
--
--    "Pedidos em aberto" = todos os não-rascunho. Hoje isso é literalmente
--    todo pedido real do sistema: o estágio 'entregue' ainda não existe
--    (item 1), então não há como um pedido estar formalmente encerrado.
--    Rascunhos ficam de fora porque podem ser abandonados — e um produto
--    criado dentro de um rascunho a partir de agora já nasce com as duas.
--
--    ON CONFLICT DO NOTHING protege a UNIQUE (product_id, step_name): quem
--    já tiver a etapa (produto novo, ou alguém que marcou à mão antes) não
--    ganha duplicata. Entra sempre como 'pending' — é trabalho que ainda
--    precisa ser feito, não histórico.
INSERT INTO product_workflow_steps (product_id, step_name, status)
SELECT p.id, op.name, 'pending'
  FROM products p
  JOIN orders o ON o.id = p.order_id
 CROSS JOIN operations op
 WHERE op.auto_add = true
   AND o.is_draft = false
ON CONFLICT (product_id, step_name) DO NOTHING;
