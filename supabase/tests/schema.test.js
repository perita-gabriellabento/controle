// ============================================================
// schema.test.js
// Suíte de testes adversarial do banco Supabase — Controle de Perícias
// Roda contra o banco de verdade (não é mock) usando credenciais do Keychain.
// Uso: npm run test:db
// Nunca deixa lixo de teste pra trás — cada bloco limpa o que criou.
// ============================================================

const { execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

function keychain(name) {
  return execFileSync('security', ['find-generic-password', '-a', process.env.USER, '-s', name, '-w']).toString().trim();
}

const URL = keychain('supabase-pericias-gabi-url');
const SECRET = keychain('supabase-pericias-gabi-secret-key');
const PUBLISHABLE = keychain('supabase-pericias-gabi-publishable-key');
const GABI_EMAIL = 'bentogabriella97@gmail.com';
const GABI_PW = keychain('supabase-pericias-gabi-temp-password');
const GAS_URL = 'https://script.google.com/macros/s/AKfycbyzxFxq8_kOjIt169v0cKB01JnpTbOFXIHfHyeBubWvVG69vRi4pdq591RPQqc8em8a/exec';

const sbAdmin = createClient(URL, SECRET, { auth: { persistSession: false } });
const sbAnon = createClient(URL, PUBLISHABLE, { auth: { persistSession: false } });

let pass = 0, fail = 0;
const failures = [];
function ok(msg) { pass++; console.log('  ✅', msg); }
function bad(msg) { fail++; failures.push(msg); console.log('  ❌', msg); }
function section(title) { console.log('\n── ' + title + ' ──'); }

async function pgQuery(sql, params) {
  const pw = keychain('supabase-pericias-gabi-db-password');
  const caPath = path.join(__dirname, '..', 'supabase-pooler-chain.pem');
  const caChain = fs.existsSync(caPath) ? fs.readFileSync(caPath, 'utf8') : undefined;
  const client = new Client({
    host: 'aws-0-sa-east-1.pooler.supabase.com', port: 5432,
    user: 'postgres.vaacmiimnocwhwyodold', password: pw, database: 'postgres',
    ssl: caChain ? { ca: caChain } : true,
  });
  await client.connect();
  const r = await client.query(sql, params);
  await client.end();
  return r;
}

async function testAuthenticatedAccess() {
  section('A) Acesso autenticado (login real da Gabi)');
  const { error: signInErr } = await sbAnon.auth.signInWithPassword({ email: GABI_EMAIL, password: GABI_PW });
  if (signInErr) return bad('login da Gabi falhou: ' + signInErr.message);
  ok('login funciona com a senha guardada no Keychain');

  for (const table of ['pericias', 'checklist_items', 'pericia_checklist_done', 'fase_prazos']) {
    const { error } = await sbAnon.from(table).select('*').limit(1);
    if (error) bad(`Gabi autenticada NÃO consegue ler ${table} (deveria conseguir): ${error.message}`);
    else ok(`Gabi autenticada consegue ler ${table}`);
  }

  // Escreve o MESMO valor que já está lá (round-trip) — nunca um literal fixo,
  // pra jamais corromper um dado real caso esse teste rode contra qualquer registro.
  const { data: sample } = await sbAnon.from('pericias').select('id, cidade').limit(1);
  if (sample && sample[0]) {
    const original = sample[0].cidade;
    const { error } = await sbAnon.from('pericias').update({ cidade: original }).eq('id', sample[0].id);
    if (error) bad('Gabi autenticada NÃO consegue escrever em pericias: ' + error.message);
    else {
      const { data: check } = await sbAnon.from('pericias').select('cidade').eq('id', sample[0].id).single();
      if (check && check.cidade === original) ok('Gabi autenticada consegue escrever em pericias (persistiu, dado original preservado)');
      else bad('escrita não persistiu corretamente');
    }
  }

  const { data: tokens, error: tokensErr } = await sbAnon.from('google_calendar_tokens').select('*').limit(1);
  if (tokensErr || (tokens && tokens.length === 0)) ok('Gabi autenticada NÃO consegue ler google_calendar_tokens (deny-all correto)');
  else bad('Gabi autenticada CONSEGUIU ler google_calendar_tokens — vazamento grave');

  await sbAnon.auth.signOut();
}

async function testAnonBlocked() {
  section('B) Acesso anônimo (sem login) é bloqueado em tudo');
  for (const table of ['pericias', 'checklist_items', 'pericia_checklist_done', 'fase_prazos', 'google_calendar_tokens']) {
    const { data, error } = await sbAnon.from(table).select('*').limit(1);
    if (error || (data && data.length === 0)) ok(`anônimo bloqueado de ler ${table}`);
    else bad(`anônimo CONSEGUIU ler ${table} sem login — falha de segurança`);
  }
  const { error: writeErr } = await sbAnon.from('pericias').insert({ polo_ativo: 'hack', polo_passivo: 'x', numero_processo: 'ANON-HACK' });
  if (writeErr) ok('anônimo bloqueado de escrever em pericias');
  else { bad('anônimo CONSEGUIU inserir em pericias sem login'); await sbAdmin.from('pericias').delete().eq('numero_processo', 'ANON-HACK'); }
}

async function testCheckConstraints() {
  section('C) CHECK constraints rejeitam dado inválido');
  const badInserts = [
    { label: 'fase inválida', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C1', fase: 'Fase Inexistente' } },
    { label: 'UF inválida', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C2', uf: 'ZZ' } },
    { label: 'tipo inválido', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C3', tipo: 'Advogado' } },
    { label: 'origem inválida', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C4', origem: 'Anúncio' } },
    { label: 'proposta_categoria fora de 1-33 (99)', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C5', proposta_categoria: 99 } },
    { label: 'proposta_categoria fora de 1-33 (0)', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C6', proposta_categoria: 0 } },
    { label: 'proposta_status inválido', payload: { polo_ativo:'x', polo_passivo:'x', numero_processo:'TEST-C7', proposta_status: 'Cancelada' } },
  ];
  for (const t of badInserts) {
    const { error } = await sbAdmin.from('pericias').insert(t.payload);
    if (error) ok(`rejeitado: ${t.label}`);
    else { bad(`ACEITOU dado inválido: ${t.label}`); await sbAdmin.from('pericias').delete().eq('numero_processo', t.payload.numero_processo); }
  }

  const { error: fpDiasErr } = await sbAdmin.from('fase_prazos').insert({ fase: 'TEST_FASE_TEMP', dias: -5, dias_tipo: 'uteis' });
  if (fpDiasErr) ok('rejeitado: dias negativo em fase_prazos');
  else { bad('ACEITOU dias negativo em fase_prazos'); await sbAdmin.from('fase_prazos').delete().eq('fase', 'TEST_FASE_TEMP'); }

  const { error: fpTipoErr } = await sbAdmin.from('fase_prazos').insert({ fase: 'TEST_FASE_TEMP2', dias: 5, dias_tipo: 'semanas' });
  if (fpTipoErr) ok('rejeitado: dias_tipo inválido em fase_prazos');
  else { bad('ACEITOU dias_tipo inválido em fase_prazos'); await sbAdmin.from('fase_prazos').delete().eq('fase', 'TEST_FASE_TEMP2'); }

  const { error: notNullErr } = await sbAdmin.from('pericias').insert({ cidade: 'Goiânia' }); // falta polo_ativo/polo_passivo/numero_processo
  if (notNullErr) ok('rejeitado: perícia sem polo_ativo/polo_passivo/numero_processo (NOT NULL)');
  else bad('ACEITOU perícia sem os campos obrigatórios');
}

async function testCascadeAndIsolation() {
  section('D) Cascade delete e isolamento global × custom no checklist');
  const { data: p1 } = await sbAdmin.from('pericias').insert({ polo_ativo:'Teste Cascade A', polo_passivo:'x', numero_processo:'TEST-D1' }).select('id').single();
  const { data: p2 } = await sbAdmin.from('pericias').insert({ polo_ativo:'Teste Cascade B', polo_passivo:'x', numero_processo:'TEST-D2' }).select('id').single();
  const { data: customItem } = await sbAdmin.from('checklist_items').insert({ descricao: 'tarefa só da perícia A', pericia_id: p1.id }).select('id').single();
  await sbAdmin.from('pericia_checklist_done').insert({ pericia_id: p1.id, checklist_item_id: customItem.id });

  const { data: itemsForP2 } = await sbAdmin.from('checklist_items').select('id').or(`pericia_id.is.null,pericia_id.eq.${p2.id}`);
  if (!itemsForP2.some(i => i.id === customItem.id)) ok('tarefa custom da perícia A não vaza para a perícia B');
  else bad('tarefa custom vazou entre perícias diferentes');

  await sbAdmin.from('pericias').delete().eq('id', p1.id);
  const { data: orphanItem } = await sbAdmin.from('checklist_items').select('id').eq('id', customItem.id);
  const { data: orphanDone } = await sbAdmin.from('pericia_checklist_done').select('*').eq('pericia_id', p1.id);
  if (orphanItem.length === 0) ok('checklist_item apagado em cascata com a perícia');
  else bad('checklist_item ficou órfão');
  if (orphanDone.length === 0) ok('pericia_checklist_done apagado em cascata');
  else bad('pericia_checklist_done ficou órfão');

  await sbAdmin.from('pericias').delete().eq('id', p2.id);
}

async function testAnexos() {
  section('D2) Anexos — RLS do storage, upload/download real, cascade delete')
  const BUCKET = 'anexos-pericias'
  const pdf = () => new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' })

  const { error: anonErr } = await sbAnon.storage.from(BUCKET).upload('teste-suite-anon.pdf', pdf())
  if (anonErr) ok('anônimo bloqueado de subir arquivo (RLS do storage)')
  else { bad('anônimo CONSEGUIU subir arquivo sem login — falha grave'); await sbAdmin.storage.from(BUCKET).remove(['teste-suite-anon.pdf']) }

  const { error: signInErr } = await sbAnon.auth.signInWithPassword({ email: GABI_EMAIL, password: GABI_PW })
  if (signInErr) { bad('login da Gabi falhou (anexos): ' + signInErr.message); return }

  const { data: p } = await sbAdmin.from('pericias').insert({ polo_ativo: 'Teste Anexo', polo_passivo: 'x', numero_processo: 'TEST-ANEXO1' }).select('id').single()
  const path = `${p.id}/teste-suite.pdf`

  const { error: upErr } = await sbAnon.storage.from(BUCKET).upload(path, pdf())
  if (!upErr) ok('autenticada consegue subir arquivo')
  else bad('upload autenticado falhou: ' + upErr.message)

  const { data: anexoRow, error: insErr } = await sbAnon.from('pericia_anexos').insert({
    pericia_id: p.id, nome_arquivo: 'teste-suite.pdf', storage_path: path, tamanho_bytes: 21, tipo_mime: 'application/pdf',
  }).select('id').single()
  if (!insErr) ok('metadado do anexo salvo')
  else bad('salvar metadado falhou: ' + insErr.message)

  const { data: dl, error: dlErr } = await sbAnon.storage.from(BUCKET).download(path)
  if (!dlErr && dl.size > 0) ok('autenticada consegue baixar o arquivo de volta')
  else bad('download falhou: ' + (dlErr?.message || 'tamanho zero'))

  // Apaga a perícia (não o anexo) — o storage_path fica órfão no bucket (Storage não faz
  // cascade automático com uma tabela comum), mas o METADADO tem que cair em cascata.
  await sbAdmin.from('pericias').delete().eq('id', p.id)
  const { data: orphanMeta } = await sbAdmin.from('pericia_anexos').select('id').eq('id', anexoRow?.id || '00000000-0000-0000-0000-000000000000')
  if (!orphanMeta || orphanMeta.length === 0) ok('metadado do anexo apagado em cascata com a perícia')
  else bad('metadado do anexo ficou órfão após apagar a perícia')

  // limpeza do arquivo físico órfão no bucket
  await sbAdmin.storage.from(BUCKET).remove([path])
  await sbAnon.auth.signOut()
}

async function testFaseChangedAtTrigger() {
  section('E) fase_changed_at só avança quando a fase muda de verdade');
  const { data: p } = await sbAdmin.from('pericias').insert({ polo_ativo:'Teste Fase', polo_passivo:'x', numero_processo:'TEST-E1', fase: 'Em produção' }).select('id, fase_changed_at').single();
  await new Promise(r => setTimeout(r, 1100));
  await sbAdmin.from('pericias').update({ cidade: 'Anápolis' }).eq('id', p.id);
  const { data: afterEdit } = await sbAdmin.from('pericias').select('fase_changed_at').eq('id', p.id).single();
  if (afterEdit.fase_changed_at === p.fase_changed_at) ok('não muda ao editar campo não relacionado');
  else bad('mudou mesmo sem trocar a fase');

  await new Promise(r => setTimeout(r, 1100));
  await sbAdmin.from('pericias').update({ fase: 'Entregue' }).eq('id', p.id);
  const { data: afterFase } = await sbAdmin.from('pericias').select('fase_changed_at').eq('id', p.id).single();
  if (afterFase.fase_changed_at !== p.fase_changed_at) ok('avança corretamente ao trocar a fase');
  else bad('não avançou ao trocar a fase');

  await sbAdmin.from('pericias').delete().eq('id', p.id);
}

async function testDefaults() {
  section('F) Valores padrão corretos');
  const { data: p } = await sbAdmin.from('pericias').insert({ polo_ativo:'Teste Default', polo_passivo:'x', numero_processo:'TEST-F1' }).select('arquivado, id').single();
  if (p.arquivado === false) ok('arquivado nasce false por padrão');
  else bad('arquivado não nasceu false: ' + p.arquivado);
  await sbAdmin.from('pericias').delete().eq('id', p.id);
}

async function testSingleton() {
  section('G) Singleton de google_calendar_tokens');
  const { error } = await sbAdmin.from('google_calendar_tokens').insert({ id: 2, refresh_token: 'fake' });
  if (error) ok('rejeitado: 2ª linha com id != 1');
  else { bad('ACEITOU 2ª linha em google_calendar_tokens'); await sbAdmin.from('google_calendar_tokens').delete().eq('id', 2); }
}

async function testRealDataQuality() {
  section('H) Qualidade dos dados reais migrados');
  const { data: allProc } = await sbAdmin.from('pericias').select('numero_processo');
  const counts = {};
  allProc.forEach(p => { counts[p.numero_processo] = (counts[p.numero_processo] || 0) + 1; });
  const dups = Object.entries(counts).filter(([, c]) => c > 1);
  if (dups.length === 0) ok('nenhum número de processo duplicado');
  else bad('processos duplicados: ' + JSON.stringify(dups));

  const { count } = await sbAdmin.from('pericias').select('*', { count: 'exact', head: true });
  if (count >= 35) ok(`${count} perícias no banco (>= 35 esperado da migração original)`);
  else bad(`só ${count} perícias no banco — esperado pelo menos 35`);
}

async function testDateExactness() {
  section('I) Datas migradas idênticas à fonte (sem deslocamento de fuso)');
  const r = await pgQuery("select numero_processo, entrega_prevista::text, inicio::text from pericias where entrega_prevista is not null order by numero_processo limit 8");
  // GAS (Google Apps Script) ocasionalmente devolve uma página de erro HTML transitória sob carga —
  // retry simples evita que um soluço externo derrube a suíte inteira.
  let src;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${GAS_URL}?action=list&token=pericias_gb_2026`);
      const json = await res.json();
      src = json.pericias;
      break;
    } catch (e) {
      if (attempt === 3) { bad('não foi possível buscar a planilha de referência (GAS) após 3 tentativas: ' + e.message); return; }
      await new Promise(r2 => setTimeout(r2, 1000 * attempt));
    }
  }
  let allOk = true;
  for (const row of r.rows) {
    const s = src.find(p => p.numeroProcesso === row.numero_processo);
    if (!s) continue;
    if (s.entregaPrevista !== row.entrega_prevista) { allOk = false; bad(`entrega_prevista diverge em ${row.numero_processo}: planilha=${s.entregaPrevista} banco=${row.entrega_prevista}`); }
    if ((s.inicio || null) !== row.inicio) { allOk = false; bad(`inicio diverge em ${row.numero_processo}: planilha=${s.inicio} banco=${row.inicio}`); }
  }
  if (allOk) ok(`${r.rows.length} perícias com datas conferidas caractere-a-caractere`);
}

async function main() {
  console.log('Suíte de testes do banco — Controle de Perícias (Supabase)');
  await testAuthenticatedAccess();
  await testAnonBlocked();
  await testCheckConstraints();
  await testCascadeAndIsolation();
  await testAnexos();
  await testFaseChangedAtTrigger();
  await testDefaults();
  await testSingleton();
  await testRealDataQuality();
  await testDateExactness();

  console.log(`\n${'='.repeat(50)}`);
  console.log(`RESULTADO: ${pass} passaram, ${fail} falharam`);
  if (fail > 0) {
    console.log('\nFalhas:');
    failures.forEach(f => console.log('  - ' + f));
    process.exit(1);
  }
}

main().catch(err => { console.error('ERRO FATAL NA SUÍTE:', err); process.exit(1); });
