-- Papéis por setor (vendedora / design / producao), além do 'admin' que já
-- existia sozinho. O CHECK antigo aceitava um único valor de propósito (ver
-- comentário em schema.sql, Etapa 7) — relaxá-lo é só trocar a constraint,
-- sem migration de dado: todo mundo que já existe continua 'admin'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'vendedora', 'design', 'producao'));

-- Dentro do papel 'producao', cada pessoa opera só as etapas atribuídas a
-- ela (ex.: só Corte e Costura) — decisão do Pablo, em vez de um papel por
-- etapa. Muitos-para-muitos com o MESMO catálogo `operations` que a tela de
-- Configurações já gerencia; não existe lista paralela de etapas.
--
-- Os dois ON DELETE CASCADE fazem a limpeza sozinhos: remover uma operação
-- em Configurações apaga os vínculos dela, e desativar/apagar um usuário
-- leva os vínculos junto.
--
-- Lista vazia = nega tudo (não "libera tudo"): esquecer de atribuir gera
-- alguém que não move nada e reclama na hora, em vez de acesso total
-- silencioso. A regra em si mora no backend (requireStepPermission).
CREATE TABLE IF NOT EXISTS user_operations (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_id BIGINT NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, operation_id)
);
