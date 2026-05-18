# Controle de Perícias GB — Contexto do Projeto

## Visão Geral
Sistema web para gestão de perícias contábeis judiciais da **Gabriella Bento — Perita Contábil**.
Desktop-first. Deploy via GitHub Pages com domínio próprio da Gabriella.

---

## Fonte de Dados
- **Google Sheets:** https://docs.google.com/spreadsheets/d/1vgxXcTUTKdHeaQBWJRTg4eBH1zs1_u0ULLB25t4t_0k/edit
- A planilha é a fonte única de verdade (single source of truth)
- O sistema lê e escreve via **Google Sheets API**

### Colunas da planilha
| Coluna | Descrição |
|---|---|
| Qtd | Número sequencial |
| Origem | Autônoma ou Indicação |
| Polo Ativo | Nome do requerente |
| Polo Passivo | Nome do requerido |
| UF | Estado |
| Cidade | Cidade |
| Vara | Vara judicial |
| Número do Processo | Número CNJ do processo |
| Código de acesso | Código de acesso ao processo |
| Assunto | Tipo de perícia/assunto |
| Tipo | Particular ou Assistência Judiciária Gratuita |
| Valor honorários | Valor total dos honorários |
| Honorários Recebidos | Valor já recebido |
| Solicitar docs? | Sim/Não |
| Início | Data de início |
| Entrega/Entrega Prevista | Data de entrega ou previsão |
| Fase | Fase atual do processo |

---

## Fases e Significados
| Fase | Descrição |
|---|---|
| Entregue | Laudo entregue |
| Impugnação de laudo | Laudo entregue e impugnado — precisa responder à impugnação |
| Em diligência | Solicitou documentos, ainda não mandaram |
| Aguardando intimação para início | Recebeu 50%, esperando o juiz intimar para iniciar |
| Em produção | Trabalhos iniciados e em execução |
| Proposta de honorários | Em discussão do valor, partes não aceitam |
| Aguardando recebimento honorários | Valor aceito/fixado, esperando receber |
| Aguardando intimação para proposta de honorários | Viu o processo cedo demais, ainda não foi intimado para apresentar proposta |

---

## Identidade Visual — Brandkit

### Paleta de Cores
```
#0D0D14  — Fundo escuro (quase preto) — background principal
#14213D  — Azul navy profundo — superfícies/cards
#D4AF37  — Dourado principal — destaque, CTAs, ícones ativos
#F2E6B8  — Dourado claro/creme — textos secundários, bordas
#FAF7F1  — Off-white — textos principais no dark mode
```

### Tipografia
- **Cinzel** — serifada elegante (Google Fonts) — títulos, logo, headings
- **Montserrat** — sans-serif moderna (Google Fonts) — corpo, tabelas, dados

### Tom Visual
Elegante, jurídico, sofisticado. **Dark mode** com dourado como cor de destaque.

### Assets disponíveis (pasta gabriella_bento_brandkit/)
- `01_logo_principal.png` — logo fundo escuro
- `02_logo_fundo_claro.png` — logo fundo claro + monograma
- `logo fundo transparente.png` — logo PNG transparente (usar no sistema)
- `03_paleta_tipografia.png` — referência de paleta e tipografia
- `04_cartao_visitas.png` — referência de aplicação
- `05_papel_timbrado.png` — referência de aplicação
- `06_capa_laudo.png` — referência de aplicação
- `07_aplicacao_social.png` — referência de aplicação social
- `identidade_visual_gabriella_bento.pptx` — brandkit completo em PPTX

---

## Funcionalidades do Sistema

### Autenticação
- Login com **PIN numérico** (mínimo 4 dígitos)
- PIN armazenado com hash (SHA-256) no localStorage
- Sessão persiste por X horas (configurável)
- Tela de login com branding completo da Gabriella

### Dashboard / KPIs (topo)
- Total de processos ativos
- Total de honorários a receber (valor total - recebido)
- Total de honorários recebidos
- Processos em produção (contagem)
- Processos entregues (contagem)
- Valor em proposta (em negociação)

### Tabela Principal
- Todas as colunas da planilha
- Filtros: Fase, Tipo (Particular/AJG), UF, Origem
- Busca por texto (polo ativo, polo passivo, número do processo)
- Ordenação por qualquer coluna
- Badge visual por fase (cores distintas)
- Edição inline de células diretamente na tabela

### Edição Otimista (Optimistic UI)
- Ao editar qualquer campo → atualiza UI instantaneamente
- Em background → faz PATCH via Google Sheets API
- Se falhar → reverte com notificação toast
- Indicador sutil de "salvando..." durante sync

### Adicionar Perícia
- Botão "Nova Perícia" abre modal/drawer
- Formulário com todos os campos
- Ao salvar → adiciona linha na planilha via API

### Cores das Fases (badges)
- 🟢 **Entregue** → verde `#22C55E`
- 🔴 **Impugnação de laudo** → vermelho `#EF4444`
- 🔵 **Em diligência** → azul `#3B82F6`
- 🟡 **Aguardando intimação para início** → amarelo âmbar `#F59E0B`
- 🟠 **Em produção** → laranja `#F97316`
- ⚪ **Proposta de honorários** → cinza `#6B7280`
- 🟣 **Aguardando recebimento honorários** → roxo `#8B5CF6`
- ⚫ **Aguardando intimação para proposta** → cinza escuro `#374151`

---

## Tech Stack Recomendado

```
Framework:     Next.js 14 (App Router) ou Vite + React 18
Estilização:   Tailwind CSS + CSS Variables para o brandkit
Componentes:   shadcn/ui (customizado com o tema dark/dourado)
API Sheets:    Google Sheets API v4 (service account ou OAuth)
Auth:          PIN local com hash SHA-256, armazenado em localStorage
Deploy:        GitHub Pages ou Vercel (free tier)
Domínio:       Domínio próprio da Gabriella (a configurar)
```

---

## Estrutura de Arquivos Sugerida

```
/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Login (PIN)
│   │   └── dashboard/
│   │       └── page.tsx          # Painel principal
│   ├── components/
│   │   ├── KPICards.tsx
│   │   ├── PeriiciasTable.tsx
│   │   ├── FaseBadge.tsx
│   │   ├── EditableCell.tsx
│   │   └── NovaPericia.tsx
│   ├── lib/
│   │   ├── sheets.ts             # Google Sheets API client
│   │   ├── auth.ts               # PIN hash logic
│   │   └── types.ts              # TypeScript types
│   └── styles/
│       └── globals.css           # CSS Variables do brandkit
├── public/
│   └── logo.png                  # Logo transparente
└── CONTEXTO_PROJETO.md           # Este arquivo
```

---

## Domínio e Deploy
- Domínio: a confirmar (domínio da Gabriella)
- Repositório GitHub: a criar
- Deploy: Vercel (recomendado) ou GitHub Pages

---

## Observações
- O sistema deve ser **somente para uso pessoal** da Gabriella
- Interface em **português brasileiro**
- Prioridade: **simplicidade + elegância** — ela usa no dia a dia
- Responsivo para desktop (prioridade), mas não quebrar em tablet
- Sem backend complexo — tudo via Google Sheets API diretamente

---

*Arquivo de contexto gerado em 17/05/2026*
*Projeto: Controle de Perícias GB — Gabriella Bento Perita Contábil*
