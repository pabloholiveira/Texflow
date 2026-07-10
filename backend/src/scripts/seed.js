// Item 2.1 do roadmap "Fechamentos rápidos" (CLAUDE.md). Uso: npm run seed
// (depois de npm run migrate). Cria um cliente + pedido + produto de
// demonstração num banco novo, pra não começar o dev local com tudo vazio.
// Idempotente por checagem manual (documento fixo, reconhecível) — rodar de
// novo não duplica o cliente/pedido demo, só avisa que já existe.
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'

const DEMO_CLIENT_DOCUMENT = '00000000000'

// Mesmo catálogo/posições documentados no domain model do CLAUDE.md — sem
// isso, um banco novo começa com a tabela `operations` vazia (o schema não
// insere nada sozinho) e a tela de Novo Pedido não tem nenhuma etapa pra
// escolher até alguém cadastrar uma na mão em Configurações.
const DEFAULT_OPERATIONS = [
  { name: 'Corte', position: 1 },
  { name: 'Bordado', position: 2 },
  { name: 'Silk', position: 2 },
  { name: 'DTF', position: 2 },
  { name: 'Costura', position: 2 },
  { name: 'Revisão/Finalização', position: 3 },
  { name: 'Lavagem', position: 4 },
  { name: 'Embalagem', position: 5 },
]

async function seedOperations() {
  for (const operation of DEFAULT_OPERATIONS) {
    await pool.query(
      'INSERT INTO operations (name, sequence_position) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [operation.name, operation.position]
    )
  }
}

async function run() {
  await seedOperations()

  const existing = await pool.query('SELECT id FROM clients WHERE document = $1', [
    DEMO_CLIENT_DOCUMENT,
  ])

  if (existing.rows.length > 0) {
    console.log('Operações padrão conferidas. Cliente demo já existe (document = 00000000000) — nada a fazer.')
    return
  }

  await withTransaction(async (client) => {
    const { rows: clientRows } = await client.query(
      `INSERT INTO clients (person_name, company_name, document, phone, email)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Cliente Demo', 'Empresa Demo Ltda', DEMO_CLIENT_DOCUMENT, '11999999999', 'demo@example.com']
    )
    const clientId = clientRows[0].id

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, client_id, deadline, stage, is_draft, total_value)
       VALUES ('PED-DEMO-0001', $1, CURRENT_DATE + INTERVAL '14 days', 'producao', false, 0)
       RETURNING id`,
      [clientId]
    )
    const orderId = orderRows[0].id

    const { rows: productRows } = await client.query(
      `INSERT INTO products (order_id, type, model, color, quantity, observations, unit_price)
       VALUES ($1, 'Camiseta', 'Camiseta Tradicional', 'Branca', 20, 'Pedido de demonstração', 35.00)
       RETURNING id`,
      [orderId]
    )
    const productId = productRows[0].id

    await client.query(
      `UPDATE orders SET total_value = 20 * 35.00 WHERE id = $1`,
      [orderId]
    )

    await client.query(
      `INSERT INTO product_workflow_steps (product_id, step_name, status) VALUES
       ($1, 'Corte', 'done'),
       ($1, 'Costura', 'in_progress'),
       ($1, 'Revisão/Finalização', 'pending')`,
      [productId]
    )
  })

  console.log('Cliente + pedido + produto demo criados com sucesso.')
}

run()
  .catch((err) => {
    console.error('Erro ao rodar seed:', err.message)
    process.exitCode = 1
  })
  .finally(() => pool.end())
