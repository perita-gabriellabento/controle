'use client'

import { FASES, TIPOS, ORIGENS, UFS, type Fase, type Tipo, type Origem } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X } from 'lucide-react'

export interface Filters {
  search: string
  fase: Fase | ''
  tipo: Tipo | ''
  uf: string
  origem: Origem | ''
  cardFilter: string
}

interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
}

const FASE_LABELS: Partial<Record<string, string>> = {
  'Entregue':                                          'Entregue',
  'Impugnação de laudo':                               'Impugnação',
  'Em diligência':                                     'Em diligência',
  'Aguardando intimação para início':                  'Ag. intimação início',
  'Em produção':                                       'Em produção',
  'Proposta de honorários':                            'Proposta honor.',
  'Aguardando recebimento honorários':                 'Ag. recebimento',
  'Aguardando intimação para proposta de honorários':  'Ag. intimação proposta',
}

function hasActiveFilters(f: Filters) {
  return f.search || f.fase || f.tipo || f.uf || f.origem || f.cardFilter
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function clear() {
    onChange({ search: '', fase: '', tipo: '', uf: '', origem: '', cardFilter: '' })
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[220px] max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/30 pointer-events-none" />
        <Input
          placeholder="Buscar polo, processo…"
          value={filters.search}
          onChange={e => set('search', e.target.value)}
          className="pl-9 h-10 text-[14px]"
        />
      </div>

      <select
        value={filters.fase}
        onChange={e => set('fase', e.target.value as Fase | '')}
        className="h-10 rounded-lg bg-surface border border-[var(--border)] px-3 text-[14px] text-text focus:outline-none focus:border-gold/50 cursor-pointer"
      >
        <option value="">Todas as fases</option>
        {FASES.map(f => (
          <option key={f} value={f}>{FASE_LABELS[f] || f}</option>
        ))}
      </select>

      <select
        value={filters.tipo}
        onChange={e => set('tipo', e.target.value as Tipo | '')}
        className="h-10 rounded-lg bg-surface border border-[var(--border)] px-3 text-[14px] text-text focus:outline-none focus:border-gold/50 cursor-pointer"
      >
        <option value="">Todos os tipos</option>
        {TIPOS.map(t => <option key={t} value={t}>{t === 'Assistência Judiciária Gratuita' ? 'AJG' : t}</option>)}
      </select>

      <select
        value={filters.uf}
        onChange={e => set('uf', e.target.value)}
        className="h-10 rounded-lg bg-surface border border-[var(--border)] px-3 text-[14px] text-text focus:outline-none focus:border-gold/50 cursor-pointer"
      >
        <option value="">Todos os estados</option>
        {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
      </select>

      <select
        value={filters.origem}
        onChange={e => set('origem', e.target.value as Origem | '')}
        className="h-10 rounded-lg bg-surface border border-[var(--border)] px-3 text-[14px] text-text focus:outline-none focus:border-gold/50 cursor-pointer"
      >
        <option value="">Todas as origens</option>
        {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>

      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={clear} className="h-10 px-3 gap-1.5 text-[14px]">
          <X size={13} />
          Limpar
        </Button>
      )}
    </div>
  )
}
