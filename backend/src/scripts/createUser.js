// Script de uso manual — não é uma rota da API de propósito. Criar conta
// nunca deve ser algo público em produção; rodar isto localmente (apontando
// pro banco certo via DATABASE_URL) é o jeito combinado de dar alta ao
// primeiro usuário admin.
//
// Uso: node src/scripts/createUser.js <username> <senha> [papel]
// O papel é opcional e cai em 'admin' se omitido — assim o comando de sempre
// continua funcionando igual. Trocar o papel depois, ou atribuir as etapas
// que um usuário de produção opera, é pela tela de Configurações.
import bcrypt from 'bcrypt'
import { pool } from '../db/pool.js'
import { ROLES } from '../auth/permissions.js'

const [username, password, role = 'admin'] = process.argv.slice(2)

if (!username || !password) {
  console.error('Uso: node src/scripts/createUser.js <username> <senha> [papel]')
  console.error(`Papéis: ${ROLES.join(', ')}`)
  process.exit(1)
}

if (!ROLES.includes(role)) {
  console.error(`Papel inválido: "${role}". Use um de: ${ROLES.join(', ')}`)
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 10)

try {
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)
     RETURNING id, username, role, created_at`,
    [username, passwordHash, role]
  )
  console.log('Usuário criado:', rows[0])
} catch (err) {
  if (err.code === '23505') {
    console.error(`Já existe um usuário com o username "${username}".`)
  } else {
    throw err
  }
} finally {
  await pool.end()
}
