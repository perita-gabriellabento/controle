'use client'

// Camada de dados — Supabase (substitui a antiga integração com Google Sheets/Apps Script).
// Mantém os mesmos nomes/assinaturas de função de antes pra não precisar tocar nos componentes
// além da troca de `row` (number) por `id` (uuid), que já foi feita separadamente.

import { supabase } from './supabaseClient'
import { Pericia, ChecklistItem, ApiResponse } from './types'
import { withRetry } from './utils'

let _cache: Pericia[] | null = null
let _cacheTs = 0
const CACHE_TTL = 30_000

let _checklistCache: ChecklistItem[] | null = null
let _checklistCacheTs = 0

// withRetry mora em utils.ts agora — compartilhado com anexos.ts, evita duplicar o mecanismo.
// Nunca aplicado a insert (appendPericia/addCustomTask): reenviar um insert que na
// verdade já teve sucesso no servidor (resposta perdida na rede) duplicaria a linha.

// ── Mapeamento camelCase (app) <-> snake_case (banco) ──────────

const CAMPO_MAP: Partial<Record<keyof Pericia, string>> = {
  qtd: 'qtd',
  origem: 'origem',
  poloAtivo: 'polo_ativo',
  poloPassivo: 'polo_passivo',
  uf: 'uf',
  cidade: 'cidade',
  vara: 'vara',
  numeroProcesso: 'numero_processo',
  codigoAcesso: 'codigo_acesso',
  assunto: 'assunto',
  tipo: 'tipo',
  valorPropostaHonorarios: 'valor_proposta_honorarios',
  valorHonorarios: 'valor_honorarios',
  honorariosRecebidos: 'honorarios_recebidos',
  solicitarDocs: 'solicitar_docs',
  inicio: 'inicio',
  entregaPrevista: 'entrega_prevista',
  fase: 'fase',
  propostaStatus: 'proposta_status',
  propostaValor: 'proposta_valor',
  propostaCategoria: 'proposta_categoria',
}

const MONEY_FIELDS = new Set(['valorPropostaHonorarios', 'valorHonorarios', 'honorariosRecebidos', 'propostaValor'])
const ENUM_FIELDS = new Set(['origem', 'uf', 'tipo', 'fase', 'propostaStatus'])
const DATE_FIELDS = new Set(['inicio', 'entregaPrevista'])

function toDbValue(campo: keyof Pericia, valor: string): unknown {
  if (campo === 'solicitarDocs') return valor === 'Sim' ? true : valor === 'Não' ? false : null
  if (campo === 'propostaCategoria') {
    const n = parseInt(valor, 10)
    return isNaN(n) ? null : n
  }
  if (MONEY_FIELDS.has(campo as string)) {
    if (!valor) return null
    const n = parseFloat(String(valor).replace(/[^\d.-]/g, ''))
    return isNaN(n) ? null : n
  }
  if (DATE_FIELDS.has(campo as string)) return valor || null
  if (ENUM_FIELDS.has(campo as string)) return valor || null
  return valor
}

function dbToPericia(row: any, doneMap: Map<string, string[]>): Pericia {
  return {
    id: row.id,
    createdAt: row.created_at,
    qtd: row.qtd || '',
    origem: row.origem || '',
    poloAtivo: row.polo_ativo || '',
    poloPassivo: row.polo_passivo || '',
    uf: row.uf || '',
    cidade: row.cidade || '',
    vara: row.vara || '',
    numeroProcesso: row.numero_processo || '',
    codigoAcesso: row.codigo_acesso || '',
    assunto: row.assunto || '',
    tipo: row.tipo || '',
    valorPropostaHonorarios: row.valor_proposta_honorarios != null ? String(row.valor_proposta_honorarios) : '',
    valorHonorarios: row.valor_honorarios != null ? String(row.valor_honorarios) : '',
    honorariosRecebidos: row.honorarios_recebidos != null ? String(row.honorarios_recebidos) : '',
    solicitarDocs: row.solicitar_docs === true ? 'Sim' : row.solicitar_docs === false ? 'Não' : '',
    inicio: row.inicio || '',
    entregaPrevista: row.entrega_prevista || '',
    fase: row.fase || '',
    arquivado: !!row.arquivado,
    checklistDone: JSON.stringify(doneMap.get(row.id) || []),
    propostaStatus: row.proposta_status || '',
    propostaValor: row.proposta_valor != null ? String(row.proposta_valor) : '',
    propostaCategoria: row.proposta_categoria != null ? String(row.proposta_categoria) : '',
    faseChangedAt: row.fase_changed_at || '',
  }
}

