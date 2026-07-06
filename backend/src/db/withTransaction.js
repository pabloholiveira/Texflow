import { pool } from './pool.js'

// Agrupa várias queries num BEGIN/COMMIT só, usando a MESMA conexão (client)
// do início ao fim — necessário sempre que uma operação só faz sentido
// "tudo ou nada" (ex: criar um produto e já inserir suas etapas de workflow).
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
