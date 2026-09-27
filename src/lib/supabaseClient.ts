'use client'

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

const TRUST_KEY = 'gb_trust_device'

// "Confiar neste dispositivo": marcado -> sessão sobrevive fechar/abrir o navegador (localStorage);
// desmarcado -> sessão só dura enquanto a aba estiver aberta (sessionStorage). O adapter abaixo
// delega dinamicamente pro backend certo, sem precisar recriar o client do Supabase.
let useSessionOnly = false
try {
  useSessionOnly = typeof window !== 'undefined' && window.localStorage.getItem(TRUST_KEY) === 'false'
} catch {
  useSessionOnly = false
}

function backingStore(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return useSessionOnly ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

const dynamicStorage = {
  getItem: (key: string) => backingStore()?.getItem(key) ?? null,
  setItem: (key: string, value: string) => { try { backingStore()?.setItem(key, value) } catch {} },
  removeItem: (key: string) => { try { backingStore()?.removeItem(key) } catch {} },
}

export function setTrustDevice(trust: boolean): void {
  useSessionOnly = !trust
  try { window.localStorage.setItem(TRUST_KEY, String(trust)) } catch {}
}

export function getTrustDevice(): boolean {
  return !useSessionOnly
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: dynamicStorage,
  },
})

// Fetch autenticado pras rotas de API do Calendar — anexa o token da sessão
// atual como Authorization: Bearer, que as rotas validam no servidor. Sem isso,
// as rotas rejeitam com 401 (elas usam a chave admin do Supabase, que ignora
// RLS de propósito, então a autenticação tem que ser checada manualmente ali).
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: token ? `Bearer ${token}` : '' },
  })
}
