-- ============================================================
-- schema.sql
-- Controle de Perícias GB — Gabriella Bento Perita Contábil
-- Substitui a Google Sheet + Apps Script por Postgres real (Supabase)
-- Rodar uma única vez no SQL Editor do projeto Supabase criado para este app.
-- ============================================================

-- ── Extensão para gen_random_uuid() ────────────────────────────
create extension if not exists pgcrypto;

-- ── Trigger genérico de updated_at ──────────────────────────────
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── pericias ─────────────────────────────────────────────────
create table if not exists pericias (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  qtd                       text,        -- número sequencial digitado à mão — mantido como texto livre, igual à planilha, sem cálculo automático
  origem                    text check (origem in ('Autônoma','Indicação')),
  polo_ativo                text not null,
  polo_passivo              text not null,
  uf                        text check (uf in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  cidade                    text,
  vara                      text,
  numero_processo           text not null,
  codigo_acesso             text,
  assunto                   text,
  tipo                      text check (tipo in ('Particular','Assistência Judiciária Gratuita')),

  valor_proposta_honorarios numeric(12,2),
  valor_honorarios          numeric(12,2),
  honorarios_recebidos      numeric(12,2),

  solicitar_docs            boolean,
  inicio                    date,
  entrega_prevista          date,

  fase                      text check (fase in (
                              'Entregue','Impugnação de laudo','Em diligência',
                              'Aguardando intimação para início','Em produção',
                              'Proposta de honorários','Aguardando recebimento honorários',
                              'Aguardando intimação para proposta de honorários'
                            )),
  arquivado                 boolean not null default false,

  proposta_status           text check (proposta_status in ('Pendente','Enviada','Aceita','Recusada')),
  proposta_valor            numeric(12,2),
  proposta_categoria        smallint check (proposta_categoria between 1 and 33), -- referencia ASPECON_TABLE (constante no código, sem FK)

  -- idempotência da sincronização com Google Calendar (Fase 3)
  -- prazo_fase = prazo calculado da fase atual (mais urgente, legal/processual)
  -- entrega = data de entrega prevista (estimativa geral da Gabi)
  -- inicio = data de início (informativo)
  google_event_id_inicio      text,
  google_event_id_entrega     text,
  google_event_id_prazo_fase  text,

  -- quando a perícia entrou na fase atual — base para o cálculo automático de prazo por fase (pedido da Gabi)
  fase_changed_at           timestamptz not null default now()
);

drop trigger if exists trg_pericias_updated_at on pericias;
create trigger trg_pericias_updated_at
  before update on pericias
  for each row execute function set_updated_at();

-- fase_changed_at só avança quando o valor de "fase" de fato muda (não em toda edição da linha)
create or replace function set_fase_changed_at()
returns trigger as $$
begin
  if tg_op = 'INSERT' then
    new.fase_changed_at = now();
  elsif new.fase is distinct from old.fase then
    new.fase_changed_at = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_pericias_fase_changed_at on pericias;
create trigger trg_pericias_fase_changed_at
  before insert or update on pericias
  for each row execute function set_fase_changed_at();

-- ── fase_prazos ──────────────────────────────────────────────
-- prazo (em dias) esperado para cada fase, contado a partir de fase_changed_at.
-- Usado para calcular automaticamente a data final prevista com base na fase atual (pedido da Gabi).
-- Uma fase sem linha aqui = sem prazo automático calculado (ex: "Entregue" e, segundo a Gabi, "Aguardando intimação para proposta de honorários").
create table if not exists fase_prazos (
  fase       text primary key,
  dias       integer not null check (dias > 0),
  dias_tipo  text not null check (dias_tipo in ('uteis','corridos'))
);

-- Seed com o que a Gabi confirmou (09/2026). "Entregue" e "Aguardando recebimento
-- honorários" ficam de fora — ela não deu prazo pra elas (a confirmar se é
-- intencional ou se esqueceu). "Aguardando intimação para proposta de
-- honorários" também fica de fora — ela confirmou explicitamente que não tem prazo.
insert into fase_prazos (fase, dias, dias_tipo) values
  ('Proposta de honorários', 5, 'uteis'),
  ('Impugnação de laudo', 15, 'uteis'),
  ('Em produção', 30, 'corridos'),
  ('Em diligência', 7, 'corridos'),
  ('Aguardando intimação para início', 15, 'uteis')
