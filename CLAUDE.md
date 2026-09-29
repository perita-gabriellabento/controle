# Controle de Perícias — Gabriella Bento

## ⚠️ Status atual (28/09/2026) — leia isto primeiro

O projeto está em **migração da planilha Google Sheets para Supabase**, com integração nova de Google Calendar. Tudo isso vive no branch **`fase2-supabase`** (commit `2dbf8c8`), **a `main` continua intocada e é o que está publicado hoje** em produção (ainda na planilha/PIN antigos). Nada do que está descrito abaixo como "novo" está no ar ainda.

### O que já está pronto e testado (branch `fase2-supabase`)
- **Banco Supabase criado e migrado**: todos os 35 processos reais migrados da planilha, com auditoria numérica e de data confirmando zero divergência
- **Schema relacional completo**: `supabase/schema.sql` — tabelas, RLS, triggers, grants
- **App reescrito** pra falar com o Supabase em vez do Google Sheets (autenticação real por e-mail/senha, tempo real em vez de polling, `row`→`id`)
- **Google Calendar**: OAuth com proteção CSRF, autenticação obrigatória em toda rota, cálculo de prazo por fase (dias úteis + feriados + recesso forense)
- **63 testes automatizados** rodando contra o banco real e o servidor real (`npm run test:db`)
- **Next.js atualizado** 14.2.29 → 14.2.35 (corrige vulnerabilidade de segurança)

### ✅ Marcos concluídos (29/09/2026)
- **App publicado no Vercel**: https://gabriellabento.com.br (domínio próprio, HTTPS válido, DNS na Locaweb)
- **Google Calendar testado ponta a ponta em produção**: conexão OAuth, criação/edição/remoção de evento real confirmadas
- **App OAuth do Google publicado ("In production")** — não expira mais em 7 dias
- **Login + troca de senha testados de verdade** (não só no código) — funcionando, com olho de mostrar/ocultar senha
- **Auditoria de segurança**: nenhum segredo vaza pro navegador nem pro repositório (testado com grep no bundle real e no site publicado)

### ✅ Auditoria adversarial + correções (29/09/2026 madrugada)
- **Auditoria linha a linha planilha × Supabase** (35 processos, 22 campos cada, checklist e somas de honorários): rodada 3 vezes (antes da correção, depois da correção, e uma checagem final) até fechar 100%.
- **2 bugs reais encontrados na SUÍTE DE TESTES** (não no app) que corrompiam dado real da Gabi toda vez que `npm run test:db` rodava:
  - `schema.test.js`: teste de "autenticado consegue escrever" gravava o literal fixo `"Goiânia"` sem reverter — corrompeu a cidade de 1 processo real. Corrigido pra fazer round-trip do valor que já estava lá.
  - `integration.test.js`: teste de checklist apagava a marcação de "Proposta de Honorários" incondicionalmente ao final, mesmo quando ela já existia antes do teste — apagou essa marcação de 5 processos reais ao longo de várias execuções da suíte. Corrigido pra nunca mexer numa marcação que não foi o próprio teste que criou.
  - Ambos os bugs foram a causa raiz de 100% das divergências de dado encontradas. Dados reconciliados a partir da planilha (fonte não editada desde 27/09), com backup datado em `backups/2026-09-29/` antes de qualquer escrita corretiva.
- **Confirmado ao vivo**: durante a auditoria, 2 processos mudaram de fase no Supabase com `fase_changed_at` de minutos atrás — a Gabi já está usando o app novo em produção e a escrita está funcionando corretamente.
- **63/63 testes passando** após as correções.
- **Bug real de mobile corrigido e publicado**: a Gabi reportou que no celular a lista de perícias "parava" antes de mostrar tudo. Causa: paginação incremental do card mobile (`MOBILE_PAGE`) estava em 10, exigindo 3 toques em "Ver mais" pro caseload real dela (~34 ativos). Aumentado pra 50 e já deployado em produção.
- **Redirecionamento de links antigos**: `controle-pericias-pericias-gabriella.vercel.app` (alias automático do Vercel) agora redireciona (308) pra `gabriellabento.com.br`, igual ao domínio `controle-pericias-delta.vercel.app`. Falta ainda publicar o redirect do GitHub Pages antigo (ver item 1 abaixo).
- **Segurança confirmada ao vivo**: site inteiro com `noindex, nofollow` (Google nunca indexa), `/dashboard` sem sessão não vaza nenhum dado real no HTML, e leitura direta na API do Supabase sem login retorna "permission denied" (RLS bloqueando de verdade, testado na fonte, não só no código).

