import { useEffect, useState } from 'react'
import { OrdersContext } from './ordersContext'
import { ordersApi, productsApi, commentsApi } from '../services/api'

// Contrato comum a todas as funções abaixo: em caso de sucesso, devolvem o
// recurso criado/atualizado; em caso de erro, mostram um alert() (mesmo
// padrão de erro já usado no resto do app) e devolvem null. Quem chama só
// precisa checar `if (!resultado) return` antes de seguir em frente (fechar
// modal, navegar, etc.) em vez de espalhar try/catch em cada tela.
export function OrdersProvider({ children }) {
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ordersApi
      .list()
      .then(setOrders)
      .catch((err) => alert(err.message))
      .finally(() => setIsLoading(false))
  }, [])

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
      const product = await productsApi.create(orderId, productDraft)
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? { ...order, products: [...order.products, product] }
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
      await productsApi.remove(productId)
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId
            ? { ...order, products: order.products.filter((item) => item.id !== productId) }
            : order
        )
      )
      return true
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

  async function toggleProductDesignRework(orderId, productId) {
    const order = orders.find((item) => item.id === orderId)
    const product = order?.products.find((item) => item.id === productId)
    if (!product) return null

    try {
      const updated = await productsApi.update(productId, {
        needsDesignRework: !product.needsDesignRework,
      })
      replaceProduct(orderId, updated)
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
        updateProductWorkflow,
        moveProductStepStatus,
        addProductComment,
        toggleProductDesignRework,
      }}
    >
      {children}
    </OrdersContext.Provider>
  )
}
