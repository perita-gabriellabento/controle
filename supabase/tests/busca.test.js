// Testa src/lib/busca.ts de verdade (compila o TypeScript real). Puro, não toca em banco.
const { execFileSync } = require('child_process')
const fs = require('fs'), os = require('os'), path = require('path')
const root = path.resolve(__dirname, '../..')
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'busca-test-'))
execFileSync(path.join(root, 'node_modules/.bin/tsc'), [path.join(root, 'src/lib/busca.ts'), '--outDir', out, '--module', 'commonjs', '--target', 'es2020', '--skipLibCheck'], { stdio: 'inherit' })
const { filtrarPorBusca, normalizar } = require(path.join(out, 'busca.js'))

const base = [
  { id: 1, campos: ['Amélia Maria Souza Campos', 'Banco do Brasil SA', '1234567-89.2023.8.09.0051', 'Verificar Abusividade e Capitalização de Juros', 'Goiânia', '3ª Vara Cível', 'Impugnação de laudo', 'Particular'] },
  { id: 2, campos: ['Jorge Duarte Lima', 'Aymoré Crédito, Financiamento e Investimento S.A.', '7654321-00.2025.8.09.0011', 'Verificar Abusividade e Capitalização de Juros', 'Aparecida de Goiânia', '1ª Vara', 'Em produção', 'Particular'] },
  { id: 3, campos: ['Maria José Alves', 'Banco Bradesco', '1000001-11.2024.8.09.0001', 'Revisão de contrato', 'Anápolis', '2ª Vara', 'Entregue', 'Judicial'] },
  { id: 4, campos: ['Marta Souza Lima', 'Caixa Econômica Federal', '2000002-22.2024.8.09.0002', 'Cálculo trabalhista', 'Rio Verde', 'Vara do Trabalho', 'Entregue', 'Judicial'] },
]
const ids = q => filtrarPorBusca(base, q, x => x.campos).map(x => x.id).join(',')
let pass = 0, fail = 0
function eq(actual, expected, label) {
  if (actual === expected) { pass++; console.log('  ✅', label, '→', `[${actual}]`) }
  else { fail++; console.log('  ❌', label, `esperado [${expected}], veio [${actual}]`) }
}

console.log('== Acento, maiúscula e pontuação não atrapalham ==')
eq(normalizar('Amélia  —  MARIA'), 'amelia maria', 'normalização')
eq(ids('amelia'), '1', 'sem acento acha "Amélia" (o caso que falhou)')
eq(ids('AMÉLIA'), '1', 'com acento e maiúscula')
eq(ids('goiania'), '1,2', 'cidade sem acento')
eq(ids('credito aymore'), '2', 'duas palavras sem acento, achando "Aymoré Crédito"')
eq(ids('impugnacao'), '1', 'busca pela fase, sem acento')
eq(ids('capitalizacao'), '1,2', 'assunto sem acento')

console.log('\n== Número de processo ==')
eq(ids('1234567'), '1', 'só o começo do número')
eq(ids('1234567-89.2023.8.09.0051'), '1', 'número completo, com pontuação')
eq(ids('12345678920238090051'), '1', 'número colado só com dígitos, sem pontuação')
eq(ids('0011'), '2', 'pedaço do número (comarca)')
eq(ids('1000001112024'), '3', 'pedaço do número só com dígitos atravessando a pontuação')

console.log('\n== Estágio exato vem primeiro: não traz parecido quando existe o certo ==')
eq(ids('maria'), '1,3', '"maria" traz as Marias e não a Marta')
eq(ids('marta'), '4', '"marta" traz só a Marta')

console.log('\n== Tolerante a erro de digitação (só quando nada casa) ==')
eq(ids('amelya'), '1', 'letra trocada: amelya')
eq(ids('amelai'), '1', 'letras vizinhas trocadas: amelai')
eq(ids('ameia'), '1', 'letra faltando: ameia')
eq(ids('ameliaa'), '1', 'letra sobrando: ameliaa')
eq(ids('jorje'), '2', 'jorje -> Jorge')
eq(ids('bradesko'), '3', 'bradesko -> Bradesco (palavra de 8 letras)')
eq(ids('capitalisacao'), '1,2', 'capitalisacao -> capitalização (s no lugar de z)')
eq(ids('abusividde'), '1,2', 'abusividde -> abusividade')
eq(ids('goiania amelya'), '1', 'duas palavras, uma com erro')

console.log('\n== Sem falso positivo ==')
eq(ids('xyzxyz'), '', 'palavra sem parecido não traz nada')
eq(ids('bb'), '', 'palavra curta não é aproximada')
eq(ids('99999999'), '', 'número que não existe não é aproximado')
eq(ids('amelia zzzzzz'), '', 'uma palavra certa e outra inexistente: nada (todas precisam casar)')
eq(ids(''), '1,2,3,4', 'busca vazia mostra tudo')
eq(ids('   '), '1,2,3,4', 'só espaços mostra tudo')

fs.rmSync(out, { recursive: true, force: true })
console.log(`\n${pass} ok, ${fail} falhas`)
process.exit(fail ? 1 : 0)