// ── Leitura ──────────────────────────────────────────────────

export async function fetchPericias(force = false): Promise<Pericia[]> {
  if (!force && _cache && Date.now() - _cacheTs < CACHE_TTL) return _cache

  // Retry aqui é importante: logo após login o token acabou de ser emitido, e uma
  // pequena diferença de relógio entre servidores (ou no próprio dispositivo) pode
  // rejeitar a primeira tentativa com "JWT issued at future" — passageiro, corrige
  // sozinho em menos de 1s. Sem retry, isso virava erro na tela pra usuária.
  const [{ data: rows, error }, { data: doneRows, error: doneErr }] = await Promise.all([
    withRetry<any[]>(() => supabase.from('pericias').select('*') as any),
    withRetry<any[]>(() => supabase.from('pericia_checklist_done').select('pericia_id, checklist_item_id') as any),
  ])
  if (error) throw new Error(`Erro ao buscar dados: ${error.message}`)
  if (doneErr) throw new Error(`Erro ao buscar checklist: ${doneErr.message}`)

  const doneMap = new Map<string, string[]>()
  for (const d of doneRows || []) {
    const list = doneMap.get(d.pericia_id) || []
    list.push(d.checklist_item_id)
    doneMap.set(d.pericia_id, list)
  }

  _cache = (rows || []).map(r => dbToPericia(r, doneMap))
  _cacheTs = Date.now()
  return _cache
}

export async function fetchChecklist(force = false): Promise<ChecklistItem[]> {
  if (!force && _checklistCache && Date.now() - _checklistCacheTs < 300_000) return _checklistCache
  const { data, error } = await withRetry<any[]>(() => supabase.from('checklist_items').select('id, descricao, pericia_id') as any)
  if (error) return []
  _checklistCache = (data || []).map(i => ({ id: i.id, descricao: i.descricao, pericia_row: i.pericia_id }))
  _checklistCacheTs = Date.now()
  return _checklistCache
}

export function invalidateChecklistCache(): void {
  _checklistCache = null
  _checklistCacheTs = 0
}

export function getChecklistCacheSync(): ChecklistItem[] {
  return _checklistCache ? [..._checklistCache] : []
}

// ── Prazos por fase (tabela fase_prazos, a mesma que o Calendar usa) ──
export type FasePrazo = { dias: number; dias_tipo: 'uteis' | 'corridos' }
let _fasePrazosCache: Record<string, FasePrazo> | null = null
export async function fetchFasePrazos(): Promise<Record<string, FasePrazo>> {
  if (_fasePrazosCache) return _fasePrazosCache
  const { data, error } = await withRetry<any[]>(() => supabase.from('fase_prazos').select('fase, dias, dias_tipo') as any)
  if (error || !data) return {}
  const mapa: Record<string, FasePrazo> = Object.fromEntries(data.map(r => [r.fase, { dias: r.dias, dias_tipo: r.dias_tipo }]))
  _fasePrazosCache = mapa
  return mapa
}

// ── Checklist: tarefas customizadas ───────────────────────────

export async function addCustomTask(pericia_row: string, descricao: string): Promise<ApiResponse & { id?: string }> {
  const { data, error } = await supabase.from('checklist_items').insert({ descricao, pericia_id: pericia_row }).select('id').single()
  if (error) return { ok: false, error: error.message }
  if (_checklistCache) _checklistCache = [..._checklistCache, { id: data.id, descricao, pericia_row }]
  return { ok: true, id: data.id }
}

export async function deleteCustomTask(task_id: string): Promise<ApiResponse> {
  const { error } = await withRetry(() => supabase.from('checklist_items').delete().eq('id', task_id) as any)
  if (error) return { ok: false, error: error.message }
  if (_checklistCache) _checklistCache = _checklistCache.filter(i => i.id !== task_id)
  return { ok: true }
}

// ── Cache local otimista ──────────────────────────────────────

export function invalidateCache(): void {
  _cache = null
  _cacheTs = 0
}

export function updateCache(id: string, campo: keyof Pericia, valor: string): void {
  if (!_cache) return
  _cache = _cache.map(p => p.id === id ? { ...p, [campo]: valor } : p)
}

export function revertCache(id: string, campo: keyof Pericia, oldValor: string): void {
  if (!_cache) return
  _cache = _cache.map(p => p.id === id ? { ...p, [campo]: oldValor } : p)
}

// ── Escrita ────────────────────────────────────────────────────

