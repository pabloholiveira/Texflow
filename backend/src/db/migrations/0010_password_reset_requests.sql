-- Item 6: "esqueci minha senha". Os usuários da Kavi não têm e-mail
-- cadastrado, então não existe reset por link — o pedido vira uma fila que
-- um admin aprova dentro do próprio sistema.
--
-- Não guarda senha nem token: aprovar apenas devolve a senha para o padrão
-- (decisão do Pablo), e quem aprova é sempre uma pessoa. Por isso a tabela
-- é só o registro do pedido e de quem resolveu.
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'recusado')),
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP,
  -- Username de quem aprovou/recusou, não FK: mesma escolha já feita em
  -- product_comments.author e product_events.created_by — o histórico
  -- continua legível mesmo se a conta do admin for removida depois.
  resolved_by TEXT
);

-- Índice UNIQUE PARCIAL: no máximo um pedido pendente por usuário, mas
-- quantos pedidos resolvidos quiserem. Sem isso, alguém clicando cinco
-- vezes em "esqueci minha senha" encheria a fila do admin com o mesmo
-- pedido — e a rota é pública, então nem exige má intenção para acontecer.
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_requests_one_pending
  ON password_reset_requests (user_id)
  WHERE status = 'pendente';