### ✅ Madrugada 29/09 — correções críticas, Calendar, Excel, mockup novo
- **Erro de login intermitente**: mensagem genérica pra qualquer erro trocada por diagnóstico real (rate limit / credencial errada / rede), com 1 retry automático.
- **Colunas congeladas (bug antigo)**: achada a causa raiz — cabeçalho sem largura fixa, corpo com largura fixa, desalinhavam no scroll. Corrigido.
- **Calendar backfill**: sincronizado com segurança. Início/entrega já estavam 100% sincronizados (0 faltando). Prazo da fase atual só foi criado pros 2 processos com `fase_changed_at` confiável (mudou de verdade via uso real, não é resíduo da migração) — os outros 20 processos com fase que teria prazo continuam sem evento de propósito, esperando a Gabi confirmar "desde quando está nesta fase" (mesma decisão de segurança de antes, não é esquecimento).
- **Exportar para Excel**: botão novo no topo do dashboard, gera `.xlsx` com as mesmas colunas da planilha antiga. Usa a distribuição oficial da SheetJS via CDN (não o pacote `xlsx` do npm, que tem prototype pollution/ReDoS sem correção publicada).
- **Push pro GitHub**: autorizado pelo Robert, mas o classificador de segurança do próprio Claude Code bloqueou a tentativa (`[Out-of-Place Publication]`) — trava da ferramenta, não da IA. Branch `fase2-supabase` está com todos os commits prontos localmente; falta só destravar isso nas configurações do Claude Code ou fazer o push manualmente.
- **Mockup visual novo**: refinamento sobre a identidade real (mesmas cores/fontes), aguardando aprovação antes de aplicar no código de verdade — nenhuma mudança visual foi feita direto no app sem aprovação, por não haver como conferir renderização real neste ambiente.

### O que falta
1. **Enviar o branch `fase2-supabase` pro GitHub** — ainda bloqueado esperando autorização explícita do Robert (ação de push é sensível, pede confirmação sempre). App está rodando via deploy direto da CLI do Vercel, não via integração Git ainda. Isso também bloqueia publicar o redirect do GitHub Pages antigo (arquivos já prontos, só falta esse push).
2. **Testar clicando de verdade a interface completa** (tabela, checklist, proposta) — o que foi testado até agora é auth + Calendar + auditoria de dados; um clique real ponta a ponta na tabela/CRUD ainda não foi feito por um humano.
3. **Confirmar com a Gabi**: tabela ASPECON 2026 (itens 32/33 idênticos a 2025 — checar com a associação) e o modelo de proposta corrigido.
4. **Reconectar o Google Calendar uma vez** agora que o app está publicado (ela conectou originalmente ainda em modo "Testando" — reconectar garante token de geração definitiva).
5. **Backfill do Calendar**: os 35 processos migrados da planilha nunca passaram pela sincronização — a agenda dela só vai ter eventos dos processos criados/editados depois da conexão. Rodar sincronização única pra popular os prazos já existentes (pendente de confirmação do Robert, já que cria ~30-70 eventos reais).
6. **Fase 4 (visual)**: design já aprovado (mockup "Controle de Perícias"), ainda não aplicado nos componentes reais.
7. **Exportar para Excel**: botão pedido pelo Robert pra Gabi exportar as perícias (mesmo formato da planilha antiga), sob demanda. Ainda não construído.
8. **Decisão sobre desligar a planilha/Apps Script de vez**: agora que a auditoria fechou 100% e o Supabase provou estar à frente em uso real, o risco de manter os dois em paralelo é baixo — mas a planilha ainda não deve ser apagada até o item 1 (push) e o item 2 (teste de clique real) estarem resolvidos.

### Inventário de recursos que NUNCA pode regredir
Ver `INVENTARIO-DE-RECURSOS.md` — checklist de toda funcionalidade da versão antiga que tem que sobreviver na nova.

---

## Stack (novo — Fase 2/3)

- **Next.js 14.2.35** App Router — **sem** `output: 'export'` (precisa de rotas de servidor pro Calendar)
- **Supabase**: Postgres + Auth + Realtime — substitui 100% o Google Sheets/Apps Script
- **Google Calendar API**: sincronização unidirecional de prazos (OAuth2, `calendar.events` scope)
- **Tailwind CSS** + CSS variables para temas dark/light (idêntico à versão anterior)
- **Fontes:** Cinzel + Montserrat · **Toasts:** Sonner · **Geração .docx:** docxtemplater + pizzip (inalterado)

