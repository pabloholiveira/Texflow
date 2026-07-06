import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './App.css'
import { OrdersProvider } from './context/OrdersProvider'
import { ClientsProvider } from './context/ClientsProvider'
import { OperationsProvider } from './context/OperationsProvider'

import Dashboard from './pages/Dashboard'
import Orders from './pages/Orders'
import OrderDetails from './pages/OrderDetails'
import Clients from './pages/Clients'
import Production from './pages/Production'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Login from './pages/Login'
import NewOrder from './pages/NewOrder'

function App() {
  return (
    <ClientsProvider>
      <OperationsProvider>
        <OrdersProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/login" element={<Login />} />

              <Route path="/pedidos" element={<Orders />} />
              <Route path="/pedidos/novo" element={<NewOrder />} />
              <Route path="/pedidos/:id" element={<OrderDetails />} />

              <Route path="/clientes" element={<Clients />} />
              <Route path="/producao" element={<Production />} />
              <Route path="/relatorios" element={<Reports />} />
              <Route path="/configuracoes" element={<Settings />} />
            </Routes>
          </BrowserRouter>
        </OrdersProvider>
      </OperationsProvider>
    </ClientsProvider>
  )
}

export default App