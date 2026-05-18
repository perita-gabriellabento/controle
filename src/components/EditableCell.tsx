'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { FASES, TIPOS, ORIGENS, UFS } from '@/lib/types'
import { formatCurrency, formatDate } from '@/lib/utils'

export type EditType =
  | 'text'
  | 'currency'
  | 'date'
  | 'select-fase'
  | 'select-tipo'
  | 'select-origem'
  | 'select-uf'
  | 'select-docs'

interface EditableCellProps {
  value: string
  campo: string
  onSave: (value: string) => void
  type?: EditType
  placeholder?: string
  className?: string
  syncing?: boolean
  renderDisplay?: (value: string) => React.ReactNode
}

function displayValue(value: string, type: EditType): string {
  if (!value) return ''
  if (type === 'currency') return formatCurrency(value)
  if (type === 'date') return formatDate(value)
  return value
}

const SELECT_OPTIONS: Record<string, string[]> = {
  'select-fase':   FASES as unknown as string[],
  'select-tipo':   TIPOS as unknown as string[],
  'select-origem': ORIGENS as unknown as string[],
  'select-uf':     UFS,
  'select-docs':   ['Sim', 'Não'],
}

export default function EditableCell({
  value,
  campo,
  onSave,
  type = 'text',
  placeholder = '—',
  className = '',
  syncing = false,
  renderDisplay,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select()
    }
  }, [editing])

  const commit = useCallback((val: string) => {
    setEditing(false)
    if (val === value) return
    onSave(val)
  }, [value, onSave])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit(draft)
    if (e.key === 'Escape') { setEditing(false); setDraft(value) }
  }

  const isSelect = type.startsWith('select-')
  const options = SELECT_OPTIONS[type] || []

  if (editing && isSelect) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={draft}
        onChange={e => { setDraft(e.target.value); commit(e.target.value) }}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
        className="w-full border border-gold/40 rounded px-2 py-1.5 text-[14px] text-text focus:outline-none focus:border-gold cursor-pointer"
        style={{ minWidth: '120px', background: 'var(--comp-cell-input)' }}
      >
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  if (editing) {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type === 'date' ? 'date' : 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
        className="w-full border border-gold/40 rounded px-2 py-1.5 text-[14px] text-text focus:outline-none focus:border-gold"
        style={{ minWidth: '80px', background: 'var(--comp-cell-input)' }}
      />
    )
  }

  const display = renderDisplay
    ? renderDisplay(value)
    : <span className={value ? 'text-text/85' : 'text-text/35'}>{displayValue(value, type) || placeholder}</span>

  return (
    <div
      className={`cell-hover group flex items-center gap-1.5 cursor-text min-h-[26px] px-1 -mx-1 rounded transition-colors duration-100 ${className}`}
      onDoubleClick={() => { setEditing(true); setDraft(value) }}
      title="Duplo clique para editar"
    >
      {display}
      {syncing
        ? <Loader2 size={10} className="animate-spin text-gold/50 flex-shrink-0" />
        : <span className="text-[9px] text-gold/0 group-hover:text-gold/30 transition-colors flex-shrink-0 select-none">✎</span>
      }
    </div>
  )
}