export async function updatePericia(id: string, campo: keyof Pericia, valor: string): Promise<ApiResponse> {
  const column = CAMPO_MAP[campo]
  if (!column) return { ok: false, error: `campo não permitido: ${String(campo)}` }
  const { error } = await withRetry(() => supabase.from('pericias').update({ [column]: toDbValue(campo, valor) }).eq('id', id) as any)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function appendPericia(fields: Omit<Pericia, 'id' | 'createdAt'>): Promise<ApiResponse> {
  if (!fields.poloAtivo || !fields.poloPassivo || !fields.numeroProcesso) {
    return { ok: false, error: 'poloAtivo, poloPassivo e numeroProcesso são obrigatórios' }
  }
  const payload: Record<string, unknown> = {
    polo_ativo: fields.poloAtivo,
    polo_passivo: fields.poloPassivo,
    numero_processo: fields.numeroProcesso,
  }
  for (const [campo, column] of Object.entries(CAMPO_MAP)) {
    const v = (fields as any)[campo]
    if (v !== undefined && !(campo in payload)) payload[column] = toDbValue(campo as keyof Pericia, v)
  }
  const { data, error } = await supabase.from('pericias').insert(payload).select('id').single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data.id }
}

// Correção manual de "desde quando está nesta fase" — usada só nos processos legados cuja
// fase_changed_at é um artefato da migração (não a data real de entrada na fase), pra permitir
// calcular o prazo com segurança sem criar alarme falso. dataISO = "YYYY-MM-DD" (meio-dia em
// Brasília = 15:00 UTC, fuso fixo -3, sem horário de verão — evita qualquer ambiguidade de fuso).
export async function correctFaseChangedAt(id: string, dataISO: string): Promise<ApiResponse> {
  const timestamp = `${dataISO}T15:00:00.000Z`
  const { error } = await withRetry(() => supabase.from('pericias').update({ fase_changed_at: timestamp }).eq('id', id) as any)
  if (error) return { ok: false, error: error.message }
  invalidateCache()
  return { ok: true }
}

export async function archivePericia(id: string): Promise<ApiResponse> {
  const { error } = await withRetry(() => supabase.from('pericias').update({ arquivado: true }).eq('id', id) as any)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deletePericia(id: string): Promise<ApiResponse> {
  const { error } = await withRetry(() => supabase.from('pericias').delete().eq('id', id) as any)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function saveChecklistStatus(periciaId: string, doneIds: string[]): Promise<ApiResponse> {
  updateCache(periciaId, 'checklistDone', JSON.stringify(doneIds))
  const { data: current, error: readErr } = await supabase.from('pericia_checklist_done').select('checklist_item_id').eq('pericia_id', periciaId)
  if (readErr) return { ok: false, error: readErr.message }
  const currentIds = new Set((current || []).map(r => r.checklist_item_id))
  const wantIds = new Set(doneIds)
  const toAdd = doneIds.filter(id => !currentIds.has(id))
  const toRemove = [...currentIds].filter(id => !wantIds.has(id))

  if (toAdd.length) {
    const { error } = await supabase.from('pericia_checklist_done').insert(toAdd.map(checklist_item_id => ({ pericia_id: periciaId, checklist_item_id })))
    if (error) return { ok: false, error: error.message }
  }
  if (toRemove.length) {
    const { error } = await supabase.from('pericia_checklist_done').delete().eq('pericia_id', periciaId).in('checklist_item_id', toRemove)
    if (error) return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function saveProposta(id: string, status: string, valor: string, categoria: string): Promise<ApiResponse> {
  updateCache(id, 'propostaStatus', status)
  updateCache(id, 'propostaValor', valor)
  updateCache(id, 'propostaCategoria', categoria)
  const { error } = await withRetry(() => supabase.from('pericias').update({
    proposta_status: status || null,
    proposta_valor: valor ? (parseFloat(valor) || null) : null,
    proposta_categoria: categoria ? (parseInt(categoria, 10) || null) : null,
  }).eq('id', id) as any)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ── Tempo real — substitui o antigo polling de 30s ────────────
// Só reage a mudanças de verdade (INSERT/UPDATE/DELETE), nunca busca a tabela inteira
// de novo sozinho. Evita o mesmo problema de egress que já aconteceu em outro projeto.

export function subscribeToChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('pericias-realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pericias' }, () => {
      invalidateCache()
      onChange()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'checklist_items' }, () => {
      invalidateChecklistCache()
      onChange()
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pericia_checklist_done' }, () => {
      invalidateCache()
      onChange()
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}
