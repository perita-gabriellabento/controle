'use client'

import { supabase } from './supabaseClient'
import { withRetry } from './utils'

export interface Anexo {
  id: string
  createdAt: string
  nomeArquivo: string
  storagePath: string
  tamanhoBytes: number
  tipoMime: string
}

const BUCKET = 'anexos-pericias'
export const TAMANHO_MAX_BYTES = 10 * 1024 * 1024 // 10MB — mesmo limite configurado no bucket
export const TIPOS_PERMITIDOS = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
export const EXTENSOES_PERMITIDAS = '.pdf,.jpg,.jpeg,.png,.doc,.docx'

function dbToAnexo(row: any): Anexo {
  return {
    id: row.id,
    createdAt: row.created_at,
    nomeArquivo: row.nome_arquivo,
    storagePath: row.storage_path,
    tamanhoBytes: row.tamanho_bytes,
    tipoMime: row.tipo_mime,
  }
}

export async function fetchAnexos(periciaId: string): Promise<Anexo[]> {
  const { data, error } = await withRetry<any[]>(() => supabase.from('pericia_anexos').select('*').eq('pericia_id', periciaId).order('created_at') as any)
  if (error) throw new Error(error.message)
  return (data || []).map(dbToAnexo)
}

export function validarArquivo(file: File): string | null {
  if (file.size > TAMANHO_MAX_BYTES) return `Arquivo muito grande (máx. 10MB) — este tem ${(file.size / 1024 / 1024).toFixed(1)}MB`
  if (!TIPOS_PERMITIDOS.includes(file.type)) return 'Tipo de arquivo não permitido — só PDF, imagem (JPG/PNG) ou Word'
  return null
}

export async function uploadAnexo(periciaId: string, file: File): Promise<{ ok: boolean; error?: string }> {
  const erroValidacao = validarArquivo(file)
  if (erroValidacao) return { ok: false, error: erroValidacao }

  const path = `${periciaId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error: uploadErr } = await supabase.storage.from(BUCKET).upload(path, file)
  if (uploadErr) return { ok: false, error: uploadErr.message }

  const { error: dbErr } = await supabase.from('pericia_anexos').insert({
    pericia_id: periciaId,
    nome_arquivo: file.name,
    storage_path: path,
    tamanho_bytes: file.size,
    tipo_mime: file.type,
  })
  if (dbErr) {
    // upload foi, mas o metadado não — remove o arquivo órfão pra não sobrar lixo na cota
    await supabase.storage.from(BUCKET).remove([path])
    return { ok: false, error: dbErr.message }
  }
  return { ok: true }
}

export async function deleteAnexo(anexo: Anexo): Promise<{ ok: boolean; error?: string }> {
  const { error: storageErr } = await withRetry(() => supabase.storage.from(BUCKET).remove([anexo.storagePath]) as any)
  if (storageErr) return { ok: false, error: storageErr.message }
  const { error: dbErr } = await withRetry(() => supabase.from('pericia_anexos').delete().eq('id', anexo.id) as any)
  if (dbErr) return { ok: false, error: dbErr.message }
  return { ok: true }
}

export async function getAnexoUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await withRetry<any>(() => supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60) as any)
  if (error) return null
  return data.signedUrl
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
