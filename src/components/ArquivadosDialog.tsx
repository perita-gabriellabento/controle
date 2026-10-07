'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Archive, Search, RotateCcw, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import FaseBadge from '@/components/FaseBadge'
import { unarchivePericia } from '@/lib/sheets'
import { filtrarPorBusca } from '@/lib/busca'
import { syncCalendar } from '@/lib/calendarSync'
import type { Pericia } from '@/lib/types'

interface ArquivadosDialogProps {
  pericias: Pericia[]
  onChanged: () => void
}

// Tela "Arquivados" (pedido da Gabi, 07/10/2026): lista os processos arquivados, com a mesma busca
// tolerante da tabela, e um botão Reabrir que devolve o processo pra tabela.
export default function ArquivadosDialog({ pericias, onChanged }: ArquivadosDialogProps) {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const [reabrindo, setReabrindo] = useState<Set<string>>(new Set())

  const arquivados = useMemo(
    () => pericias.filter(p => p.arquivado).sort((a, b) => a.poloAtivo.localeCompare(b.poloAtivo, 'pt-BR')),
    [pericias],
  )
  const lista = useMemo(
    () => (busca ? filtrarPorBusca(arquivados, busca, p => [p.poloAtivo, p.poloPassivo, p.numeroProcesso, p.assunto, p.cidade, p.vara]) : arquivados),
    [arquivados, busca],
  )

  async function reabrir(p: Pericia) {
    if (reabrindo.has(p.id)) return
    setReabrindo(s => new Set(s).add(p.id))
    try {
      const res = await unarchivePericia(p.id)
      if (!res.ok) { toast.error('Não foi possível reabrir', { description: res.error }); return }
      // Recria os eventos da agenda (o arquivamento tinha apagado). Falha aqui não desfaz a reabertura.
      void syncCalendar(p.id)
      toast.success('Processo reaberto', { description: `${p.poloAtivo} voltou para a tabela.` })
      onChanged()
    } finally {
      setReabrindo(s => { const ns = new Set(s); ns.delete(p.id); return ns })
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) setBusca('') }}>
      <DialogTrigger asChild>
        <button
          className="icon-btn w-8 h-8 sm:w-9 sm:h-9 relative"
          title={`Arquivados (${arquivados.length})`}
          aria-label={`Arquivados, ${arquivados.length} processos`}
        >
          <Archive size={15} />
          {arquivados.length > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center tabular-nums"
              style={{ background: 'var(--gold)', color: '#1A1406' }}
            >
              {arquivados.length}
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Processos arquivados</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-lg px-3 h-10" style={{ background: 'var(--comp-cell-input)', border: '1px solid var(--border)' }}>
          <Search size={14} className="text-text/40 flex-shrink-0" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar nome, processo, comarca…"
            className="bg-transparent outline-none text-[14px] text-text w-full min-w-0"
            aria-label="Buscar nos arquivados"
          />
        </div>

        <div className="flex flex-col gap-2 max-h-[55vh] overflow-y-auto pr-1">
          {arquivados.length === 0 && (
            <p className="text-[13px] text-text/50 py-6 text-center">Nenhum processo arquivado.</p>
          )}
          {arquivados.length > 0 && lista.length === 0 && (
            <p className="text-[13px] text-text/50 py-6 text-center">Nada encontrado nos arquivados.</p>
          )}
          {lista.map(p => (
            <div
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5"
              style={{ background: 'var(--comp-cell-input)', border: '1px solid var(--border)' }}
            >
              <div className="min-w-0 flex-1 basis-56">
                <p className="text-[13.5px] font-semibold text-text truncate">{p.poloAtivo || '—'}</p>
                <p className="text-[12px] text-text/55 truncate">{p.poloPassivo || '—'}</p>
                <p className="text-[11px] text-text/40 font-mono truncate">{p.numeroProcesso}</p>
              </div>
              <FaseBadge fase={p.fase} size="sm" />
              <button
                onClick={() => reabrir(p)}
                disabled={reabrindo.has(p.id)}
                className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-50"
                style={{ background: 'rgba(212,175,55,0.18)', color: 'var(--gold)' }}
              >
                {reabrindo.has(p.id) ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                Reabrir
              </button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
