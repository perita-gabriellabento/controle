import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { requireAuth } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

// POST (não GET) de propósito: precisa do header Authorization, que uma navegação
// <a href> comum não consegue mandar. O client faz fetch aqui, recebe a URL do
// Google de volta, e só ENTÃO navega o navegador pra ela.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (!auth) return NextResponse.json({ ok: false, error: 'não autenticado' }, { status: 401 })

  const state = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString() // 5 min é sobra — o fluxo todo leva segundos
  const { error } = await supabaseAdmin.from('oauth_pending_state').upsert({ id: 1, state, expires_at: expiresAt })
  if (error) return NextResponse.json({ ok: false, error: 'falha ao iniciar conexão' }, { status: 500 })

  const redirectUri = `${process.env.APP_URL}/api/calendar/oauth/callback`
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || '',
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent', // garante emissão de refresh_token mesmo se ela já tiver autorizado antes
    scope: 'https://www.googleapis.com/auth/calendar.events',
    state,
  })
  return NextResponse.json({ ok: true, url: `${GOOGLE_AUTH_URL}?${params.toString()}` })
}
