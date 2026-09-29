// ============================================================
// integration.test.js
// Testa a MESMA lógica de mapeamento/escrita que src/lib/sheets.ts usa,
// rodando contra o banco real, autenticado como a Gabi de verdade —
// simula exatamente o que o app faz no navegador.
// Uso: node supabase/tests/integration.test.js
// ============================================================

const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

function keychain(name) {
  return execFileSync('security', ['find-generic-password', '-a', process.env.USER, '-s', name, '-w']).toString().trim();
}

const URL = keychain('supabase-pericias-gabi-url');
const PUBLISHABLE = keychain('supabase-pericias-gabi-publishable-key');
const GABI_EMAIL = 'bentogabriella97@gmail.com';
const GABI_PW = keychain('supabase-pericias-gabi-temp-password');

const sb = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });

let pass = 0, fail = 0;
function ok(msg) { pass++; console.log('  ✅', msg); }
function bad(msg) { fail++; console.log('  ❌', msg); }

// mesma função de src/lib/sheets.ts, copiada aqui pra testar a lógica isoladamente
function dbToPericia(row, doneMap) {
  return {
    id: row.id,
    createdAt: row.created_at,
    poloAtivo: row.polo_ativo || '',
    poloPassivo: row.polo_passivo || '',
    valorHonorarios: row.valor_honorarios != null ? String(row.valor_honorarios) : '',
    solicitarDocs: row.solicitar_docs === true ? 'Sim' : row.solicitar_docs === false ? 'Não' : '',
    fase: row.fase || '',
    checklistDone: JSON.stringify(doneMap.get(row.id) || []),
  };
}

async function main() {
  console.log('Login como a Gabi (fluxo real do app)...');
  const { error: signInErr } = await sb.auth.signInWithPassword({ email: GABI_EMAIL, password: GABI_PW });
  if (signInErr) { bad('login falhou: ' + signInErr.message); return report(); }
  ok('login OK');

  console.log('\nFetch + mapeamento (igual fetchPericias)...');
  const [{ data: rows, error }, { data: doneRows, error: doneErr }] = await Promise.all([
    sb.from('pericias').select('*').limit(5),
    sb.from('pericia_checklist_done').select('pericia_id, checklist_item_id'),
  ]);
  if (error || doneErr) { bad('fetch falhou: ' + (error || doneErr).message); return report(); }
  const doneMap = new Map();
  for (const d of doneRows || []) {
    const list = doneMap.get(d.pericia_id) || [];
    list.push(d.checklist_item_id);
    doneMap.set(d.pericia_id, list);
  }
  const pericias = rows.map(r => dbToPericia(r, doneMap));
  if (pericias.length > 0 && typeof pericias[0].id === 'string' && pericias[0].id.includes('-')) ok('id vem como uuid (string), não mais número de linha');
  else bad('id não parece um uuid: ' + JSON.stringify(pericias[0]));
  if (pericias.every(p => typeof p.checklistDone === 'string')) ok('checklistDone sempre vem como string JSON (compatível com JSON.parse do componente)');
  else bad('checklistDone em formato inesperado');

  console.log('\nUpdate por id (igual updatePericia)...');
  const target = rows[0];
  const oldCidade = target.cidade;
  const { error: updErr } = await sb.from('pericias').update({ cidade: 'Cidade Teste Integração' }).eq('id', target.id);
  if (updErr) { bad('update falhou: ' + updErr.message); }
  else {
    const { data: check } = await sb.from('pericias').select('cidade').eq('id', target.id).single();
    if (check.cidade === 'Cidade Teste Integração') ok('update por id persistiu corretamente');
    else bad('update não persistiu: ' + check.cidade);
    await sb.from('pericias').update({ cidade: oldCidade }).eq('id', target.id); // reverte
  }

  console.log('\nChecklist done: marcar e desmarcar (igual saveChecklistStatus)...');
  const { data: globalItems } = await sb.from('checklist_items').select('id').is('pericia_id', null).limit(1);
  if (globalItems && globalItems[0]) {
    const itemId = globalItems[0].id;
    // Nunca apaga uma marcação que já existia antes do teste (poderia ser um "feito" real da Gabi) —
    // só desfaz o que o próprio teste criou.
    const { data: before } = await sb.from('pericia_checklist_done').select('*').eq('pericia_id', target.id).eq('checklist_item_id', itemId);
    const jaEstavaMarcado = !!(before && before.length > 0);

    const { error: insErr } = await sb.from('pericia_checklist_done').insert({ pericia_id: target.id, checklist_item_id: itemId });
    if (insErr && !insErr.message.includes('duplicate')) { bad('marcar tarefa falhou: ' + insErr.message); }
    else {
      const { data: doneCheck } = await sb.from('pericia_checklist_done').select('*').eq('pericia_id', target.id).eq('checklist_item_id', itemId);
      if (doneCheck.length >= 1) ok('marcar tarefa funcionou');
      else bad('marcar tarefa não refletiu no banco');
      if (jaEstavaMarcado) {
        ok('tarefa já estava marcada antes do teste — preservada sem alteração');
      } else {
        const { error: delErr } = await sb.from('pericia_checklist_done').delete().eq('pericia_id', target.id).eq('checklist_item_id', itemId);
        if (!delErr) ok('desmarcar tarefa funcionou');
        else bad('desmarcar tarefa falhou: ' + delErr.message);
      }
    }
  } else {
    console.log('  (sem tarefas globais pra testar — pulado)');
  }

  await sb.auth.signOut();
  report();
}

function report() {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULTADO: ${pass} passaram, ${fail} falharam`);
  if (fail > 0) process.exit(1);
}

main().catch(err => { console.error('ERRO FATAL:', err); process.exit(1); });
