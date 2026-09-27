# Controle de Perícias — Gabriella Bento

## REGRA ABSOLUTA — NUNCA REGRESSÃO DE CÓDIGO

**Jamais deployar código que represente regressão.** Antes de qualquer deploy:
1. Confirmar que o `out/` foi gerado pelo build mais recente (`npm run build`)
2. Verificar timestamp dos arquivos fonte — todos devem ser anteriores ao build
3. O `gh-pages` substitui a branch inteira pelo `out/` — nunca mistura com versões antigas
4. Se houver dúvida, rodar `npm run build` novamente antes de deployar

---

## Stack

- **Next.js 14** App Router, `output: 'export'` (static export)
- **basePath:** `/controle` — `NEXT_PUBLIC_BASE_PATH=/controle`
- **Tailwind CSS** + CSS variables para temas dark/light
- **Backend:** Google Apps Script (GAS) REST — token `pericias_gb_2026`
- **Fontes:** Cinzel + Montserrat (Google Fonts)
- **Toasts:** Sonner
- **Geração .docx:** docxtemplater + pizzip (client-side)

## URLs e Repositório

- **Live:** https://perita-gabriellabento.github.io/controle/
- **Repo:** https://github.com/perita-gabriellabento/controle
- **Branch deploy:** `gh-pages`
- **Diretório:** `/tmp/pericias-gabi` (symlink — ver abaixo)

> Todos os caminhos abaixo apontam para o **mesmo diretório físico** (mesmo inode — macOS case-insensitive):
> - `/tmp/pericias-gabi` — symlink de trabalho
> - `/Users/robertmarques/Dropbox/Documentos/Controle de Péricias - Gabi`
> - `/Users/robertmarques/Dropbox/DOCUMENTOS/Controle de Péricias - Gabi`
>
> Editar qualquer um reflete nos três automaticamente. Nunca há risco de dessincronização.
> O symlink `/tmp/pericias-gabi` existe por causa de um bug do Next.js com caminhos Unicode/espaços.
> **Sempre trabalhar via `/tmp/pericias-gabi`.**

## Deploy

Conta GitHub: **perita-gabriellabento**  
Token salvo no keychain macOS.

```bash
# Recuperar token:
security find-internet-password -s github.com -a perita-gabriellabento -w

# Build + deploy completo:
cd /tmp/pericias-gabi
npm run build
TOKEN=$(security find-internet-password -s github.com -a perita-gabriellabento -w)
npx gh-pages -d out -b gh-pages --repo https://perita-gabriellabento:${TOKEN}@github.com/perita-gabriellabento/controle.git
```

> A conta `lifeb-web` configurada no `gh auth` padrão **não tem acesso** ao repo. Sempre usar o token da `perita-gabriellabento` na URL.

## Arquivos principais

| Arquivo | Responsabilidade |
|---|---|
| `src/app/dashboard/page.tsx` | Página principal — load, filtros, header |
| `src/components/PericiasTable.tsx` | Tabela (~1150 linhas) — edição inline, sticky cols, popup |
| `src/components/PropostaModal.tsx` | Modal de proposta de honorários |
| `src/components/FilterBar.tsx` | Barra de filtros |
| `src/components/KPICards.tsx` | Cards de KPI clicáveis |
| `src/components/NovaPericia.tsx` | Formulário de cadastro |
| `src/components/EditableCell.tsx` | Célula editável genérica |
| `src/lib/sheets.ts` | Cache + chamadas ao GAS (fetchPericias, fetchChecklist, etc.) |
| `src/lib/utils.ts` | formatCurrency, toTitleCase, valorParaExtenso, formatDate... |
| `src/lib/types.ts` | Tipos TypeScript + ASPECON_TABLE |
| `src/app/globals.css` | CSS variables, temas, sticky columns, animações |
| `public/template-proposta.docx` | Template Word para geração de proposta |

## Padrões de código

- **Otimismo primeiro:** atualizar cache local (`updateCache`) antes da API, reverter em erro
- **Debounce 800ms** nas edições inline — cancelar timer anterior se campo editado de novo
- **Undo via toast** (3s) — sempre persiste o revert no servidor via `updatePericia`
- **useMemo** para listas filtradas, totais do footer, checklistItems globais
- **Sticky columns:** `border-collapse: separate; border-spacing: 0` + `position: sticky` + `will-change: transform` + backgrounds com `!important` no light mode
- **Title Case:** `toTitleCase()` preserva siglas em CAIXA ALTA (LTDA, ME, S/A, BRB, C6, etc.)
- **Popups fixed:** usar `getBoundingClientRect()` + `position: fixed` + clamping de viewport

## Tema light mode — atenção CSS

A regra `[data-theme="light"] .pericias-table tbody .pericias-row td { background: #FFFFFF }` tem especificidade alta e sobrescreve o background das sticky cols. As sticky cols em light mode precisam de `!important` explícito para manter o background correto durante o scroll.

## Checklist e deploy checklist de tarefas

- Checklist global vem da aba "Checklist" da planilha via GAS
- Estado salvo por perícia no campo `checklistDone` (JSON array de IDs)
- Tarefas custom por perícia: `addCustomTask` / `deleteCustomTask`
- Cache de checklist: 5 minutos (`300_000ms`) — `getChecklistCacheSync()` para init síncrono
