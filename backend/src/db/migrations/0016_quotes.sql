-- Orçamentos (2026-08-26).
--
-- ENTIDADE PRÓPRIA, NÃO uma flag `is_quote` em `orders` (decisão do Pablo,
-- tomada depois de as duas alternativas serem comparadas). A flag seria mais
-- barata num ponto só — `isActiveOrder` cobriria as 5 telas de trabalho de
-- uma vez — mas deixaria quatro pontos de SQL no backend (Financeiro e as
-- duas queries de Gargalos, mais o lead-time) e o filtro cru da tela de
-- Clientes tendo que lembrar do orçamento PARA SEMPRE, sob pena de um
-- orçamento entrar num número como se fosse venda. E o pior caso é o
-- Financeiro: orçamento contado em `sold` é uma venda que nunca existiu.
--
-- Tabela separada torna isso impossível por construção: nenhuma query
-- existente enxerga `quotes`, então nenhuma delas precisou mudar.
--
-- O PREÇO ACEITO da separação: os campos de item repetem os de `products`
-- (tipo, modelo, cor, tecido, grade, valor). É duplicação de FORMA, não de
-- comportamento — um item de orçamento não tem workflow, não tem arquivo,
-- não tem comentário, não entra na fila de design e não anda por estágio
-- nenhum. É uma linha de proposta comercial; o produto é a peça física.

CREATE TABLE IF NOT EXISTS quotes (
  id BIGSERIAL PRIMARY KEY,

  -- Mesmo desenho de orders.order_number: id numérico para join/índice e um
  -- código legível separado, com UNIQUE próprio. Formato ORC-{ano}-{id},
  -- montado pelo mesmo truque de inserir com placeholder e atualizar depois
  -- que o RETURNING devolve o id (ver routes/quotes.js).
  quote_number TEXT NOT NULL UNIQUE,

  -- Nulável de propósito: no começo da conversa a vendedora pode ter só a
  -- peça e o preço, sem cadastro do cliente ainda. Converter em pedido é que
  -- exige (um pedido sem cliente não tem para quem entregar).
  client_id BIGINT REFERENCES clients(id),

  -- Validade da PROPOSTA ("este preço vale até"), que não é o prazo de
  -- entrega do pedido: são datas de naturezas diferentes e por isso a
  -- conversão não copia uma na outra — o prazo é perguntado na hora.
  valid_until DATE,

  observations TEXT,

  -- Armazenado, recalculado dentro da mesma transação de qualquer mudança de
  -- item — mesma decisão (e mesma fórmula) de orders.total_value.
  total_value NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- O STATUS É DERIVADO destas três colunas mais valid_until, e não é uma
  -- coluna própria: um `status` gravado precisaria ser mantido em dia por
  -- alguém, e "vencido" muda sozinho com a passagem do tempo — nenhum código
  -- roda no dia do vencimento para escrever isso. Derivar é a única forma de
  -- o status nunca mentir. Ver src/data/quoteStatuses.js (front).
  rejected_at TIMESTAMP,

  -- Converter COPIA para um pedido novo e mantém o orçamento como documento
  -- histórico (decisão do Pablo): promover destruindo faria uma edição futura
  -- do pedido reescrever a proposta que o cliente aprovou, e este projeto não
  -- exclui nada em lugar nenhum.
  --
  -- São DUAS colunas porque respondem a perguntas diferentes: converted_at é
  -- o fato (aconteceu, e quando), converted_order_id é o link. Se o pedido
  -- for excluído um dia, o SET NULL desfaz o link mas o fato permanece — com
  -- uma coluna só, excluir o pedido faria o orçamento voltar a parecer
  -- "aberto", e ele reapareceria na lista de propostas em aberto.
  converted_at TIMESTAMP,
  converted_order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id BIGSERIAL PRIMARY KEY,
  quote_id BIGINT NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,

  type TEXT NOT NULL,
  model TEXT,
  color TEXT,
  fabric TEXT,

  -- Soma da grade quando existe grade; digitada à mão quando não existe.
  -- Mesma regra de products.quantity, pelo mesmo motivo: o valor sai de
  -- unit_price * quantity, e grade somando 10 com quantidade dizendo 12
  -- deixaria ninguém sabendo qual dos dois números acreditar.
  quantity INTEGER NOT NULL DEFAULT 0,

  observations TEXT,
  print_observations TEXT,

  unit_price NUMERIC(10,2),
  needs_vectorization BOOLEAN NOT NULL DEFAULT false,
  vectorization_price NUMERIC(10,2),

  -- Preserva a ordem em que a vendedora montou a proposta. Em `products` a
  -- ordem é o created_at, que aqui não serve: editar um orçamento regrava o
  -- conjunto inteiro de itens de uma vez (ver PUT /quotes/:id), então todos
  -- nasceriam no mesmo instante.
  position INTEGER NOT NULL DEFAULT 0,

  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON quote_items (quote_id);

-- Espelha product_sizes, inclusive o CHECK com a lista fechada de tamanhos
-- (dois lugares, porque um CHECK não se compartilha entre tabelas; a lista
-- canônica vive em backend/src/data/sizes.js e src/data/sizes.js).
CREATE TABLE IF NOT EXISTS quote_item_sizes (
  quote_item_id BIGINT NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,
  size TEXT NOT NULL CHECK (size IN (
    '1', '2', '4', '6', '8', '10', '12', '14', '16',
    'PP', 'P', 'M', 'G', 'GG', 'EXG',
    'G1', 'G2', 'G3', 'G4'
  )),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (quote_item_id, size)
);
