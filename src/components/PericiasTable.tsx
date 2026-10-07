'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Archive, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, FileText, CheckSquare, Plus, Trash2, Loader2 as Spin, KeyRound, Copy, X, Paperclip, Download, Upload, CalendarClock, Pencil } from 'lucide-react'
import { Pericia, ChecklistItem, ASPECON_TABLE } from '@/lib/types'
import { updatePericia, archivePericia, deletePericia, updateCache, revertCache, invalidateCache, fetchChecklist, saveChecklistStatus, addCustomTask, deleteCustomTask, getChecklistCacheSync, correctFaseChangedAt, fetchFasePrazos, type FasePrazo } from '@/lib/sheets'
import { authedFetch } from '@/lib/supabaseClient'
import { formatCurrency, formatDate, parseCurrency, toTitleCase } from '@/lib/utils'
import { utcTimestampToBrazilDate, calcPrazo } from '@/lib/businessDays'
import { filtrarPorBusca } from '@/lib/busca'
import { syncCalendar } from '@/lib/calendarSync'
import { contaNosTotais } from '@/lib/prazos'
import { ENTREGA_AUTOMATICA_ATIVA, entregaAutomatica, entregaAoLimparInicio, entregaTemAlerta, FASE_IMPUGNACAO } from '@/lib/prazos'
import { fetchAnexos, uploadAnexo, deleteAnexo, getAnexoUrl, formatBytes, EXTENSOES_PERMITIDAS, type Anexo } from '@/lib/anexos'
import EditableCell from '@/components/EditableCell'
import FaseBadge from '@/components/FaseBadge'
import PropostaModal from '@/components/PropostaModal'
import type { Filters } from '@/components/FilterBar'

interface PericiasTableProps {
  pericias: Pericia[]
  filters: Filters
  onUpdate: () => void
}

type SortKey = keyof Pericia
type SortDir = 'asc' | 'desc' | null

const CAMPO_LABELS: Record<string, string> = {
  poloAtivo: 'Polo Ativo',
  poloPassivo: 'Polo Passivo',
  uf: 'UF',
  cidade: 'Cidade',
  vara: 'Vara',
  numeroProcesso: 'Nº Processo',
  assunto: 'Assunto',
  tipo: 'Tipo',
  fase: 'Status',
  valorHonorarios: 'Honorários',
  honorariosRecebidos: 'Recebido',
  solicitarDocs: 'Solicitar Docs',
  inicio: 'Início',
  entregaPrevista: 'Entrega Prevista',
  origem: 'Origem',
  codigoAcesso: 'Código de Acesso',
}

// Campos cuja mudança pode afetar algum dos 3 eventos do Google Calendar (Fase 3).
const CALENDAR_SYNC_FIELDS = new Set(['inicio', 'entregaPrevista', 'fase'])

function triggerCalendarSync(periciaId: string) {
  void syncCalendar(periciaId) // fila por perícia, ver src/lib/calendarSync.ts
}

function triggerCalendarCleanup(periciaId: string) {
  authedFetch('/api/calendar/sync', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ periciaId }),
  }).catch(() => {})
}

function dateStatus(isoDate: string, fase?: string): 'overdue' | 'soon' | 'ok' | null {
  if (!isoDate) return null
  // Laudo já entregue (Impugnação, Entregue): a data vira só registro, sem "Atrasado"/"Urgente".
  if (fase && !entregaTemAlerta(fase)) return 'ok'
  const parts = isoDate.split('-')
  if (parts.length !== 3) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  if (isNaN(d.getTime())) return null
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= 7) return 'soon'
  return 'ok'
}

function applyFilters(pericias: Pericia[], f: Filters): Pericia[] {
  let list = pericias.filter(p => !p.arquivado)
  if (f.search) {
    // Busca tolerante a acento e a erro de digitação (ver src/lib/busca.ts).
    list = filtrarPorBusca(list, f.search, p => [p.poloAtivo, p.poloPassivo, p.numeroProcesso, p.assunto, p.cidade, p.vara])
  }
  if (f.fase)   list = list.filter(p => p.fase === f.fase)
  if (f.tipo)   list = list.filter(p => p.tipo === f.tipo)
  if (f.uf)     list = list.filter(p => p.uf === f.uf)
  if (f.origem) list = list.filter(p => p.origem === f.origem)
  if (f.cardFilter === 'a_receber')   list = list.filter(p => contaNosTotais(p) && parseCurrency(p.valorHonorarios) > parseCurrency(p.honorariosRecebidos))
  if (f.cardFilter === 'recebido')    list = list.filter(p => contaNosTotais(p) && parseCurrency(p.honorariosRecebidos) > 0)
  if (f.cardFilter === 'em_producao') list = list.filter(p => p.fase === 'Em produção')
  if (f.cardFilter === 'entregue')    list = list.filter(p => p.fase === 'Entregue')
  if (f.cardFilter === 'em_proposta') list = list.filter(p => p.fase === 'Proposta de honorários')
  return list
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={12} className="text-text/35 flex-shrink-0" />
  if (sortDir === 'asc') return <ChevronUp size={11} className="text-gold flex-shrink-0" />
  return <ChevronDown size={11} className="text-gold flex-shrink-0" />
}

