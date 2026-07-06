import jwt from 'jsonwebtoken'

// Portão que fica na frente de toda rota protegida (ver app.js). Não guarda
// nada em memória — só confere a assinatura do token com JWT_SECRET; se
// bater, confia no payload (id/username/role) e anexa em req.user.
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Não autenticado' })
  }

  const token = authHeader.slice('Bearer '.length)

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada' })
  }
}
