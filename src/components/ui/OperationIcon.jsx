function normalize(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // marcas de acento soltas pelo NFD
    .replace(/[^a-z0-9]/g, '') // barra, espaço, hífen: "Revisão/Finalização"
}

// Traçado, não preenchido — mesma família visual dos ícones da Sidebar, e
// no papel um ícone cheio vira borrão de tinta em impressora de fábrica.
const ICONS = {
  corte: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M20 4L8.12 15.88" />
      <path d="M14.47 14.48L20 20" />
      <path d="M8.12 8.12L12 12" />
    </>
  ),
  /* Silhueta de máquina: mesa, base, coluna+braço em L e a agulha descendo
     à direita. A primeira versão tinha o corpo como retângulo arredondado e
     virava um risco com uma caixinha no tamanho de impressão (~25px) — a
     forma em L é o que faz reconhecer a máquina de relance. */
  costura: (
    <>
      <path d="M2.5 19.5h19" />
      <path d="M5 19.5V15h14v4.5" />
      <path d="M7.5 15V6.5H17" />
      <path d="M17 6.5V12" />
      <path d="M17 13.5v1.5" />
    </>
  ),
  // Carretel de linha — compartilhado pelas três operações de aplicação.
  bordado: (
    <>
      <rect x="8" y="4" width="8" height="16" rx="1" />
      <path d="M6 4h12M6 20h12" />
      <path d="M8 9h8M8 12h8M8 15h8" />
    </>
  ),
  lavagem: <path d="M12 3s6 6.4 6 10a6 6 0 0 1-12 0c0-3.6 6-10 6-10z" />,
  revisaofinalizacao: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.8-3.8" />
    </>
  ),
  embalagem: (
    <>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3 8l9 5 9-5" />
      <path d="M12 13v8" />
    </>
  ),
  // Botão de roupa: entrou no catálogo de produção da Kavi em 2026-08-03.
  botao: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="10" cy="10" r="1" />
      <circle cx="14" cy="10" r="1" />
      <circle cx="10" cy="14" r="1" />
      <circle cx="14" cy="14" r="1" />
    </>
  ),
}

ICONS.silk = ICONS.bordado
ICONS.dtf = ICONS.bordado

// Marcador neutro: qualquer etapa fora do catálogo cai aqui em vez de sair
// sem ícone, que deixaria a linha desalinhada das outras na tabela.
const FALLBACK = (
  <>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="2.5" />
  </>
)

function OperationIcon({ step, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[normalize(step)] ?? FALLBACK}
    </svg>
  )
}

export default OperationIcon
