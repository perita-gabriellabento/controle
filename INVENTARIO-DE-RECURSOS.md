# Inventário de Recursos — Controle de Perícias

> Checklist de tudo que o sistema atual faz, levantado lendo o código-fonte por completo (`PericiasTable.tsx`, `EditableCell.tsx`, `FilterBar.tsx`, `KPICards.tsx`, `NovaPericia.tsx`, `PropostaModal.tsx`, `FaseBadge.tsx`, `sheets.ts`, `auth.ts`, `types.ts`, `utils.ts`, `globals.css`, `layout.tsx`, `dashboard/page.tsx`, `page.tsx`).
>
> **Regra fixa pra reconstrução (Fase 2 em diante): nenhum item aqui pode desaparecer. Pode melhorar, pode mudar o mecanismo por dentro (ex: trocar polling por Realtime), nunca remover a capacidade que a Gabi já tem hoje.**

## Status (atualizado 02/10/2026)

Todo o código abaixo foi reescrito pra Supabase e **já está no `main` e em produção** (`gabriellabento.com.br`, ver `CLAUDE.md`) preservando essas funcionalidades **na leitura do código** — isto é, revisei cada componente linha a linha durante a migração e nenhuma capacidade foi removida do JSX/lógica.

**Confirmado por uso real em produção (não só leitura de código) até aqui:** proposta de honorários finalizada e no ar (confirmado pelo Robert em 02/10 — itens da seção Proposta abaixo seguem `[ ]` até conferência tela a tela), login (com erro de sessão investigado e corrigido de verdade), Google Calendar (eventos reais criados/atualizados na agenda da Gabi, incluindo enquanto ela usava o app durante uma auditoria), checklist (banco real, 68 testes automatizados), exportar Excel (arquivo real gerado e lido de volta por ferramenta independente), anexo de arquivo (upload/download real testado com RLS).

**O que ainda NÃO aconteceu: alguém clicando de verdade em cada botão/interação num navegador.** Os itens abaixo continuam `[ ]` por disciplina — não marco como confirmado só porque o código compila ou porque testei via API/script. Só viram `[x]` quando o Robert ou a Gabi realmente usar a tela e confirmar.

### Recursos novos desde a migração (não existiam na planilha antiga)
- **Anexar arquivo por processo** — PDF/imagem/Word até 10MB, painel expandido de cada perícia
- **Exportar para Excel** — botão no topo do dashboard, formatação real (cabeçalho, moeda, data, zebra)
- **Correção manual de "desde quando está nesta fase"** — resolve prazo de Calendar pros processos legados da migração
- **Sincronização automática do Calendar** — dispara ao editar início/entrega/fase, criar, arquivar ou excluir

## Autenticação / sessão
- [ ] Acesso protegido por credencial rápida, sessão persistente sem precisar logar toda hora
- [ ] Tela de troca de senha/PIN

## Tema
- [ ] Dark/light toggle, persistido entre sessões, dark como padrão
- [ ] Paleta completa nos dois temas, com hierarquia de superfícies (fundo/card/card elevado)
- [ ] Header com efeito glass/blur; toques ambientes (glow, textura sutil) na tela de login

## Modo privacidade
- [ ] Toggle único que borra TODOS os valores financeiros ao mesmo tempo — KPIs, tabela desktop, cards mobile, totais do rodapé, modal de proposta

## Tabela desktop
- [ ] Colunas congeladas (expand, ações, nº, polo ativo, polo passivo) com sombra de separação ao rolar
- [ ] Scroll horizontal e vertical dentro da própria tabela, cabeçalho sempre visível
- [ ] Ordenação clicável em qualquer coluna (3 estados: asc/desc/nenhum)
- [ ] Ordenação padrão: ativos por entrega mais próxima primeiro, entregues sempre por último
- [ ] Edição inline em toda coluna (texto, moeda, data, seletor) com um clique
- [ ] Debounce antes de salvar + indicador visual de "salvando"
- [ ] Desfazer (undo) via notificação, reflete no servidor também
- [ ] Zebra (linhas alternadas) + faixa colorida lateral por fase (8 cores)
- [ ] Cálculo automático: honorários = 40% da proposta quando origem é "Indicação", senão valor integral — recalcula ao editar proposta OU origem
- [ ] Indicador de prazo: atrasado / urgente (≤7 dias) / normal, com cor e rótulo
- [ ] Popup de código de acesso (editar, copiar, fechar), posicionado sem sair da tela
- [ ] Mini progresso do checklist por linha (fração + barra)
- [ ] Ações por linha: proposta, código de acesso, checklist, arquivar, excluir
- [ ] Arquivar com undo real (janela de alguns segundos antes de persistir)
- [ ] Excluir com confirmação, permanente
- [ ] Painel expansível por linha (checklist + resumo da proposta), animado
- [ ] Rodapé com totais (proposta, honorários, recebido, a receber) e contagem de processos

## Tabela mobile (cards)
- [ ] Mesma funcionalidade da tabela desktop, reorganizada em cards verticais
- [ ] Paginação incremental ("Ver mais", "Ver menos")
- [ ] Barra de ações própria, sem conflito com o toque de editar
- [ ] Mesmo accent de fase, mesmo rodapé de totais

## Checklist
- [ ] Tarefas globais + tarefas específicas por perícia
- [ ] Anel de progresso visual com cor dinâmica por percentual
- [ ] Marcar/desmarcar com undo
- [ ] Adicionar/excluir tarefa específica (globais não podem ser excluídas por aqui)
- [ ] Cache local para carregamento instantâneo

## Proposta de honorários
- [ ] Status (Pendente/Enviada/Aceita/Recusada) como seleção visual
- [ ] Seletor de categoria ASPECON com sugestão automática pela palavra-chave do assunto
- [ ] Valor sugerido preenche sozinho ao trocar categoria
- [ ] Valor por extenso calculado automaticamente
- [ ] Campos de texto livre editáveis (descrição do caso, escopo, itens do escopo)
- [ ] Geração de .docx com a identidade visual completa dela (timbrado, logo, cores) — **nunca gerar documento sem essa formatação**
- [ ] Excluir proposta
- [ ] Auto-preenchimento de tudo que o sistema já sabe (processo, natureza, partes, vara/comarca/UF) — ela nunca redigita dado que já existe

## Filtros e busca
- [ ] Busca textual (polo ativo, polo passivo, processo, assunto, cidade, vara)
- [ ] Filtros por fase, tipo, UF, origem
- [ ] Ordenação por data de entrega ou por recência
- [ ] KPIs clicáveis funcionando como atalho de filtro

## Formatação
- [ ] Title Case preservando siglas conhecidas em maiúsculas (LTDA, S/A, bancos, tribunais, etc.)
- [ ] Moeda em BRL, datas em formato brasileiro
- [ ] Nunca usar `new Date('YYYY-MM-DD')` no client (bug de fuso já mapeado no plano)

## Nova perícia
- [ ] Formulário completo, mesma regra automática de honorários por origem
- [ ] Validação dos campos obrigatórios

## Cabeçalho / geral
- [ ] Atualização automática dos dados (mecanismo pode/deve mudar pra Realtime — a função de "sempre atualizado" continua)
- [ ] Estado de erro com botão de tentar novamente
- [ ] Logo (a real, nunca substituir por aproximação) clicável recarrega

---
*Criado em 27/09/2026 como checklist vivo da reconstrução Sheets→Supabase. Atualizar aqui sempre que um recurso novo for confirmado ou um recurso antigo for intencionalmente descontinuado (com autorização explícita do Robert/Gabi, nunca por omissão).*
