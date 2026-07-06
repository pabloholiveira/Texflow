// Script de uso manual — não é uma rota da API de propósito. Criar conta
// nunca deve ser algo público em produção; rodar isto localmente (apontando
// pro banco certo via DATABASE_URL) é o jeito combinado de dar alta ao
// primeiro (e, por enquanto, único) usuário admin.
//
// Uso: node src/scripts/createUser.js <username> <senha>
import bcrypt from 'bcrypt'
import { pool } from '../db/pool.js'

const [username, password] = process.argv.slice(2)

if (!username || !password) {
  console.error('Uso: node src/scripts/createUser.js <username> <senha>')
  process.exit(1)
}

const passwordHash = await bcrypt.hash(password, 10)

try {
  const { rows } = await pool.query(
    `INSERT INTO users (username, password_hash) VALUES ($1, $2)
     RETURNING id, username, role, created_at`,
    [username, passwordHash]
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
