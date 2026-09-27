// Teste isolado da lógica de businessDays.ts (copiada inline pra rodar sem bundler)
function parseISO(iso) { const [y,m,d] = iso.split('-').map(Number); return {y,m,d} }
function toISO({y,m,d}) { return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` }
function toUTCDate({y,m,d}) { return new Date(Date.UTC(y,m-1,d)) }
function fromUTCDate(date) { return { y: date.getUTCFullYear(), m: date.getUTCMonth()+1, d: date.getUTCDate() } }
function addDaysUTC(ymd, days) { const date = toUTCDate(ymd); date.setUTCDate(date.getUTCDate()+days); return fromUTCDate(date) }
function weekdayUTC(ymd) { return toUTCDate(ymd).getUTCDay() }
function easter(year) {
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3)
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451)
  const month=Math.floor((h+l-7*m+114)/31), day=((h+l-7*m+114)%31)+1
  return {y:year,m:month,d:day}
}
function nationalHolidays(year) {
  const fixed=[{y:year,m:1,d:1},{y:year,m:4,d:21},{y:year,m:5,d:1},{y:year,m:9,d:7},{y:year,m:10,d:12},{y:year,m:11,d:2},{y:year,m:11,d:15},{y:year,m:11,d:20},{y:year,m:12,d:25}]
  const ey=easter(year)
  const movable=[addDaysUTC(ey,-48),addDaysUTC(ey,-47),addDaysUTC(ey,-2),addDaysUTC(ey,60)]
  return new Set([...fixed,...movable].map(toISO))
}
const cache = new Map()
function holidaysForYear(y) { if(!cache.has(y)) cache.set(y, nationalHolidays(y)); return cache.get(y) }
function isForensicRecess(ymd) { if(ymd.m===12 && ymd.d>=20) return true; if(ymd.m===1 && ymd.d<=20) return true; return false }
function isBusinessDay(iso) { const ymd=parseISO(iso); const wd=weekdayUTC(ymd); if(wd===0||wd===6) return false; if(isForensicRecess(ymd)) return false; if(holidaysForYear(ymd.y).has(iso)) return false; return true }
function addBusinessDays(startIso, days) { let cur=parseISO(startIso); let rem=days; while(rem>0){ cur=addDaysUTC(cur,1); if(isBusinessDay(toISO(cur))) rem-- } return toISO(cur) }
function addCalendarDays(startIso, days) { return toISO(addDaysUTC(parseISO(startIso), days)) }

let pass=0, fail=0
function ok(msg){ pass++; console.log('  ✅', msg) }
function bad(msg){ fail++; console.log('  ❌', msg) }
function eq(actual, expected, label){ if(actual===expected) ok(`${label}: ${actual}`); else bad(`${label}: esperado ${expected}, veio ${actual}`) }

console.log('== Páscoa (cross-check com datas historicamente conhecidas) ==')
eq(toISO(easter(2024)), '2024-03-31', 'Páscoa 2024')
eq(toISO(easter(2025)), '2025-04-20', 'Páscoa 2025')
eq(toISO(easter(2026)), '2026-04-05', 'Páscoa 2026')

console.log('\n== Feriados fixos ==')
eq(isBusinessDay('2026-01-01'), false, 'Ano novo não é dia útil')
eq(isBusinessDay('2026-12-25'), false, 'Natal não é dia útil')
eq(isBusinessDay('2026-09-07'), false, 'Independência não é dia útil')
eq(isBusinessDay('2026-11-20'), false, 'Consciência Negra não é dia útil')

console.log('\n== Fim de semana ==')
const d = new Date(Date.UTC(2026,8,27)) // 2026-09-27, conferir dia da semana real via Date nativo
console.log('  (2026-09-27 é', ['dom','seg','ter','qua','qui','sex','sab'][d.getUTCDay()], 'pelo JS nativo)')
eq(isBusinessDay('2026-09-27'), d.getUTCDay() !== 0 && d.getUTCDay() !== 6, 'weekend check consistente com JS nativo')

console.log('\n== Recesso forense (20/dez a 20/jan) ==')
eq(isForensicRecess(parseISO('2026-12-19')), false, '19/dez ainda não é recesso')
eq(isForensicRecess(parseISO('2026-12-20')), true, '20/dez já é recesso')
eq(isForensicRecess(parseISO('2027-01-20')), true, '20/jan ainda é recesso')
eq(isForensicRecess(parseISO('2027-01-21')), false, '21/jan já não é mais recesso')

console.log('\n== addBusinessDays — contagem manual ==')
// 2026-09-28 é segunda-feira (confirmado pelo JS nativo abaixo)
const seg = new Date(Date.UTC(2026,8,28))
console.log('  (2026-09-28 é', ['dom','seg','ter','qua','qui','sex','sab'][seg.getUTCDay()], ')')
// segunda + 5 dias úteis (sem feriado no meio) = segunda seguinte (pula 2 fins de semana = +7 dias corridos)
eq(addBusinessDays('2026-09-28', 5), '2026-10-05', '5 dias úteis a partir de uma segunda = segunda seguinte')

// caso que atravessa o recesso forense: 15/dez/2026 (terça) + 5 dias úteis deve pular o recesso inteiro
const dec15 = new Date(Date.UTC(2026,11,15))
console.log('  (2026-12-15 é', ['dom','seg','ter','qua','qui','sex','sab'][dec15.getUTCDay()], ')')
const resultado = addBusinessDays('2026-12-15', 5)
console.log('  15/dez/2026 + 5 dias úteis =', resultado, '(deve estar DEPOIS de 20/jan/2027, pulando o recesso inteiro)')
eq(resultado > '2027-01-20', true, 'resultado pula o recesso forense inteiro')

console.log('\n== addCalendarDays — dias corridos simples ==')
eq(addCalendarDays('2026-09-27', 30), '2026-10-27', '30 dias corridos')

console.log(`\n${'='.repeat(50)}\nRESULTADO: ${pass} passaram, ${fail} falharam`)
if (fail > 0) process.exit(1)
