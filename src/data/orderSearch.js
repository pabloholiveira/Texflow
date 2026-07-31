import { getClientDisplayName } from './clients'

/* Busca de pedidos, usada por /pedidos e /entregues.

   Mora aqui, e não dentro de cada tela, porque são duas listas do mesmo
   tipo: copiar a regra seria repetir a duplicação que já desalinhou o
   conceito de "pedido ativo" em cinco lugares (ver orderStages.js).

   Campos que entram, na ordem em que uma vendedora costuma lembrar:

   - número do pedido — casa por pedaço, então "0007" acha "PED-2026-0007";
   - nome e empresa do cliente;
   - CPF/CNPJ, que identifica o cliente sem ambiguidade (mesmo critério da
     busca da tela de Clientes e do ClientAutocomplete);
   - tipo e modelo dos produtos, porque é assim que o pedido é lembrado na
     prática ("o pedido dos bonés").

   O último é o único que acha o pedido "por dentro" — buscar "polo" traz
   todo pedido que tenha uma polo. É intencional: a lista mostra o cliente
   ao lado, então dá para entender de onde veio o resultado.

   Sem filtro no servidor: os pedidos já estão todos em memória (a
   limitação de paginação registrada no CLAUDE.md), então filtrar aqui é
   instantâneo e não pede rota nova. */
function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    // Tira acento e pontuação para que "jose" ache "José" e "12345678900"
    // ache "123.456.789-00" — quem digita não repete a máscara.
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas de acento soltas pelo NFD
    .replace(/[.\-/()\s]/g, '')
}

export function matchesOrderSearch(order, query, clients) {
  const term = normalize(query)
  if (!term) return true

  const client = clients.find((item) => item.id === order.clientId)

  const fields = [
    order.orderNumber,
    client && getClientDisplayName(client),
    client?.personName,
    client?.companyName,
    client?.document,
    ...order.products.flatMap((product) => [product.type, product.model]),
  ]

  return fields.some((field) => field && normalize(field).includes(term))
}
