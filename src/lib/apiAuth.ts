// Autenticação das rotas de API do Calendar. Como essas rotas usam a secret key
// do Supabase (ignora RLS de propósito, pra poder ler/escrever tokens que o
// client nunca pode ver), CADA rota precisa validar a sessão manualmente —
// RLS não protege nada aqui.

import { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabaseAdmin'

export async function requireAuth(req: NextRequest): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return { userId: data.user.id }
}
