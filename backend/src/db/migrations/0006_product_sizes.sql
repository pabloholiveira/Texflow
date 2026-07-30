-- Grade de tamanhos por produto (item 3 da lista de 2026-07-29). Antes só
-- existia products.quantity — "10 peças", sem dizer quantas de cada tamanho.
--
-- TEXT + CHECK, não ENUM: mesma razão já registrada no topo do schema.sql —
-- estender um ENUM depois (ALTER TYPE ... ADD VALUE) não roda dentro de
-- transação, então a migration do dia em que a Kavi vender um tamanho novo
-- seria dolorosa. Com CHECK é uma migration de duas linhas, igual à 0003 e à
-- 0005 já fizeram.
--
-- Os numéricos ('1', '2', ...) são TEXT junto com 'PP'/'EXG' porque a coluna
-- precisa de um tipo só. A ORDEM DE EXIBIÇÃO não vive aqui: um CHECK valida
-- mas não ordena, e ordem alfabética colocaria '10' antes de '2' e 'EXG'
-- antes de 'G'. A lista ordenada fica no código (src/data/sizes.js no front,
-- backend/src/data/sizes.js aqui), duplicada de propósito entre os dois
-- processos Node, mesma convenção de ORDER_STAGES.
--
-- Chave primária composta (product_id, size): impede o mesmo tamanho duas
-- vezes no mesmo produto sem precisar de um UNIQUE separado, e dispensa uma
-- coluna id que ninguém usaria — a linha É identificada por produto+tamanho.
--
-- quantity > 0: tamanho com zero peças não é "zero", é ausência de linha.
-- Isso mantém a grade sem lixo e faz SUM(quantity) ser sempre a quantidade
-- real do produto (ver recalculateProductQuantity em ordersQueries.js).
CREATE TABLE IF NOT EXISTS product_sizes (
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  size TEXT NOT NULL CHECK (size IN (
    '1', '2', '4', '6', '8', '10', '12', '14', '16',
    'PP', 'P', 'M', 'G', 'GG', 'EXG',
    'G1', 'G2', 'G3', 'G4'
  )),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (product_id, size)
);
