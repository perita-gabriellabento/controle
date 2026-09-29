import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: string | number): string {
  const num = typeof value === 'string'
    ? parseFloat(value.replace(/[^\d,.-]/g, '').replace(',', '.'))
    : value
  if (isNaN(num)) return value as string || ''
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(num)
}

export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

export function formatDate(value: string): string {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${d}/${m}/${y}`
}

export function toISODate(value: string): string {
  if (!value) return ''
  const parts = value.split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`
  }
  return value
}

function inteiroParaExtenso(n: number): string {
  const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove']
  const DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa']
  const CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos']

  if (n === 0) return 'zero'
  if (n === 100) return 'cem'
  if (n < 20) return UNIDADES[n]
  if (n < 100) {
    const d = DEZENAS[Math.floor(n / 10)]
    const u = n % 10
    return u > 0 ? `${d} e ${UNIDADES[u]}` : d
  }
  if (n < 1000) {
    const c = CENTENAS[Math.floor(n / 100)]
    const rem = n % 100
    if (rem === 0) return c
    if (rem === 100) return `${c} e cem`
    return `${c} e ${inteiroParaExtenso(rem)}`
  }
  if (n < 1000000) {
    const mil = Math.floor(n / 1000)
    const rem = n % 1000
    const milStr = mil === 1 ? 'mil' : `${inteiroParaExtenso(mil)} mil`
    if (rem === 0) return milStr
    if (rem < 100) return `${milStr} e ${inteiroParaExtenso(rem)}`
    return `${milStr} e ${inteiroParaExtenso(rem)}`
  }
  return n.toString()
}

export function valorParaExtenso(valor: number): string {
  if (!valor || valor <= 0) return 'zero reais'
  const reais = Math.floor(valor)
  const centavos = Math.round((valor - reais) * 100)
  const partes: string[] = []
  if (reais > 0) {
    partes.push(`${inteiroParaExtenso(reais)} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos > 0) {
    partes.push(`${inteiroParaExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  }
  return partes.join(' e ')
}

export function formatValorBR(valor: number): string {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SMALL_WORDS = new Set([
  'de','da','do','das','dos','e','ou','a','o','as','os','em','com','para','por',
  'no','na','nos','nas','num','numa','ao','aos','à','às','ante','até','após',
  'sob','sobre','sem','entre','desde','via',
])

// Lista explícita de siglas — sempre maiúsculas independente do input
const SIGLAS = new Set([
  // Natureza jurídica
  'LTDA','ME','SA','S/A','EPP','EIRELI','MEI','SS','SLU','SC','CIA','SCS','SNC',
  // Bancos e financeiras
  'BRB','CEF','BB','BTG','XP','C6','BCO','HSBC','BMG','BV','BNDES','CEI',
  'SICREDI','SICOOB','BRADESCO','ITAÚ','ITAU','CAIXA',
  // Tribunais e órgãos jurídicos
  'STF','STJ','TST','TSE','TRF','TRT','TRE','TJ','TC','TCU','TCE','TCM',
  'MPF','MPE','MPT','MPM','PGE','PGR','AGU','DPU','DPE','PGM',
  // Entidades e conselhos
  'OAB','CRC','CFC','CREA','CRM','CRF','CRP','CRECI','CFO',
  // Órgãos e autarquias
  'INSS','INPI','IBGE','ANATEL','ANEEL','ANS','ANP','ANVISA','IBAMA',
  'BACEN','CVM','SUSEP','PREVIC','PGFN',
  // Siglas fiscais e trabalhistas
  'CPF','CNPJ','RG','CTF','FGTS','PIS','COFINS','CSLL','IRPJ','IRRF',
  'IPTU','IPVA','ICMS','ISS','IOF','IPI','ITR','ITBI','ITCMD',
  // Outros comuns em processos
  'SFH','SFI','CEI','NIT','RAIS','DIRF','SPED','NF','NFS','NFe',
  'ONG','OS','OSCIP','APL',
])

export function toTitleCase(s: string): string {
  if (!s) return s
  return s.trim().split(/\s+/).map((word, i) => {
    // Separa sufixo de pontuação (ex: "LTDA." → base="LTDA", sufixo=".")
    const match = word.match(/^(.*?)([.,;:!?]*)$/)
    const base = match?.[1] ?? word
    const suffix = match?.[2] ?? ''
    // Sigla conhecida → sempre maiúscula
    if (SIGLAS.has(base.toUpperCase())) return base.toUpperCase() + suffix
    // Artigo/preposição (exceto na primeira posição)
    const low = base.toLowerCase()
    if (i > 0 && SMALL_WORDS.has(low)) return low + suffix
    // Caso geral → Title Case
    return low.charAt(0).toUpperCase() + low.slice(1) + suffix
  }).join(' ')
}

// Retry com espera crescente — só pra operações idempotentes (leitura, update, delete).
// Nunca usar em insert/create: reexecutar depois de uma falha de rede poderia duplicar
// o registro (o servidor pode ter criado na primeira tentativa e só a resposta se perdido).
export async function withRetry<T>(fn: () => PromiseLike<{ data: T; error: any }>, attempts = 3): Promise<{ data: T; error: any }> {
  let last: { data: T; error: any } = { data: null as T, error: new Error('sem tentativa') }
  for (let i = 0; i < attempts; i++) {
    last = await fn()
    if (!last.error) return last
    if (i === attempts - 1) return last
    await new Promise(r => setTimeout(r, 300 * Math.pow(2, i)))
  }
  return last
}
