import dotenv from 'dotenv'
import pg from 'pg'

// ES module imports fully evaluate before this file's own top-level code
// runs, so this can't rely on server.js's dotenv.config() call happening
// first — it has to load its own env vars here.
dotenv.config()

const { Pool, types } = pg

// OID 1082 = coluna DATE do Postgres. Por padrão o node-pg devolve isso como
// um objeto Date do JS à meia-noite no fuso da sessão — ao virar JSON, isso
// pode sair como "2026-08-01T03:00:00.000Z" (deslocado pro UTC), o que quebra
// um <input type="date"> (que exige exatamente "YYYY-MM-DD"). Manter como
// string crua evita esse deslocamento de fuso horário na origem.
types.setTypeParser(1082, (value) => value)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})
