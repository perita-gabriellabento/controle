import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuth } from '@/lib/apiAuth'
import { upsertDeadlineEvent, deleteDeadlineEvent } from '@/lib/googleCalendar'
import { calcPrazo, utcTimestampToBrazilDate } from '@/lib/businessDays'
import { FASE_REVOGADO } from '@/lib/prazos'

// Reconcilia os 3 eventos possíveis de uma perícia (início, entrega prevista,
// prazo da fase atual) com o estado atual do banco — sempre parte da verdade
// vigente no banco, nunca do que o client informou, pra nunca gerar "alarme
// falso" por dessincronia. Pode ser chamada a qualquer momento (inclusive por
// um job noturno de auto-correção) que o resultado final é sempre o mesmo.
// Chamado antes de EXCLUIR (não arquivar) uma perícia — remove os 3 eventos
// incondicionalmente, já que depois de apagada não há mais linha pra consultar
// os ids salvos.
export async function DELETE(req: NextRequest) {
  if (!(await requireAuth(req))) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 })
  const { periciaId } = await req.json()
  if (!periciaId) return NextResponse.json({ ok: false, error: 'periciaId obrigatório' }, { status: 400 })
  const { data: p } = await supabaseAdmin.from('pericias').select('google_event_id_inicio, google_event_id_entrega, google_event_id_prazo_fase').eq('id', periciaId).single()
  if (!p) return NextResponse.json({ ok: true }) // já não existe, nada a fazer
  try {
    await Promise.all([
      p.google_event_id_inicio ? deleteDeadlineEvent(p.google_event_id_inicio) : null,
      p.google_event_id_entrega ? deleteDeadlineEvent(p.google_event_id_entrega) : null,
      p.google_event_id_prazo_fase ? deleteDeadlineEvent(p.google_event_id_prazo_fase) : null,
    ])
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'erro desconhecido' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await requireAuth(req))) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 })
  const { periciaId } = await req.json()
  if (!periciaId) return NextResponse.json({ ok: false, error: 'periciaId obrigatório' }, { status: 400 })

  const { data: p, error } = await supabaseAdmin.from('pericias').select('*').eq('id', periciaId).single()
  if (error || !p) return NextResponse.json({ ok: false, error: 'perícia não encontrada' }, { status: 404 })

  const nomeCaso = `${p.polo_ativo} × ${p.polo_passivo} (${p.numero_processo})`
  const updates: Record<string, string | null> = {}

  try {
    // Se arquivada ou revogada, remove os 3 eventos e encerra.
    if (p.arquivado || p.fase === FASE_REVOGADO) {
      await Promise.all([
        p.google_event_id_inicio ? deleteDeadlineEvent(p.google_event_id_inicio) : null,
        p.google_event_id_entrega ? deleteDeadlineEvent(p.google_event_id_entrega) : null,
        p.google_event_id_prazo_fase ? deleteDeadlineEvent(p.google_event_id_prazo_fase) : null,
      ])
      await supabaseAdmin.from('pericias').update({
        google_event_id_inicio: null, google_event_id_entrega: null, google_event_id_prazo_fase: null,
      }).eq('id', periciaId)
      return NextResponse.json({ ok: true, arquivado: !!p.arquivado, revogado: p.fase === FASE_REVOGADO })
    }

    // ── Início ──
    if (p.inicio) {
      updates.google_event_id_inicio = await upsertDeadlineEvent(p.google_event_id_inicio, {
        title: `Início — ${nomeCaso}`,
        description: `Data de início do processo pericial.\nFase atual: ${p.fase || '—'}`,
        dateISO: p.inicio,
      })
    } else if (p.google_event_id_inicio) {
      await deleteDeadlineEvent(p.google_event_id_inicio)
      updates.google_event_id_inicio = null
    }

    // ── Entrega prevista ──
    if (p.entrega_prevista) {
      updates.google_event_id_entrega = await upsertDeadlineEvent(p.google_event_id_entrega, {
        title: `Entrega Prevista — ${nomeCaso}`,
        description: `Data estimada de entrega do laudo pericial.`,
        dateISO: p.entrega_prevista,
      })
    } else if (p.google_event_id_entrega) {
      await deleteDeadlineEvent(p.google_event_id_entrega)
      updates.google_event_id_entrega = null
    }

    // ── Prazo da fase atual (o mais urgente — processual/legal) ──
    const { data: prazoFase } = await supabaseAdmin.from('fase_prazos').select('dias, dias_tipo').eq('fase', p.fase).maybeSingle()
    if (prazoFase && p.fase_changed_at) {
      const startDate = utcTimestampToBrazilDate(p.fase_changed_at)
      const deadline = calcPrazo(startDate, prazoFase.dias, prazoFase.dias_tipo)
      updates.google_event_id_prazo_fase = await upsertDeadlineEvent(p.google_event_id_prazo_fase, {
        title: `Prazo (${p.fase}) — ${nomeCaso}`,
        description: `Prazo processual da fase atual: ${prazoFase.dias} dias ${prazoFase.dias_tipo}, contados a partir de ${startDate}.`,
        dateISO: deadline,
      })
    } else if (p.google_event_id_prazo_fase) {
      // fase atual não tem prazo definido (ex: Entregue) — remove o evento antigo, sem alarme falso
      await deleteDeadlineEvent(p.google_event_id_prazo_fase)
      updates.google_event_id_prazo_fase = null
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin.from('pericias').update(updates).eq('id', periciaId)
    }
    return NextResponse.json({ ok: true, updates })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'erro desconhecido' }, { status: 500 })
  }
}
