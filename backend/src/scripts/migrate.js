// Item 2.1 do roadmap "Fechamentos rápidos" (CLAUDE.md). Uso: npm run migrate
// (ou node src/scripts/migrate.js). Roda schema.sql (idempotente, sempre
// primeiro) e depois qualquer arquivo novo em db/migrations/, em ordem, cada
// um dentro da própria transação — registra o nome em `schema_migrations`
// pra nunca rodar o mesmo arquivo duas vezes.
import { readFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbDir = join(__dirname, '../db')
const migrationsDir = join(dbDir, 'migrations')

async function ensureTrackingTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMP NOT NULL DEFAULT now()
    )
  `)
}

async function alreadyApplied(filename) {
  const { rows } = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [
    filename,
  ])
  return rows.length > 0
}

async function apply(filename, filePath) {
  const sql = readFileSync(filePath, 'utf-8')

  await withTransaction(async (client) => {
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename])
  })

  console.log(`✓ ${filename}`)
}

async function run() {
  await ensureTrackingTable()

  // schema.sql sempre primeiro, sempre — é a base idempotente de tudo.
  if (!(await alreadyApplied('0000_schema.sql'))) {
    await apply('0000_schema.sql', join(dbDir, 'schema.sql'))
  }

  const migrationFiles = readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const filename of migrationFiles) {
    if (await alreadyApplied(filename)) continue
    await apply(filename, join(migrationsDir, filename))
  }

  console.log('Migrations em dia.')
}

run()
  .catch((err) => {
    console.error('Erro ao rodar migrations:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
