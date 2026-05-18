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
