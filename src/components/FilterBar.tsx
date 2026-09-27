'use client'

import { useState } from 'react'
import { FASES, TIPOS, ORIGENS, UFS, type Fase, type Tipo, type Origem } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, X, SlidersHorizontal } from 'lucide-react'

export interface Filters {
  search: string
  fase: Fase | ''
  tipo: Tipo | ''
  uf: string
  origem: Origem | ''
  cardFilter: string
  sortBy: 'entrega_asc' | 'entrega_desc' | 'recente' | 'antiga'
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

const SELECT_CLASS = "h-10 rounded-lg bg-surface border border-[var(--border)] px-3 text-[14px] text-text focus:outline-none focus:border-gold/50 cursor-pointer w-full sm:w-auto"

function hasActiveFilters(f: Filters) {
  return f.search || f.fase || f.tipo || f.uf || f.origem || f.cardFilter
}

export default function FilterBar({ filters, onChange }: FilterBarProps) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeCount = [filters.fase, filters.tipo, filters.uf, filters.origem, filters.cardFilter].filter(Boolean).length

  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function clear() {
    onChange({ search: '', fase: '', tipo: '', uf: '', origem: '', cardFilter: '', sortBy: 'entrega_asc' })
    setFiltersOpen(false)
  }

  return (
    <div className="flex flex-col gap-2 flex-1 min-w-0">
      {/* Linha principal: busca + botão filtros (mobile) */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/30 pointer-events-none" />
          <Input
            placeholder="Buscar polo, processo…"
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="pl-9 h-10 text-[14px] w-full"
          />
        </div>

        {/* Botão Filtros — só no mobile */}
        <button
          onClick={() => setFiltersOpen(o => !o)}
          className="sm:hidden flex items-center gap-1.5 h-10 px-3 rounded-lg text-[13px] font-semibold font-montserrat flex-shrink-0 transition-all"
          style={{
            background: filtersOpen || activeCount > 0 ? 'rgba(212,175,55,0.15)' : 'var(--surface-2)',
            border: `1px solid ${filtersOpen || activeCount > 0 ? 'rgba(212,175,55,0.35)' : 'var(--border)'}`,
            color: filtersOpen || activeCount > 0 ? 'var(--gold)' : 'var(--muted)',
          }}
        >
          <SlidersHorizontal size={14} />
          Filtros
          {activeCount > 0 && (
            <span
              className="w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
              style={{ background: 'var(--gold)', color: '#1A2535' }}
            >
              {activeCount}
            </span>
          )}
        </button>

        {/* Limpar — só se tiver filtro ativo, no desktop fica inline */}
        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-10 px-3 gap-1.5 text-[14px] hidden sm:flex flex-shrink-0">
            <X size={13} />
            Limpar
          </Button>
        )}
      </div>

      {/* Selects — sempre visíveis no desktop, toggle no mobile */}
      <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex flex-wrap gap-2 items-center`}>
        <select value={filters.fase} onChange={e => set('fase', e.target.value as Fase | '')} className={SELECT_CLASS}>
          <option value="">Todas as fases</option>
          {FASES.map(f => <option key={f} value={f}>{FASE_LABELS[f] || f}</option>)}
        </select>

        <select value={filters.tipo} onChange={e => set('tipo', e.target.value as Tipo | '')} className={SELECT_CLASS}>
          <option value="">Todos os tipos</option>
          {TIPOS.map(t => <option key={t} value={t}>{t === 'Assistência Judiciária Gratuita' ? 'AJG' : t}</option>)}
        </select>

        <select value={filters.uf} onChange={e => set('uf', e.target.value)} className={SELECT_CLASS}>
          <option value="">Todos os estados</option>
          {UFS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
        </select>

        <select value={filters.origem} onChange={e => set('origem', e.target.value as Origem | '')} className={SELECT_CLASS}>
          <option value="">Todas as origens</option>
          {ORIGENS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>

        <select value={filters.sortBy} onChange={e => set('sortBy', e.target.value as Filters['sortBy'])} className={SELECT_CLASS}>
          <option value="entrega_asc">Entrega: mais próxima</option>
          <option value="entrega_desc">Entrega: mais distante</option>
          <option value="recente">Mais recentes</option>
          <option value="antiga">Mais antigas</option>
        </select>

        {/* Limpar no mobile (dentro do painel expandido) */}
        {hasActiveFilters(filters) && (
          <Button variant="ghost" size="sm" onClick={clear} className="h-10 px-3 gap-1.5 text-[14px] sm:hidden">
            <X size={13} />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  )
}
