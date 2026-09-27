// Integração com Google Calendar — só chamado a partir de rotas de API (servidor).
// Unidirecional: o app só cria/atualiza/apaga eventos, nunca lê a agenda da Gabi de volta.

import { supabaseAdmin } from './supabaseAdmin'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

interface TokenRow {
  refresh_token: string
  access_token: string | null
  access_token_expires_at: string | null
  calendar_id: string
}

async function getTokenRow(): Promise<TokenRow> {
  const { data, error } = await supabaseAdmin.from('google_calendar_tokens').select('*').eq('id', 1).single()
  if (error || !data) throw new Error('Google Calendar ainda não foi conectado (faltam as Configurações → Conectar Google Calendar).')
  return data as TokenRow
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Falha ao renovar token do Google: ${res.status} ${await res.text()}`)
  return res.json()
}

async function getAccessToken(): Promise<{ accessToken: string; calendarId: string }> {
  const row = await getTokenRow()
  const stillValid = row.access_token && row.access_token_expires_at && new Date(row.access_token_expires_at).getTime() > Date.now() + 60_000
  if (stillValid) return { accessToken: row.access_token!, calendarId: row.calendar_id }

  const fresh = await refreshAccessToken(row.refresh_token)
  const expiresAt = new Date(Date.now() + fresh.expires_in * 1000).toISOString()
  await supabaseAdmin.from('google_calendar_tokens').update({
    access_token: fresh.access_token,
    access_token_expires_at: expiresAt,
  }).eq('id', 1)
  return { accessToken: fresh.access_token, calendarId: row.calendar_id }
}

export interface DeadlineEvent {
  title: string
  description: string
  dateISO: string // 'YYYY-MM-DD' — evento de dia inteiro, nunca dateTime (evita bug de fuso)
}

// Cria ou atualiza (idempotente via eventId já existente). Retorna o id do evento.
export async function upsertDeadlineEvent(existingEventId: string | null, event: DeadlineEvent): Promise<string> {
  const { accessToken, calendarId } = await getAccessToken()
  const body = {
    summary: event.title,
    description: event.description,
    start: { date: event.dateISO },
    end: { date: event.dateISO },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 7 * 24 * 60 },
        { method: 'email', minutes: 7 * 24 * 60 },
        { method: 'popup', minutes: 3 * 24 * 60 },
        { method: 'popup', minutes: 1 * 24 * 60 },
        { method: 'email', minutes: 1 * 24 * 60 },
        { method: 'popup', minutes: 0 },
      ],
    },
  }
  const url = existingEventId
    ? `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${existingEventId}`
    : `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
  const res = await fetch(url, {
    method: existingEventId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // Evento pode ter sido apagado manualmente por ela — se PATCH der 404, cria um novo em vez de falhar.
  if (existingEventId && res.status === 404) return upsertDeadlineEvent(null, event)
  if (!res.ok) throw new Error(`Falha ao sincronizar evento no Calendar: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.id
}

export async function deleteDeadlineEvent(eventId: string): Promise<void> {
  const { accessToken, calendarId } = await getAccessToken()
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Falha ao remover evento do Calendar: ${res.status} ${await res.text()}`)
  }
}

// Garante que existe um calendário secundário "Perícias" dedicado, em vez de usar
// o calendário pessoal principal dela. Roda uma vez, no momento da conexão OAuth.
export async function ensurePericiasCalendar(accessToken: string): Promise<string> {
  const listRes = await fetch(`${CALENDAR_API}/users/me/calendarList`, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (listRes.ok) {
    const list = await listRes.json()
    const existing = (list.items || []).find((c: any) => c.summary === 'Perícias')
    if (existing) return existing.id
  }
  const createRes = await fetch(`${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'Perícias' }),
  })
  if (!createRes.ok) throw new Error(`Falha ao criar calendário "Perícias": ${createRes.status} ${await createRes.text()}`)
  const created = await createRes.json()
  return created.id
}
