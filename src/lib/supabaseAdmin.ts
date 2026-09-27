// Client Supabase de servidor — usa a secret key (ignora RLS).
// NUNCA importar isso de um componente 'use client'. Só rotas de API (src/app/api/**).

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || ''

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
