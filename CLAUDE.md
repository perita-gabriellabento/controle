# Controle de Perícias — Gabriella Bento

## ✅ Status atual (02/10/2026) — leia isto primeiro

**O app novo (Supabase + Calendar) está no ar e é a versão oficial:** https://gabriellabento.com.br (Vercel, projeto `controle-pericias`). A Gabi já usa no dia a dia. O que está no ar está correto (confirmado pelo Robert em 02/10).

### Onde está cada coisa
- **Código:** GitHub `perita-gabriellabento/controle`. Em 02/10 conferido direto no remoto: `main` = `fase2-supabase` = commit `0a7c45a` (merge feito em 29/09, nada divergente). O `git status` local pode mostrar "ahead 19" — é só a referência `origin/main` local velha, não diferença real.
- **Deploy:** CLI do Vercel (`npx vercel`, token no Keychain — ver seção Deploy). **Não** é via integração Git — push no GitHub não publica nada sozinho.
- **Dados:** Supabase (35 processos migrados e auditados 100% contra a planilha).
- **Planilha Google + `pericias-proxy.gs` (Apps Script):** o app **não usa mais**. **Decisão do Robert (02/10): deixar ligada e NÃO alterar nada — fica só como base histórica.** Não apagar, não editar, não desligar.
- **GitHub Pages antigo** (`perita-gabriellabento.github.io/controle/`, branch `gh-pages` `a9f7a62`): continua no ar, ainda servindo o app antigo da planilha (HTTP 200 conferido em 02/10). O redirect pro domínio novo ainda **não foi publicado** — ver pendências.

### Decisões fechadas (não reabrir)
- **Proposta de honorários:** finalizada. Campo "Trecho da Decisão" 100% livre (commit `cdf22f3`); modelo `.docx` corrigido e no ar.
- **Tabela ASPECON-GO 2026** (Resolução 001/2026) aplicada em `src/lib/types.ts`. A associação aboliu a coluna "valor médio" (`valorMedio: 0`, UI já trata). Itens 32/33 iguais a 2025 **de verdade** — a própria ASPECON não reajustou, confirmado no PDF oficial. Não é bug.
- **Senha da Gabi:** definida, ficou como está, **vai permanecer** (não trocar nem pedir troca).
- **Google Calendar:** atualizado (confirmado pelo Robert em 02/10). A Gabi **está ciente** de que precisa informar "desde quando está nesta fase" nos processos legados (campo de correção manual no app) — enquanto ela não preenche, os ~20 processos legados ficam sem evento de "prazo da fase" **de propósito** (não é esquecimento nem bug). Cria evento só pra quem tem `fase_changed_at` confiável.
- **Fase 4 (visual):** aplicada (badges pill+ponto, KPIs, favicon real, colunas congeladas corrigidas, contraste no modo claro).
- **Exportar Excel, anexos por processo, Realtime, retry de auth (`withRetry`):** prontos e em produção.

### Marcos históricos (resumo)
- 28/09: banco + app reescrito + Calendar + suíte de testes (hoje 68 testes, `npm run test:db`).
- 29/09: domínio próprio no ar, OAuth Google em produção, auditoria adversarial planilha × Supabase (2 bugs achados na SUÍTE, não no app — testes corrompiam dado real; corrigidos, dados reconciliados, backup em `backups/2026-09-29/`), paginação mobile 10→50, push + merge no `main`.

### Pendências reais (o que falta)
1. **Redirect do GitHub Pages antigo → `gabriellabento.com.br`.** Arquivos prontos, push que bloqueava já foi feito. Falta publicar na branch `gh-pages`. Risco enquanto não publica: link antigo ainda abre o app da planilha, que **não reflete mais os dados reais** (quem editar lá grava na planilha histórica, não no Supabase). Aguardando o Robert pedir.
2. **Teste de clique real ponta a ponta** (tabela, edição inline, undo, checklist, proposta/.docx, mobile, filtros) — itens do `INVENTARIO-DE-RECURSOS.md` seguem `[ ]` até Robert/Gabi confirmarem tela por tela. Só viram `[x]` com confirmação humana.
3. **Gabi preencher "desde quando está nesta fase"** nos processos legados (ela está ciente) → depois rodar sincronização do Calendar pra criar os eventos de prazo restantes.
4. **Pedidos de melhoria da Gabi (05/10/2026) — aguardando respostas dela.** Questionário publicado no artefato "Controle de Perícias" (https://claude.ai/artifact/JgVnvv474UqBisVi4Pp55n, o artefato único do projeto; o mockup antigo foi substituído, versões anteriores no histórico). Respostas salvam na coleção `respostas` do banco do artefato (ler com `ArtifactData`, action `list`, collection `respostas`; `meta/status` marca "terminei"). Pedidos: (a) calcular entrega a partir do início, mantendo data digitada à mão; (b) "Atrasado" não deve aparecer em fase pós-entrega (caso real, entrega 01/08 em fase Impugnação; hoje `dateStatus` em `PericiasTable.tsx` ignora a fase); (c) data/prazo da impugnação visível e criação de tarefa/evento ao mudar de fase (hoje só cria evento de Calendar via `/api/calendar/sync`, não cria tarefa de checklist). Também conferir `fase_changed_at` da A.M. = 08/10/2026 (futuro). **Não construir antes de ler as respostas.**

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
| `supabase-pericias-gabi-temp-password` | Senha de login da Gabi (`bentogabriella97@gmail.com`) — **definitiva, vai permanecer** (decisão 02/10) |
| `google-calendar-pericias-client-id` / `-client-secret` | OAuth Client do Google Cloud (projeto "Pericias GB Calendar") — servidor apenas |
| `vercel-pericias-gabi-token` | Token de deploy do Vercel — Access Token funcionando (deploys reais feitos com ele) |

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

**App OAuth publicado ("In production")** desde 29/09 — token não expira em 7 dias. Domínio `gabriellabento.com.br` no ar.

## Testes — `npm run test:db`

63 testes automatizados, nessa ordem, todos rodando contra o banco/servidor real (não é mock):
1. `supabase/tests/businessDays.test.js` — Páscoa, feriados, recesso forense, contagem de dias úteis
2. `supabase/tests/schema.test.js` — RLS (autenticado × anônimo em toda tabela), CHECK constraints, cascade delete, triggers, qualidade dos dados migrados
3. `supabase/tests/integration.test.js` — simula o fluxo real do app logado como a Gabi
4. `supabase/tests/api-security.test.js` — sobe o servidor Next.js de verdade e ataca as próprias rotas do Calendar (sem auth, CSRF forjado, replay de state)

Sempre rodar antes de considerar qualquer mudança de backend "pronta".

## Deploy (mudou — não é mais GitHub Pages)

Como tem rotas de servidor (Calendar), não usa `output: 'export'`/GitHub Pages. Produção é **Vercel** (`gabriellabento.com.br`). GitHub guarda só o código (`main`); push lá não publica. Processo:
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
| `pericias-proxy.gs`, planilha Google | **Ligados e intocados — base histórica.** O app não usa mais. NÃO alterar (decisão 02/10) |
