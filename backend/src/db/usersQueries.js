import { pool } from './pool.js'
import { ALL_STEPS_ROLES } from '../auth/permissions.js'

// Etapas que um usuário de produção pode operar (tabela user_operations,
// migration 0005). Sempre devolve [{ id, name }] — mesma forma que
// GET /operations usa, pra tela de Configurações renderizar os checkboxes a
// partir do catálogo que ela já carrega.
export async function getUserOperations(userId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.name
       FROM user_operations uo
       JOIN operations o ON o.id = uo.operation_id
      WHERE uo.user_id = $1
      ORDER BY o.sequence_position NULLS LAST, o.name`,
    [userId]
  )
  return rows
}

// Substitui a lista inteira (apaga e reinsere) em vez de aceitar
// adiciona/remove separados: a tela manda o conjunto final de checkboxes
// marcados, então essa é a operação que o front realmente faz. Transação
// para não existir um instante em que a pessoa ficou sem nenhuma etapa.
export async function setUserOperations(client, userId, operationIds) {
  await client.query('DELETE FROM user_operations WHERE user_id = $1', [userId])

  if (operationIds.length > 0) {
    await client.query(
      `INSERT INTO user_operations (user_id, operation_id)
       SELECT $1, id FROM operations WHERE id = ANY($2::bigint[])`,
      [userId, operationIds]
    )
  }
}

// Gate de AUTORIZAÇÃO da etapa — não confundir com o gate de SEQUÊNCIA
// (findBlockingSteps): aquele responde "essa etapa já pode começar?" olhando
// o produto; este responde "essa pessoa pode mexer nessa etapa?" olhando o
// usuário. Os dois moram no mesmo PATCH /products/:id/workflow/:step porque
// esse é o único lugar do sistema que muda status de etapa.
//
// Duas isenções:
// - admin e gerente passam por tudo (ALL_STEPS_ROLES);
// - etapa fora do catálogo ("outra operação", digitada à mão na venda) é
//   livre para qualquer usuário de produção — mesmo precedente que o gate de
//   sequência já segue (etapa custom não é bloqueada e não bloqueia ninguém).
export async function canOperateStep(user, stepName) {
  if (ALL_STEPS_ROLES.includes(user.role)) return true

  const { rows } = await pool.query(
    `SELECT
       (SELECT id FROM operations WHERE name = $2) AS operation_id,
       EXISTS (
         SELECT 1
           FROM user_operations uo
           JOIN operations o ON o.id = uo.operation_id
          WHERE uo.user_id = $1 AND o.name = $2
       ) AS allowed`,
    [user.id, stepName]
  )

  if (rows[0].operation_id === null) return true
  return rows[0].allowed
}

// Versão ESTRITA do gate acima: "esta etapa do catálogo está atribuída
// nominalmente a esta pessoa?". Sem nenhuma das isenções — nem papel que
// passa por tudo, nem liberdade para etapa fora do catálogo.
//
// Existe para o caso de uma etapa de produção que a venda também opera (ex.:
// "Botão" na Kavi): quem não é da produção só entra se a etapa tiver sido
// atribuída a ela, uma a uma. É de propósito que isso seja por PESSOA e não
// por papel — se amanhã só uma das vendedoras pregar botão, o modelo já
// suporta sem mexer em código.
export async function hasStepAssigned(user, stepName) {
  const { rows } = await pool.query(
    `SELECT EXISTS (
       SELECT 1
         FROM user_operations uo
         JOIN operations o ON o.id = uo.operation_id
        WHERE uo.user_id = $1 AND o.name = $2
     ) AS assigned`,
    [user.id, stepName]
  )

  return rows[0].assigned
}
