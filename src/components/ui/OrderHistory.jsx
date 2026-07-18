import { useEffect, useState } from 'react'
import { ordersApi } from '../../services/api'
import { describeEvent, groupEventsByDay } from '../../utils/events'

// Timeline do pedido (item 3.3). Busca com useState/useEffect local, sem
// context compartilhado — mesma decisão já tomada em Reports: nenhuma outra
// tela consome esses dados, e os Providers existem justamente porque várias
// telas precisam da MESMA lista.
//
// `refreshToken`: qualquer valor que mude quando algo acontecer no pedido
// (OrderDetails passa o próprio objeto do pedido). Como toda mutação
// substitui o pedido no cache do OrdersProvider, isso rebusca o histórico
// depois de cada ação, sem precisar de um botão "Atualizar".
function OrderHistory({ orderId, refreshToken }) {
  const [events, setEvents] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  // Cadeia .then() escrita dentro do próprio efeito, e não uma função
  // async chamada dele: a regra react-hooks/set-state-in-effect proíbe
  // chamar no corpo do efeito qualquer função que contenha setState, mas
  // aceita setState dentro do callback de uma promise — mesmo formato já
  // usado em Reports.
  //
  // isLoading só é desligado (nunca religado): numa rebusca disparada pelo
  // refreshToken, a lista antiga continua na tela até a nova chegar, em vez
  // de piscar "Carregando" a cada ação feita no pedido.
  useEffect(() => {
    ordersApi
      .events(orderId)
      .then((data) => {
        setEvents(data)
        setError(null)
      })
      // Sem alert() aqui, ao contrário dos mutators: o histórico é
      // informação secundária da tela, e um alerta modal por causa dele
      // atrapalharia quem só quer trabalhar no pedido.
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [orderId, refreshToken])

  if (isLoading) return <p>Carregando histórico...</p>
  if (error) return <p className="history-error">{error}</p>
  if (events.length === 0) return <p>Nenhum evento registrado ainda.</p>

  return (
    <div className="history-timeline">
      {groupEventsByDay(events).map((group) => (
        <div className="history-day" key={group.day}>
          <h3>{group.day}</h3>

          {group.events.map((event) => (
            <div className="history-item" key={event.id}>
              <span className="history-time">
                {new Date(event.createdAt).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>

              <span className="history-text">{describeEvent(event)}</span>

              {event.createdBy && (
                <span className="history-author">{event.createdBy}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default OrderHistory
