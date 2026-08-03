-- Papel 'gerente': acumula tudo da vendedora e soma a produção inteira.
-- Mesma forma da 0005 — o CHECK é trocado, não há migration de dado nos
-- papéis existentes.
--
-- O que o gerente NÃO tem (decisão do Pablo): Configurações, e a futura aba
-- financeira. É por isso que ele não é simplesmente um segundo 'admin'.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'vendedora', 'design', 'producao', 'gerente'));

-- A conta 'caixa' é o motivo desta migration existir: ela era 'vendedora' e
-- passa a ser a gerente. WHERE por username, então isto é no-op em qualquer
-- banco que não tenha essa conta (o local de desenvolvimento, por exemplo).
--
-- O username segue 'caixa' — renomear é decisão à parte, e ele continua sendo
-- uma conta compartilhada, então o histórico e os comentários seguem sem
-- dizer QUEM da loja agiu. Limitação já conhecida, não introduzida aqui.
UPDATE users SET role = 'gerente' WHERE username = 'caixa';
