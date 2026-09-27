// Cálculo de prazos (dias úteis / dias corridos) considerando feriados nacionais
// e o recesso forense (20/dez a 20/jan, prazos processuais suspensos por lei).
//
// Regra de ouro: toda data é tratada como componentes Y/M/D puros, nunca como
// `new Date('YYYY-MM-DD')` direto — isso evita o bug clássico de fuso horário
// (a string ISO é interpretada como UTC meia-noite, que "volta um dia" em
// qualquer timezone negativo como o do Brasil). Aqui sempre construímos e lemos
// as datas via Date.UTC()/getUTC*, nunca métodos locais.

type YMD = { y: number; m: number; d: number }

function parseISO(iso: string): YMD {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

function toISO({ y, m, d }: YMD): string {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`
}

function toUTCDate({ y, m, d }: YMD): Date {
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTCDate(date: Date): YMD {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

function addDaysUTC(ymd: YMD, days: number): YMD {
  const date = toUTCDate(ymd)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUTCDate(date)
}

function weekdayUTC(ymd: YMD): number {
  return toUTCDate(ymd).getUTCDay() // 0 = domingo, 6 = sábado
}

// ── Páscoa (algoritmo de Gauss/Meeus, calendário gregoriano) ────
function easter(year: number): YMD {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return { y: year, m: month, d: day }
}

// ── Feriados nacionais (fixos + móveis baseados na Páscoa) ──────
function nationalHolidays(year: number): Set<string> {
  const fixed: YMD[] = [
    { y: year, m: 1, d: 1 },   // Confraternização Universal
    { y: year, m: 4, d: 21 },  // Tiradentes
    { y: year, m: 5, d: 1 },   // Dia do Trabalho
    { y: year, m: 9, d: 7 },   // Independência
    { y: year, m: 10, d: 12 }, // N. Sra. Aparecida
    { y: year, m: 11, d: 2 },  // Finados
    { y: year, m: 11, d: 15 }, // Proclamação da República
    { y: year, m: 11, d: 20 }, // Consciência Negra (feriado nacional desde 2023)
    { y: year, m: 12, d: 25 }, // Natal
  ]
  const easterYmd = easter(year)
  const movable: YMD[] = [
    addDaysUTC(easterYmd, -48), // Carnaval (segunda)
    addDaysUTC(easterYmd, -47), // Carnaval (terça)
    addDaysUTC(easterYmd, -2),  // Sexta-feira Santa
    addDaysUTC(easterYmd, 60),  // Corpus Christi
  ]
  return new Set([...fixed, ...movable].map(toISO))
}

const _holidayCache = new Map<number, Set<string>>()
function holidaysForYear(year: number): Set<string> {
  if (!_holidayCache.has(year)) _holidayCache.set(year, nationalHolidays(year))
  return _holidayCache.get(year)!
}

// ── Recesso forense: 20/dez a 20/jan (inclusive), atravessa o ano ──
function isForensicRecess(ymd: YMD): boolean {
  if (ymd.m === 12 && ymd.d >= 20) return true
  if (ymd.m === 1 && ymd.d <= 20) return true
  return false
}

export function isBusinessDay(iso: string): boolean {
  const ymd = parseISO(iso)
  const wd = weekdayUTC(ymd)
  if (wd === 0 || wd === 6) return false
  if (isForensicRecess(ymd)) return false
  if (holidaysForYear(ymd.y).has(iso)) return false
  return true
}

export function addCalendarDays(startIso: string, days: number): string {
  return toISO(addDaysUTC(parseISO(startIso), days))
}

export function addBusinessDays(startIso: string, days: number): string {
  let cur = parseISO(startIso)
  let remaining = days
  while (remaining > 0) {
    cur = addDaysUTC(cur, 1)
    if (isBusinessDay(toISO(cur))) remaining--
  }
  return toISO(cur)
}

// ── Ponto de entrada usado pelo cálculo de prazo por fase ───────
export function calcPrazo(startIso: string, dias: number, tipo: 'uteis' | 'corridos'): string {
  return tipo === 'uteis' ? addBusinessDays(startIso, dias) : addCalendarDays(startIso, dias)
}

// Converte um timestamp UTC (ex: fase_changed_at do Postgres) pra data local de
// Brasília antes de contar prazo — evita que um registro feito à noite (BRT)
// já vire "dia seguinte" em UTC e desloque o prazo calculado por engano.
export function utcTimestampToBrazilDate(utcIso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(utcIso))
  const map: Record<string, string> = {}
  for (const p of parts) map[p.type] = p.value
  return `${map.year}-${map.month}-${map.day}`
}
