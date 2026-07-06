import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ClientFields from '../../components/ui/ClientFields'
import { useClients } from '../../context/clientsContext'
import { useOrders } from '../../context/ordersContext'

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

function Clients() {
  const { clients, addClient } = useClients()
  const { orders } = useOrders()
  const finalizedOrders = orders.filter((order) => !order.isDraft)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [client, setClient] = useState(emptyClient)

  function openModal() {
    setClient(emptyClient)
    setIsModalOpen(true)
  }

  function closeModal() {
    setIsModalOpen(false)
  }

  function handleChange(event) {
    const { name, value } = event.target
    setClient({ ...client, [name]: value })
  }

  async function saveClient() {
    if (!client.personName) {
      alert('Preencha o nome do cliente.')
      return
    }

    if (!client.document) {
      alert('Preencha o CPF/CNPJ do cliente.')
      return
    }

    if (!client.phone) {
      alert('Preencha o telefone do cliente.')
      return
    }

    const alreadyExists = clients.some(
      (item) => item.document === client.document
    )

    if (alreadyExists) {
      alert('Já existe um cliente cadastrado com esse CPF/CNPJ.')
      return
    }

    const created = await addClient(client)
    if (created) closeModal()
  }

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Clientes</h1>
          <p>Cadastro e histórico de pedidos por cliente</p>
        </div>

        <Button onClick={openModal}>Adicionar Cliente</Button>
      </div>

      <section className="clients-list">
        {clients.map((item) => {
          const clientOrders = finalizedOrders.filter(
            (order) => order.clientId === item.id
          )

          return (
            <div className="client-card" key={item.id}>
              <div className="client-card-header">
                <strong>{item.companyName || item.personName}</strong>
                <span>{clientOrders.length} pedido(s)</span>
              </div>

              {item.companyName && (
                <p className="client-card-contact">{item.personName}</p>
              )}

              <div className="client-card-info">
                <div>
                  <span>CPF/CNPJ</span>
                  <strong>{item.document}</strong>
                </div>

                <div>
                  <span>Telefone</span>
                  <strong>{item.phone}</strong>
                </div>

                <div>
                  <span>Email</span>
                  <strong>{item.email || '-'}</strong>
                </div>
              </div>

              {clientOrders.length > 0 && (
                <div className="client-card-orders">
                  {clientOrders.map((order) => (
                    <Link to={`/pedidos/${order.id}`} key={order.id}>
                      {order.orderNumber}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </section>

      <Modal isOpen={isModalOpen} onClose={closeModal} title="Adicionar Cliente">
        <ClientFields client={client} onChange={handleChange} />

        <div className="modal-actions">
          <Button variant="secondary" onClick={closeModal}>
            Cancelar
          </Button>
          <Button onClick={saveClient}>Salvar</Button>
        </div>
      </Modal>
    </Layout>
  )
}

export default Clients
