import { Pericia } from '@/lib/types'
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
  const ativos = pericias.filter(p => !p.arquivado)

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
      accent: '#D4AF37',
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
            className="kpi-card rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden text-left w-full transition-all duration-200"
            style={{
              outline: isActive ? `1.5px solid ${card.accent}` : undefined,
              boxShadow: isActive ? `0 0 24px ${card.accent}28, 0 6px 28px rgba(0,0,0,0.3)` : undefined,
              opacity: isDimmed ? 0.45 : 1,
              transform: isActive ? 'translateY(-2px)' : undefined,
            }}
            title={card.id ? `Filtrar por: ${card.label}` : 'Mostrar todos'}
          >
            {/* Barra colorida sólida — identidade de cada card */}
            <div
              className="absolute top-0 left-0 right-0 transition-all duration-200"
              style={{
                height: isActive ? '4px' : '3px',
                background: card.accent,
                opacity: isActive ? 1 : 0.8,
              }}
            />

            {/* Active indicator dot */}
            {isActive && (
              <div
                className="absolute top-3 right-3 w-2 h-2 rounded-full"
                style={{ background: card.accent, boxShadow: `0 0 8px ${card.accent}` }}
              />
            )}

            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-text/60 font-montserrat leading-tight">
                {card.label}
              </p>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200"
                style={{
                  background: isActive ? `${card.accent}22` : card.glow,
                  border: `1px solid ${card.accent}${isActive ? '44' : '22'}`,
                }}
              >
                <Icon size={17} style={{ color: card.accent }} strokeWidth={2} />
              </div>
            </div>

            <div>
              <p
                className={`text-[28px] font-bold font-montserrat leading-none tracking-tight${card.private ? ' pv' : ''}`}
                style={{ color: card.accent }}
              >
                {card.value}
              </p>
              <p className="text-[11px] text-text/50 mt-2 font-montserrat uppercase tracking-wider">
                {card.sub}
              </p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
