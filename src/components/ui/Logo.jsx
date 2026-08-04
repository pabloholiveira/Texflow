/* Marca TexFlow: máquina de costura em contorno (escolha do Pablo entre
   variantes, na passada de polish de 2026-07-10).

   Extraído em 2026-08-04 porque o mesmo SVG estava copiado byte a byte
   entre Login e Sidebar, e a ficha de produção impressa seria a terceira
   cópia — mudar o logo viraria três edições.

   As classes vêm por prop, e não fixas aqui, para que login.css,
   sidebar.css e print.css continuem donos da própria aparência: este
   componente entrega a marcação, não o estilo. Cada tela passa seu
   prefixo (`login-brand`, `sidebar-brand`, `sheet-brand`) e as regras que
   já existiam seguem valendo sem precisar mudar de nome.

   O `stroke="currentColor"` é o que faz a mesma marca servir para a
   sidebar branca, o login e o papel preto-no-branco da ficha — quem
   define a cor é o CSS de quem usa. */
function Logo({ className }) {
  return (
    <div className={className}>
      <span className={`${className}-icon`} aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Espelhado no eixo X: o volante da máquina fica à direita, como
              numa máquina real vista de frente pelo operador. */}
          <g transform="scale(-1 1) translate(-24 0)">
            <path d="M3 18.5h18" />
            <path d="M18.5 18.5V8a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2v3.5" />
            <path d="M6.5 14.5v2.5" />
            <path d="M18.5 9.5a2 2 0 1 1 0 4" />
            <path d="M11 6V4" />
          </g>
        </svg>
      </span>
      <span className={`${className}-name`}>
        <span className={`${className}-accent`}>T</span>exFlow
      </span>
    </div>
  )
}

export default Logo
