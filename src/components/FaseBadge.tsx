import { FASE_COLORS, type Fase } from '@/lib/types'

interface FaseBadgeProps {
  fase: Fase
  size?: 'sm' | 'default'
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
  'Revogado':                                          'Revogado',
}

export default function FaseBadge({ fase, size = 'default' }: FaseBadgeProps) {
  if (!fase) return <span className="text-text/40 text-sm">—</span>

  const colors = FASE_COLORS[fase]
  const label = FASE_LABELS[fase] || fase

  if (!colors) return <span className="text-text/60 text-sm">{label}</span>

  const padding = size === 'sm' ? 'pl-2 pr-2.5 py-1 text-[11.5px]' : 'pl-2.5 pr-3 py-1.5 text-[12.5px]'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold font-montserrat whitespace-nowrap tracking-wide ${padding}`}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colors.text }} />
      {label}
    </span>
  )
}
