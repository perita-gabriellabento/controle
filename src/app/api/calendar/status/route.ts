import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireAuth } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  if (!(await requireAuth(req))) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 })
  const { data } = await supabaseAdmin.from('google_calendar_tokens').select('calendar_id').eq('id', 1).maybeSingle()
  return NextResponse.json({ connected: !!data })
}
