import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthProvider'
import { OrdersProvider } from './context/OrdersProvider'
import { ClientsProvider } from './context/ClientsProvider'
import { OperationsProvider } from './context/OperationsProvider'
import { SettingsProvider } from './context/SettingsProvider'
import ProtectedRoute from './components/layout/ProtectedRoute'

import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetails from './pages/OrderDetails'
import Quotes from './pages/Quotes'
import QuoteForm from './pages/QuoteForm'
import QuoteDetails from './pages/QuoteDetails'
import Clients from './pages/Clients'
import Production from './pages/Production'
import Conference from './pages/Conference'
import Delivered from './pages/Delivered'
import Design from './pages/Design'
import Reports from './pages/Reports'
import Finance from './pages/Finance'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NewOrder from './pages/NewOrder'
import PrintSheet from './pages/PrintSheet'
import ProductView from './pages/ProductView'

function App() {
  return (
    <AuthProvider>
      <ClientsProvider>
        <OperationsProvider>
          <SettingsProvider>
            <OrdersProvider>
              <BrowserRouter>
                <Routes>
                  <Route path="/login" element={<Login />} />

                  <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

                  <Route path="/pedidos" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                  <Route path="/pedidos/novo" element={<ProtectedRoute action="orders.write"><NewOrder /></ProtectedRoute>} />
                  <Route path="/pedidos/:id" element={<ProtectedRoute><OrderDetails /></ProtectedRoute>} />
                  {/* Fichas de produção (item 4): fora do <Layout>, é o
                      próprio PrintSheet que se desenha para papel. Sem
                      `action`: quem enxerga a peça pode imprimi-la. */}
                  <Route path="/pedidos/:id/fichas" element={<ProtectedRoute><PrintSheet /></ProtectedRoute>} />
                  <Route path="/pedidos/:id/produtos/:productId/ficha" element={<ProtectedRoute><PrintSheet /></ProtectedRoute>} />

                  {/* Destino do QR impresso na ficha. Sem `action` pela mesma
                      razão de /pedidos: é leitura, e quem está na máquina com
                      a peça na mão é justamente quem precisa abrir. */}
                  <Route path="/produtos/:productId" element={<ProtectedRoute><ProductView /></ProtectedRoute>} />

                  {/* "novo" antes de ":id" pela mesma razão de /pedidos/novo:
                      declarado depois, o path dinâmico engoliria a palavra e
                      tentaria carregar um orçamento de id "novo". Toda a tela
                      é `quotes.manage` — orçamento tem preço e não segue a
                      "leitura ampla" das telas de chão de fábrica. */}
                  <Route path="/orcamentos" element={<ProtectedRoute action="quotes.manage"><Quotes /></ProtectedRoute>} />
                  <Route path="/orcamentos/novo" element={<ProtectedRoute action="quotes.manage"><QuoteForm /></ProtectedRoute>} />
                  <Route path="/orcamentos/:id" element={<ProtectedRoute action="quotes.manage"><QuoteDetails /></ProtectedRoute>} />
                  <Route path="/orcamentos/:id/editar" element={<ProtectedRoute action="quotes.manage"><QuoteForm /></ProtectedRoute>} />

                  <Route path="/clientes" element={<ProtectedRoute action="clients.manage"><Clients /></ProtectedRoute>} />
                  {/* /design e /producao ficam abertas a todo mundo de propósito:
                      a matriz é "leitura ampla, escrita por setor" — quem não é do
                      setor vê o andamento, mas os botões de mover não aparecem. */}
                  <Route path="/design" element={<ProtectedRoute><Design /></ProtectedRoute>} />
                  <Route path="/producao" element={<ProtectedRoute><Production /></ProtectedRoute>} />
                  <Route path="/conferencia" element={<ProtectedRoute><Conference /></ProtectedRoute>} />
                  {/* Histórico de leitura, sem nenhum botão que altere algo —
                      por isso segue a mesma regra de /pedidos e não tem action. */}
                  <Route path="/entregues" element={<ProtectedRoute><Delivered /></ProtectedRoute>} />
                  <Route path="/relatorios" element={<ProtectedRoute action="reports.view"><Reports /></ProtectedRoute>} />
                  <Route path="/financeiro" element={<ProtectedRoute action="finance.view"><Finance /></ProtectedRoute>} />
                  <Route path="/configuracoes" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                </Routes>
              </BrowserRouter>
            </OrdersProvider>
          </SettingsProvider>
        </OperationsProvider>
      </ClientsProvider>
    </AuthProvider>
  )
}

export default App