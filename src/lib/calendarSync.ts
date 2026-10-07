'use client'

import { authedFetch } from './supabaseClient'

// Sincroniza o Calendar de uma perícia, UMA chamada por vez por perícia. Duas chamadas simultâneas
// leem "sem evento" ao mesmo tempo e criam eventos duplicados no Google (auditoria de 07/10/2026).
// Falha de sincronização nunca incomoda o fluxo principal: a perícia já foi salva no banco.
const filas = new Map<string, Promise<void>>()

export function syncCalendar(periciaId: string): Promise<void> {
  const anterior = filas.get(periciaId) ?? Promise.resolve()
  const proxima = anterior.then(() =>
    authedFetch('/api/calendar/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periciaId }),
    }).then(() => undefined).catch(() => undefined),
  )
  filas.set(periciaId, proxima)
  proxima.then(() => { if (filas.get(periciaId) === proxima) filas.delete(periciaId) })
  return proxima
}
