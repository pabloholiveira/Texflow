import { Router } from 'express'
import { pool } from '../db/pool.js'
import { withTransaction } from '../db/withTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  fetchQuotes,
  normalizeQuoteItems,
  recalculateQuoteTotal,
  replaceQuoteItems,
} from '../db/quotesQueries.js'
import {
  getAutoAddOperationNames,
  recalculateOrderTotal,
  saveProductSizes,
} from '../db/ordersQueries.js'
import { logEvent } from '../db/eventsQueries.js'
import { requireRole } from '../middleware/requireRole.js'
import { SALES_ROLES } from '../auth/permissions.js'

/* Orçamentos (2026-08-26).

   TODAS as rotas daqui são SALES_ROLES, inclusive as de leitura — e essa é
   uma exceção deliberada à matriz "leitura ampla, escrita por setor" do
   resto do sistema: um orçamento é documento comercial com preços, e a
   produção não tem o que fazer com ele (decisão do Pablo).

   Fechar o GET só é possível porque NÃO existe um QuotesProvider buscando na
   montagem para todo mundo. Foi o motivo de GET /clients e GET /operations
   terem ficado abertos: os Providers deles buscam no login, e um 403 ali
   estouraria na cara de quem é da produção. Aqui as telas de orçamento
   buscam sozinhas (mesmo padrão de Relatórios e Financeiro), então ninguém
   bate nestas rotas sem ter aberto a tela. */
const router = Router()

router.get(
  '/',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    res.json(await fetchQuotes())
  })
)

router.get(
  '/:id',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const [quote] = await fetchQuotes('WHERE id = $1', [req.params.id])
    if (!quote) return res.status(404).json({ error: 'Orçamento não encontrado' })
    res.json(quote)
  })
)

/* Cria o orçamento COM os itens numa chamada só — diferente de um pedido,
   que nasce vazio e vai recebendo produtos.

   A razão é concreta: `orders` precisa existir cedo porque um produto só
   pode receber arquivo depois de ter id real, e daí veio o `is_draft` (e os
   32 rascunhos abandonados que se acumularam em produção). Um item de
   orçamento não anexa nada, então a tela monta a proposta inteira em memória
   e grava de uma vez. Sem rascunho, sem lixo acumulando. */
