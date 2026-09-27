import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { ensurePericiasCalendar } from '@/lib/googleCalendar'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

// Chamado pelo próprio Google (navegação de topo, sem header customizado possível).
// A prova de que essa chamada corresponde a um /connect que a Gabi de fato
// iniciou é o "state" batendo com o que guardamos — não dá pra exigir sessão
// aqui do jeito tradicional, é assim que OAuth resolve isso por design.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const errorParam = req.nextUrl.searchParams.get('error')
  const dashboardUrl = new URL('/dashboard', process.env.APP_URL)

  function fail(code: string, detail?: unknown) {
    if (detail) console.error('[calendar/oauth/callback]', code, detail)
    dashboardUrl.searchParams.set('calendar_error', code)
    return NextResponse.redirect(dashboardUrl)
  }

  if (errorParam) return fail('consentimento_negado')
  if (!code || !state) return fail('parametros_ausentes')

  // Valida o state ANTES de qualquer troca de token — invalida (apaga) na hora,
  // pra nunca poder ser reaproveitado (proteção CSRF + replay).
  const { data: pending } = await supabaseAdmin.from('oauth_pending_state').select('*').eq('id', 1).maybeSingle()
  await supabaseAdmin.from('oauth_pending_state').delete().eq('id', 1)
  if (!pending || pending.state !== state) return fail('state_invalido')
  if (new Date(pending.expires_at).getTime() < Date.now()) return fail('state_expirado')

  try {
    const redirectUri = `${process.env.APP_URL}/api/calendar/oauth/callback`
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    })
    if (!tokenRes.ok) return fail('token_exchange_falhou', { status: tokenRes.status, body: await tokenRes.text() })
    const tokens = await tokenRes.json()
    if (!tokens.refresh_token) {
      return fail('sem_refresh_token', 'Google não retornou refresh_token — provavelmente já autorizado antes sem revogar. Peça pra revogar em myaccount.google.com/permissions e conectar de novo.')
    }

    const calendarId = await ensurePericiasCalendar(tokens.access_token)
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    const { error } = await supabaseAdmin.from('google_calendar_tokens').upsert({
      id: 1,
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      access_token_expires_at: expiresAt,
      calendar_id: calendarId,
    })
    if (error) return fail('falha_ao_salvar', error.message)

    dashboardUrl.searchParams.set('calendar_connected', '1')
    return NextResponse.redirect(dashboardUrl)
  } catch (err) {
    return fail('erro_inesperado', err)
  }
}
