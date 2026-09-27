'use client'

import { supabase, setTrustDevice } from './supabaseClient'

export async function login(email: string, password: string, trustDevice: boolean): Promise<{ ok: boolean; error?: string }> {
  setTrustDevice(trustDevice)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
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
