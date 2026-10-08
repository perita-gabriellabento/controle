# Controle de Perícias — Gabriella Bento

## ✅ Status atual (02/10/2026) — leia isto primeiro

**O app novo (Supabase + Calendar) está no ar e é a versão oficial:** https://gabriellabento.com.br (Vercel, projeto `controle-pericias`). A Gabi já usa no dia a dia. O que está no ar está correto (confirmado pelo Robert em 02/10).

### Onde está cada coisa
- **Código:** GitHub `perita-gabriellabento/controle` (repositório PÚBLICO), branch `main`, atualizado a cada deploy pelo `scripts/deploy.sh`, que também cria a tag `deploy-AAAAMMDD-HHMM` (a última tag que passou em todas as travas é a referência para provar regressão). Em 07/10 o histórico local foi limpo de dado de cliente antes do envio (backup do histórico antigo só neste Mac, branch `backup/pre-limpeza-2026-10-07`, NUNCA enviar essa branch).
- **Deploy:** SOMENTE `scripts/deploy.sh "mensagem"` (ver "Regras do projeto"). Não é via integração Git.
- **Dados:** Supabase (35 processos migrados e auditados 100% contra a planilha).
- **Planilha Google + `pericias-proxy.gs` (Apps Script):** o app **não usa mais**. **Decisão do Robert (02/10): deixar ligada e NÃO alterar nada — fica só como base histórica.** Não apagar, não editar, não desligar.
- **GitHub Pages antigo** (`perita-gabriellabento.github.io/controle/`): **DESATIVADO em 07/10/2026 a pedido do Robert** (confundia a Gabi). O GitHub NÃO deixa desligar o Pages pela API (422 "Deactivating GitHub pages for this repository is not allowed"), então a branch `gh-pages` agora só tem `index.html` + `404.html` que redirecionam para `gabriellabento.com.br` (commit `90feee1` na gh-pages; o app antigo continua no histórico dela, dá para voltar). Qualquer endereço antigo cai nessa página. Para desligar de vez: apagar a branch `gh-pages` (irreversível) ou desativar nas Settings > Pages pelo site do GitHub.

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
1. ~~Redirect do GitHub Pages antigo~~ **FEITO em 07/10/2026** (ver "Onde está cada coisa").
2. **Teste de clique real ponta a ponta** (tabela, edição inline, undo, checklist, proposta/.docx, mobile, filtros) — itens do `INVENTARIO-DE-RECURSOS.md` seguem `[ ]` até Robert/Gabi confirmarem tela por tela. Só viram `[x]` com confirmação humana.
3. **Gabi preencher "desde quando está nesta fase"** nos processos legados (ela está ciente) → depois rodar sincronização do Calendar pra criar os eventos de prazo restantes.
4. **Pedidos de melhoria da Gabi (05/10/2026)** — questionário no artefato único do projeto (https://claude.ai/artifact/JgVnvv474UqBisVi4Pp55n); ela respondeu por texto em 05/10 (copiado na conversa; respostas: entrega 30 dias corridos mantendo data à mão, sem "Atrasado" em Impugnação/Entregue com data em cinza, impugnação conta da intimação, tarefa "Impugnação" + evento na agenda, ver só no painel expandido, campo próprio editável, prazos por fase confirmados). Estado:
   - ✅ **No ar (deploy 05/10, commit `57f869b`)**: "Atrasado/Urgente" não aparece mais na coluna Entrega nas fases Impugnação de laudo, Entregue (e Revogado) (`dateStatus(iso, fase)` + `entregaTemAlerta` em `src/lib/prazos.ts`). A criação automática da tarefa "Impugnação" foi feita em 05/10 e REMOVIDA em 07/10 (ver abaixo). O evento de prazo na agenda já existia.
   - ⏸️ **Pronto mas DESLIGADO**: cálculo automático da entrega (`ENTREGA_AUTOMATICA_ATIVA = false` em `prazos.ts`; tabela e formulário Nova Perícia já ligados ao interruptor; testes em `supabase/tests/prazos.test.js`). Motivo: ela respondeu "30 dias corridos", mas nos dados dela 3 de 9 entregas estão no mesmo dia do mês seguinte (31 dias) e só 2 têm 30 exatos. **Perguntar à Gabi: 30 dias corridos ou 1 mês (mesmo dia do mês seguinte)?** Backfill não é necessário: nenhum processo ativo tem início sem entrega.
   - ❓ **Aguardando resposta da Gabi (não implementar no achismo)**: (a) "Data da impugnação" é o último dia do prazo ou o dia em que ela vai protocolar? E ao preencher substitui o prazo calculado (15 dias úteis) no evento da agenda? (b) criar a tarefa "Impugnação" também para os 3 processos que já estão em Impugnação (A.M., Sicoob, A.L.)? Hoje só cria ao mudar a fase. (c) A.M.: com a entrada na fase em 09/09/2026, os 15 dias úteis venceram em 30/09. A impugnação dela já foi feita?
   - 🔧 **Ação manual pendente**: corrigir "desde quando está nesta fase" da A.M. de 08/10/2026 (errada, futura) para **09/09/2026** pelo botão "corrigir" no painel expandido dela. Tem que ser pela tela (grava e sincroniza o evento da agenda); não alterar direto no banco, senão o evento antigo fica errado.
   - ✅ **Busca inteligente no ar (deploy 05/10, commit `245a1ae`)**: `src/lib/busca.ts`, estágio 1 exato ignorando acento/maiúscula/pontuação (número de processo também colado só com dígitos); estágio 2 tolerante a erro de digitação só quando nada casa (1 letra, 2 em palavra longa, troca de vizinhas). Busca também em fase e tipo. Teste `supabase/tests/busca.test.js` (29 casos).
   - 📨 **Rodada 2 do questionário publicada (05/10)** no mesmo artefato: 30 dias x 1 mês, semântica da "Data da impugnação" + efeito na agenda, tarefa para os 3 já em Impugnação, data de intimação e situação dos 3 processos (A.M., Sicoob, A.L.), conferência de "Atrasado" e da busca. Resposta vem por texto copiado ("RESPOSTAS DA GABI (RODADA 2)"). Depois de ler: ligar `ENTREGA_AUTOMATICA_ATIVA` com a regra confirmada (30 corridos já implementada; "1 mês" precisa de função nova + teste) e implementar o campo "Data da impugnação" (coluna nova `data_impugnacao` em `pericias`, sync do Calendar). Privacidade: o link do artefato é público, então usar só primeiro nome + final do processo nele.
   - ✅ **Rodada 2 respondida (05/10, 15:08) e aplicada (deploy commit `08a63d3`)**: (1) cálculo automático da entrega LIGADO, 30 dias corridos confirmado duas vezes (`ENTREGA_AUTOMATICA_ATIVA = true`); (2) painel expandido mostra "Prazo final" (conta de `fase_prazos` + data de entrada na fase, a mesma do Calendar) e, na fase Impugnação, chama a data de "Intimação (início do prazo de impugnação)".
   - ❓ **Aguardando a Gabi (rodada 3, não implementar no achismo)**: (a) já existe a tarefa GLOBAL "Resposta a impugnação de laudo" em toda perícia; a tarefa "Impugnação" criada ao mudar de fase seria quase duplicada. Ela pediu "Sim, criar agora para os 3" mas pode não saber da global: quer as duas ou só a existente? Tarefas dos 3 em Impugnação NÃO foram criadas por isso. (b) "Data da impugnação" = data da intimação (resposta dela), que é o mesmo que o "Nesta fase desde" que já existe; ela disse "nada na agenda" mas na rodada 1 marcou criar o evento do prazo. Hipótese forte: não precisa de campo novo (nada de coluna nova). Confirmar. (c) A.L.: impugnação já feita, sem data de intimação; o app está com 04/10 e o evento de prazo na agenda dele cai em 25/10 (alarme falso). Qual a data, apagar o evento, marcar a tarefa como concluída?
   - 🚨 **Prazos em risco (05/10)**: A.M., intimação 09/09 → prazo 15 úteis venceu em **30/09** e a impugnação AINDA NÃO foi feita. Sicoob, intimação 17/09 → vence em **08/10**; no app ainda está com 04/10 (daria 25/10, errado), ela ficou de corrigir pela tela. Verificar depois: `fase_changed_at` do Sicoob deve ser 2026-09-17T15:00Z (A.M. já está 2026-09-09).
   - 📨 **Rodada 3 (última) publicada no artefato (05/10)**: tarefa "Impugnação" x global "Resposta a impugnação de laudo", campo "Data da impugnação" x só intimação, evento do prazo na agenda, prorrogação por juiz, Sicoob corrigido?, A.L. (data, fase, evento, tarefa concluída). Resposta vem como texto "RESPOSTAS DA GABI (RODADA 3)". Ao receber: aplicar cada resposta (tarefa: parar/continuar criação automática em `PericiasTable.tsx` handleSave e criar nos 3 se pediu; Antonio: fase/evento/tarefa via tela ou sync; só criar coluna `data_impugnacao` se ela pediu campo separado) e verificar `fase_changed_at` do Sicoob = 2026-09-17.
   - 🗄️ **Arquivar / revogados (pergunta da Gabi, 07/10)**: `archivePericia` só põe `arquivado=true`; a linha fica no banco, some da tabela/KPIs (`applyFilters`, `KPICards`), os 3 eventos do Calendar são apagados, e NÃO existe tela de arquivados nem botão de reabrir (só sai no Excel exportado, coluna "Arquivado"). Já arquivados: 2 (uma em Entregue, uma em Proposta de honorários arquivada em 07/10, possivelmente revogada). Ela sugeriu categoria "Revogados". Perguntas r1 a r5 adicionadas à rodada 3 do artefato (tela Arquivados com Reabrir? fase "Revogado" x motivo ao arquivar? honorários nos totais? agenda? qual dos 2 é revogado?). Não implementar antes da resposta.
   - ✅ **Rodada 3 respondida (07/10, 15:03) e aplicada (deploy commit `b750228`)**: (1) tarefa "Impugnação": basta a global "Resposta a impugnação de laudo", então a criação automática foi REMOVIDA e a que o app criou em 07/10 no Sicoob X2 foi apagada (não estava marcada); (2) sem campo "Data da impugnação": basta a data da intimação ("Nesta fase desde"), evento do prazo na agenda mantido; prorrogação = ela troca a data de intimação e o app recalcula; (3) A.L.: ela mesma já mudou para Entregue e marcou a tarefa concluída em 07/10; (4) **fase "Revogado"** nova (cor própria, sem alerta de atrasado, FORA de todos os totais: KPIs incl. "Total Processos", rodapé, filtros A receber/Recebido; sync do Calendar apaga os eventos como no arquivado; `contaNosTotais` em `prazos.ts`; constraint `pericias_fase_check` alargada no banco em 07/10, backup em `backups/2026-10-07/`); M.P. virou fase Revogado (continua arquivado); (5) A.P. reaberta (`arquivado=false`; arquivada desde a migração; proposta Enviada R$ 4.900 está intacta).
   - ❓ **Ainda aberto com a Gabi**: (a) Sicoob: são DOIS processos em Impugnação, finais X1 (x K.) e X2 (x A.), ambos terminam em 0051; os dois estão com entrada em 29/09 (prazo 21/10), ela disse ter corrigido para 17/09 (prazo 08/10). Qual é o de 17/09? (b) A.M. está com 18/09 no app (prazo 09/10); era 09/09 (prazo 30/09 vencido). Confirmar se 18/09 é prorrogação ou digitação. (c) A.P.: só reaberta com fase Entregue; ela quer voltar para fase "Proposta de honorários" ou só refazer a proposta? (d) M.P. Revogado: manter arquivado (invisível) ou aparecer na tabela como Revogado? (e) Tela "Arquivados" com botão Reabrir: ela não respondeu; hoje arquivado só volta por edição direta no banco.
   - 📨 **Rodada 4 (FINAL) publicada no artefato (07/10)**: dados dos 2 Sicoob (finais X1 e X2: data de intimação e se a impugnação foi feita), correção no app, A.M. (18/09 x 09/09 e se feita), A.P. (o que excluiu, fase, manter ou limpar a proposta), M.P. (ficar arquivado ou aparecer como Revogado), tela Arquivados com Reabrir (sim/não), "Total Processos" conta revogados (sim/não). Resposta vem como texto "RESPOSTAS DA GABI (RODADA 4)". Robert pediu que seja a última; ao receber, aplicar tudo sem perguntar mais: A.P. fase/proposta via DB (conferir antes de escrever, ela edita ao mesmo tempo), M.P. `arquivado`, construir tela Arquivados se "sim" (`arquivado=false` + sync do Calendar), ajustar `KPICards` se contar revogados, e conferir `fase_changed_at` dos Sicoob/A.M. no banco.
   - ✅ **Rodada 4 (final) respondida (07/10, 18:18) e aplicada (deploy commit `bd5aa21`)**: (1) **tela "Arquivados"** no ar: ícone de arquivo no cabeçalho com contador, lista os arquivados com busca (a mesma tolerante) e botão Reabrir (`unarchivePericia` em `sheets.ts` + sync do Calendar para recriar eventos; componente `ArquivadosDialog.tsx`); (2) A.P.: arquivou sem querer, já estava reaberta, agora com fase "Proposta de honorários" (proposta Enviada R$ 4.900 mantida; alterada por DB só se ainda estivesse Entregue; o evento de prazo da fase só aparece na próxima edição/sincronização dela); (3) M.P. continua Revogado e arquivado (escondido), como ela pediu; (4) "Total Processos" continua sem contar revogados; (5) A.M.: 18/09 confirmada como a data certa, impugnação AINDA NÃO feita, prazo final 09/10/2026; (6) Sicoob (X1 e X2): ela marcou "Sim, corrigi" mas deixou data e situação em branco; o banco tem 29/09 nos dois (prazo 21/10), então 29/09 vale como a corrigida (antes ela havia falado em 17/09, prazo 08/10; não confirmado). Teste novo no `schema.test.js`: banco aceita "Revogado" e arquivar/reabrir vai e volta (39 passam).
   - 🏁 **Todas as perguntas da Gabi foram respondidas.** Nada pendente dela.
   - ✅ **Auditoria independente de 07/10 (2 revisores + reconferência) e correções, publicadas na tag `deploy-20261007-1952`**: (1) ALTO: reabrir um arquivado na mesma sessão não devolvia a linha à tabela; (2) entrega calculada: desfazer e falha de rede agora revertem as duas datas, edição manual dentro de 0,8 s não é sobrescrita, apagar o início apaga a entrega que era calculada, Desfazer no meio da gravação não deixa a entrega no banco; (3) datas parciais (ano 0002/0202) não geram prazo e o campo de data não grava ano fora de 1900-2100; `Date.UTC` com ano < 100 corrigido em `businessDays.ts`; (4) fila de sincronização do Calendar por perícia (`src/lib/calendarSync.ts`) contra eventos duplicados; (5) busca voltou aos campos de antes (sem fase/tipo, que traziam processo demais), com teto de 80 letras; (6) `check-privacidade.sh` e `deploy.sh` endurecidos. Pendente de decisão da Gabi/Robert, NÃO mexido: o rodapé da tabela mostra "N processos" contando os revogados (os valores em R$ do rodapé e o cartão "Total Processos" não contam).
   - 📨 **Rodada 5 (FECHAMENTO) publicada no artefato (08/10)**: nada mais depende de outra pergunta. Conteúdo: (A) data de intimação e situação de Sicoob x2 e Amélia (datas já vêm preenchidas com as do app); (B) data de entrada na fase de 16 processos sem evento de prazo (ou "sem prazo agora"); (C) pode criar de uma vez na agenda os eventos desses processos?; (D) rodapé "N processos" conta revogados?; (E) conferência de 17 funções do app (Funciona / Tem problema / Não usei) para marcar o inventário. Resposta: texto "RESPOSTAS DA GABI (RODADA 5)". **Plano ao receber, sem perguntar mais nada**: (1) datas que diferirem do banco: gravar `fase_changed_at` (15:00Z) só se ainda estiver igual ao valor lido antes (ela edita ao mesmo tempo); (2) linhas "SEM PRAZO AGORA": não mexer; (3) se C = sim: criar um botão "Sincronizar agenda" nas Configurações (percorre as perícias ativas pela fila `syncCalendar`, com progresso) e pedir ao Robert que clique uma vez; se não, nada; (4) D = sim: contar todos no rodapé (`filtered.length`), senão manter; (5) E: marcar `[x]` no `INVENTARIO-DE-RECURSOS.md` só o que ela marcou "Funciona"; "Tem problema" vira correção imediata; "Não usei" fica `[ ]`; (6) publicar tudo por `scripts/deploy.sh` depois de auditoria (regra 2).
   - Suíte: `test:db` verde (schema 37 + integração 6 + API 9 + prazos 22). O teste I do `schema.test.js` agora só compara com a planilha as linhas não editadas depois da migração e fica "pulado" quando não há nenhuma (hoje, todas já foram editadas pela Gabi). Backup do banco antes do deploy em `backups/2026-10-05/`.

## Regras do projeto (padrão Bia) — valem para toda mudança daqui pra frente

1. **Deploy só por `scripts/deploy.sh "mensagem"`.** Ele não tem flag para pular trava. Ordem: árvore limpa → privacidade → `tsc` → `npm run test:db` → build → backup do banco → push no GitHub → Vercel → conferência no ar → tag `deploy-AAAAMMDD-HHMM`. `scripts/deploy.sh --dry-run "msg"` roda as travas e para antes de publicar. Nunca usar `npx vercel` direto.
2. **Auditoria independente ANTES de publicar** (regra da Bia): 2 revisores read-only com prompts diferentes (um confere as regras de negócio contra o que a Gabi respondeu, outro tenta quebrar: dados, corridas, agenda). Achado CRÍTICO ou ALTO é corrigido antes do deploy. Se mexer em dinheiro, prazo ou agenda, um dos dois pode ser Opus.
3. **Cada regra nova ganha teste novo** (`prazos.test.js`, `busca.test.js`, `schema.test.js`). O `INVENTARIO-DE-RECURSOS.md` nunca perde item. Falha reproduzível na suíte é regressão minha até provar o contrário contra a última tag `deploy-*` que passou; nunca chamar de "pré-existente" sem essa prova.
4. **`npm run test:db` toca o banco de PRODUÇÃO** (não existe staging). Os testes criam linhas `TEST-*` e removem. Nunca alterar ou apagar linha que o teste não criou.
5. **Backup antes de qualquer escrita no banco** (`backups/…`, só local, no `.gitignore`, contém dado de cliente). O deploy já faz. Escrita direta no banco: ler antes, usar filtro condicional (ex.: `fase=eq.Entregue`) e conferir depois, porque a Gabi edita ao mesmo tempo. O que altera a agenda do Google Calendar passa pela tela (a sincronização exige a sessão dela).
6. **Privacidade: o repositório do GitHub é PÚBLICO.** Nenhum nome completo de parte nem número de processo real em arquivo versionado, commit ou artefato público (usar iniciais, números fictícios, primeiro nome + final do processo). `scripts/check-privacidade.sh` confere isso no deploy, comparando com os nomes que estão hoje no banco.
7. **Perguntas para a Gabi vão num artefato único** (https://claude.ai/artifact/JgVnvv474UqBisVi4Pp55n); ela responde e copia o texto. **Nunca decidir no achismo**: dúvida vira pergunta. O link do artefato é público, então só primeiro nome + final do processo.
8. **Documentar antes, durante e depois**: este arquivo é atualizado a cada mudança, e o estado vivo (código/banco) é conferido antes de afirmar qualquer coisa.
9. **Lacunas conhecidas (honestas)**: não há teste automatizado de TELA (só lógica pura, banco e API); não há staging; não há CI no GitHub (o `deploy.sh` é a trava, local). Qualquer mudança visual precisa ser olhada de verdade antes de dizer que está pronta.

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
scripts/deploy.sh "o que mudou, em uma frase"     # publica (com todas as travas)
scripts/deploy.sh --dry-run "o que mudou"         # só roda as travas
```
Rollback se algo der errado no ar: `npx vercel rollback` (volta para o deploy anterior, mantém o domínio). O token do Vercel fica no Keychain (`vercel-pericias-gabi-token`) e o `deploy.sh` lê de lá.
Configurar as mesmas variáveis de `.env.local` no painel do Vercel (Settings → Environment Variables), trocando `APP_URL` de `http://localhost:3000` pra URL real do deploy.

**Regra permanente, herdada da versão antiga:** nunca deployar código que represente regressão. Antes de qualquer deploy: usar `scripts/deploy.sh` (ver "Regras do projeto"), que roda `npx tsc --noEmit`, `npm run test:db` e `npm run build` e não deixa pular.

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
