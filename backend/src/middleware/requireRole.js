// Segundo portão, depois do requireAuth: aquele responde "está logado?",
// este responde "esse papel pode fazer isso?". Sempre usado DEPOIS do
// requireAuth, então req.user já existe aqui.
//
// 403, nunca 401: um 401 fora de /auth/login é tratado pelo front
// (src/services/api.js) como sessão expirada e desloga a pessoa na hora —
// mesma armadilha já registrada no item 1.3 dos fechamentos rápidos, onde
// errar a senha atual deslogava em vez de mostrar o erro. Aqui a sessão está
// perfeitamente válida; o que falta é permissão.
export function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({
        error: 'Seu perfil não tem permissão para esta ação',
      })
    }
    next()
  }
}
