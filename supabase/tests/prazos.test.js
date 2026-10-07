// Testa src/lib/prazos.ts de verdade (compila o TypeScript real pra uma pasta temporária,
// em vez de copiar a lógica). Regras da Gabi de 05/10/2026. Puro: não toca em banco nenhum.
const { execFileSync } = require('child_process')
const fs = require('fs'), os = require('os'), path = require('path')

const root = path.resolve(__dirname, '../..')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'prazos-test-'))
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [
  path.join(root, 'src/lib/prazos.ts'), path.join(root, 'src/lib/businessDays.ts'),
  '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck',
], { stdio: 'inherit' })
const P = require(path.join(out, 'prazos.js'))
const B = require(path.join(out, 'businessDays.js'))

let pass = 0, fail = 0
function eq(actual, expected, label) {
  if (actual === expected) { pass++; console.log('  ✅', label, '→', actual) }
  else { fail++; console.log('  ❌', label, `esperado ${expected}, veio ${actual}`) }
}

console.log('== Entrega = início + 30 dias corridos ==')
eq(P.calcEntregaAuto('2026-10-15'), '2026-11-14', 'caso do print (processo J.H.); cai em sábado e fica como saiu')
eq(P.calcEntregaAuto('2026-12-10'), '2027-01-09', 'atravessa o recesso: corridos contam tudo')
eq(P.calcEntregaAuto('2028-02-01'), '2028-03-02', 'ano bissexto')

console.log('\n== Quando a entrega é preenchida sozinha ==')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-15', inicioAntigo: '', entregaAtual: '' }), '2026-11-14', 'entrega vazia: preenche')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-20', inicioAntigo: '2026-10-15', entregaAtual: '2026-11-14' }), '2026-11-19', 'entrega era a calculada: acompanha o novo início')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-20', inicioAntigo: '2026-10-15', entregaAtual: '2026-12-01' }), null, 'entrega digitada à mão: mantém')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-20', inicioAntigo: '2026-10-15', entregaAtual: '2026-11-15' }), null, 'um dia de diferença do calculado também é "à mão": mantém')
eq(P.entregaAutomatica({ inicioNovo: '', inicioAntigo: '2026-10-15', entregaAtual: '2026-11-14' }), null, 'início apagado: não mexe na entrega')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-15', inicioAntigo: '2026-10-15', entregaAtual: '2026-11-14' }), null, 'mesma data: nada a fazer')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-15', inicioAntigo: '2026-10-01', entregaAtual: '2026-08-01' }), null, 'entrega antiga digitada (caso real): mantém')

console.log('\n== Datas inválidas e valores intermediários do campo de data (auditoria 07/10) ==')
for (const [v, esperado] of [['2026-10-15', true], ['0002-10-15', false], ['0026-03-05', false], ['1899-12-31', false], ['2101-01-01', false], ['2026-02-30', false], ['2026-13-01', false], ['', false], ['2026-10-1', false], ['abc', false]])
  eq(P.dataValida(v), esperado, `dataValida("${v}")`)
eq(P.entregaAutomatica({ inicioNovo: '0002-10-15', inicioAntigo: '', entregaAtual: '' }), null, 'ano intermediário (0002) não gera entrega')
eq(P.entregaAutomatica({ inicioNovo: '0202-10-15', inicioAntigo: '2026-10-15', entregaAtual: '2026-11-14' }), null, 'ano intermediário não mexe na entrega que já existe')
eq(B.addCalendarDays('0026-03-05', 30), '0026-04-04', 'businessDays: ano < 100 não vira 19xx')
eq(B.addCalendarDays('2026-12-20', 30), '2027-01-19', 'businessDays: virada de ano')

console.log('\n== Apagar e redigitar o início ==')
eq(P.entregaAoLimparInicio({ inicioAntigo: '2026-10-15', entregaAtual: '2026-11-14' }), '', 'apagar início: some a entrega que era calculada')
eq(P.entregaAoLimparInicio({ inicioAntigo: '2026-10-15', entregaAtual: '2026-12-01' }), null, 'apagar início: entrega digitada à mão fica')
eq(P.entregaAoLimparInicio({ inicioAntigo: '', entregaAtual: '2026-11-14' }), null, 'apagar início sem início antigo: não mexe')
eq(P.entregaAutomatica({ inicioNovo: '2026-10-20', inicioAntigo: '', entregaAtual: '' }), '2026-11-19', 'depois de apagar, digitar outro início recalcula (entrega estava vazia)')

console.log('\n== "Atrasado" só onde o laudo ainda não foi entregue ==')
for (const [fase, esperado] of [
  ['Impugnação de laudo', false], ['Entregue', false], ['Revogado', false],
  ['Em produção', true], ['Em diligência', true], ['Proposta de honorários', true],
  ['Aguardando intimação para início', true], ['Aguardando recebimento honorários', true],
  ['Aguardando intimação para proposta de honorários', true], ['', true],
]) eq(P.entregaTemAlerta(fase), esperado, `alerta de entrega em "${fase || '(sem fase)'}"`)

console.log('\n== Revogado e arquivado ficam fora dos totais ==')
eq(P.contaNosTotais({ fase: 'Em produção', arquivado: false }), true, 'processo normal conta')
eq(P.contaNosTotais({ fase: 'Revogado', arquivado: false }), false, 'revogado não conta')
eq(P.contaNosTotais({ fase: 'Entregue', arquivado: true }), false, 'arquivado não conta')
eq(P.contaNosTotais({ fase: 'Revogado', arquivado: true }), false, 'revogado e arquivado não conta')
eq(P.contaNosTotais({}), true, 'sem fase conta (como antes)')

console.log('\n== Interruptor ==')
eq(P.ENTREGA_AUTOMATICA_ATIVA, true, 'cálculo automático da entrega ligado (Gabi confirmou 30 dias corridos na rodada 2)')

console.log('\n== Constantes ==')
eq(P.FASE_IMPUGNACAO, 'Impugnação de laudo', 'nome da fase confere com o CHECK do banco')
eq(P.FASE_REVOGADO, 'Revogado', 'nome da fase Revogado')

fs.rmSync(out, { recursive: true, force: true })
console.log(`\n${pass} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
