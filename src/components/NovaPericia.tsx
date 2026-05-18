'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'
import { FASES, TIPOS, ORIGENS, UFS, type Pericia } from '@/lib/types'
import { appendPericia, invalidateCache } from '@/lib/sheets'

interface NovaPericiasProps {
  onCreated: () => void
}

const EMPTY: Omit<Pericia, 'row'> = {
  qtd: '',
  origem: '',
  poloAtivo: '',
  poloPassivo: '',
  uf: '',
  cidade: '',
  vara: '',
  numeroProcesso: '',
  codigoAcesso: '',
  assunto: '',
  tipo: '',
  valorPropostaHonorarios: '',
  valorHonorarios: '',
  honorariosRecebidos: '',
  solicitarDocs: '',
  inicio: '',
  entregaPrevista: '',
  fase: '',
}

interface FieldConfig {
  key: keyof typeof EMPTY
  label: string
  required?: boolean
  type?: string
  options?: string[]
  optionLabels?: Record<string, string>
  gridCol?: string
}

const FIELDS: FieldConfig[] = [
  { key: 'poloAtivo',       label: 'Polo Ativo (Requerente)', required: true, gridCol: 'col-span-2' },
  { key: 'poloPassivo',     label: 'Polo Passivo (Requerido)', required: true, gridCol: 'col-span-2' },
  { key: 'numeroProcesso',  label: 'Número do Processo (CNJ)', required: true, gridCol: 'col-span-2' },
  { key: 'codigoAcesso',    label: 'Código de Acesso', gridCol: 'col-span-2' },
  { key: 'assunto',         label: 'Assunto / Tipo de Perícia', gridCol: 'col-span-2' },
  { key: 'vara',            label: 'Vara Judicial' },
  { key: 'cidade',          label: 'Cidade' },
  { key: 'uf',              label: 'UF', type: 'select', options: ['', ...UFS] },
  { key: 'origem',          label: 'Origem', type: 'select', options: ['', ...ORIGENS] },
  { key: 'tipo',            label: 'Tipo', type: 'select', options: ['', ...TIPOS], optionLabels: { 'Assistência Judiciária Gratuita': 'AJG' } },
  { key: 'fase',                    label: 'Status', type: 'select', options: ['', ...FASES], gridCol: 'col-span-2' },
  { key: 'valorPropostaHonorarios', label: 'Valor Proposta Honorários (R$)', type: 'currency' },
  { key: 'valorHonorarios',         label: 'Valor Honorários (R$) (calculado)', type: 'currency' },
  { key: 'honorariosRecebidos',     label: 'Honorários Recebidos (R$)', type: 'currency' },
  { key: 'solicitarDocs',   label: 'Solicitar Docs?', type: 'select', options: ['', 'Sim', 'Não'] },
  { key: 'inicio',          label: 'Data de Início', type: 'date' },
  { key: 'entregaPrevista', label: 'Entrega Prevista', type: 'date' },
]

export default function NovaPericia({ onCreated }: NovaPericiasProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<typeof EMPTY>({ ...EMPTY })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const proposta = parseFloat(form.valorPropostaHonorarios || '0') || 0
    if (proposta <= 0) return
    const efetivo = form.origem === 'Indicação' ? +(proposta * 0.4).toFixed(2) : proposta
    setForm(f => ({ ...f, valorHonorarios: String(efetivo) }))
  }, [form.valorPropostaHonorarios, form.origem])

  function reset() { setForm({ ...EMPTY }) }

  function set<K extends keyof typeof EMPTY>(key: K, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.poloAtivo.trim() || !form.poloPassivo.trim() || !form.numeroProcesso.trim()) {
      toast.error('Polo Ativo, Polo Passivo e Número do Processo são obrigatórios')
      return
    }
    setSaving(true)
    try {
      const res = await appendPericia(form as Omit<Pericia, 'row'>)
      if (!res.ok) throw new Error(res.error || 'Erro ao salvar')
      invalidateCache()
      toast.success('Perícia adicionada com sucesso')
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset() }}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="btn-gold-shimmer flex items-center gap-2 h-10 px-6 rounded-xl text-[13px] font-cinzel font-semibold tracking-[0.12em] flex-shrink-0"
          style={{ color: '#1A2535' }}
        >
          <Plus size={13} strokeWidth={2.5} />
          Nova Perícia
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Perícia</DialogTitle>
          <p className="text-xs text-text/50 mt-1">Preencha os dados do novo processo pericial.</p>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4 p-6">
            {FIELDS.map(field => (
              <div key={field.key} className={`flex flex-col gap-1.5 ${field.gridCol || ''}`}>
                <Label htmlFor={`nova-${field.key}`}>
                  {field.label}{field.required && <span className="text-gold ml-0.5">*</span>}
                </Label>
                {field.type === 'select' ? (
                  <select
                    id={`nova-${field.key}`}
                    value={String(form[field.key] ?? '')}
                    onChange={e => set(field.key, e.target.value)}
                    className="h-9 rounded bg-surface-2 border border-[var(--border)] px-3 text-[14px] text-text focus:outline-none focus:border-gold/50"
                  >
                    {(field.options || []).map(o => (
                      <option key={o} value={o}>
                        {o === '' ? 'Selecione...' : (field.optionLabels?.[o] || o)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id={`nova-${field.key}`}
                    type={field.type === 'date' ? 'date' : 'text'}
                    value={String(form[field.key] ?? '')}
                    onChange={e => set(field.key, e.target.value)}
                    placeholder={field.type === 'currency' ? 'ex: 3500' : ''}
                  />
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Salvando…' : 'Adicionar Perícia'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
