import { useEffect, useState } from 'react'
import { OrdersContext } from './ordersContext'
import { useAuth } from './authContext'
import { ordersApi, productsApi, commentsApi, filesApi } from '../services/api'

// Contrato comum a todas as funções abaixo: em caso de sucesso, devolvem o
// recurso criado/atualizado; em caso de erro, mostram um alert() (mesmo
// padrão de erro já usado no resto do app) e devolvem null. Quem chama só
// precisa checar `if (!resultado) return` antes de seguir em frente (fechar
// modal, navegar, etc.) em vez de espalhar try/catch em cada tela.
export function OrdersProvider({ children }) {
  const { isAuthenticated } = useAuth()
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Sem isso, este provider tentaria buscar /orders assim que o app carrega
  // — mesmo ainda na tela de /login, sem token — e cairia num 401 (ver
  // requireAuth no backend), disparando um alert() antes da pessoa conseguir
  // digitar usuário/senha. Refaz a busca sozinho quando isAuthenticated vira
  // true (login concluído), sem precisar de F5. Não reseta `orders` no ramo
  // "não autenticado" — chamar setState direto no corpo do efeito (fora de
  // uma promise) é o que o lint react-hooks/set-state-in-effect reclama;
  // como o ProtectedRoute já esconde a tela antes disso importar, não faz
  // diferença deixar os dados antigos ali até o próximo fetch real.
  useEffect(() => {
    if (!isAuthenticated) return

    ordersApi
      .list()
      .then(setOrders)
      .catch((err) => alert(err.message))
      .finally(() => setIsLoading(false))
  }, [isAuthenticated])

  function replaceOrder(updatedOrder) {
    setOrders((current) =>
      current.map((order) => (order.id === updatedOrder.id ? updatedOrder : order))
    )
  }

  function replaceProduct(orderId, updatedProduct) {
    setOrders((current) =>
      current.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              products: order.products.map((product) =>
                product.id === updatedProduct.id ? updatedProduct : product
              ),
            }
      )
    )
  }

  // Igual replaceProduct, mas também atualiza order.totalValue — usado
  // sempre que a rota de produto pode ter mexido em unit_price/quantity
  // (ver recalculateOrderTotal no backend, Funcionalidades comerciais no
  // CLAUDE.md). O `orderTotalValue` vem junto na resposta da API, um campo
  // a mais no objeto do produto — por isso o destructure separa os dois
  // antes de guardar o produto de volta em order.products.
  function replaceProductAndTotal(orderId, updatedProduct, totalValue) {
    setOrders((current) =>
      current.map((order) =>
        order.id !== orderId
          ? order
          : {
              ...order,
              products: order.products.map((product) =>
                product.id === updatedProduct.id ? updatedProduct : product
              ),
              totalValue,
            }
      )
    )
  }

  async function createOrder() {
    try {
      const order = await ordersApi.create({})
      setOrders((current) => [...current, order])
      return order.id
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function finalizeOrder(orderId) {
    try {
      const order = await ordersApi.finalize(orderId)
      replaceOrder(order)
      return order
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function updateOrderInfo(orderId, info) {
    try {
      const order = await ordersApi.update(orderId, info)
      replaceOrder(order)
      return order
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function advanceOrderStage(orderId) {
    try {
      const order = await ordersApi.advanceStage(orderId)
      replaceOrder(order)
      return order
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function addProduct(orderId, productDraft) {
    try {
      const { orderTotalValue, ...product } = await productsApi.create(orderId, productDraft)
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? { ...order, products: [...order.products, product], totalValue: orderTotalValue }
            : order
        )
      )
      return product
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function removeProduct(orderId, productId) {
    try {
      const { totalValue } = await productsApi.remove(productId)
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? {
                ...order,
                products: order.products.filter((item) => item.id !== productId),
                totalValue,
              }
            : order
        )
      )
      return true
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  // Único jeito de editar tipo/modelo/cor/tecido/quantidade/valor de um
  // produto já criado — reaproveita o mesmo PATCH /products/:id que
  // toggleProductDesignRework já usa, só com outros campos.
  async function updateProductInfo(orderId, productId, fields) {
    try {
      const { orderTotalValue, ...updated } = await productsApi.update(productId, fields)
      replaceProductAndTotal(orderId, updated, orderTotalValue)
      return updated
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  // `operations` é a lista de nomes escolhidos (string[]) — quem calcula o
  // status de cada etapa (preservando o que já existia) é o backend, ver
  // PUT /products/:id/workflow na Etapa 3.
  async function updateProductWorkflow(orderId, productId, operations) {
    try {
      const product = await productsApi.setWorkflow(productId, operations)
      replaceProduct(orderId, product)
      return product
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function moveProductStepStatus(orderId, productId, step, direction) {
    try {
      const product = await productsApi.moveStep(productId, step, direction)
      replaceProduct(orderId, product)
      return product
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function addProductComment(orderId, productId, comment) {
    try {
      const created = await commentsApi.create(productId, comment)
      setOrders((current) =>
        current.map((order) =>
          order.id !== orderId
            ? order
            : {
                ...order,
                products: order.products.map((product) =>
                  product.id === productId
                    ? { ...product, comments: [...product.comments, created] }
                    : product
                ),
              }
        )
      )
      return created
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function addProductFile(orderId, productId, formData) {
    try {
      const created = await filesApi.create(productId, formData)
      setOrders((current) =>
        current.map((order) =>
          order.id !== orderId
            ? order
            : {
                ...order,
                products: order.products.map((product) =>
                  product.id === productId
                    ? { ...product, files: [...product.files, created] }
                    : product
                ),
              }
        )
      )
      return created
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  async function toggleProductDesignRework(orderId, productId) {
    const order = orders.find((item) => item.id === orderId)
    const product = order?.products.find((item) => item.id === productId)
    if (!product) return null

    try {
      const { orderTotalValue, ...updated } = await productsApi.update(productId, {
        needsDesignRework: !product.needsDesignRework,
      })
      replaceProductAndTotal(orderId, updated, orderTotalValue)
      return updated
    } catch (err) {
      alert(err.message)
      return null
    }
  }

  return (
    <OrdersContext.Provider
      value={{
        orders,
        isLoading,
        createOrder,
        finalizeOrder,
        updateOrderInfo,
        advanceOrderStage,
        addProduct,
        removeProduct,
        updateProductInfo,
        updateProductWorkflow,
        moveProductStepStatus,
        addProductComment,
        addProductFile,
        toggleProductDesignRework,
      }}
    >
      {children}
    </OrdersContext.Provider>
  )
}
