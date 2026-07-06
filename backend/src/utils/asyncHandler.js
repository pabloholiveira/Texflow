// Express 4 não captura sozinho uma rejeição de Promise dentro de um
// handler async — sem isso, um erro numa rota `async` trava a resposta em
// vez de cair no middleware de erro (definido em app.js).
export function asyncHandler(fn) {
  return (req, res, next) => {
    fn(req, res, next).catch(next)
  }
}
