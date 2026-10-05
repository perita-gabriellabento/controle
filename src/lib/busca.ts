// Busca da tabela de perícias. Pedido da Gabi/Robert (05/10/2026): "Amélia" não aparecia
// ao digitar com acento diferente, e a busca deve perdoar erro de digitação e de português.
//
// Dois estágios, pra ser precisa quando dá e tolerante só quando precisa:
//  1) exata: ignora acento, maiúscula e pontuação; cada palavra digitada precisa aparecer
//     (como parte de alguma palavra do processo). Número de processo casa por dígitos.
//  2) tolerante: só roda se o estágio 1 não achou NADA. Aceita 1 letra errada, faltando,
//     sobrando ou trocada de lugar (2 em palavras longas).
// Assim "Maria" nunca traz "Marta" quando existe uma Maria; já "Amelya" acha "Amélia".

export function normalizar(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Distância de edição com troca de letras vizinhas (ex.: "amelai" -> "amelia" = 1).
function distancia(a: string, b: string): number {
  const n = a.length, m = b.length
  if (!n) return m
  if (!m) return n
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)])
  for (let j = 0; j <= m; j++) d[0][j] = j
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[n][m]
}

function tolerancia(len: number): number {
  if (len <= 3) return 0
  if (len <= 6) return 1
  return 2
}

// Número de processo colado sem pontuação (ex.: 12345678920238090051) casa pelos dígitos de cada campo.
function casaPorDigitos(q: string, digitosCampos: string[]): boolean {
  return /^\d{7,}$/.test(q) && digitosCampos.some(d => d.includes(q))
}

function palavraCasaExata(q: string, palavras: string[], digitosCampos: string[]): boolean {
  return palavras.some(p => p.includes(q)) || casaPorDigitos(q, digitosCampos)
}

function palavraCasaTolerante(q: string, palavras: string[], digitosCampos: string[]): boolean {
  if (/^\d+$/.test(q)) return palavraCasaExata(q, palavras, digitosCampos) // número nunca é "aproximado"
  const tol = tolerancia(q.length)
  if (tol === 0) return palavraCasaExata(q, palavras, digitosCampos)
  return palavras.some(p => {
    if (p.includes(q)) return true
    if (/^\d+$/.test(p)) return false
    if (distancia(q, p) <= tol) return true
    // palavra ainda sendo digitada, com um erro no meio: compara só com o começo da palavra
    if (q.length >= 5 && p.length > q.length) return distancia(q, p.slice(0, q.length)) <= 1
    return false
  })
}

export function filtrarPorBusca<T>(itens: T[], consulta: string, campos: (item: T) => string[]): T[] {
  const tokens = normalizar(consulta).split(' ').filter(Boolean)
  if (!tokens.length) return itens
  const indexados = itens.map(item => {
    const cs = campos(item)
    return {
      item,
      palavras: normalizar(cs.join(' ')).split(' ').filter(Boolean),
      digitosCampos: cs.map(c => (c || '').replace(/\D/g, '')).filter(Boolean),
    }
  })
  const exatos = indexados.filter(x => tokens.every(t => palavraCasaExata(t, x.palavras, x.digitosCampos)))
  if (exatos.length) return exatos.map(x => x.item)
  return indexados.filter(x => tokens.every(t => palavraCasaTolerante(t, x.palavras, x.digitosCampos))).map(x => x.item)
}
