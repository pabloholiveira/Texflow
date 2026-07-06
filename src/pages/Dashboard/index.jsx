import Layout from '../../components/layout/Layout'

function Dashboard() {
  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da produção da confecção</p>
        </div>

        <button>Novo pedido</button>
      </div>

      <section className="alert-box">
        <strong>🔴 Atenção</strong>
        <p>3 pedidos estão atrasados e 2 vencem amanhã.</p>
      </section>

      <section className="dashboard-cards">
        <div className="dashboard-card">
          <span>Pedidos ativos</span>
          <strong>28</strong>
        </div>

        <div className="dashboard-card">
          <span>Atrasados</span>
          <strong>3</strong>
        </div>

        <div className="dashboard-card">
          <span>Em Costura</span>
          <strong>12</strong>
        </div>

        <div className="dashboard-card">
          <span>Em Estampa</span>
          <strong>8</strong>
        </div>

        <div className="dashboard-card">
          <span>Em Bordado</span>
          <strong>5</strong>
        </div>

        <div className="dashboard-card">
          <span>Em Corte</span>
          <strong>6</strong>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-panel">
          <h2>Próximos vencimentos</h2>

          <div className="deadline-item">
            <strong>PED-2026-1023</strong>
            <span>Escola Alfa • Vence hoje</span>
          </div>

          <div className="deadline-item">
            <strong>PED-2026-1024</strong>
            <span>Igreja Vida • Vence amanhã</span>
          </div>

          <div className="deadline-item">
            <strong>PED-2026-1025</strong>
            <span>Empresa XP • Vence em 2 dias</span>
          </div>
        </div>

        <div className="dashboard-panel">
          <h2>Fluxo da produção</h2>

          <div className="production-flow">
            <span>Venda</span>
            <span>Design</span>
            <span>Corte</span>
            <span>Costura</span>
            <span>Bordado</span>
            <span>Estampa</span>
            <span>Finalização</span>
          </div>
        </div>
      </section>
    </Layout>
  )
}

export default Dashboard