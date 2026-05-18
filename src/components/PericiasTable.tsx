'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Archive, ChevronUp, ChevronDown, ChevronsUpDown, ChevronRight, FileText, CheckSquare, Plus, Trash2, Loader2 as Spin } from 'lucide-react'
import { Pericia, ChecklistItem, ASPECON_TABLE } from '@/lib/types'
import { updatePericia, archivePericia, updateCache, revertCache, invalidateCache, fetchChecklist, saveChecklistStatus, addCustomTask, deleteCustomTask } from '@/lib/sheets'
import { formatCurrency, formatDate } from '@/lib/utils'
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

const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

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
}

function parseMoney(v: string): number {
  if (!v) return 0
  const n = parseFloat(v.replace(/[^\d,.-]/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

function dateStatus(isoDate: string): 'overdue' | 'soon' | 'ok' | null {
  if (!isoDate) return null
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
    const q = f.search.toLowerCase()
    list = list.filter(p =>
      p.poloAtivo.toLowerCase().includes(q) ||
      p.poloPassivo.toLowerCase().includes(q) ||
      p.numeroProcesso.toLowerCase().includes(q) ||
      p.assunto.toLowerCase().includes(q) ||
      p.cidade.toLowerCase().includes(q) ||
      p.vara.toLowerCase().includes(q)
    )
  }
  if (f.fase)   list = list.filter(p => p.fase === f.fase)
  if (f.tipo)   list = list.filter(p => p.tipo === f.tipo)
  if (f.uf)     list = list.filter(p => p.uf === f.uf)
  if (f.origem) list = list.filter(p => p.origem === f.origem)
  if (f.cardFilter === 'a_receber')   list = list.filter(p => parseMoney(p.valorHonorarios) > parseMoney(p.honorariosRecebidos))
  if (f.cardFilter === 'recebido')    list = list.filter(p => parseMoney(p.honorariosRecebidos) > 0)
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
  { key: 'qtd',                  label: '#',             width: 'w-8'          },
  { key: 'poloAtivo',            label: 'Polo Ativo',    width: 'min-w-[130px]' },
  { key: 'poloPassivo',          label: 'Polo Passivo',  width: 'min-w-[130px]' },
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

function ExpandedPanel({ pericia: p, checklistItems, onUpdate, onOpenProposta, onChecklistChange, onAddItem }: ExpandedPanelProps) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const globalItems = checklistItems.filter(i => !i.pericia_row)
  const customItems = checklistItems.filter(i => i.pericia_row === p.row)
  const allItems = [...globalItems, ...customItems]

  const doneIds: number[] = (() => {
    try { return JSON.parse(p.checklistDone || '[]') } catch { return [] }
  })()

  // Captura doneIds no momento do toggle para undo correto
  async function toggleTask(id: number) {
    const prevDone = [...doneIds]
    const wasChecked = prevDone.includes(id)
    const newDone = wasChecked ? prevDone.filter(d => d !== id) : [...prevDone, id]

    // Optimistic: update cache and re-render immediately
    updateCache(p.row, 'checklistDone', JSON.stringify(newDone))
    onUpdate()

    const label = allItems.find(i => i.id === id)?.descricao || 'Tarefa'
    toast.success(wasChecked ? 'Desmarcada' : 'Concluída', {
      description: label,
      action: {
        label: '↩ Desfazer',
        onClick: async () => {
          updateCache(p.row, 'checklistDone', JSON.stringify(prevDone))
          onUpdate()
          await saveChecklistStatus(p.row, prevDone)
          toast.info('Alteração desfeita', { duration: 2000 })
        },
      },
      duration: 3000,
    })

    try {
      await saveChecklistStatus(p.row, newDone)
    } catch {
      revertCache(p.row, 'checklistDone', JSON.stringify(prevDone))
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
      const res = await addCustomTask(p.row, text)
      if (!res.ok) throw new Error(res.error || 'Erro ao salvar')
      const newId = res.id!
      setNewText('')
      setAdding(false)
      onAddItem({ id: newId, descricao: text, pericia_row: p.row })
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

  async function handleDeleteTask(id: number, descricao: string) {
    setDeletingId(id)
    try {
      await deleteCustomTask(id)
      const newDone = doneIds.filter(d => d !== id)
      if (newDone.length !== doneIds.length) {
        await saveChecklistStatus(p.row, newDone)
        onUpdate()
      }
      onChecklistChange()
      toast.success('Tarefa removida', {
        description: descricao,
        action: {
          label: '↩ Desfazer',
          onClick: async () => {
            await addCustomTask(p.row, descricao)
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
      className="grid grid-cols-1 sm:grid-cols-[1fr_280px] gap-0"
      style={{
        background: 'linear-gradient(135deg, var(--comp-expand-from) 0%, var(--comp-expand-to) 100%)',
        borderTop: '1px solid var(--comp-row-border)',
      }}
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
  )
}

// ── Main table ────────────────────────────────────────────────

export default function PericiasTable({ pericias, filters, onUpdate }: PericiasTableProps) {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [archiving, setArchiving] = useState<number | null>(null)
  const [syncingCells, setSyncingCells] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([])
  const [propostaRow, setPropostaRow] = useState<number | null>(null)
  const cellGenerations = useRef(new Map<string, number>())

  useEffect(() => {
    fetchChecklist().then(setChecklistItems)
  }, [])

  const refetchChecklist = useCallback(() => {
    fetchChecklist(true).then(setChecklistItems)
  }, [])

  const handleAddItem = useCallback((item: ChecklistItem) => {
    setChecklistItems(prev => [...prev, item])
  }, [])

  function toggleExpand(row: number) {
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

  const handleSave = useCallback((row: number, campo: keyof Pericia, valor: string, oldValor: string, silent = false) => {
    const cellKey = `${row}:${String(campo)}`
    const label = CAMPO_LABELS[String(campo)] || String(campo)

    const gen = (cellGenerations.current.get(cellKey) || 0) + 1
    cellGenerations.current.set(cellKey, gen)

    if (pendingTimers.has(cellKey)) {
      clearTimeout(pendingTimers.get(cellKey)!)
      pendingTimers.delete(cellKey)
    }

    updateCache(row, campo, valor)
    onUpdate()
    if (!silent) setSyncingCells(s => new Set(s).add(cellKey))

    if (!silent) {
      toast.success(label, {
        description: 'Alterado',
        action: {
          label: '↩ Desfazer',
          onClick: () => {
            if (cellGenerations.current.get(cellKey) !== gen) return
            cellGenerations.current.set(cellKey, gen + 1)
            if (pendingTimers.has(cellKey)) {
              clearTimeout(pendingTimers.get(cellKey)!)
              pendingTimers.delete(cellKey)
            }
            updateCache(row, campo, oldValor)
            setSyncingCells(s => { const ns = new Set(s); ns.delete(cellKey); return ns })
            onUpdate()
            toast.info('Alteração desfeita', { duration: 2000 })
          },
        },
        duration: 3000,
      })
    }

    pendingTimers.set(cellKey, setTimeout(async () => {
      if (cellGenerations.current.get(cellKey) !== gen) return
      pendingTimers.delete(cellKey)
      try {
        const res = await updatePericia(row, campo, valor)
        if (!res.ok) throw new Error(res.error || 'Falha ao salvar')
      } catch (err) {
        revertCache(row, campo, oldValor)
        onUpdate()
        if (!silent) toast.error(`Não foi possível salvar: ${err instanceof Error ? err.message : 'tente novamente'}`, { description: label })
      } finally {
        if (!silent) setSyncingCells(s => { const ns = new Set(s); ns.delete(cellKey); return ns })
      }
    }, silent ? 150 : 3000))
  }, [onUpdate])

  function calcHonorarios(proposta: string, origem: string): string {
    const n = parseFloat(proposta) || 0
    if (n <= 0) return ''
    return String(origem === 'Indicação' ? +(n * 0.4).toFixed(2) : n)
  }

  const handleArchive = async (row: number) => {
    if (!confirm('Arquivar este processo? Ele não aparecerá mais na listagem principal.')) return
    setArchiving(row)
    try {
      const res = await archivePericia(row)
      if (!res.ok) throw new Error(res.error || 'Erro ao arquivar')
      invalidateCache()
      toast.success('Processo arquivado com sucesso')
      onUpdate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao arquivar')
    } finally {
      setArchiving(null)
    }
  }

  let filtered = applyFilters(pericias, filters)
  if (sortKey && sortDir) {
    filtered = [...filtered].sort((a, b) => {
      const va = String(a[sortKey] ?? '')
      const vb = String(b[sortKey] ?? '')
      const cmp = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base', numeric: true })
      return sortDir === 'asc' ? cmp : -cmp
    })
  }

  const propostaPericia = propostaRow !== null ? pericias.find(p => p.row === propostaRow) : null

  const globalChecklistItems = checklistItems.filter(i => !i.pericia_row)

  const totalHonorarios = filtered.reduce((s, p) => s + parseMoney(p.valorHonorarios), 0)
  const totalRecebido = filtered.reduce((s, p) => s + parseMoney(p.honorariosRecebidos), 0)
  const totalAReceber = filtered.reduce((s, p) => s + Math.max(0, parseMoney(p.valorHonorarios) - parseMoney(p.honorariosRecebidos)), 0)

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
      <div className="rounded-xl pericias-table-wrapper" style={{ background: 'var(--comp-table-bg)', border: '1px solid var(--comp-table-wrapper-border)', boxShadow: 'var(--comp-table-shadow)' }}>
        <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 'calc(100vh - 345px)', paddingBottom: '2px', scrollbarGutter: 'stable' }}>
          <table className="w-full text-[14px] font-montserrat border-collapse pericias-table">
            <thead className="sticky top-0 z-10 pericias-thead" style={{ background: 'var(--comp-thead)', backdropFilter: 'blur(8px)' }}>
              <tr style={{ borderBottom: '1px solid var(--comp-table-wrapper-border)' }}>
                {/* Expand column */}
                <th className="w-10 px-2 py-4" />
                {/* Action column — first for immediate access */}
                <th className="w-[100px] px-2 py-4">
                  <span className="text-[12px] font-semibold uppercase tracking-widest text-text/45">Ação</span>
                </th>
                {COLS.map(h => (
                  <th
                    key={h.key}
                    className={`${h.width} px-3 py-4 select-none whitespace-nowrap cursor-pointer group ${h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'}`}
                    onClick={() => toggleSort(h.key)}
                  >
                    <div className={`flex items-center gap-1 text-[12px] font-semibold uppercase tracking-widest text-text/55 group-hover:text-gold/80 transition-colors ${h.align === 'right' ? 'justify-end' : h.align === 'center' ? 'justify-center' : ''}`}>
                      {h.label}
                      <SortIcon col={h.key} sortKey={sortKey} sortDir={sortDir} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const isExpanded = expandedRows.has(p.row)
                const isEven = idx % 2 === 0
                const doneIds: number[] = (() => { try { return JSON.parse(p.checklistDone || '[]') } catch { return [] } })()
                const rowAllItems = [...globalChecklistItems, ...checklistItems.filter(i => i.pericia_row === p.row)]
                const rowDone = doneIds.filter(id => rowAllItems.some(i => i.id === id)).length
                const rowTotal = rowAllItems.length
                const rowPct = rowTotal > 0 ? Math.round((rowDone / rowTotal) * 100) : 0
                const rowProgColor = rowPct === 100 ? '#22C55E' : rowPct > 60 ? '#D4AF37' : rowPct > 0 ? '#F97316' : ''
                const checkPct = rowPct
                const propBadge = p.propostaStatus ? PROPOSTA_BADGE[p.propostaStatus] : null

                return (
                  <>
                    <tr
                      key={p.row}
                      data-fase={p.fase}
                      className={`pericias-row transition-colors duration-100 ${isEven ? '' : 'pericias-row-odd'} ${isExpanded ? 'pericias-row-expanded' : ''}`}
                      style={{ borderBottom: '1px solid var(--comp-row-border)' }}
                    >
                      {/* Expand button + mini progresso */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <button
                            onClick={() => toggleExpand(p.row)}
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

                      {/* Action cell — moved to front */}
                      <td className="px-2 py-2.5">
                        <div className="flex items-center gap-1 justify-center">
                          <button
                            onClick={() => { setPropostaRow(p.row); setExpandedRows(s => new Set(s).add(p.row)) }}
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
                          {checklistItems.length > 0 && (
                            <button
                              onClick={() => toggleExpand(p.row)}
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
                            className="tip w-7 h-7 rounded-lg flex items-center justify-center text-text/30 hover:text-red-400/80 hover:bg-red-400/10 transition-all duration-150 disabled:opacity-40"
                            disabled={archiving === p.row}
                            onClick={() => handleArchive(p.row)}
                            data-tip="Arquivar"
                          >
                            <Archive size={13} />
                          </button>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-text/50 text-[11px] font-mono">{p.qtd || idx + 1}</td>

                      <td className="px-3 py-3">
                        <EditableCell value={p.poloAtivo} campo="poloAtivo"
                          syncing={syncingCells.has(`${p.row}:poloAtivo`)}
                          onSave={v => handleSave(p.row, 'poloAtivo', v, p.poloAtivo)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.poloPassivo} campo="poloPassivo"
                          syncing={syncingCells.has(`${p.row}:poloPassivo`)}
                          onSave={v => handleSave(p.row, 'poloPassivo', v, p.poloPassivo)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.uf} campo="uf" type="select-uf"
                          syncing={syncingCells.has(`${p.row}:uf`)}
                          onSave={v => handleSave(p.row, 'uf', v, p.uf)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.cidade} campo="cidade"
                          syncing={syncingCells.has(`${p.row}:cidade`)}
                          onSave={v => handleSave(p.row, 'cidade', v, p.cidade)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.vara} campo="vara"
                          syncing={syncingCells.has(`${p.row}:vara`)}
                          onSave={v => handleSave(p.row, 'vara', v, p.vara)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.numeroProcesso} campo="numeroProcesso"
                          className="font-mono text-[11px] tracking-wide"
                          syncing={syncingCells.has(`${p.row}:numeroProcesso`)}
                          onSave={v => handleSave(p.row, 'numeroProcesso', v, p.numeroProcesso)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.assunto} campo="assunto"
                          syncing={syncingCells.has(`${p.row}:assunto`)}
                          onSave={v => handleSave(p.row, 'assunto', v, p.assunto)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.tipo} campo="tipo" type="select-tipo"
                          syncing={syncingCells.has(`${p.row}:tipo`)}
                          renderDisplay={v => (
                            <span className={`text-[12px] font-semibold ${v === 'Particular' ? 'text-gold/90' : 'text-blue-400/80'}`}>
                              {v === 'Assistência Judiciária Gratuita' ? 'AJG' : v || '—'}
                            </span>
                          )}
                          onSave={v => handleSave(p.row, 'tipo', v, p.tipo)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.fase} campo="fase" type="select-fase"
                          syncing={syncingCells.has(`${p.row}:fase`)}
                          renderDisplay={v => <FaseBadge fase={v as Parameters<typeof FaseBadge>[0]['fase']} size="sm" />}
                          onSave={v => handleSave(p.row, 'fase', v, p.fase)} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableCell value={p.valorPropostaHonorarios || ''} campo="valorPropostaHonorarios" type="currency"
                          className="justify-end"
                          syncing={syncingCells.has(`${p.row}:valorPropostaHonorarios`)}
                          renderDisplay={v => (
                            <span className={`pv ${v ? 'text-text/65 font-medium' : 'text-text/30'}`}>
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          onSave={v => {
                            handleSave(p.row, 'valorPropostaHonorarios', v, p.valorPropostaHonorarios || '')
                            handleSave(p.row, 'valorHonorarios', calcHonorarios(v, p.origem), p.valorHonorarios, true)
                          }} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableCell value={p.valorHonorarios} campo="valorHonorarios" type="currency"
                          className="justify-end"
                          syncing={syncingCells.has(`${p.row}:valorHonorarios`)}
                          renderDisplay={v => (
                            <span className={`pv ${v ? 'text-gold-light/90 font-semibold' : 'text-text/30'}`}>
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          onSave={v => handleSave(p.row, 'valorHonorarios', v, p.valorHonorarios)} />
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <EditableCell value={p.honorariosRecebidos} campo="honorariosRecebidos" type="currency"
                          className="justify-end"
                          syncing={syncingCells.has(`${p.row}:honorariosRecebidos`)}
                          renderDisplay={v => (
                            <span className={`pv ${v ? 'text-green-400/85 font-semibold' : 'text-text/30'}`}>
                              {v ? formatCurrency(v) : '—'}
                            </span>
                          )}
                          onSave={v => handleSave(p.row, 'honorariosRecebidos', v, p.honorariosRecebidos)} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <EditableCell value={p.solicitarDocs} campo="solicitarDocs" type="select-docs"
                          syncing={syncingCells.has(`${p.row}:solicitarDocs`)}
                          renderDisplay={v => (
                            <span className={v === 'Sim' ? 'text-amber-400/90 font-bold text-[12px]' : v === 'Não' ? 'text-text/45 text-[12px]' : 'text-text/30 text-[12px]'}>{v || '—'}</span>
                          )}
                          onSave={v => handleSave(p.row, 'solicitarDocs', v, p.solicitarDocs)} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EditableCell value={p.inicio} campo="inicio" type="date"
                          syncing={syncingCells.has(`${p.row}:inicio`)}
                          renderDisplay={v => <span className="text-text/70 tabular-nums">{formatDate(v) || '—'}</span>}
                          onSave={v => handleSave(p.row, 'inicio', v, p.inicio)} />
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <EditableCell value={p.entregaPrevista} campo="entregaPrevista" type="date"
                          syncing={syncingCells.has(`${p.row}:entregaPrevista`)}
                          renderDisplay={v => {
                            const ds = dateStatus(v)
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
                          onSave={v => handleSave(p.row, 'entregaPrevista', v, p.entregaPrevista)} />
                      </td>
                      <td className="px-3 py-3">
                        <EditableCell value={p.origem} campo="origem" type="select-origem"
                          syncing={syncingCells.has(`${p.row}:origem`)}
                          renderDisplay={v => (
                            <span className={`text-[12px] font-medium ${v === 'Indicação' ? 'text-purple-400/80' : 'text-text/65'}`}>{v || '—'}</span>
                          )}
                          onSave={v => {
                            handleSave(p.row, 'origem', v, p.origem)
                            handleSave(p.row, 'valorHonorarios', calcHonorarios(p.valorPropostaHonorarios || '', v), p.valorHonorarios, true)
                          }} />
                      </td>

                    </tr>

                    {/* Expanded panel row */}
                    <tr key={`exp-${p.row}`} className="expanded-panel-row" style={{ borderBottom: '1px solid var(--comp-row-border)' }}>
                      <td colSpan={totalCols} style={{ padding: 0 }}>
                        <div style={{
                          maxHeight: isExpanded ? '600px' : '0',
                          overflow: 'hidden',
                          transition: 'max-height 0.38s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}>
                          <ExpandedPanel
                            pericia={p}
                            checklistItems={checklistItems}
                            onUpdate={onUpdate}
                            onOpenProposta={() => setPropostaRow(p.row)}
                            onChecklistChange={refetchChecklist}
                            onAddItem={handleAddItem}
                          />
                        </div>
                      </td>
                    </tr>
                  </>
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

      {/* Proposta Modal */}
      {propostaPericia && (
        <PropostaModal
          pericia={propostaPericia}
          onClose={() => setPropostaRow(null)}
          onSaved={onUpdate}
        />
      )}
    </>
  )
}
