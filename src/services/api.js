const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

async function request(path, options = {}) {
  let response

  // FormData (upload de arquivo) não pode virar JSON, e não pode ter
  // Content-Type forçado manualmente — o navegador precisa definir sozinho
  // o boundary do multipart/form-data.
  const isFormData = options.body instanceof FormData

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: isFormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
      body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.')
  }

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(data?.error || `Erro ${response.status} ao comunicar com o servidor`)
  }

  return data
}

export const ordersApi = {
  list: () => request('/orders'),
  get: (id) => request(`/orders/${id}`),
  create: (info) => request('/orders', { method: 'POST', body: info }),
  update: (id, info) => request(`/orders/${id}`, { method: 'PATCH', body: info }),
  finalize: (id) => request(`/orders/${id}/finalize`, { method: 'PATCH' }),
  advanceStage: (id) => request(`/orders/${id}/advance-stage`, { method: 'PATCH' }),
}

export const productsApi = {
  create: (orderId, product) =>
    request(`/orders/${orderId}/products`, { method: 'POST', body: product }),
  update: (id, fields) => request(`/products/${id}`, { method: 'PATCH', body: fields }),
  remove: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  setWorkflow: (id, operations) =>
    request(`/products/${id}/workflow`, { method: 'PUT', body: { operations } }),
  // Nome da etapa vai na URL, então precisa ser codificado — nomes como
  // "Revisão/Finalização" têm uma barra, que senão seria lida como
  // separador de path (mesmo motivo do backend deletar operações por id).
  moveStep: (id, step, direction) =>
    request(`/products/${id}/workflow/${encodeURIComponent(step)}`, {
      method: 'PATCH',
      body: { direction },
    }),
}

export const commentsApi = {
  create: (productId, comment) =>
    request(`/products/${productId}/comments`, { method: 'POST', body: comment }),
}

export const filesApi = {
  create: (productId, formData) =>
    request(`/products/${productId}/files`, { method: 'POST', body: formData }),
}

export const clientsApi = {
  list: () => request('/clients'),
  create: (client) => request('/clients', { method: 'POST', body: client }),
  findOrCreate: (client) => request('/clients/find-or-create', { method: 'POST', body: client }),
}

export const operationsApi = {
  list: () => request('/operations'),
  create: (name, position = null) => request('/operations', { method: 'POST', body: { name, position } }),
  remove: (id) => request(`/operations/${id}`, { method: 'DELETE' }),
}
