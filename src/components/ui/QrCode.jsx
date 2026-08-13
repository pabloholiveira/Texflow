import { useMemo } from 'react'
import qrcode from 'qrcode-generator'

/* QR Code como SVG inline, no mesmo espírito de todo o resto da aplicação:
   nenhum asset externo, nenhuma imagem baixada — a marcação sai do próprio
   código. Isso importa mais aqui do que parece: a ficha é impressa, às vezes
   de um computador da fábrica, e um <img> apontando para um gerador online
   falharia justamente quando a internet estivesse ruim.

   A BIBLIOTECA SÓ CALCULA A MATRIZ, quem desenha somos nós. `qrcode-generator`
   foi escolhida entre as três candidatas por ter ZERO dependências (a mais
   popular, `qrcode`, arrasta yargs — um parser de linha de comando — e pngjs
   para dentro do node_modules) e por ser SÍNCRONA: a matriz sai no próprio
   render, sem estado assíncrono nem efeito, que seria a alternativa e é
   justamente o padrão que o react-hooks/set-state-in-effect já proibiu três
   vezes neste projeto.

   UM ÚNICO <path> EM VEZ DE UM <rect> POR MÓDULO: são ~1400 módulos num QR
   deste tamanho, e mil e quatrocentos elementos no DOM só para desenhar um
   quadriculado deixariam a impressão pesada à toa. O path é uma string só.

   `shapeRendering="crispEdges"` desliga o antialiasing: numa impressora, borda
   suavizada vira cinza, e cinza no lugar de preto é exatamente o que faz um
   leitor errar a leitura. */

// Zona de silêncio exigida pela especificação do QR: 4 módulos de margem
// branca em volta. Sem ela, o leitor não acha onde o código começa — é a
// causa clássica de "o QR não lê" quando ele está colado em outro elemento.
const QUIET_ZONE = 4

function QrCode({ value, className, errorCorrection = 'Q', title }) {
  const { path, side } = useMemo(() => {
    // typeNumber 0 = a própria biblioteca escolhe a menor versão que couber.
    const qr = qrcode(0, errorCorrection)
    qr.addData(value)
    qr.make()

    const count = qr.getModuleCount()
    let d = ''

    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (!qr.isDark(row, col)) continue
        // Um quadrado de 1x1 na grade de módulos; o viewBox faz a escala.
        d += `M${col + QUIET_ZONE} ${row + QUIET_ZONE}h1v1h-1z`
      }
    }

    return { path: d, side: count + QUIET_ZONE * 2 }
  }, [value, errorCorrection])

  return (
    <svg
      className={className}
      viewBox={`0 0 ${side} ${side}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title ?? 'QR Code'}
    >
      {/* Fundo branco explícito: a zona de silêncio precisa ser branca de
          verdade, não "o que estiver atrás". */}
      <rect width={side} height={side} fill="#fff" />
      <path d={path} fill="#000" />
    </svg>
  )
}

export default QrCode