router.post(
  '/',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { clientId = null, validUntil = null, observations = null, items = [] } = req.body

    let normalizedItems
    try {
      normalizedItems = normalizeQuoteItems(items)
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const quoteId = await withTransaction(async (client) => {
      // Mesmo truque do order_number: o número precisa ser único desde o
      // INSERT, mas só dá para montá-lo depois de saber o id gerado.
      const inserted = await client.query(
        `INSERT INTO quotes (quote_number, client_id, valid_until, observations)
         VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        ['pendente', clientId || null, validUntil || null, observations]
      )
      const { id, created_at } = inserted.rows[0]

      await client.query('UPDATE quotes SET quote_number = $1 WHERE id = $2', [
        `ORC-${created_at.getFullYear()}-${String(id).padStart(4, '0')}`,
        id,
      ])

      await replaceQuoteItems(client, id, normalizedItems)
      await recalculateQuoteTotal(client, id)
      return id
    })

    const [quote] = await fetchQuotes('WHERE id = $1', [quoteId])
    res.status(201).json(quote)
  })
)

/* Editar substitui o orçamento inteiro (dados + conjunto de itens), em vez
   de PATCH de campo e CRUD de item separados. Ver replaceQuoteItems. */
router.put(
  '/:id',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { clientId = null, validUntil = null, observations = null, items = [] } = req.body

    let normalizedItems
    try {
      normalizedItems = normalizeQuoteItems(items)
    } catch (err) {
      return res.status(400).json({ error: err.message })
    }

    const result = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT converted_at FROM quotes WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (current.rows.length === 0) return { error: 404 }

      /* Orçamento já convertido não se edita, e é exatamente o ponto da
         decisão de copiar em vez de promover: editar depois reescreveria a
         proposta que o cliente aprovou. O que mudou de ideia vira edição do
         PEDIDO, que é onde o combinado agora vive. */
      if (current.rows[0].converted_at) {
        return {
          error: 409,
          message: 'Orçamento já convertido em pedido. Edite o pedido, não a proposta.',
        }
      }

      await client.query(
        `UPDATE quotes SET client_id = $1, valid_until = $2, observations = $3, updated_at = now()
          WHERE id = $4`,
        [clientId || null, validUntil || null, observations, req.params.id]
      )

      await replaceQuoteItems(client, req.params.id, normalizedItems)
      await recalculateQuoteTotal(client, req.params.id)
      return { ok: true }
    })

    if (result.error === 404) return res.status(404).json({ error: 'Orçamento não encontrado' })
    if (result.error) return res.status(result.error).json({ error: result.message })

    const [quote] = await fetchQuotes('WHERE id = $1', [req.params.id])
    res.json(quote)
  })
)

/* Recusar e reabrir são rotas distintas, não um toggle — mesma razão já
   registrada em cancelar/reabrir pedido: um endpoint que inverte esconde
   qual das duas coisas quem chamou queria, e um clique repetido faz o
   oposto do esperado.

   Recusar NÃO exclui nada: o orçamento continua consultável, e saber que o
   cliente disse não (e quando) é informação, não lixo. */
router.patch(
  '/:id/reject',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT rejected_at, converted_at FROM quotes WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (current.rows.length === 0) return { error: 404 }
      if (current.rows[0].converted_at) {
        return { error: 409, message: 'Orçamento já foi convertido em pedido.' }
      }
      if (current.rows[0].rejected_at) {
        return { error: 409, message: 'Orçamento já está recusado.' }
      }

      await client.query('UPDATE quotes SET rejected_at = now(), updated_at = now() WHERE id = $1', [
        req.params.id,
      ])
      return { ok: true }
    })

    if (result.error === 404) return res.status(404).json({ error: 'Orçamento não encontrado' })
    if (result.error) return res.status(result.error).json({ error: result.message })

    const [quote] = await fetchQuotes('WHERE id = $1', [req.params.id])
    res.json(quote)
  })
)

router.patch(
  '/:id/reopen',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const result = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT rejected_at FROM quotes WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (current.rows.length === 0) return { error: 404 }
      if (!current.rows[0].rejected_at) {
        return { error: 409, message: 'Orçamento não está recusado.' }
      }

      await client.query('UPDATE quotes SET rejected_at = NULL, updated_at = now() WHERE id = $1', [
        req.params.id,
      ])
      return { ok: true }
    })

    if (result.error === 404) return res.status(404).json({ error: 'Orçamento não encontrado' })
    if (result.error) return res.status(result.error).json({ error: result.message })

    const [quote] = await fetchQuotes('WHERE id = $1', [req.params.id])
    res.json(quote)
  })
)

/* Converter: COPIA a proposta para um pedido novo e carimba o orçamento.
   O orçamento continua existindo, agora como documento histórico ligado ao
   pedido (decisão 3 do Pablo).

   O pedido nasce com is_draft = false: converter é um ato deliberado, e um
   pedido invisível na lista logo depois de "Converter em pedido" seria
   incompreensível. É o mesmo motivo do rascunho existir para NewOrder e não
   fazer sentido aqui.

   O PRAZO DE ENTREGA é perguntado na conversão e não copiado do
   `valid_until`: validade da proposta e prazo de entrega são datas de
   naturezas diferentes ("este preço vale até" ≠ "fica pronto em"). */
router.post(
  '/:id/convert',
  requireRole(...SALES_ROLES),
  asyncHandler(async (req, res) => {
    const { deadline = null } = req.body

    const result = await withTransaction(async (client) => {
      const current = await client.query(
        'SELECT * FROM quotes WHERE id = $1 FOR UPDATE',
        [req.params.id]
      )
      if (current.rows.length === 0) return { error: 404 }

      const quote = current.rows[0]

      if (quote.converted_at) {
        return { error: 409, message: 'Orçamento já foi convertido em pedido.' }
      }
      if (quote.rejected_at) {
        return {
          error: 409,
          message: 'Orçamento recusado. Reabra o orçamento antes de convertê-lo.',
        }
      }
      if (!quote.client_id) {
        return { error: 400, message: 'Informe o cliente no orçamento antes de convertê-lo.' }
      }

      const itemsResult = await client.query(
        'SELECT * FROM quote_items WHERE quote_id = $1 ORDER BY position, id',
        [req.params.id]
      )
      if (itemsResult.rows.length === 0) {
        return { error: 400, message: 'Orçamento sem itens não vira pedido.' }
      }

      const inserted = await client.query(
        `INSERT INTO orders (order_number, client_id, deadline, is_draft)
         VALUES ($1, $2, $3, false) RETURNING id, created_at`,
        ['pendente', quote.client_id, deadline || null]
      )
      const { id: orderId, created_at } = inserted.rows[0]
      const orderNumber = `PED-${created_at.getFullYear()}-${String(orderId).padStart(4, '0')}`
      await client.query('UPDATE orders SET order_number = $1 WHERE id = $2', [orderNumber, orderId])

      // O vínculo aparece no histórico do pedido: quem abrir a timeline vê de
      // onde ele veio, sem precisar saber que existe uma tabela de orçamentos.
      await logEvent(client, {
        orderId,
        type: 'order_created',
        payload: { orderNumber, fromQuote: quote.quote_number },
        user: req.user.username,
      })

      // As etapas automáticas (Revisão/Finalização e Embalagem) entram aqui
      // igual entrariam num produto criado pela tela — um pedido convertido
      // não pode nascer sem conferência.
      //
      // As DEMAIS operações ficam de fora de propósito: o orçamento não as
      // guarda. Ele é sobre preço, e quais operações a peça precisa é
      // escolha que a vendedora faz no pedido, com o "Editar Etapas" que já
      // existe. Guardá-las no orçamento exigiria uma quarta tabela e
      // manteria duas listas de operações em sincronia sem ninguém pedir.
      const autoAdd = await getAutoAddOperationNames(client)

      for (const item of itemsResult.rows) {
        const product = await client.query(
          `INSERT INTO products
             (order_id, type, model, color, fabric, quantity, observations,
              print_observations, unit_price, needs_vectorization, vectorization_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [
            orderId,
            item.type,
            item.model,
            item.color,
            item.fabric,
            item.quantity,
            item.observations,
            item.print_observations,
            item.unit_price,
            item.needs_vectorization,
            item.vectorization_price,
          ]
        )
        const productId = product.rows[0].id

        // design_status fica NULL: o pedido nasce em 'venda', e é sair da
        // Venda que põe todo produto na fila de design (gatilho 1 em
        // advance-stage). Mesma regra do produto criado pela tela.
        for (const step of autoAdd) {
          await client.query(
            'INSERT INTO product_workflow_steps (product_id, step_name, status) VALUES ($1, $2, $3)',
            [productId, step, 'pending']
          )
        }

        const sizes = await client.query(
          `SELECT size, quantity FROM quote_item_sizes WHERE quote_item_id = $1`,
          [item.id]
        )
        if (sizes.rows.length > 0) {
          await saveProductSizes(client, productId, sizes.rows)
        }

        await logEvent(client, {
          orderId,
          productId,
          type: 'product_created',
          payload: {
            type: item.type,
            model: item.model,
            quantity: item.quantity,
            sizes: sizes.rows,
            operations: autoAdd,
            fromQuote: quote.quote_number,
          },
          user: req.user.username,
        })
      }

      // Recalcula em vez de copiar quotes.total_value: a fórmula é a mesma,
      // mas o total do pedido tem que sair dos produtos DELE — copiar criaria
      // um número que ninguém consegue reconferir se algo divergir.
      await recalculateOrderTotal(client, orderId)

      await client.query(
        `UPDATE quotes SET converted_at = now(), converted_order_id = $1, updated_at = now()
          WHERE id = $2`,
        [orderId, req.params.id]
      )

      return { orderId }
    })

    if (result.error === 404) return res.status(404).json({ error: 'Orçamento não encontrado' })
    if (result.error) return res.status(result.error).json({ error: result.message })

    const [quote] = await fetchQuotes('WHERE id = $1', [req.params.id])
    // Devolve os dois: a tela precisa do id do pedido para navegar até ele, e
    // do orçamento atualizado para não ficar mostrando "aberto" no caminho.
    // Id cru, como no resto da API: o node-pg devolve bigint como string, e
    // converter para Number aqui já quebrou uma comparação estrita antes
    // (a tabela por cliente do Financeiro, 2026-08-04).
    res.status(201).json({ orderId: result.orderId, quote })
  })
)

export default router
