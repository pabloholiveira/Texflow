-- TexFlow — Database schema (PostgreSQL)
-- Etapa 1 do roadmap de backend (ver CLAUDE.md > "Backend migration roadmap").
-- Baseado no domain model já documentado em CLAUDE.md. Fechado em 2026-07-04.
--
-- Decisões deliberadas, não óbvias a partir do SQL sozinho:
-- - orders.id é uma PK numérica interna; orders.order_number é o código visível
--   ("PED-2026-0001") em coluna separada, com UNIQUE própria.
-- - stage/status usam TEXT + CHECK em vez de ENUM nativo do Postgres, porque
--   ENUMs são incômodos de alterar depois (ALTER TYPE não roda em transação
--   simples) e este projeto ainda está evoluindo bastante.
-- - product_workflow_steps.step_name é texto livre, SEM foreign key para
--   operations — o formulário de produto aceita uma "outra operação" avulsa
--   que não precisa existir no catálogo gerido em Configurações. Uma FK aqui
--   quebraria esse comportamento já validado no front-end.
-- - Índices adicionais (orders.client_id, products.order_id, etc.) foram
--   deliberadamente adiados para a Etapa 2 — combinado com o usuário.
--
-- Item 2.1 do roadmap "Fechamentos rápidos" (CLAUDE.md): todo CREATE TABLE
-- aqui usa IF NOT EXISTS de propósito — este arquivo é rodado por
-- backend/src/scripts/migrate.js como a base ("migration 0") toda vez que o
-- migration runner executa, então precisa ser seguro rodar tanto num banco
-- novo (cria tudo) quanto num banco que já tem essas tabelas (não faz nada).
-- Mudanças incrementais a partir de agora (novas colunas, novas tabelas) vão
-- em backend/src/db/migrations/, não direto aqui — ver README nessa pasta.

