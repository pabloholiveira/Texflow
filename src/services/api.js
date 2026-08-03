const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333'

async function request(path, options = {}) {
  let response

  // FormData (upload de arquivo) não pode virar JSON, e não pode ter
  // Content-Type forçado manualmente — o navegador precisa definir sozinho
  // o boundary do multipart/form-data.
  const isFormData = options.body instanceof FormData

  const token = localStorage.getItem('texflow_token')

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: isFormData ? options.body : options.body ? JSON.stringify(options.body) : undefined,
    })
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.')
  }

  if (response.status === 204) return null

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    // Sessão expirada/inválida: limpa o login guardado e manda de volta pro
    // /login, em vez de deixar cada tela lidar com isso na mão. Não se aplica
    // ao próprio /auth/login (ali um 401 só significa "senha errada").
    if (response.status === 401 && path !== '/auth/login') {
      localStorage.removeItem('texflow_token')
      localStorage.removeItem('texflow_user')
      window.location.href = '/login'
    }

    throw new Error(data?.error || `Erro ${response.status} ao comunicar com o servidor`)
  }

  return data
}

export const authApi = {
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  // Rota pública (fora do requireAuth) — quem esqueceu a senha não consegue
  // se autenticar para pedir.
  requestPasswordReset: (username) =>
    request('/auth/password-reset-request', { method: 'POST', body: { username } }),
}

export const ordersApi = {
  list: () => request('/orders'),
  get: (id) => request(`/orders/${id}`),
  create: (info) => request('/orders', { method: 'POST', body: info }),
  update: (id, info) => request(`/orders/${id}`, { method: 'PATCH', body: info }),
  finalize: (id) => request(`/orders/${id}/finalize`, { method: 'PATCH' }),
  advanceStage: (id) => request(`/orders/${id}/advance-stage`, { method: 'PATCH' }),
  regressStage: (id) => request(`/orders/${id}/regress-stage`, { method: 'PATCH' }),
  events: (id) => request(`/orders/${id}/events`),
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
  setDesignStatus: (id, status) =>
    request(`/products/${id}/design-status`, { method: 'PATCH', body: { status } }),
  setDesignRework: (id, value) =>
    request(`/products/${id}/design-rework`, { method: 'PATCH', body: { value } }),
}

export const commentsApi = {
  create: (productId, comment) =>
    request(`/products/${productId}/comments`, { method: 'POST', body: comment }),
}

export const filesApi = {
  create: (productId, formData) =>
    request(`/products/${productId}/files`, { method: 'POST', body: formData }),
  remove: (productId, fileId) =>
    request(`/products/${productId}/files/${fileId}`, { method: 'DELETE' }),
}

export const clientsApi = {
  list: () => request('/clients'),
  create: (client) => request('/clients', { method: 'POST', body: client }),
  update: (id, fields) => request(`/clients/${id}`, { method: 'PATCH', body: fields }),
  findOrCreate: (client) => request('/clients/find-or-create', { method: 'POST', body: client }),
}

export const operationsApi = {
  list: () => request('/operations'),
  create: (name, position = null) => request('/operations', { method: 'POST', body: { name, position } }),
  remove: (id) => request(`/operations/${id}`, { method: 'DELETE' }),
}

export const reportsApi = {
  avgTimePerStep: () => request('/reports/avg-time-per-step'),
  bottlenecks: () => request('/reports/bottlenecks'),
  leadTime: () => request('/reports/lead-time'),
}

export const usersApi = {
  list: () => request('/users'),
  update: (id, fields) => request(`/users/${id}`, { method: 'PATCH', body: fields }),
  operations: (id) => request(`/users/${id}/operations`),
  setOperations: (id, operationIds) =>
    request(`/users/${id}/operations`, { method: 'PUT', body: { operationIds } }),
  changeOwnPassword: (id, currentPassword, newPassword) =>
    request(`/users/${id}/password`, { method: 'PATCH', body: { currentPassword, newPassword } }),
  resetPassword: (id, newPassword) =>
    request(`/users/${id}/password`, { method: 'PATCH', body: { newPassword } }),
  deactivate: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  passwordResetRequests: () => request('/users/password-reset-requests'),
  approvePasswordReset: (requestId) =>
    request(`/users/password-reset-requests/${requestId}/approve`, { method: 'PATCH' }),
  rejectPasswordReset: (requestId) =>
    request(`/users/password-reset-requests/${requestId}/reject`, { method: 'PATCH' }),
}

export const settingsApi = {
  getWhatsappTemplate: () => request('/settings/whatsapp-template'),
  updateWhatsappTemplate: (value) =>
    request('/settings/whatsapp-template', { method: 'PUT', body: { value } }),
  getWhatsappReadyTemplate: () => request('/settings/whatsapp-ready-template'),
  updateWhatsappReadyTemplate: (value) =>
    request('/settings/whatsapp-ready-template', { method: 'PUT', body: { value } }),
}
