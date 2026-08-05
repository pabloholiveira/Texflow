-- Layout aprovado passa a ser do PEDIDO, não do produto (2026-08-05).
--
-- Mudança de decisão do Pablo: o mockup aprovado é um só para o pedido
-- inteiro, e subir num produto deve fazê-lo valer para todos os outros.
-- 'referencia' NÃO muda — continua sendo material que o cliente entrega
-- para uma peça específica.
--
-- MODELAGEM: a tabela ganha order_id e product_id vira nulável, em vez de
-- uma tabela order_files nova. É exatamente o caminho que product_events já
-- trilhou na migration 0004 (ganhou order_id, product_id virou nulável, e a
-- tabela manteve o nome mesmo com o escopo maior). Uma tabela separada
-- duplicaria upload, exclusão e a integração com o Cloudinary, e obrigaria
-- o front a juntar duas fontes.
--
-- As duas FKs em cascata passam a fazer coisas diferentes, e é o desejado:
-- excluir um PRODUTO leva junto as referências dele, mas não o layout (que
-- tem product_id NULL); excluir o PEDIDO leva tudo.

ALTER TABLE product_files
  ADD COLUMN IF NOT EXISTS order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE;

-- Backfill: todo arquivo existente pertence ao pedido do seu produto.
UPDATE product_files pf
SET order_id = p.order_id
FROM products p
WHERE p.id = pf.product_id AND pf.order_id IS NULL;

-- Soltar o NOT NULL vem ANTES de promover os layouts: o UPDATE abaixo põe
-- product_id em NULL, e com a coluna ainda obrigatória a migration inteira
-- falha (e o runner reverte tudo, como aconteceu na primeira tentativa).
ALTER TABLE product_files ALTER COLUMN product_id DROP NOT NULL;

-- Promove os layouts que já existem para o nível do pedido.
--
-- Sem desempate de propósito: se um pedido tiver dois layouts em produtos
-- diferentes, os dois viram layouts do pedido e aparecem na lista. Preferi
-- isso a escolher um e descartar o outro — perder arquivo numa migration é
-- pior que mostrar dois. (Nos bancos reais, local e produção, existe no
-- máximo um layout por pedido, então o caso é teórico.)
UPDATE product_files SET product_id = NULL WHERE category = 'layout_aprovado';

ALTER TABLE product_files ALTER COLUMN order_id SET NOT NULL;

-- A regra fica gravada no banco, não só nas rotas: layout é do pedido
-- (product_id NULL) e referência é do produto (product_id preenchido). Sem
-- isto, um bug que gravasse layout com product_id voltaria em silêncio ao
-- comportamento antigo — o arquivo apareceria só num produto.
ALTER TABLE product_files
  DROP CONSTRAINT IF EXISTS product_files_scope_check;
ALTER TABLE product_files
  ADD CONSTRAINT product_files_scope_check CHECK (
    (category = 'layout_aprovado' AND product_id IS NULL)
    OR (category = 'referencia' AND product_id IS NOT NULL)
  );
