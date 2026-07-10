# Migrations

`schema.sql` (uma pasta acima) continua sendo a base — descreve o schema completo,
com todos os comentários explicando as decisões, e é sempre aplicado primeiro por
`npm run migrate` (é seguro rodar de novo em qualquer banco, veja o comentário no
topo daquele arquivo).

A partir de agora, qualquer mudança de schema (nova coluna, nova tabela) vira um
arquivo aqui, não uma edição direta em `schema.sql`. Convenções:

- Nome: `NNNN_descricao_curta.sql`, `NNNN` sequencial com 4 dígitos (`0001`, `0002`, ...).
- Cada migration roda uma única vez, dentro de uma transação — `npm run migrate`
  registra o nome do arquivo em `schema_migrations` depois de aplicar com sucesso e
  nunca roda o mesmo arquivo duas vezes.
- Escreva migrations de forma idempotente quando der (`ADD COLUMN IF NOT EXISTS`,
  `CREATE TABLE IF NOT EXISTS`) — não é obrigatório (o tracking já evita rodar duas
  vezes), mas evita dor de cabeça se alguém precisar rodar a mesma migration de novo
  manualmente por algum motivo.
- Depois que uma migration já foi commitada e aplicada em algum ambiente (local ou
  Railway), não edite o arquivo — crie uma nova migration corrigindo o que for
  preciso. Editar um arquivo já aplicado deixa o `schema_migrations` mentindo sobre
  o que o banco realmente tem.