## Credenciais (Keychain macOS — nunca em arquivo de texto puro)

Ler com `security find-generic-password -a "$USER" -s "<nome>" -w`:

| Nome no Keychain | Pra que serve |
|---|---|
| `supabase-pericias-gabi-url` | Project URL do Supabase |
| `supabase-pericias-gabi-publishable-key` | Chave pública (client-side, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) |
| `supabase-pericias-gabi-secret-key` | Chave admin — **só servidor** (`SUPABASE_SECRET_KEY`), ignora RLS |
| `supabase-pericias-gabi-db-password` | Senha do Postgres — só necessária pra conexão direta (scripts de migração/teste) |
| `supabase-pericias-gabi-temp-password` | Senha temporária de login da Gabi (`bentogabriella97@gmail.com`) — trocar quando ela começar a usar de verdade |
| `google-calendar-pericias-client-id` / `-client-secret` | OAuth Client do Google Cloud (projeto "Pericias GB Calendar") — servidor apenas |
| `vercel-pericias-gabi-token` | Token de deploy do Vercel — **cuidado**: o primeiro que o Robert mandou era de um produto errado (AI Gateway), precisa confirmar que é um Access Token de verdade (Settings → Tokens) |

Variáveis completas em `.env.local` (nunca commitado, está no `.gitignore`).

## Arquitetura de dados (Supabase)

Ver `supabase/schema.sql` pra DDL completo. Resumo:
- **`pericias`** — substitui a planilha, `id uuid` (não mais número de linha), `CHECK` constraints em vez de texto livre pra fase/tipo/origem/status, `fase_changed_at` (atualizado por trigger só quando a fase muda de verdade — base do cálculo de prazo)
- **`checklist_items`** — `pericia_id` nulo = tarefa global, preenchido = específica (cascade delete)
- **`pericia_checklist_done`** — junção; existir a linha = tarefa concluída (substitui o JSON `"[1,3,5]"` de antes)
- **`fase_prazos`** — dias de prazo por fase (úteis/corridos), confirmados com a Gabi (ver histórico de memória do projeto)
- **`google_calendar_tokens`** — singleton, só `service_role` acessa (RLS sem nenhuma policy)
- **`oauth_pending_state`** — nonce anti-CSRF do fluxo OAuth do Calendar, singleton, expira em 5min
- **RLS**: qualquer usuária autenticada tem acesso completo (só existe uma usuária prevista — a Gabi); `anon` bloqueado em tudo

`ASPECON_TABLE` (33 categorias de honorários) continua constante no código (`src/lib/types.ts`), nunca virou tabela — são dados fixos que raramente mudam.

## Camada de dados no app

- `src/lib/supabaseClient.ts` — client do browser, com storage dinâmico pra "Confiar neste dispositivo" (localStorage vs sessionStorage) + `authedFetch()` (anexa o token de sessão nas chamadas às rotas de API)
- `src/lib/supabaseAdmin.ts` — client de servidor com a secret key. **Nunca importar de um componente `'use client'`.**
- `src/lib/auth.ts` — `login`/`logout`/`isAuthenticated`/`changePassword`/`onAuthChange`
- `src/lib/sheets.ts` — mantém o nome do arquivo (histórico) mas fala 100% com Supabase agora: `fetchPericias`, `updatePericia`, `appendPericia`, `saveChecklistStatus` etc., mais `subscribeToChanges()` (Realtime, substitui o polling de 30s)
- `src/lib/businessDays.ts` — cálculo de prazo (dias úteis/corridos), feriados nacionais (fixos + móveis via Páscoa) + recesso forense (20/dez–20/jan)
- `src/lib/googleCalendar.ts` + `src/lib/apiAuth.ts` — só usados pelas rotas de API (`src/app/api/calendar/**`)

## Google Calendar — como funciona

Unidirecional: o app só cria/atualiza/apaga eventos, nunca lê a agenda da Gabi de volta. Cada perícia pode ter até 3 eventos (dia inteiro, nunca `dateTime`, pra não ter bug de fuso):
1. **Início** (`google_event_id_inicio`)
2. **Entrega prevista** (`google_event_id_entrega`)
3. **Prazo da fase atual** (`google_event_id_prazo_fase`) — o mais urgente, calculado a partir de `fase_changed_at` + `fase_prazos`

