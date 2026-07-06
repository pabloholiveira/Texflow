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

CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  person_name TEXT NOT NULL,
  company_name TEXT,
  document TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  client_id BIGINT REFERENCES clients(id),
  deadline DATE,
  stage TEXT NOT NULL DEFAULT 'venda'
    CHECK (stage IN ('venda', 'design', 'aprovacao', 'producao')),
  is_draft BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  model TEXT,
  color TEXT,
  fabric TEXT,
  quantity INTEGER,
  observations TEXT,
  needs_design_rework BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_workflow_steps (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'done')),
  UNIQUE (product_id, step_name)
);

CREATE TABLE product_comments (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE operations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  -- Camada da operação na sequência de produção (menor = mais cedo). Operações
  -- na mesma posição não dependem umas das outras, só das de posição menor —
  -- ver PATCH /products/:id/workflow/:step e o modelo documentado no CLAUDE.md.
  -- NULL = fora da sequência (nunca é bloqueada, nunca bloqueia ninguém).
  sequence_position INTEGER
);

-- Etapa 7 do roadmap (CLAUDE.md): login básico, sem papéis por setor ainda.
-- role tem CHECK só com 'admin' por enquanto — dá pra virar
-- ('admin', 'vendedora', 'producao', ...) depois sem migração estrutural,
-- só relaxando o CHECK. password_hash nunca guarda a senha em texto puro —
-- é gerado com bcrypt (ver backend/src/scripts/createUser.js).
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin')),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE product_files (
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
