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
import Clients from './pages/Clients'
import Production from './pages/Production'
import Conference from './pages/Conference'
import Delivered from './pages/Delivered'
import Design from './pages/Design'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NewOrder from './pages/NewOrder'

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