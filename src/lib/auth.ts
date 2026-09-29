'use client'

import { supabase, setTrustDevice } from './supabaseClient'

// Traduz o erro do Supabase pra algo que a Gabi consiga agir — "verifique email/senha" só
// quando a causa REAL for credencial errada. Rate limit e falha de rede têm mensagem própria,
// senão ela via o mesmo aviso genérico pra qualquer causa e achava que tinha digitado errado.
function friendlyLoginError(error: { message: string; status?: number }): string {
  const msg = error.message.toLowerCase()
  if (error.status === 429 || msg.includes('rate limit')) {
    return 'Muitas tentativas seguidas — aguarde 1 minuto e tente de novo.'
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos.'
  }
  return 'Não foi possível conectar ao servidor — verifique sua internet e tente de novo.'
}

export async function login(email: string, password: string, trustDevice: boolean): Promise<{ ok: boolean; error?: string }> {
  setTrustDevice(trustDevice)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (!error) return { ok: true }
      if (error.status === 429 || attempt === 2) return { ok: false, error: friendlyLoginError(error) }
      // status ausente/5xx = falha transitória de rede — 1 nova tentativa antes de desistir
      if (error.status && error.status < 500) return { ok: false, error: friendlyLoginError(error) }
    } catch {
      if (attempt === 2) return { ok: false, error: 'Não foi possível conectar ao servidor — verifique sua internet e tente de novo.' }
    }
    await new Promise(r => setTimeout(r, 800))
  }
  return { ok: false, error: 'Não foi possível conectar ao servidor — tente de novo.' }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
}

export async function isAuthenticated(): Promise<boolean> {
  const { data } = await supabase.auth.getSession()
  return !!data.session
}

export async function changePassword(newPassword: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export function onAuthChange(callback: (authenticated: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(!!session)
  })
  return () => data.subscription.unsubscribe()
}