const PROPOSTA_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  'Pendente': { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
  'Enviada':  { bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6', border: 'rgba(59,130,246,0.3)'  },
  'Aceita':   { bg: 'rgba(34,197,94,0.15)',   text: '#22C55E', border: 'rgba(34,197,94,0.3)'   },
  'Recusada': { bg: 'rgba(239,68,68,0.15)',   text: '#EF4444', border: 'rgba(239,68,68,0.3)'   },
}

const COLS: { key: SortKey; label: string; width: string; align?: 'right' | 'center' }[] = [
  { key: 'qtd',                  label: '#',             width: ''             },
  { key: 'poloAtivo',            label: 'Polo Ativo',    width: ''             },
  { key: 'poloPassivo',          label: 'Polo Passivo',  width: ''             },
  { key: 'uf',                   label: 'UF',            width: 'w-12'         },
  { key: 'cidade',               label: 'Cidade',        width: 'min-w-[90px]' },
  { key: 'vara',                 label: 'Vara',          width: 'min-w-[90px]' },
  { key: 'numeroProcesso',       label: 'Processo',      width: 'min-w-[145px]' },
  { key: 'assunto',              label: 'Assunto',       width: 'min-w-[100px]' },
  { key: 'tipo',                 label: 'Tipo',          width: 'w-16'         },
  { key: 'fase',                 label: 'Fase',          width: 'min-w-[170px]' },
  { key: 'valorPropostaHonorarios', label: 'V. Proposta', width: 'min-w-[100px]', align: 'right' },
  { key: 'valorHonorarios',      label: 'Honor.',        width: 'min-w-[100px]', align: 'right' },
  { key: 'honorariosRecebidos',  label: 'Recebido',      width: 'min-w-[100px]', align: 'right' },
  { key: 'solicitarDocs',        label: 'Docs?',         width: 'w-14',         align: 'center' },
  { key: 'inicio',               label: 'Início',        width: 'min-w-[88px]' },
  { key: 'entregaPrevista',      label: 'Entrega',       width: 'min-w-[88px]' },
  { key: 'origem',               label: 'Origem',        width: 'min-w-[88px]' },
]

// ── Checklist expanded panel ──────────────────────────────────

interface ExpandedPanelProps {
  pericia: Pericia
  checklistItems: ChecklistItem[]
  onUpdate: () => void
  onOpenProposta: () => void
  onChecklistChange: () => void
  onAddItem: (item: ChecklistItem) => void
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 16
  const circ = 2 * Math.PI * r
  const offset = total > 0 ? circ * (1 - done / total) : circ
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const color = pct === 100 ? '#22C55E' : pct > 50 ? '#D4AF37' : '#9CA3AF'
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="flex-shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" strokeWidth="3" style={{ stroke: 'var(--border-hover)' }} />
      <circle cx="22" cy="22" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${circ}`} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 22 22)"
        style={{ transition: 'stroke-dashoffset 0.4s cubic-bezier(0.4,0,0.2,1)' }} />
      <text x="22" y="26" textAnchor="middle" fill={color} fontSize="10" fontWeight="700" fontFamily="Montserrat,sans-serif">
        {done}/{total}
      </text>
    </svg>
  )
}

// Correção manual de "desde quando está nesta fase" — só existe pra corrigir os processos
// legados cuja fase_changed_at é artefato da migração (não a data real). Depois de salvar,
// dispara sincronização do Calendar pra criar/corrigir o evento de prazo já com a data certa.
function FaseChangedCorrector({ pericia: p, onUpdate }: { pericia: Pericia; onUpdate: () => void }) {
  const [editing, setEditing] = useState(false)
  const currentDateISO = p.faseChangedAt ? utcTimestampToBrazilDate(p.faseChangedAt) : ''
  const [value, setValue] = useState(currentDateISO)
  const [saving, setSaving] = useState(false)
  const [prazoFase, setPrazoFase] = useState<FasePrazo | null>(null)
  useEffect(() => {
    let vivo = true
    fetchFasePrazos().then(m => { if (vivo) setPrazoFase(m[p.fase] || null) })
    return () => { vivo = false }
  }, [p.fase])
  // Data final do prazo da fase: mesma conta que o Calendar usa (fase_prazos + data de entrada na fase).
  const prazoFinal = prazoFase && currentDateISO ? calcPrazo(currentDateISO, prazoFase.dias, prazoFase.dias_tipo) : ''
  const naImpugnacao = p.fase === FASE_IMPUGNACAO

  async function handleSave() {
    if (!value) return
    setSaving(true)
    try {
      const res = await correctFaseChangedAt(p.id, value)
      if (!res.ok) { toast.error('Erro ao corrigir data', { description: res.error }); return }
      triggerCalendarSync(p.id)
      onUpdate()
      setEditing(false)
      toast.success('Data da fase corrigida', { description: `Nesta fase desde ${formatDate(value)} — prazo recalculado.` })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-2.5 text-[11.5px] font-montserrat" style={{ borderBottom: '1px solid var(--comp-row-border)', color: 'var(--muted)' }}>
      <CalendarClock size={12} className="flex-shrink-0" />
      {editing ? (
        <>
          <span>{naImpugnacao ? 'Data da intimação (início do prazo de impugnação):' : <>Nesta fase (&quot;{p.fase}&quot;) desde:</>}</span>
          <input
            type="date"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="rounded-md px-2 py-1 text-[12px] text-text outline-none"
            style={{ background: 'var(--comp-cell-input)', border: '1px solid var(--border)' }}
          />
          <button
            onClick={handleSave}
            disabled={saving || !value}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md disabled:opacity-40"
            style={{ background: 'rgba(212,175,55,0.18)', color: 'var(--gold)' }}
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={() => { setEditing(false); setValue(currentDateISO) }} className="text-[11px] text-text/40 px-2 py-1">
            Cancelar
          </button>
        </>
      ) : (
        <>
          <span>
            {naImpugnacao ? 'Intimação (início do prazo de impugnação) em' : <>Nesta fase (&quot;{p.fase}&quot;) desde</>} <b className="text-text/70">{currentDateISO ? formatDate(currentDateISO) : '—'}</b>
            {prazoFinal && prazoFase && (
              <> · Prazo final <b className="text-text/70">{formatDate(prazoFinal)}</b> ({prazoFase.dias} dias {prazoFase.dias_tipo === 'uteis' ? 'úteis' : 'corridos'})</>
            )}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md transition-colors"
            style={{ color: 'var(--gold)', opacity: 0.7 }}
            title="Corrigir data — use se essa data vier da migração e não da realidade"
          >
            <Pencil size={10} /> corrigir
          </button>
        </>
      )}
    </div>
  )
}

function ExpandedPanel({ pericia: p, checklistItems, onUpdate, onOpenProposta, onChecklistChange, onAddItem }: ExpandedPanelProps) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const globalItems = checklistItems.filter(i => !i.pericia_row)
  const customItems = checklistItems.filter(i => i.pericia_row === p.id)
  const allItems = [...globalItems, ...customItems]

  const doneIds: string[] = (() => {
    try { return JSON.parse(p.checklistDone || '[]') } catch { return [] }
  })()

  // Captura doneIds no momento do toggle para undo correto
  async function toggleTask(id: string) {
    const prevDone = [...doneIds]
    const wasChecked = prevDone.includes(id)
    const newDone = wasChecked ? prevDone.filter(d => d !== id) : [...prevDone, id]

    // Optimistic: update cache and re-render immediately
    updateCache(p.id, 'checklistDone', JSON.stringify(newDone))
    onUpdate()

    const label = allItems.find(i => i.id === id)?.descricao || 'Tarefa'
    toast.success(wasChecked ? 'Desmarcada' : 'Concluída', {
      description: label,
      action: {
        label: '↩ Desfazer',
        onClick: async () => {
          updateCache(p.id, 'checklistDone', JSON.stringify(prevDone))
          onUpdate()
          await saveChecklistStatus(p.id, prevDone)
          toast.info('Alteração desfeita', { duration: 2000 })
        },
      },
      duration: 3000,
    })

    try {
      await saveChecklistStatus(p.id, newDone)
    } catch {
      revertCache(p.id, 'checklistDone', JSON.stringify(prevDone))
      onUpdate()
      toast.error('Erro ao salvar tarefa. Tente novamente.')
    }
  }

  async function handleAddTask() {
    const text = newText.trim()
    if (!text) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await addCustomTask(p.id, text)
      if (!res.ok) throw new Error(res.error || 'Erro ao salvar')
      const newId = res.id!
      setNewText('')
      setAdding(false)
      onAddItem({ id: newId, descricao: text, pericia_row: p.id })
      onChecklistChange()
      toast.success('Tarefa adicionada', {
        description: text,
        action: {
          label: '↩ Desfazer',
          onClick: async () => {
            await deleteCustomTask(newId)
            onChecklistChange()
            toast.info('Tarefa removida', { duration: 2000 })
          },
        },
        duration: 4000,
      })
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteTask(id: string, descricao: string) {
    setDeletingId(id)
    try {
      await deleteCustomTask(id)
      const newDone = doneIds.filter(d => d !== id)
      if (newDone.length !== doneIds.length) {
        await saveChecklistStatus(p.id, newDone)
        onUpdate()
      }
      onChecklistChange()
      toast.success('Tarefa removida', {
        description: descricao,
        action: {
          label: '↩ Desfazer',
          onClick: async () => {
            await addCustomTask(p.id, descricao)
            onChecklistChange()
            toast.info('Tarefa restaurada', { duration: 2000 })
          },
        },
        duration: 4000,
      })
    } finally {
      setDeletingId(null)
    }
  }

  function cancelAdding() {
    setAdding(false)
    setNewText('')
    setSaveError('')
  }

  useEffect(() => {
    if (adding && inputRef.current) inputRef.current.focus({ preventScroll: true })
  }, [adding])

  const done = doneIds.filter(id => allItems.some(i => i.id === id)).length
  const total = allItems.length

  const catItem = p.propostaCategoria ? ASPECON_TABLE.find(i => i.id === parseInt(p.propostaCategoria!)) : null
  const propBadge = p.propostaStatus ? PROPOSTA_BADGE[p.propostaStatus] : null

  // Render function (não component) para evitar remount em cada render
  function renderItem(item: ChecklistItem, custom: boolean) {
    const checked = doneIds.includes(item.id)
    return (
      <div key={item.id} className="checklist-item flex items-center gap-2 w-full group py-1.5 px-2 rounded-lg transition-colors duration-100">
        <button
          onClick={() => toggleTask(item.id)}
          className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
        >
          <span
            className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center transition-all duration-200"
            style={{
              background: checked ? 'rgba(212,175,55,0.2)' : 'var(--comp-cell-hover)',
              border: `1.5px solid ${checked ? 'var(--gold)' : 'var(--border)'}`,
              boxShadow: checked ? '0 0 8px rgba(212,175,55,0.2)' : 'none',
            }}
          >
            {checked && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 3.5L3.8 6.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }} />
              </svg>
            )}
          </span>
          <span className={`text-[13px] font-montserrat leading-tight truncate transition-colors ${checked ? 'text-text/45 line-through' : 'text-text/80'}`}>
            {item.descricao}
          </span>
          {custom && (
            <span className="flex-shrink-0 text-[9px] font-montserrat px-1 rounded" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
              custom
            </span>
          )}
        </button>
        {custom && (
          <button
            onClick={() => handleDeleteTask(item.id, item.descricao)}
            disabled={deletingId === item.id}
            className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 hover:text-red-400/80 text-text/30 disabled:opacity-40"
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = '')}
            title="Remover tarefa"
          >
            {deletingId === item.id ? <Spin size={9} className="animate-spin" /> : <Trash2 size={9} />}
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, var(--comp-expand-from) 0%, var(--comp-expand-to) 100%)',
        borderTop: '1px solid var(--comp-row-border)',
      }}
    >
    <FaseChangedCorrector pericia={p} onUpdate={onUpdate} />
    <div
      className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-0"
    >
      {/* ── Checklist ── */}
      <div className="p-5 panel-divider-b panel-divider-r">
        <div className="flex items-center gap-3 mb-4">
          <ProgressRing done={done} total={total} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text/55 font-montserrat">Checklist de Tarefas</p>
            <p className="text-sm text-text/65 font-montserrat mt-0.5">
              {done === total && total > 0 ? (
                <span className="text-green-400/80">Todas as tarefas concluídas</span>
              ) : total === 0 ? (
                <span className="text-text/45">Nenhuma tarefa</span>
              ) : (
                <>{done} de {total} concluídas</>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto pr-1">
          {globalItems.length === 0 && customItems.length === 0 ? (
            <p className="text-[12px] text-text/40 font-montserrat italic px-2">
              Nenhuma tarefa global cadastrada na aba &quot;checklist&quot;.
            </p>
          ) : (
            globalItems.map(item => renderItem(item, false))
          )}
          {customItems.length > 0 && (
            <>
              <div className="my-2 flex items-center gap-2">
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                <span className="text-[9px] font-semibold uppercase tracking-wider font-montserrat" style={{ color: 'var(--gold)' }}>
                  Específicas
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              </div>
              {customItems.map(item => renderItem(item, true))}
            </>
          )}
        </div>

        {/* ── Nova tarefa ── */}
        <div className="mt-3">
          {adding ? (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--comp-toolbar)' }}
            >
              <div className="px-3 pt-3 pb-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] font-montserrat mb-2" style={{ color: 'var(--gold)' }}>
                  Nova Tarefa Específica
                </p>
                <input
                  ref={inputRef}
                  value={newText}
                  onChange={e => { setNewText(e.target.value); setSaveError('') }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddTask()
                    if (e.key === 'Escape') cancelAdding()
                  }}
                  placeholder="Descreva a tarefa para esta perícia…"
                  maxLength={120}
                  className="w-full rounded-lg px-3 py-2.5 text-[13px] font-montserrat text-text focus:outline-none"
                  style={{ background: 'var(--comp-cell-input)', border: `1px solid ${saveError ? 'rgba(239,68,68,0.5)' : 'var(--border)'}` }}
                />
                {saveError && (
                  <p className="text-[10px] text-red-400/80 font-montserrat mt-1 px-1">{saveError}</p>
                )}
              </div>
              <div className="flex items-center justify-start gap-2 px-3 py-2.5">
                <button
                  onClick={cancelAdding}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold font-montserrat transition-all duration-150"
                  style={{ background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddTask}
                  disabled={saving || !newText.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold font-cinzel tracking-wide transition-all duration-150 disabled:opacity-40"
                  style={{ background: 'rgba(212,175,55,0.18)', color: 'var(--gold)', border: '1px solid rgba(212,175,55,0.35)' }}
                >
                  {saving ? <Spin size={10} className="animate-spin" /> : <Plus size={11} />}
                  {saving ? 'Salvando…' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-1.5 text-[12px] font-montserrat transition-all duration-150 mt-1 px-2 py-1.5 rounded-lg"
              style={{ color: 'var(--gold)', opacity: 0.65 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
            >
              <Plus size={11} />
              Adicionar tarefa específica
            </button>
          )}
        </div>
      </div>

      {/* ── Proposta ── */}
      <div className="p-5 flex flex-col gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text/55 font-montserrat">Proposta de Honorários</p>

        {propBadge && p.propostaStatus && (
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full w-fit text-[11px] font-semibold font-montserrat"
            style={{ background: propBadge.bg, color: propBadge.text, border: `1px solid ${propBadge.border}` }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: propBadge.text }} />
            {p.propostaStatus}
          </div>
        )}

        {p.propostaValor && parseFloat(p.propostaValor) > 0 && (
          <div>
            <p className="text-[11px] text-text/45 uppercase tracking-wider font-montserrat">Valor proposto</p>
            <p className="pv text-lg font-bold font-montserrat" style={{ color: '#D4AF37' }}>
              {formatCurrency(p.propostaValor)}
            </p>
            {catItem && (
              <p className="text-[11px] text-text/40 font-montserrat mt-0.5 leading-tight">{catItem.descricao}</p>
            )}
          </div>
        )}

        <button
          onClick={onOpenProposta}
          className="btn-gold-shimmer mt-auto flex items-center justify-center gap-2 w-full py-3 rounded-xl text-[12px] font-cinzel font-semibold tracking-wider transition-all duration-200"
          style={{ color: '#1A2535' }}
        >
          <FileText size={12} />
          {p.propostaStatus && p.propostaStatus !== 'Pendente' ? 'Ver / Editar Proposta' : 'Gerar Proposta'}
        </button>
      </div>
    </div>

    <AnexosSection periciaId={p.id} />
    </div>
  )
}

// ── Anexos ──────────────────────────────────────────────────
function AnexosSection({ periciaId }: { periciaId: string }) {
  const [anexos, setAnexos] = useState<Anexo[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchAnexos(periciaId).then(setAnexos).catch(() => setAnexos([]))
  }, [periciaId])

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadAnexo(periciaId, file)
      if (!res.ok) { toast.error('Erro ao anexar', { description: res.error }); return }
      setAnexos(await fetchAnexos(periciaId))
      toast.success('Arquivo anexado', { description: file.name })
    } finally {
      setUploading(false)
    }
  }

  async function handleDownload(anexo: Anexo) {
    const url = await getAnexoUrl(anexo.storagePath)
    if (!url) { toast.error('Erro ao abrir arquivo'); return }
    window.open(url, '_blank')
  }

  async function handleDelete(anexo: Anexo) {
    if (!confirm(`Remover "${anexo.nomeArquivo}"?`)) return
    setDeletingId(anexo.id)
    try {
      const res = await deleteAnexo(anexo)
      if (!res.ok) { toast.error('Erro ao remover', { description: res.error }); return }
      setAnexos(prev => (prev || []).filter(a => a.id !== anexo.id))
      toast.success('Arquivo removido')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="p-5" style={{ borderTop: '1px solid var(--comp-row-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text/55 font-montserrat flex items-center gap-2">
          <Paperclip size={12} />
          Anexos {anexos && anexos.length > 0 ? `(${anexos.length})` : ''}
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-[12px] font-montserrat transition-all duration-150 px-2.5 py-1.5 rounded-lg disabled:opacity-40"
          style={{ color: 'var(--gold)', opacity: uploading ? 0.4 : 0.75 }}
        >
          {uploading ? <Spin size={11} className="animate-spin" /> : <Upload size={11} />}
          {uploading ? 'Enviando…' : 'Anexar arquivo'}
        </button>
        <input ref={fileInputRef} type="file" accept={EXTENSOES_PERMITIDAS} onChange={handleFileSelected} className="hidden" />
      </div>

      {anexos === null ? (
        <p className="text-[12px] text-text/40 font-montserrat italic">Carregando…</p>
      ) : anexos.length === 0 ? (
        <p className="text-[12px] text-text/40 font-montserrat italic">Nenhum arquivo anexado. PDF, imagem ou Word, até 10MB.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {anexos.map(a => (
            <div key={a.id} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg group" style={{ background: 'var(--comp-cell-hover)' }}>
              <FileText size={13} className="flex-shrink-0 text-text/40" />
              <span className="text-[13px] font-montserrat text-text/80 truncate flex-1 min-w-0">{a.nomeArquivo}</span>
              <span className="text-[11px] font-montserrat text-text/35 flex-shrink-0">{formatBytes(a.tamanhoBytes)}</span>
              <button onClick={() => handleDownload(a)} className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-text/40 hover:text-gold/80 transition-colors" title="Baixar">
                <Download size={12} />
              </button>
              <button
                onClick={() => handleDelete(a)}
                disabled={deletingId === a.id}
                className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-text/30 hover:text-red-400/80 transition-colors disabled:opacity-40"
                title="Remover"
              >
                {deletingId === a.id ? <Spin size={11} className="animate-spin" /> : <Trash2 size={11} />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function sortByFilter(list: Pericia[], sortBy: string): Pericia[] {
  const active = list.filter(p => p.fase !== 'Entregue')
  const entregue = list.filter(p => p.fase === 'Entregue')

  function sortGroup(arr: Pericia[]): Pericia[] {
    if (sortBy === 'entrega_desc') {
      return [...arr].sort((a, b) => {
        if (!a.entregaPrevista && !b.entregaPrevista) return 0
        if (!a.entregaPrevista) return 1
        if (!b.entregaPrevista) return -1
        return b.entregaPrevista.localeCompare(a.entregaPrevista)
      })
    }
    if (sortBy === 'recente') return [...arr].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    if (sortBy === 'antiga') return [...arr].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return [...arr].sort((a, b) => {
      if (!a.entregaPrevista && !b.entregaPrevista) return 0
      if (!a.entregaPrevista) return 1
      if (!b.entregaPrevista) return -1
      return a.entregaPrevista.localeCompare(b.entregaPrevista)
    })
  }

  return [...sortGroup(active), ...sortGroup(entregue)]
}

const MOBILE_PAGE = 50 // caseload real da Gabi (~35) cabe inteiro sem precisar tocar "Ver mais"

// ── Main table ────────────────────────────────────────────────

export default function PericiasTable({ pericias, filters, onUpdate }: PericiasTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [syncingCells, setSyncingCells] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>(getChecklistCacheSync)
  const [propostaRow, setPropostaRow] = useState<string | null>(null)
  const [editingCodigoRow, setEditingCodigoRow] = useState<string | null>(null)
  const [codigoPopupPos, setCodigoPopupPos] = useState<{ top: number; left: number } | null>(null)
  const [optimisticArchivedRows, setOptimisticArchivedRows] = useState<Set<string>>(new Set())
  const [mobileVisible, setMobileVisible] = useState(MOBILE_PAGE)
  const cellGenerations = useRef(new Map<string, number>())
  const scrollRef = useRef<HTMLDivElement>(null)
  const codigoInputRef = useRef<HTMLInputElement>(null)
  const pendingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const archiveCancellations = useRef(new Set<string>())

  useEffect(() => {
    if (editingCodigoRow !== null && codigoInputRef.current) {
      codigoInputRef.current.focus()
      codigoInputRef.current.select()
    }
  }, [editingCodigoRow])

  // Fecha popup ao clicar fora dele
  useEffect(() => {
    if (editingCodigoRow === null) return
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!t.closest('[data-codigo-popup]') && !t.closest('[data-codigo-btn]')) {
        setEditingCodigoRow(null)
        setCodigoPopupPos(null)
      }
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handler), 0)
    return () => { clearTimeout(id); document.removeEventListener('mousedown', handler) }
  }, [editingCodigoRow])

  useEffect(() => {
    fetchChecklist().then(setChecklistItems)
  }, [])

  // Reseta paginação mobile sempre que os filtros mudam
  useEffect(() => {
    setMobileVisible(MOBILE_PAGE)
  }, [filters])

  const refetchChecklist = useCallback(() => {
    fetchChecklist(true).then(setChecklistItems)
  }, [])

  const handleAddItem = useCallback((item: ChecklistItem) => {
    setChecklistItems(prev => [...prev, item])
  }, [])

  function toggleExpand(row: string) {
    setExpandedRows(s => {
      const ns = new Set(s)
      ns.has(row) ? ns.delete(row) : ns.add(row)
      return ns
    })
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortDir(null); setSortKey(null) }
      else setSortDir('asc')
    } else {
      setSortKey(key); setSortDir('asc')
    }
  }

  const handleSave = useCallback((row: string, campo: keyof Pericia, valor: string, oldValor: string, silent = false, companion?: { campo: keyof Pericia; valor: string; oldValor: string }) => {
    const cellKey = `${row}:${String(campo)}`
    const label = CAMPO_LABELS[String(campo)] || String(campo)

    const gen = (cellGenerations.current.get(cellKey) || 0) + 1
    cellGenerations.current.set(cellKey, gen)

    if (pendingTimers.current.has(cellKey)) {
      clearTimeout(pendingTimers.current.get(cellKey)!)
      pendingTimers.current.delete(cellKey)
    }

    // Campo "companheiro" (ex.: entrega calculada junto com o início): entra no cache agora, é gravado
    // DEPOIS do campo principal e ANTES da sincronização do Calendar, e desfaz/reverte junto com ele.
    // Se a Gabi mexer na célula do companheiro nesse meio-tempo, a edição dela vale e o app não grava o calculado.
    const compKey = companion ? `${row}:${String(companion.campo)}` : ''
    const compGen0 = companion ? (cellGenerations.current.get(compKey) || 0) : 0
    const compIntacto = () => !companion || (cellGenerations.current.get(compKey) || 0) === compGen0
    let companionGravado = false

    updateCache(row, campo, valor)
    if (companion) updateCache(row, companion.campo, companion.valor)
    onUpdate()
    if (!silent) setSyncingCells(s => new Set(s).add(cellKey))

    if (!silent) {
      toast.success(label, {
        description: companion ? (companion.valor ? `Entrega calculada: ${formatDate(companion.valor)} (30 dias corridos)` : 'Entrega calculada também foi limpa') : 'Alterado',
        action: {
          label: '↩ Desfazer',
          onClick: () => {
            if (cellGenerations.current.get(cellKey) !== gen) return
            cellGenerations.current.set(cellKey, gen + 1)
            if (pendingTimers.current.has(cellKey)) {
              clearTimeout(pendingTimers.current.get(cellKey)!)
              pendingTimers.current.delete(cellKey)
            }
            updateCache(row, campo, oldValor)
            const desfazeCompanheiro = !!companion && compIntacto()
            if (desfazeCompanheiro && companion) updateCache(row, companion.campo, companion.oldValor)
            setSyncingCells(s => { const ns = new Set(s); ns.delete(cellKey); return ns })
            onUpdate()
            const gravacoes: Promise<unknown>[] = [updatePericia(row, campo, oldValor)]
            if (desfazeCompanheiro && companion && companionGravado) gravacoes.push(updatePericia(row, companion.campo, companion.oldValor))
            // O Calendar também volta ao que era (antes o desfazer deixava o evento na data desfeita).
            Promise.all(gravacoes).then(() => { if (CALENDAR_SYNC_FIELDS.has(campo as string)) triggerCalendarSync(row) })
            toast.info('Alteração desfeita', { duration: 2000 })
          },
        },
        duration: 3000,
      })
    }

    pendingTimers.current.set(cellKey, setTimeout(async () => {
      if (cellGenerations.current.get(cellKey) !== gen) return
      pendingTimers.current.delete(cellKey)
      try {
        const res = await updatePericia(row, campo, valor)
        if (!res.ok) throw new Error(res.error || 'Falha ao salvar')
        if (companion && compIntacto()) {
          const r2 = await updatePericia(row, companion.campo, companion.valor)
          if (r2.ok) companionGravado = true
          else {
            toast.error('Não foi possível gravar a entrega calculada', { description: r2.error })
            invalidateCache()
            onUpdate()
          }
        }
        if (CALENDAR_SYNC_FIELDS.has(campo as string)) triggerCalendarSync(row)
      } catch (err) {
        revertCache(row, campo, oldValor)
        if (companion && compIntacto()) revertCache(row, companion.campo, companion.oldValor)
        onUpdate()
        if (!silent) toast.error(`Não foi possível salvar: ${err instanceof Error ? err.message : 'tente novamente'}`, { description: label })
      } finally {
        if (!silent) setSyncingCells(s => { const ns = new Set(s); ns.delete(cellKey); return ns })
      }
    }, silent ? 100 : 800))
  }, [onUpdate])

  // Início mudou: a entrega acompanha (início + 30 dias corridos) quando está vazia ou ainda é a
  // calculada antes; ao apagar o início, some a entrega que era calculada. Entrega digitada à mão
  // pela Gabi nunca é sobrescrita nem apagada.
  const handleInicioSave = useCallback((p: Pericia, valor: string) => {
    let companion: { campo: keyof Pericia; valor: string; oldValor: string } | undefined
    if (ENTREGA_AUTOMATICA_ATIVA) {
      if (valor === '') {
        const limpa = entregaAoLimparInicio({ inicioAntigo: p.inicio, entregaAtual: p.entregaPrevista })
        if (limpa !== null) companion = { campo: 'entregaPrevista', valor: limpa, oldValor: p.entregaPrevista }
      } else {
        const nova = entregaAutomatica({ inicioNovo: valor, inicioAntigo: p.inicio, entregaAtual: p.entregaPrevista })
        if (nova) companion = { campo: 'entregaPrevista', valor: nova, oldValor: p.entregaPrevista }
      }
    }
    handleSave(p.id, 'inicio', valor, p.inicio, false, companion)
  }, [handleSave])

  function calcHonorarios(proposta: string, origem: string): string {
    const n = parseFloat(proposta) || 0
    if (n <= 0) return ''
    return String(origem === 'Indicação' ? +(n * 0.4).toFixed(2) : n)
  }

  function saveCodigoAcesso(row: string, oldVal: string) {
    const val = (codigoInputRef.current?.value || '').trim()
    setEditingCodigoRow(null)
    setCodigoPopupPos(null)
    if (val !== oldVal) handleSave(row, 'codigoAcesso', val, oldVal)
  }

  const handleArchive = (row: string) => {
    setOptimisticArchivedRows(s => new Set(s).add(row))
    toast.success('Processo arquivado', {
      action: {
        label: '↩ Desfazer',
        onClick: () => {
          archiveCancellations.current.add(row)
          setOptimisticArchivedRows(s => { const ns = new Set(s); ns.delete(row); return ns })
          toast.info('Arquivamento cancelado', { duration: 2000 })
        },
      },
      duration: 4000,
    })
    setTimeout(async () => {
      if (archiveCancellations.current.has(row)) {
        archiveCancellations.current.delete(row)
        return
      }
      try {
        const res = await archivePericia(row)
        if (!res.ok) throw new Error(res.error || 'Erro ao arquivar')
        invalidateCache()
        onUpdate()
        triggerCalendarSync(row) // remove os eventos do Calendar (processo arquivado)
      } catch (err) {
        setOptimisticArchivedRows(s => { const ns = new Set(s); ns.delete(row); return ns })
        toast.error(err instanceof Error ? err.message : 'Erro ao arquivar')
      }
    }, 4200)
  }

  const handleDelete = async (row: string) => {
    if (!confirm('Excluir permanentemente este processo? Esta ação não pode ser desfeita.')) return
    setDeleting(row)
    try {
      // Limpa os eventos do Calendar ANTES de apagar (depois de apagada, a perícia
      // não existe mais pra rota de sync consultar os ids salvos).
      triggerCalendarCleanup(row)
      const res = await deletePericia(row)
      if (!res.ok) throw new Error(res.error || 'Erro ao excluir')
      invalidateCache()
      toast.success('Processo excluído permanentemente')
      onUpdate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao excluir')
    } finally {
      setDeleting(null)
    }
  }

  // Linha que o banco já confirmou como arquivada sai do conjunto de "escondidos otimistas": assim, se for
  // reaberta na tela Arquivados sem recarregar, ela volta pra tabela (auditoria 07/10/2026).
  useEffect(() => {
    setOptimisticArchivedRows(prev => {
      if (prev.size === 0) return prev
      const ns = new Set(prev)
      let mudou = false
      prev.forEach(id => { const p = pericias.find(x => x.id === id); if (p && p.arquivado) { ns.delete(id); mudou = true } })
      return mudou ? ns : prev
    })
  }, [pericias])

  const filtered = useMemo(() => {
    let list = applyFilters(pericias, filters)
    if (optimisticArchivedRows.size > 0) {
      list = list.filter(p => !optimisticArchivedRows.has(p.id))
    }
    if (sortKey && sortDir) {
      list = [...list].sort((a, b) => {
        const va = String(a[sortKey] ?? '')
        const vb = String(b[sortKey] ?? '')
        const cmp = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base', numeric: true })
        return sortDir === 'asc' ? cmp : -cmp
      })
    } else {
      list = sortByFilter(list, filters.sortBy)
    }
    return list
  }, [pericias, filters, sortKey, sortDir, optimisticArchivedRows])

  const propostaPericia = useMemo(
    () => propostaRow !== null ? (pericias.find(p => p.id === propostaRow) ?? null) : null,
    [propostaRow, pericias]
  )

  const globalChecklistItems = useMemo(() => checklistItems.filter(i => !i.pericia_row), [checklistItems])

  const { totalVProposta, totalHonorarios, totalRecebido, totalAReceber } = useMemo(() => {
    let vp = 0, hon = 0, rec = 0, ar = 0
    for (const p of filtered) {
      if (!contaNosTotais(p)) continue // revogado não entra nos totais do rodapé
      const h = parseCurrency(p.valorHonorarios)
      const r = parseCurrency(p.honorariosRecebidos)
      vp += parseCurrency(p.valorPropostaHonorarios || '')
      hon += h
      rec += r
      ar += Math.max(0, h - r)
    }
    return { totalVProposta: vp, totalHonorarios: hon, totalRecebido: rec, totalAReceber: ar }
  }, [filtered])

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl" style={{ background: 'var(--comp-table-bg)', border: '1px solid var(--comp-table-wrapper-border)', boxShadow: 'var(--comp-table-shadow)' }}>
        <div className="w-14 h-14 rounded-full bg-surface flex items-center justify-center mb-4 border border-[rgba(212,175,55,0.1)]">
          <Archive size={22} className="text-text/30" />
        </div>
        <p className="text-text/50 text-sm font-montserrat font-medium">Nenhum processo encontrado</p>
        <p className="text-text/40 text-xs mt-1 font-montserrat">Tente ajustar os filtros de busca</p>
      </div>
    )
  }

  const totalCols = COLS.length + 2 // expand + ação

  return (
    <>
      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="hidden md:block rounded-xl pericias-table-wrapper" style={{ background: 'var(--comp-table-bg)', border: '1px solid var(--comp-table-wrapper-border)', boxShadow: 'var(--comp-table-shadow)' }}>
        <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 318px)', paddingBottom: '2px', scrollbarGutter: 'stable' }}>
          <table className="w-full text-[14px] font-montserrat pericias-table">
            <thead className="sticky top-0 z-10 pericias-thead" style={{ background: 'linear-gradient(180deg, #16233A 0%, #111C26 100%)', borderBottom: '2px solid rgba(212,175,55,0.35)' }}>
              <tr>
                {/* Expand column — frozen 1 */}
                <th className="sticky-col px-2 py-4" style={{ width: 44, minWidth: 44, left: 0, zIndex: 5 }} />
                {/* Action column — frozen 2 */}
                <th className="sticky-col px-2 py-4" style={{ width: 136, minWidth: 136, left: 44, zIndex: 4 }}>
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-text/45">Ação</span>
                </th>
                {COLS.map((h, hi) => {
                  const isFrozen = hi < 3 // qtd, poloAtivo, poloPassivo
                  const isLast = hi === 2
                  // Mesma largura EXATA do <td> do corpo (linhas mais abaixo) — cabeçalho e
                  // corpo têm que casar em px, senão a coluna seguinte (fixada num left
                  // absoluto) sobrepõe/corta o cabeçalho durante o scroll horizontal.
                  const frozenWidth = hi === 0 ? 40 : 148
                  return (
                  <th
                    key={h.key}
                    className={`${isFrozen ? `sticky-col${isLast ? ' sticky-col-last' : ''}` : ''} ${h.width} px-3 py-4 select-none whitespace-nowrap cursor-pointer group ${h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'}`}
                    style={isFrozen ? {
                      width: frozenWidth,
                      minWidth: frozenWidth,
                      left: hi === 0 ? 180 : hi === 1 ? 220 : 368,
                      zIndex: hi === 0 ? 3 : hi === 1 ? 2 : 1,
                    } : undefined}
                    onClick={() => toggleSort(h.key)}
                  >
                    <div className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-text/60 group-hover:text-gold transition-colors ${h.align === 'right' ? 'justify-end' : h.align === 'center' ? 'justify-center' : ''}`}>
                      {h.label}
                      <SortIcon col={h.key} sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const isExpanded = expandedRows.has(p.id)
                const isEven = idx % 2 === 0
                const doneIds: string[] = (() => { try { return JSON.parse(p.checklistDone || '[]') } catch { return [] } })()
                const rowAllItems = [...globalChecklistItems, ...checklistItems.filter(i => i.pericia_row === p.id)]
                const rowDone = doneIds.filter(id => rowAllItems.some(i => i.id === id)).length
                const rowTotal = rowAllItems.length
                const rowPct = rowTotal > 0 ? Math.round((rowDone / rowTotal) * 100) : 0
                const rowProgColor = rowPct === 100 ? '#22C55E' : rowPct > 60 ? '#D4AF37' : rowPct > 0 ? '#F97316' : ''
                const checkPct = rowPct
                const propBadge = p.propostaStatus ? PROPOSTA_BADGE[p.propostaStatus] : null

                return (
                  <React.Fragment key={p.id}>
                    <tr
                      data-fase={p.fase}
                      className={`pericias-row transition-colors duration-100 ${isEven ? '' : 'pericias-row-odd'} ${isExpanded ? 'pericias-row-expanded' : ''}`}
                    >
                      {/* Expand button + mini progresso — frozen 1 */}
                      <td className="sticky-col px-2 py-1.5 text-center" style={{ width: 44, minWidth: 44, left: 0, zIndex: 5 }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <button
                            onClick={() => toggleExpand(p.id)}
                            className="w-9 h-9 rounded-xl flex items-center justify-center expand-btn tip"
                            data-expanded={String(isExpanded)}
                            data-tip={isExpanded ? 'Recolher' : 'Checklist e proposta'}
                          >
                            <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
                          </button>
                          {rowTotal > 0 && (
                            <div className="flex flex-col items-center gap-0.5 w-9">
                              <div className="w-9 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${rowPct}%`, background: rowProgColor || 'rgb(var(--color-text)/0.2)' }}
                                />
                              </div>
                              <span className="text-[10px] font-bold font-mono tabular-nums leading-none" style={{ color: rowProgColor || 'rgb(var(--color-text)/0.3)' }}>
                                {rowDone}/{rowTotal}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action cell — frozen 2 */}
                      <td className="sticky-col px-2 py-2.5" style={{ width: 136, minWidth: 136, left: 44, zIndex: 4 }}>
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => { setPropostaRow(p.id); setExpandedRows(s => new Set(s).add(p.id)) }}
                            className="tip w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                            data-tip="Proposta"
                            style={{
                              color: propBadge ? propBadge.text : 'var(--comp-expand-inactive)',
                              background: propBadge ? propBadge.bg : 'transparent',
                              border: `1px solid ${propBadge ? propBadge.border : 'transparent'}`,
                            }}
                          >
                            <FileText size={12} />
                          </button>
                          <button
                            data-codigo-btn
                            className="tip w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                            data-tip={p.codigoAcesso ? `Cód: ${p.codigoAcesso}` : 'Definir código de acesso'}
                            onClick={e => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              const pw = 232
                              const left = Math.min(rect.left, window.innerWidth - pw - 8)
                              const top = rect.bottom + 4 > window.innerHeight - 160 ? rect.top - 164 : rect.bottom + 4
                              setCodigoPopupPos({ top, left })
                              setEditingCodigoRow(p.id)
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.color = 'rgba(212,175,55,0.95)'
                              e.currentTarget.style.background = 'rgba(212,175,55,0.14)'
                              e.currentTarget.style.border = '1px solid rgba(212,175,55,0.3)'
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.color = p.codigoAcesso ? 'rgba(212,175,55,0.7)' : 'var(--comp-expand-inactive)'
                              e.currentTarget.style.background = p.codigoAcesso ? 'rgba(212,175,55,0.08)' : 'transparent'
                              e.currentTarget.style.border = p.codigoAcesso ? '1px solid rgba(212,175,55,0.2)' : '1px solid transparent'
                            }}
                            style={{
                              color: p.codigoAcesso ? 'rgba(212,175,55,0.7)' : 'var(--comp-expand-inactive)',
                              background: p.codigoAcesso ? 'rgba(212,175,55,0.08)' : 'transparent',
                              border: p.codigoAcesso ? '1px solid rgba(212,175,55,0.2)' : '1px solid transparent',
                            }}
                          >
                            <KeyRound size={12} />
                          </button>
                          {checklistItems.length > 0 && (
                            <button
                              onClick={() => toggleExpand(p.id)}
                              className="tip w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150"
                              data-tip={`Checklist ${rowDone}/${rowTotal}`}
                              style={{
                                color: checkPct === 100 ? '#22C55E' : checkPct > 0 ? '#D4AF37' : 'var(--comp-expand-inactive)',
                              }}
                            >
                              <CheckSquare size={13} />
                            </button>
                          )}
                          <button
                            className="tip w-7 h-7 rounded-lg flex items-center justify-center text-text/30 hover:text-amber-400/80 hover:bg-amber-400/10 transition-all duration-150"
                            onClick={() => handleArchive(p.id)}
                            data-tip="Arquivar (ocultar)"
                          >
                            <Archive size={13} />
                          </button>
                          <button
                            className="tip w-7 h-7 rounded-lg flex items-center justify-center text-text/30 hover:text-red-500/90 hover:bg-red-500/10 transition-all duration-150 disabled:opacity-40"
                            disabled={deleting === p.id}
                            onClick={() => handleDelete(p.id)}
                            data-tip="Excluir permanente"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>

                      {/* qtd — frozen 3 */}
                      <td className="sticky-col px-3 py-3 text-text/50 text-[11px] font-mono" style={{ width: 40, minWidth: 40, left: 180, zIndex: 3 }}>{p.qtd || idx + 1}</td>

                      {/* poloAtivo — frozen 4 */}
                      <td className="sticky-col px-3 py-3" style={{ width: 148, minWidth: 148, left: 220, zIndex: 2 }}>
                        <EditableCell value={p.poloAtivo} campo="poloAtivo"
                          syncing={syncingCells.has(`${p.id}:poloAtivo`)}
                          renderDisplay={v => <span className="text-text/85 text-[13px] font-medium leading-snug">{toTitleCase(v) || '—'}</span>}
                          onSave={v => handleSave(p.id, 'poloAtivo', v, p.poloAtivo)} />
                      </td>
                      {/* poloPassivo — frozen 5 (last frozen) */}
                      <td className="sticky-col sticky-col-last px-3 py-3" style={{ width: 148, minWidth: 148, left: 368, zIndex: 1 }}>
                        <EditableCell value={p.poloPassivo} campo="poloPassivo"
                          syncing={syncingCells.has(`${p.id}:poloPassivo`)}
                          renderDisplay={v => <span className="text-text/85 text-[13px] font-medium leading-snug">{toTitleCase(v) || '—'}</span>}
                          onSave={v => handleSave(p.id, 'poloPassivo', v, p.poloPassivo)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.uf} campo="uf" type="select-uf"
                          syncing={syncingCells.has(`${p.id}:uf`)}
                          onSave={v => handleSave(p.id, 'uf', v, p.uf)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.cidade} campo="cidade"
                          syncing={syncingCells.has(`${p.id}:cidade`)}
                          renderDisplay={v => <span className="text-text/75">{toTitleCase(v) || '—'}</span>}
                          onSave={v => handleSave(p.id, 'cidade', v, p.cidade)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.vara} campo="vara"
                          syncing={syncingCells.has(`${p.id}:vara`)}
                          renderDisplay={v => <span className="text-text/75">{toTitleCase(v) || '—'}</span>}
                          onSave={v => handleSave(p.id, 'vara', v, p.vara)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.numeroProcesso} campo="numeroProcesso"
                          className="font-mono text-[11px] tracking-wide"
                          syncing={syncingCells.has(`${p.id}:numeroProcesso`)}
                          onSave={v => handleSave(p.id, 'numeroProcesso', v, p.numeroProcesso)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.assunto} campo="assunto"
                          syncing={syncingCells.has(`${p.id}:assunto`)}
                          renderDisplay={v => <span className="text-text/75">{toTitleCase(v) || '—'}</span>}
                          onSave={v => handleSave(p.id, 'assunto', v, p.assunto)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.tipo} campo="tipo" type="select-tipo"
                          syncing={syncingCells.has(`${p.id}:tipo`)}
                          renderDisplay={v => (
                            <span className={`text-[12px] font-semibold ${v === 'Particular' ? 'text-gold/90' : 'text-blue-400/80'}`}>
                              {v === 'Assistência Judiciária Gratuita' ? 'AJG' : v || '—'}
                            </span>
                          )}
                          onSave={v => handleSave(p.id, 'tipo', v, p.tipo)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.fase} campo="fase" type="select-fase"
                          syncing={syncingCells.has(`${p.id}:fase`)}
                          renderDisplay={v => <FaseBadge fase={v as Parameters<typeof FaseBadge>[0]['fase']} size="sm" />}
                          onSave={v => handleSave(p.id, 'fase', v, p.fase)} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableCell value={p.valorPropostaHonorarios || ''} campo="valorPropostaHonorarios" type="currency"
                          className="justify-end"
                          syncing={syncingCells.has(`${p.id}:valorPropostaHonorarios`)}
                          renderDisplay={v => (
                            <span className={`pv ${v ? 'text-text/65 font-medium' : 'text-text/30'}`}>
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          onSave={v => {
                            handleSave(p.id, 'valorPropostaHonorarios', v, p.valorPropostaHonorarios || '')
                            handleSave(p.id, 'valorHonorarios', calcHonorarios(v, p.origem), p.valorHonorarios, true)
                          }} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableCell value={p.valorHonorarios} campo="valorHonorarios" type="currency"
                          className="justify-end"
                          syncing={syncingCells.has(`${p.id}:valorHonorarios`)}
                          renderDisplay={v => (
                            <span className={`pv ${v ? 'text-gold-light/90 font-semibold' : 'text-text/30'}`}>
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          onSave={v => handleSave(p.id, 'valorHonorarios', v, p.valorHonorarios)} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableCell value={p.honorariosRecebidos} campo="honorariosRecebidos" type="currency"
                          className="justify-end"
                          syncing={syncingCells.has(`${p.id}:honorariosRecebidos`)}
                          renderDisplay={v => (
                            <span className={`pv ${v ? 'text-green-400/85 font-semibold' : 'text-text/30'}`}>
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          onSave={v => handleSave(p.id, 'honorariosRecebidos', v, p.honorariosRecebidos)} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <EditableCell value={p.solicitarDocs} campo="solicitarDocs" type="select-docs"
                          syncing={syncingCells.has(`${p.id}:solicitarDocs`)}
                          renderDisplay={v => (
                            <span className={v === 'Sim' ? 'text-amber-400/90 font-bold text-[12px]' : v === 'Não' ? 'text-text/45 text-[12px]' : 'text-text/30 text-[12px]'}>{v || '—'}</span>
                          )}
                          onSave={v => handleSave(p.id, 'solicitarDocs', v, p.solicitarDocs)} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EditableCell value={p.inicio} campo="inicio" type="date"
                          syncing={syncingCells.has(`${p.id}:inicio`)}
                          renderDisplay={v => <span className="text-text/70 tabular-nums">{formatDate(v) || '—'}</span>}
                          onSave={v => handleInicioSave(p, v)} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EditableCell value={p.entregaPrevista} campo="entregaPrevista" type="date"
                          syncing={syncingCells.has(`${p.id}:entregaPrevista`)}
                          renderDisplay={v => {
                            const ds = dateStatus(v, p.fase)
                            if (!v) return <span className="text-text/30">—</span>
                            const fmt = formatDate(v)
                            if (ds === 'overdue') return (
                              <div className="flex flex-col gap-0.5">
                                <span className="tabular-nums font-semibold" style={{ color: 'rgba(239,68,68,0.9)' }}>{fmt}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(239,68,68,0.7)' }}>Atrasado</span>
                              </div>
                            )
                            if (ds === 'soon') return (
                              <div className="flex flex-col gap-0.5">
                                <span className="tabular-nums font-semibold" style={{ color: 'rgba(249,115,22,0.9)' }}>{fmt}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'rgba(249,115,22,0.7)' }}>Urgente</span>
                              </div>
                            )
                            return <span className="text-text/70 tabular-nums">{fmt}</span>
                          }}
                          onSave={v => handleSave(p.id, 'entregaPrevista', v, p.entregaPrevista)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.origem} campo="origem" type="select-origem"
                          syncing={syncingCells.has(`${p.id}:origem`)}
                          renderDisplay={v => (
                            <span className={`text-[12px] font-medium ${v === 'Indicação' ? 'text-purple-400/80' : 'text-text/65'}`}>{v || '—'}</span>
                          )}
                          onSave={v => {
                            handleSave(p.id, 'origem', v, p.origem)
                            handleSave(p.id, 'valorHonorarios', calcHonorarios(p.valorPropostaHonorarios || '', v), p.valorHonorarios, true)
                          }} />
                      </td>

                    </tr>

                    {/* Expanded panel row */}
                    <tr key={`exp-${p.id}`} className="expanded-panel-row">
                      <td colSpan={totalCols} style={{ padding: 0, position: 'sticky', left: 0, zIndex: 1 }}>
                        <div style={{
                          maxHeight: isExpanded ? '600px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}>
                          <ExpandedPanel
                            pericia={p}
                            checklistItems={checklistItems}
                            onUpdate={onUpdate}
                            onOpenProposta={() => setPropostaRow(p.id)}
                            onChecklistChange={refetchChecklist}
                            onAddItem={handleAddItem}
                          />
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 pericias-table-footer" style={{ borderTop: '1px solid var(--comp-row-border)' }}>
          <span className="text-[12px] font-semibold text-text/45 font-montserrat">
            {filtered.length} processo{filtered.length !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-5 flex-wrap">
            {totalVProposta > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">V. Proposta</span>
                <span className="pv text-[13px] font-bold font-montserrat tabular-nums text-text/55">{formatCurrency(totalVProposta)}</span>
              </div>
            )}
            {totalHonorarios > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">Honorários</span>
                <span className="pv text-[13px] font-bold font-montserrat tabular-nums" style={{ color: 'var(--gold)' }}>{formatCurrency(totalHonorarios)}</span>
              </div>
            )}
            {totalRecebido > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">Recebido</span>
                <span className="pv text-[13px] font-bold font-montserrat tabular-nums text-green-400/85">{formatCurrency(totalRecebido)}</span>
              </div>
            )}
            {totalAReceber > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">A Receber</span>
                <span className="pv text-[13px] font-bold font-montserrat tabular-nums" style={{ color: '#8B5CF6' }}>{formatCurrency(totalAReceber)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile cards ──────────────────────────────────────── */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.slice(0, mobileVisible).map((p, idx) => {
          const isExpanded = expandedRows.has(p.id)
          const doneIds: string[] = (() => { try { return JSON.parse(p.checklistDone || '[]') } catch { return [] } })()
          const rowAllItems = [...globalChecklistItems, ...checklistItems.filter(i => i.pericia_row === p.id)]
          const rowDone = doneIds.filter(id => rowAllItems.some(i => i.id === id)).length
          const rowTotal = rowAllItems.length
          const rowPct = rowTotal > 0 ? Math.round((rowDone / rowTotal) * 100) : 0
          const rowProgColor = rowPct === 100 ? '#22C55E' : rowPct > 60 ? '#D4AF37' : rowPct > 0 ? '#F97316' : ''
          const propBadge = p.propostaStatus ? PROPOSTA_BADGE[p.propostaStatus] : null
          const ds = dateStatus(p.entregaPrevista, p.fase)

          return (
            <div
              key={p.id}
              data-fase={p.fase}
              className="mobile-card rounded-2xl overflow-hidden"
            >
              {/* ── Topo: expand + nº + badge — sem botões de ação aqui ── */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                <button
                  onClick={() => toggleExpand(p.id)}
                  className="expand-btn w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  data-expanded={String(isExpanded)}
                >
                  <ChevronRight size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }} />
                </button>
                <span className="text-[11px] text-text/40 font-mono tabular-nums flex-shrink-0">{p.qtd || idx + 1}</span>
                {/* FaseBadge isolado — sem concorrência com action buttons */}
                <div className="flex-1 min-w-0">
                  <FaseBadge fase={p.fase as Parameters<typeof FaseBadge>[0]['fase']} size="sm" />
                </div>
              </div>

              {/* ── Nomes (toque para editar) ── */}
              <div className="px-4 pb-2">
                <EditableCell value={p.poloAtivo} campo="poloAtivo"
                  syncing={syncingCells.has(`${p.id}:poloAtivo`)}
                  renderDisplay={v => <span className="text-[15px] font-semibold text-text/90 leading-snug block">{toTitleCase(v) || '—'}</span>}
                  onSave={v => handleSave(p.id, 'poloAtivo', v, p.poloAtivo)} />
                <EditableCell value={p.poloPassivo} campo="poloPassivo"
                  syncing={syncingCells.has(`${p.id}:poloPassivo`)}
                  renderDisplay={v => <span className="text-[13px] text-text/55 leading-snug block mt-0.5">{toTitleCase(v) || '—'}</span>}
                  onSave={v => handleSave(p.id, 'poloPassivo', v, p.poloPassivo)} />
              </div>

              {/* ── Progress + data de entrega ── */}
              {(rowTotal > 0 || p.entregaPrevista) && (
                <div className="px-4 pb-2 flex items-center gap-3">
                  {rowTotal > 0 && (
                    <>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${rowPct}%`, background: rowProgColor || 'rgba(var(--color-text)/0.2)' }} />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums flex-shrink-0" style={{ color: rowProgColor || 'var(--muted)' }}>{rowDone}/{rowTotal}</span>
                    </>
                  )}
                  {p.entregaPrevista && (
                    <span className={`text-[11px] tabular-nums flex-shrink-0 ${rowTotal > 0 ? '' : 'ml-auto'} ${ds === 'overdue' ? 'text-red-400/90 font-semibold' : ds === 'soon' ? 'text-orange-400/90 font-semibold' : 'text-text/45'}`}>
                      {formatDate(p.entregaPrevista)}{ds === 'overdue' ? ' · Atrasado' : ds === 'soon' ? ' · Urgente' : ''}
                    </span>
                  )}
                </div>
              )}

              {/* ── Barra de ações — linha dedicada, sem sobreposição ── */}
              <div className="mobile-card-actions flex items-center justify-between px-3 py-2.5 gap-2">
                {/* Primários: com label */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setPropostaRow(p.id); setExpandedRows(s => new Set(s).add(p.id)) }}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold font-montserrat transition-all duration-150"
                    style={{
                      color: propBadge ? propBadge.text : 'var(--muted)',
                      background: propBadge ? propBadge.bg : 'var(--surface-2)',
                      border: `1px solid ${propBadge ? propBadge.border : 'var(--border)'}`,
                    }}
                  >
                    <FileText size={13} />
                    Proposta
                  </button>
                  <button
                    data-codigo-btn
                    className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold font-montserrat transition-all duration-150"
                    onClick={e => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      const pw = 260
                      const left = Math.max(8, Math.min(rect.left, window.innerWidth - pw - 8))
                      const top = rect.bottom + 4 > window.innerHeight - 200 ? rect.top - 172 : rect.bottom + 4
                      setCodigoPopupPos({ top, left })
                      setEditingCodigoRow(p.id)
                    }}
                    style={{
                      color: p.codigoAcesso ? 'rgba(212,175,55,0.85)' : 'var(--muted)',
                      background: p.codigoAcesso ? 'rgba(212,175,55,0.1)' : 'var(--surface-2)',
                      border: p.codigoAcesso ? '1px solid rgba(212,175,55,0.28)' : '1px solid var(--border)',
                    }}
                  >
                    <KeyRound size={13} />
                    Código
                  </button>
                </div>

                {/* Secundários: icon-only, alinhados à direita */}
                <div className="flex items-center gap-1">
                  <button
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
                    style={{ color: 'var(--muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                    onClick={() => handleArchive(p.id)}
                    title="Arquivar"
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(245,158,11,0.85)'; e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.borderColor = 'rgba(245,158,11,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <Archive size={14} />
                  </button>
                  <button
                    className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 disabled:opacity-40"
                    style={{ color: 'var(--muted)', background: 'var(--surface-2)', border: '1px solid var(--border)' }}
                    disabled={deleting === p.id}
                    onClick={() => handleDelete(p.id)}
                    title="Excluir permanente"
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(239,68,68,0.85)'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* ── Conteúdo expandido ── */}
              <div style={{ maxHeight: isExpanded ? '2400px' : '0', overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)' }}>
                <div className="mobile-expanded-section">
                  {/* Campos editáveis em grid */}
                  <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-4">

                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Status</span>
                      <EditableCell value={p.fase} campo="fase" type="select-fase"
                        syncing={syncingCells.has(`${p.id}:fase`)}
                        renderDisplay={v => <FaseBadge fase={v as Parameters<typeof FaseBadge>[0]['fase']} size="sm" />}
                        onSave={v => handleSave(p.id, 'fase', v, p.fase)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Vara</span>
                      <EditableCell value={p.vara} campo="vara"
                        syncing={syncingCells.has(`${p.id}:vara`)}
                        renderDisplay={v => <span className="text-[13px] text-text/75">{toTitleCase(v) || '—'}</span>}
                        onSave={v => handleSave(p.id, 'vara', v, p.vara)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Cidade / UF</span>
                      <div className="flex items-center gap-1.5">
                        <EditableCell value={p.cidade} campo="cidade"
                          syncing={syncingCells.has(`${p.id}:cidade`)}
                          renderDisplay={v => <span className="text-[13px] text-text/75">{toTitleCase(v) || '—'}</span>}
                          onSave={v => handleSave(p.id, 'cidade', v, p.cidade)} />
                        {p.uf && <span className="text-[11px] text-text/40 flex-shrink-0">· {p.uf}</span>}
                      </div>
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Nº Processo</span>
                      <EditableCell value={p.numeroProcesso} campo="numeroProcesso"
                        className="font-mono text-[11px] tracking-wide"
                        syncing={syncingCells.has(`${p.id}:numeroProcesso`)}
                        onSave={v => handleSave(p.id, 'numeroProcesso', v, p.numeroProcesso)} />
                    </div>

                    <div className="col-span-2 flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Assunto</span>
                      <EditableCell value={p.assunto} campo="assunto"
                        syncing={syncingCells.has(`${p.id}:assunto`)}
                        renderDisplay={v => <span className="text-[13px] text-text/75">{toTitleCase(v) || '—'}</span>}
                        onSave={v => handleSave(p.id, 'assunto', v, p.assunto)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Honorários</span>
                      <EditableCell value={p.valorHonorarios} campo="valorHonorarios" type="currency"
                        syncing={syncingCells.has(`${p.id}:valorHonorarios`)}
                        renderDisplay={v => <span className={`pv text-[14px] font-semibold ${v ? '' : 'text-text/30'}`} style={{ color: v ? 'var(--gold)' : undefined }}>{v ? formatCurrency(v) : '—'}</span>}
                        onSave={v => handleSave(p.id, 'valorHonorarios', v, p.valorHonorarios)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Recebido</span>
                      <EditableCell value={p.honorariosRecebidos} campo="honorariosRecebidos" type="currency"
                        syncing={syncingCells.has(`${p.id}:honorariosRecebidos`)}
                        renderDisplay={v => <span className={`pv text-[14px] font-semibold ${v ? 'text-green-400/85' : 'text-text/30'}`}>{v ? formatCurrency(v) : '—'}</span>}
                        onSave={v => handleSave(p.id, 'honorariosRecebidos', v, p.honorariosRecebidos)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Tipo</span>
                      <EditableCell value={p.tipo} campo="tipo" type="select-tipo"
                        syncing={syncingCells.has(`${p.id}:tipo`)}
                        renderDisplay={v => <span className={`text-[13px] font-semibold ${v === 'Particular' ? 'text-gold/90' : 'text-blue-400/80'}`}>{v === 'Assistência Judiciária Gratuita' ? 'AJG' : v || '—'}</span>}
                        onSave={v => handleSave(p.id, 'tipo', v, p.tipo)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Origem</span>
                      <EditableCell value={p.origem} campo="origem" type="select-origem"
                        syncing={syncingCells.has(`${p.id}:origem`)}
                        renderDisplay={v => <span className={`text-[13px] font-medium ${v === 'Indicação' ? 'text-purple-400/80' : 'text-text/65'}`}>{v || '—'}</span>}
                        onSave={v => { handleSave(p.id, 'origem', v, p.origem); handleSave(p.id, 'valorHonorarios', calcHonorarios(p.valorPropostaHonorarios || '', v), p.valorHonorarios, true) }} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Início</span>
                      <EditableCell value={p.inicio} campo="inicio" type="date"
                        syncing={syncingCells.has(`${p.id}:inicio`)}
                        renderDisplay={v => <span className="text-[13px] text-text/70 tabular-nums">{formatDate(v) || '—'}</span>}
                        onSave={v => handleInicioSave(p, v)} />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-text/40 font-montserrat">Entrega</span>
                      <EditableCell value={p.entregaPrevista} campo="entregaPrevista" type="date"
                        syncing={syncingCells.has(`${p.id}:entregaPrevista`)}
                        renderDisplay={v => {
                          const s = dateStatus(v, p.fase)
                          if (!v) return <span className="text-[13px] text-text/30">—</span>
                          return <span className={`text-[13px] tabular-nums font-semibold ${s === 'overdue' ? 'text-red-400/90' : s === 'soon' ? 'text-orange-400/90' : 'text-text/70'}`}>{formatDate(v)}</span>
                        }}
                        onSave={v => handleSave(p.id, 'entregaPrevista', v, p.entregaPrevista)} />
                    </div>
                  </div>

                  {/* Checklist + Proposta */}
                  <ExpandedPanel
                    pericia={p}
                    checklistItems={checklistItems}
                    onUpdate={onUpdate}
                    onOpenProposta={() => setPropostaRow(p.id)}
                    onChecklistChange={refetchChecklist}
                    onAddItem={handleAddItem}
                  />
                </div>
              </div>
            </div>
          )
        })}

        {/* ── Ver mais / Ver menos ── */}
        {filtered.length > MOBILE_PAGE && (
          mobileVisible < filtered.length ? (
            <button
              onClick={() => setMobileVisible(v => Math.min(v + MOBILE_PAGE, filtered.length))}
              className="mobile-ver-mais w-full flex items-center justify-center gap-2 h-12 rounded-2xl font-montserrat font-semibold text-[13px] tracking-wide transition-all duration-200 active:scale-[0.98]"
            >
              <ChevronDown size={16} strokeWidth={2} />
              Ver mais
              <span className="mobile-ver-mais-badge inline-flex items-center justify-center rounded-full text-[11px] font-bold px-2 py-0.5" style={{ minWidth: 28 }}>
                {filtered.length - mobileVisible}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setMobileVisible(MOBILE_PAGE)}
              className="mobile-ver-menos w-full flex items-center justify-center gap-2 h-11 rounded-2xl font-montserrat font-medium text-[12px] tracking-wide transition-all duration-200 active:scale-[0.98]"
            >
              <ChevronUp size={15} strokeWidth={2} />
              Ver menos
            </button>
          )
        )}

        {/* Footer totais mobile */}
        <div className="mobile-card-footer flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl">
          <span className="text-[12px] font-semibold text-text/45 font-montserrat">{filtered.length} processo{filtered.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-4 flex-wrap">
            {totalHonorarios > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">Honorários</span>
                <span className="pv text-[13px] font-bold tabular-nums" style={{ color: 'var(--gold)' }}>{formatCurrency(totalHonorarios)}</span>
              </div>
            )}
            {totalRecebido > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">Recebido</span>
                <span className="pv text-[13px] font-bold tabular-nums text-green-400/85">{formatCurrency(totalRecebido)}</span>
              </div>
            )}
            {totalAReceber > 0 && (
              <div className="flex flex-col items-end">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-text/35 font-montserrat">A Receber</span>
                <span className="pv text-[13px] font-bold tabular-nums" style={{ color: '#8B5CF6' }}>{formatCurrency(totalAReceber)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Proposta Modal */}
      {propostaPericia && (
        <PropostaModal
          pericia={propostaPericia}
          onClose={() => setPropostaRow(null)}
          onSaved={onUpdate}
        />
      )}

      {/* Código de Acesso popup — fixed, fora do overflow da tabela */}
      {editingCodigoRow !== null && codigoPopupPos && (() => {
        const ep = pericias.find(x => x.id === editingCodigoRow)
        if (!ep) return null
        return (
          <div
            data-codigo-popup
            className="codigo-popup rounded-2xl flex flex-col gap-3 p-4"
            style={{ position: 'fixed', top: codigoPopupPos.top, left: codigoPopupPos.left, zIndex: 9999, width: 260 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound size={13} style={{ color: 'var(--gold)', flexShrink: 0 }} />
                <span className="text-[11px] font-semibold uppercase tracking-wider font-montserrat" style={{ color: 'var(--gold)' }}>
                  Código de Acesso
                </span>
              </div>
              <button
                onClick={() => { setEditingCodigoRow(null); setCodigoPopupPos(null) }}
                className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                style={{ color: 'var(--muted)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--muted)' }}
              >
                <X size={12} />
              </button>
            </div>

            {/* Input */}
            <input
              ref={codigoInputRef}
              defaultValue={ep.codigoAcesso || ''}
              onKeyDown={e => {
                if (e.key === 'Enter') saveCodigoAcesso(editingCodigoRow, ep.codigoAcesso || '')
                if (e.key === 'Escape') { setEditingCodigoRow(null); setCodigoPopupPos(null) }
              }}
              className="codigo-popup-input rounded-xl px-3 py-2.5 text-[13px] font-mono w-full"
              placeholder="ex: AC2891"
              maxLength={60}
            />

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const val = ep.codigoAcesso || codigoInputRef.current?.value || ''
                  if (!val) return
                  navigator.clipboard.writeText(val)
                  toast.success('Código copiado', { duration: 1800 })
                  setEditingCodigoRow(null)
                  setCodigoPopupPos(null)
                }}
                disabled={!ep.codigoAcesso}
                className="flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-[11px] font-semibold font-montserrat transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--muted)' }}
                onMouseEnter={e => { if (ep.codigoAcesso) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)' }}
              >
                <Copy size={11} />
                Copiar
              </button>
              <button
                onClick={() => saveCodigoAcesso(editingCodigoRow, ep.codigoAcesso || '')}
                className="flex-1 py-2.5 rounded-xl text-[11px] font-semibold font-cinzel tracking-wide transition-all duration-150"
                style={{ background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.4)', color: 'var(--gold)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.3)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)' }}
              >
                Salvar
              </button>
            </div>
          </div>
        )
      })()}
    </>
  )
}
