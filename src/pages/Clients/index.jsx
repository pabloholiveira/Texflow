import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import ClientFields from '../../components/ui/ClientFields'
import { useClients } from '../../context/clientsContext'
import { useOrders } from '../../context/ordersContext'
import { getClientDisplayName } from '../../data/clients'
import { getStageLabel } from '../../data/orderStages'

const emptyClient = {
  personName: '',
  companyName: '',
  document: '',
  phone: '',
  email: '',
}

function formatOrderDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('pt-BR')
}

function summarizeProducts(products) {
  if (products.length === 0) return 'Nenhum produto'
  return products.map((product) => `${product.type} (${product.quantity})`).join(', ')
}

function Clients() {
  const { clients, addClient, updateClient } = useClients()
  const { orders } = useOrders()
  const finalizedOrders = orders.filter((order) => !order.isDraft)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [client, setClient] = useState(emptyClient)

  // Guarda só o id, não uma cópia do cliente — assim, depois de editar, o
  // modal de detalhes já reflete o dado novo sozinho (lido de volta de
  // `clients`), sem precisar sincronizar manualmente os dois estados.
  const [detailsClientId, setDetailsClientId] = useState(null)
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editDraft, setEditDraft] = useState(emptyClient)

  const detailsClient = clients.find((item) => item.id === detailsClientId) || null
  const detailsClientOrders = detailsClient
    ? finalizedOrders
        .filter((order) => order.clientId === detailsClient.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : []

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

  function openDetails(item) {
    setDetailsClientId(item.id)
    setIsEditingDetails(false)
  }

  function closeDetails() {
    setDetailsClientId(null)
    setIsEditingDetails(false)
  }

  function startEditingDetails() {
    setEditDraft({
      personName: detailsClient.personName,
      companyName: detailsClient.companyName || '',
      document: detailsClient.document,
      phone: detailsClient.phone,
      email: detailsClient.email || '',
    })
    setIsEditingDetails(true)
  }

  function handleEditDraftChange(event) {
    const { name, value } = event.target
    setEditDraft({ ...editDraft, [name]: value })
  }

  async function saveEditedClient() {
    if (!editDraft.personName || !editDraft.document || !editDraft.phone) {
      alert('Preencha nome, CPF/CNPJ e telefone.')
      return
    }

    const duplicateDocument = clients.some(
      (item) => item.document === editDraft.document && item.id !== detailsClient.id
    )
    if (duplicateDocument) {
      alert('Já existe outro cliente cadastrado com esse CPF/CNPJ.')
      return
    }

    const updated = await updateClient(detailsClient.id, editDraft)
    if (updated) setIsEditingDetails(false)
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

              <div className="client-card-actions">
                <Button variant="secondary" onClick={() => openDetails(item)}>
                  Ver detalhes
                </Button>
              </div>
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

      <Modal
        isOpen={!!detailsClient}
        onClose={closeDetails}
        title={detailsClient ? getClientDisplayName(detailsClient) : ''}
      >
        {detailsClient && !isEditingDetails && (
          <>
            <div className="client-card-info">
              <div>
                <span>Nome</span>
                <strong>{detailsClient.personName}</strong>
              </div>

              <div>
                <span>Empresa</span>
                <strong>{detailsClient.companyName || '-'}</strong>
              </div>

              <div>
                <span>CPF/CNPJ</span>
                <strong>{detailsClient.document}</strong>
              </div>

              <div>
                <span>Telefone</span>
                <strong>{detailsClient.phone}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{detailsClient.email || '-'}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <Button variant="secondary" onClick={startEditingDetails}>
                Editar
              </Button>
            </div>

            <h3>Histórico de pedidos</h3>

            {detailsClientOrders.length === 0 && <p>Nenhum pedido finalizado ainda.</p>}

            {detailsClientOrders.map((order) => (
              <div className="client-order-history-item" key={order.id}>
                <div>
                  <Link to={`/pedidos/${order.id}`}>{order.orderNumber}</Link>
                  <span>
                    {formatOrderDate(order.createdAt)} • {getStageLabel(order.stage)}
                  </span>
                </div>
                <p>{summarizeProducts(order.products)}</p>
              </div>
            ))}
          </>
        )}

        {detailsClient && isEditingDetails && (
          <>
            <ClientFields client={editDraft} onChange={handleEditDraftChange} />

            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setIsEditingDetails(false)}>
                Cancelar
              </Button>
              <Button onClick={saveEditedClient}>Salvar</Button>
            </div>
          </>
        )}
      </Modal>
    </Layout>
  )
}

export default Clients