on conflict (fase) do update set dias = excluded.dias, dias_tipo = excluded.dias_tipo;

-- ── checklist_items ──────────────────────────────────────────
-- pericia_id nulo = tarefa global; preenchido = tarefa específica daquela perícia
create table if not exists checklist_items (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  descricao   text not null,
  pericia_id  uuid references pericias(id) on delete cascade
);

create index if not exists idx_checklist_items_pericia_id on checklist_items(pericia_id);

-- ── pericia_checklist_done ───────────────────────────────────
-- a linha existir = tarefa concluída para aquela perícia (substitui o JSON "[1,3,5]")
create table if not exists pericia_checklist_done (
  pericia_id        uuid not null references pericias(id) on delete cascade,
  checklist_item_id uuid not null references checklist_items(id) on delete cascade,
  done_at           timestamptz not null default now(),
  primary key (pericia_id, checklist_item_id)
);

-- ── google_calendar_tokens ───────────────────────────────────
-- singleton (1 única linha) — só a Gabi, só o servidor (service_role) acessa
create table if not exists google_calendar_tokens (
  id                        int primary key default 1 check (id = 1),
  refresh_token             text not null,
  access_token              text,
  access_token_expires_at   timestamptz,
  calendar_id               text not null default 'primary',
  updated_at                timestamptz not null default now()
);

drop trigger if exists trg_google_calendar_tokens_updated_at on google_calendar_tokens;
create trigger trg_google_calendar_tokens_updated_at
  before update on google_calendar_tokens
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- Só existe (e só existirá) uma usuária autenticada — a Gabi.
-- Por isso a policy é simples: qualquer sessão autenticada tem acesso completo.
-- Isso é seguro porque só a conta dela poderá existir/logar neste projeto.
-- ============================================================

alter table pericias enable row level security;
alter table checklist_items enable row level security;
alter table pericia_checklist_done enable row level security;
alter table google_calendar_tokens enable row level security;
alter table fase_prazos enable row level security;

create policy "authenticated_full_access" on pericias
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on checklist_items
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on pericia_checklist_done
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_full_access" on fase_prazos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- google_calendar_tokens: propositalmente SEM policy nenhuma.
-- RLS habilitado + zero policy = ninguém (nem "authenticated", nem "anon") acessa via API pública.
-- Só o service_role key (usado exclusivamente pelo servidor, nunca no browser) ignora RLS e consegue ler/escrever aqui.

-- ── oauth_pending_state ──────────────────────────────────────
-- Guarda o "state" (nonce anti-CSRF) do fluxo OAuth do Calendar entre o momento
-- em que /api/calendar/connect gera o link do Google e o momento em que
-- /api/calendar/oauth/callback recebe a volta — singleton, expira sozinho.
create table if not exists oauth_pending_state (
  id         int primary key default 1 check (id = 1),
  state      text not null,
  expires_at timestamptz not null
);

alter table oauth_pending_state enable row level security;
-- sem policy nenhuma: só service_role acessa (mesmo padrão do google_calendar_tokens)

-- ============================================================
-- Grants
-- Como "Automatically expose new tables" fica DESLIGADO no projeto (de propósito,
-- é a opção mais segura), o Supabase não concede acesso sozinho — precisa conceder
-- explicitamente. RLS continua sendo a proteção linha-a-linha; isso aqui é só o
-- acesso à tabela como um todo, pré-requisito pra RLS entrar em ação.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on pericias, checklist_items, pericia_checklist_done, fase_prazos to authenticated;
-- google_calendar_tokens: nenhum grant para anon/authenticated — só service_role (já coberto pelo "all tables" acima)

-- garante que tabelas criadas no futuro (via este mesmo schema.sql rodado pelo usuário postgres) já nasçam com o grant certo
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