Os eventos vão pro **calendário principal** da Gabi (não um secundário dedicado — tentei isso primeiro, mas criar calendário novo exige escopo `calendar` amplo; mantive o escopo mínimo `calendar.events` e distingo visualmente com o prefixo `⚖️` no título). Avisos escalonados: 7 dias antes, 3 dias antes, 1 dia antes, no dia (pop-up + e-mail nos mais próximos). `POST /api/calendar/sync {periciaId}` reconcilia os 3 sempre a partir do estado atual do banco (nunca do que o client mandou) — pode ser chamado quantas vezes quiser, nunca duplica evento, nunca deixa "alarme falso" de fase antiga. `DELETE /api/calendar/sync` limpa tudo antes de excluir uma perícia permanentemente.

**Toda rota de `/api/calendar/*` exige `Authorization: Bearer <token de sessão>`** — sem isso, 401. O fluxo de conexão usa `state` anti-CSRF (tabela `oauth_pending_state`, expira em 5min, invalidado no primeiro uso).

**Risco conhecido:** app OAuth ainda em "Testing" no Google Cloud — token pode expirar em 7 dias. Falta o domínio verificado (`gabriellabento.com.br`, pendente do deploy) pra publicar em produção sem essa limitação.

## Testes — `npm run test:db`

63 testes automatizados, nessa ordem, todos rodando contra o banco/servidor real (não é mock):
1. `supabase/tests/businessDays.test.js` — Páscoa, feriados, recesso forense, contagem de dias úteis
2. `supabase/tests/schema.test.js` — RLS (autenticado × anônimo em toda tabela), CHECK constraints, cascade delete, triggers, qualidade dos dados migrados
3. `supabase/tests/integration.test.js` — simula o fluxo real do app logado como a Gabi
4. `supabase/tests/api-security.test.js` — sobe o servidor Next.js de verdade e ataca as próprias rotas do Calendar (sem auth, CSRF forjado, replay de state)

Sempre rodar antes de considerar qualquer mudança de backend "pronta".

## Deploy (mudou — não é mais GitHub Pages)

Como agora tem rotas de servidor (Calendar), não dá mais pra usar `output: 'export'`/GitHub Pages. Alvo é **Vercel**. Processo (em construção, ver seção de status no topo):
```bash
npx vercel --token "$(security find-generic-password -a "$USER" -s "vercel-pericias-gabi-token" -w)"
```
Configurar as mesmas variáveis de `.env.local` no painel do Vercel (Settings → Environment Variables), trocando `APP_URL` de `http://localhost:3000` pra URL real do deploy.

**Regra permanente, herdada da versão antiga:** nunca deployar código que represente regressão. Antes de qualquer deploy: rodar `npm run test:db`, `npx tsc --noEmit` e `npm run build` — todos precisam passar limpo.

## Padrões de código (mantidos da versão anterior)

- **Otimismo primeiro:** atualizar cache local antes da API, reverter em erro
- **Debounce 800ms** nas edições inline
- **Undo via toast** (3s), sempre persiste o revert no servidor também
- **Sticky columns / Title Case / popups fixed** — inalterados, ver `globals.css` e `utils.ts`
- **Retry com backoff** em toda escrita idempotente nova (update/delete), nunca em insert (evita duplicar registro se a rede falhar)

## Arquivos principais (atualizados)

| Arquivo | Responsabilidade |
|---|---|
| `src/app/dashboard/page.tsx` | Página principal — agora com Realtime, Configurações com botão do Calendar |
| `src/app/page.tsx` | Login — e-mail/senha + "Confiar neste dispositivo" |
| `src/lib/sheets.ts` | Camada de dados — Supabase (nome do arquivo é histórico) |
| `src/lib/auth.ts`, `supabaseClient.ts`, `supabaseAdmin.ts`, `apiAuth.ts` | Autenticação (client e servidor) |
| `src/lib/businessDays.ts`, `googleCalendar.ts` | Lógica do Calendar |
| `src/app/api/calendar/**` | Rotas de servidor (connect, callback, sync, status) |
| `src/components/PericiasTable.tsx` | Tabela — mesma UI de antes, `id` no lugar de `row` |
| `supabase/schema.sql` | Fonte da verdade do schema do banco |
| `supabase/tests/*.test.js` | Suíte de testes (rodar com `npm run test:db`) |
| `pericias-proxy.gs`, planilha Google | **Ainda existem, intocados** — rede de segurança até o corte final (ver plano de fases) |