CREATE TABLE IF NOT EXISTS clients (
  id BIGSERIAL PRIMARY KEY,
  person_name TEXT NOT NULL,
  company_name TEXT,
  document TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_id BIGINT REFERENCES clients(id),
  deadline DATE,
  stage TEXT NOT NULL DEFAULT 'venda'
    CHECK (stage IN ('venda', 'design', 'aprovacao', 'producao')),
  is_draft BOOLEAN NOT NULL DEFAULT true,
  -- Soma de (unit_price * quantity) de todos os produtos do pedido — ver
  -- Funcionalidades comerciais (item 1) no CLAUDE.md. Guardado (não só
  -- calculado na hora) e recalculado no backend a cada criação/edição/
  -- remoção de produto, via recalculateOrderTotal (ordersQueries.js).
  -- Registro de valor de venda pra controle interno, não é faturamento.
  total_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  -- Item 3 do roadmap comercial (CLAUDE.md): capturado ao clicar em
  -- "Finalizar Pedido" (pago tudo/metade/outro valor, sempre como número —
  -- sem categoria separada, "quanto falta" é sempre total_value - amount_paid)
  -- e editável depois, via PATCH /orders/:id, pra registrar o restante pago
  -- na retirada.
  amount_paid NUMERIC(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  model TEXT,
  color TEXT,
  fabric TEXT,
  quantity INTEGER,
  observations TEXT,
  needs_design_rework BOOLEAN NOT NULL DEFAULT false,
  -- Valor cobrado por unidade (não a linha inteira) — NULL em produtos que
  -- ainda não tiveram valor informado. Ver orders.total_value acima.
  unit_price NUMERIC(10, 2),
  -- Item 2 do roadmap comercial (CLAUDE.md): "vetorizar logo" como serviço
  -- adicional. vectorization_price só é preenchido quando o checkbox está
  -- marcado; some (vira NULL) se desmarcado — entra na soma de
  -- orders.total_value junto com unit_price * quantity.
  needs_vectorization BOOLEAN NOT NULL DEFAULT false,
  vectorization_price NUMERIC(10, 2),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_workflow_steps (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done')),
  -- Adicionado junto com product_workflow_events (Relatórios, 2026-07-07):
  -- serve de referência pra "desde quando" uma etapa que nunca saiu de
  -- 'pending' está parada, já que ela não tem nenhuma linha em events ainda.
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (product_id, step_name)
);

-- Log de toda mudança de status de uma etapa (Relatórios, 2026-07-07) — sem
-- isso não tem como calcular "tempo médio por etapa" nem "há quanto tempo
-- está parado" (nenhuma coluna antiga guardava quando um status mudou). Uma
-- versão enxuta do "histórico" já citado como planejado no CLAUDE.md, só que
-- limitada a transições de workflow de produto (não inclui order.stage).
CREATE TABLE IF NOT EXISTS product_workflow_events (
  id BIGSERIAL PRIMARY KEY,
  workflow_step_id BIGINT NOT NULL REFERENCES product_workflow_steps(id) ON DELETE CASCADE,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_comments (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  -- Camada da operação na sequência de produção (menor = mais cedo). Operações
  -- na mesma posição não dependem umas das outras, só das de posição menor —
  -- ver PATCH /products/:id/workflow/:step e o modelo documentado no CLAUDE.md.
  -- NULL = fora da sequência (nunca é bloqueada, nunca bloqueia ninguém).
  sequence_position INTEGER
);

-- Etapa 7 do roadmap (CLAUDE.md): login básico. Os papéis por setor chegaram
-- depois (migration 0005) — o CHECK aqui já nasce com os quatro, mas um banco
-- que já existia precisa da 0005 pra trocar a constraint antiga, porque
-- CREATE TABLE IF NOT EXISTS não altera tabela existente. password_hash nunca
-- guarda a senha em texto puro — é gerado com bcrypt (ver createUser.js).
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'vendedora', 'design', 'producao')),
  -- Item 1.2 do roadmap (CLAUDE.md): DELETE /users/:id nunca apaga a linha
  -- de verdade (soft delete) — só marca is_active = false. Login (POST
  -- /auth/login) passa a rejeitar um usuário inativo com a mesma mensagem
  -- genérica de credenciais erradas (mesma convenção anti-enumeração já
  -- usada ali). Não revoga tokens já emitidos (JWT é stateless, sem tabela
  -- de sessões — mesma decisão de design já registrada na Etapa 7).
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Etapas que cada usuário de produção pode operar (migration 0005). Aponta
-- pro mesmo catálogo `operations` que a tela de Configurações gerencia — não
-- existe lista paralela de etapas. Os dois ON DELETE CASCADE limpam sozinhos
-- quando uma operação é removida ou um usuário apagado. Lista vazia nega
-- tudo; a regra vive em canOperateStep (backend/src/db/usersQueries.js).
CREATE TABLE IF NOT EXISTS user_operations (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id BIGINT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, operation_id)
);

CREATE TABLE IF NOT EXISTS product_files (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- 'referencia' = material recebido na venda (fotos, logo, tom de tecido),
  -- disponível já no cadastro do produto; 'layout_aprovado' = PDF do mockup
  -- aprovado pelo cliente, consultado pela produção depois. TEXT + CHECK, não
  -- ENUM, mesma razão de stage/status acima. Sem FK pra um catálogo — só duas
  -- categorias fixas, não justifica uma tabela própria.
  category TEXT NOT NULL CHECK (category IN ('referencia', 'layout_aprovado')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  uploaded_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

-- Configurações genéricas chave-valor (hoje só o template da mensagem de
-- WhatsApp — ver item 4 do roadmap comercial no CLAUDE.md). Uma tabela
-- key-value em vez de uma coluna dedicada em algum lugar, pra uma futura
-- segunda configuração não precisar de outra migração — mas sem construir
-- uma UI genérica de "gerenciar configurações" por causa disso, só essa
-- rota específica mesmo.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
