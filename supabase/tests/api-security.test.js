// ============================================================
// api-security.test.js
// Sobe o servidor Next.js de verdade e testa as rotas de API do Calendar
// contra ataque real: sem autenticação, com token válido, CSRF (state forjado
// ou reaproveitado). Não é teste de unidade — bate na rota HTTP de verdade.
// Uso: node supabase/tests/api-security.test.js
// ============================================================

const { spawn, execFileSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

function keychain(name) {
  return execFileSync('security', ['find-generic-password', '-a', process.env.USER, '-s', name, '-w']).toString().trim();
}

const PORT = 3911; // porta dedicada, não colide com um `npm run dev` que já esteja rodando
const BASE = `http://localhost:${PORT}`;
let pass = 0, fail = 0;
function ok(msg) { pass++; console.log('  ✅', msg); }
function bad(msg) { fail++; console.log('  ❌', msg); }

async function getGabiToken() {
  const sb = createClient(keychain('supabase-pericias-gabi-url'), keychain('supabase-pericias-gabi-publishable-key'), { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({
    email: 'bentogabriella97@gmail.com',
    password: keychain('supabase-pericias-gabi-temp-password'),
  });
  if (error) throw new Error('login falhou: ' + error.message);
  return data.session.access_token;
}

function waitForServer(proc, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout esperando o servidor subir')), timeoutMs);
    proc.stdout.on('data', d => {
      if (/Ready in|started server/i.test(d.toString())) { clearTimeout(timer); resolve(); }
    });
    proc.on('exit', code => { clearTimeout(timer); reject(new Error('servidor caiu antes de subir, exit ' + code)); });
  });
}

async function main() {
  console.log('Subindo o servidor Next.js de teste na porta', PORT, '...');
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: process.cwd(), env: process.env });
  let serverErr = '';
  server.stderr.on('data', d => { serverErr += d.toString(); });

  try {
    await waitForServer(server);
    console.log('Servidor no ar.\n');

    const token = await getGabiToken();

    console.log('== Rotas sem autenticação — todas devem devolver 401 ==');
    const unauthed = [
      ['POST', '/api/calendar/connect', null],
      ['POST', '/api/calendar/sync', { periciaId: '00000000-0000-0000-0000-000000000000' }],
      ['DELETE', '/api/calendar/sync', { periciaId: '00000000-0000-0000-0000-000000000000' }],
      ['GET', '/api/calendar/status', null],
    ];
    for (const [method, path, body] of unauthed) {
      const res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 401) ok(`${method} ${path} sem token -> 401`);
      else bad(`${method} ${path} sem token -> ${res.status} (esperado 401)`);
    }

    console.log('\n== Com token real da Gabi — deve funcionar ==');
    const connectRes = await fetch(BASE + '/api/calendar/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const connectData = await connectRes.json();
    if (connectRes.status === 200 && connectData.ok && connectData.url?.includes('accounts.google.com')) ok('POST /api/calendar/connect autenticado -> gera URL do Google');
    else bad('connect autenticado falhou: ' + JSON.stringify(connectData));
    const realState = new URL(connectData.url).searchParams.get('state');

    const statusRes = await fetch(BASE + '/api/calendar/status', { headers: { Authorization: `Bearer ${token}` } });
    if (statusRes.status === 200) ok('GET /api/calendar/status autenticado -> 200');
    else bad('status autenticado falhou: ' + statusRes.status);

    console.log('\n== Proteção CSRF (state) ==');
    const forged = await fetch(`${BASE}/api/calendar/oauth/callback?code=x&state=forjado-pelo-atacante`, { redirect: 'manual' });
    const forgedLoc = forged.headers.get('location') || '';
    if (forgedLoc.includes('calendar_error=state_invalido')) ok('state forjado é rejeitado');
    else bad('state forjado NÃO foi rejeitado: ' + forgedLoc);

    // gera um novo state (invalida o anterior) e tenta reusar o antigo
    const connect2 = await fetch(BASE + '/api/calendar/connect', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    await connect2.json();
    const replay = await fetch(`${BASE}/api/calendar/oauth/callback?code=x&state=${realState}`, { redirect: 'manual' });
    const replayLoc = replay.headers.get('location') || '';
    if (replayLoc.includes('calendar_error=state_invalido')) ok('state antigo/reaproveitado é rejeitado (proteção contra replay)');
    else bad('state reaproveitado NÃO foi rejeitado: ' + replayLoc);

    const noParams = await fetch(`${BASE}/api/calendar/oauth/callback`, { redirect: 'manual' });
    const noParamsLoc = noParams.headers.get('location') || '';
    if (noParamsLoc.includes('calendar_error=parametros_ausentes')) ok('callback sem code/state é rejeitado');
    else bad('callback sem parâmetros NÃO foi rejeitado: ' + noParamsLoc);

  } finally {
    server.kill('SIGTERM');
    if (fail > 0 && serverErr) console.log('\n(stderr do servidor, se ajudar a debugar):\n' + serverErr.slice(-2000));
  }

  console.log(`\n${'='.repeat(50)}\nRESULTADO: ${pass} passaram, ${fail} falharam`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error('ERRO FATAL:', err); process.exit(1); });
