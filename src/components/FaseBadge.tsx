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
}

export default function FaseBadge({ fase, size = 'default' }: FaseBadgeProps) {
  if (!fase) return <span className="text-text/40 text-sm">—</span>

  const colors = FASE_COLORS[fase]
  const label = FASE_LABELS[fase] || fase

  if (!colors) return <span className="text-text/60 text-sm">{label}</span>

  const padding = size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1 text-[13px]'

  return (
    <span
      className={`inline-block rounded font-medium font-montserrat whitespace-nowrap ${padding}`}
      style={{
        background: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  )
}
