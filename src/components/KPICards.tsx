import { Pericia } from '@/lib/types'
import { contaNosTotais } from '@/lib/prazos'
import { formatCurrency } from '@/lib/utils'
import { Scale, TrendingDown, CheckCircle, Clock, FileText, TrendingUp } from 'lucide-react'

interface KPICardsProps {
  pericias: Pericia[]
  activeFilter: string
  onCardClick: (id: string) => void
}

function parseMoney(v: string): number {
  if (!v) return 0
  const n = parseFloat(v.replace(/[^\d,.-]/g, '').replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export default function KPICards({ pericias, activeFilter, onCardClick }: KPICardsProps) {
  const ativos = pericias.filter(contaNosTotais) // revogado e arquivado ficam fora de todos os totais

  let totalHonorarios = 0
  let totalRecebido = 0
  let emProducao = 0
  let entregues = 0
  let emProposta = 0
  let aReceberCount = 0
  let recebidoCount = 0

  for (const p of ativos) {
    const honor = parseMoney(p.valorHonorarios)
    const receb = parseMoney(p.honorariosRecebidos)
    totalHonorarios += honor
    totalRecebido += receb
    if (p.fase === 'Em produção') emProducao++
    if (p.fase === 'Entregue') entregues++
    if (p.fase === 'Proposta de honorários') emProposta++
    if (honor > receb) aReceberCount++
    if (receb > 0) recebidoCount++
  }

  const aReceber = totalHonorarios - totalRecebido

  type Card = {
    id: string
    label: string
    value: string
    sub: string
    icon: typeof Scale
    accent: string
    glow: string
    private?: boolean
  }

  const cards: Card[] = [
    {
      id: '',
      label: 'Total Processos',
      value: String(ativos.length),
      sub: 'processos ativos',
      icon: Scale,
      accent: 'var(--gold)', // dourado puro (#D4AF37) tem contraste fraco sobre fundo branco no modo claro — var(--gold) já resolve pra um tom mais escuro (#B8960C) nesse tema
      glow: 'rgba(212,175,55,0.08)',
    },
    {
      id: 'a_receber',
      label: 'A Receber',
      value: formatCurrency(aReceber),
      sub: `${aReceberCount} processos com saldo`,
      icon: TrendingDown,
      accent: '#8B5CF6',
      glow: 'rgba(139,92,246,0.08)',
      private: true,
    },
    {
      id: 'recebido',
      label: 'Recebido',
      value: formatCurrency(totalRecebido),
      sub: `${recebidoCount} processos com recebimento`,
      icon: TrendingUp,
      accent: '#22C55E',
      glow: 'rgba(34,197,94,0.07)',
      private: true,
    },
    {
      id: 'em_producao',
      label: 'Em Produção',
      value: String(emProducao),
      sub: 'laudos em elaboração',
      icon: Clock,
      accent: '#F97316',
      glow: 'rgba(249,115,22,0.08)',
    },
    {
      id: 'entregue',
      label: 'Entregues',
      value: String(entregues),
      sub: 'laudos entregues',
      icon: CheckCircle,
      accent: '#3B82F6',
      glow: 'rgba(59,130,246,0.07)',
    },
    {
      id: 'em_proposta',
      label: 'Em Proposta',
      value: String(emProposta),
      sub: 'aguardando aprovação',
      icon: FileText,
      accent: '#9CA3AF',
      glow: 'rgba(156,163,175,0.06)',
    },
  ]

  const hasAnyActive = activeFilter !== ''

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map(card => {
        const Icon = card.icon
        const isActive = activeFilter === card.id
        const isDimmed = hasAnyActive && !isActive && card.id !== ''

        return (
          <button
            key={card.id || 'total'}
            onClick={() => onCardClick(card.id)}
            className="kpi-card rounded-lg pl-4 pr-4 py-4 flex flex-col gap-2.5 relative overflow-hidden text-left w-full transition-all duration-200"
            style={{
              opacity: isDimmed ? 0.4 : 1,
              transform: isActive ? 'translateY(-2px)' : undefined,
              boxShadow: isActive ? '0 8px 24px -8px rgba(0,0,0,0.35)' : undefined,
            }}
            title={card.id ? `Filtrar por: ${card.label}` : 'Mostrar todos'}
          >
            {/* Barra de acento — div decorativa (não `border`), pra sobreviver ao "border: none !important" do modo claro */}
            <div className="absolute left-0 top-0 bottom-0" style={{ width: '3px', background: card.accent }} />

            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-text/55 font-montserrat leading-tight">
                {card.label}
              </p>
              <Icon size={13} style={{ color: card.accent, opacity: isActive ? 1 : 0.7 }} strokeWidth={2} />
            </div>

            <p
              className={`font-cinzel text-[24px] sm:text-[27px] font-semibold leading-none tabular-nums${card.private ? ' pv' : ''}`}
              style={{ color: card.accent }}
            >
              {card.value}
            </p>

            <p className="text-[10.5px] text-text/40 font-montserrat">
              {card.sub}
            </p>
          </button>
        )
      })}
    </div>
  )
}
