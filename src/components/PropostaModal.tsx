'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { X, Download, Save, FileText, ChevronDown, Trash2 } from 'lucide-react'
import { Pericia, ASPECON_TABLE, PROPOSTA_STATUS, type PropostaStatus } from '@/lib/types'
import { saveProposta } from '@/lib/sheets'
import { formatCurrency, valorParaExtenso, formatValorBR } from '@/lib/utils'

interface PropostaModalProps {
  pericia: Pericia
  onClose: () => void
  onSaved: () => void
}

function suggestCategory(assunto: string): number {
  const a = assunto.toLowerCase()
  if (a.includes('trabalhista') || a.includes('fgts') || a.includes('rescisão') || a.includes('salarial')) return 11
  if (a.includes('previdência') || a.includes('aposentadoria') || a.includes('benefício')) return 17
  if (a.includes('dissolução parcial')) return 26
  if (a.includes('dissolução')) return 27
  if (a.includes('haveres') && (a.includes('grande') || a.includes('major'))) return 25
  if (a.includes('haveres') && (a.includes('médio') || a.includes('media'))) return 24
  if (a.includes('haveres')) return 23
  if (a.includes('recuperação judicial') || a.includes('falência')) return 28
  if (a.includes('prestação de contas')) return 18
  if (a.includes('lucro cessante')) return 21
  if (a.includes('indenização') || a.includes('danos materiais') || a.includes('danos')) return 22
  if (a.includes('liquidação')) return 19
  if (a.includes('reintegração') || a.includes('desapropriação')) return 20
  if (a.includes('fiscal') || a.includes('tributário') || a.includes('imposto')) return 14
  if (a.includes('cartão')) return 4
  if (a.includes('consignado') || a.includes('empréstimo') || a.includes('contrato bancário') || a.includes('contrato rural')) return 1
  if (a.includes('hipotecário') || a.includes('sfh') || a.includes('financiamento')) return 2
  if (a.includes('leasing') || a.includes('consórcio')) return 3
  if (a.includes('cheque especial')) return 5
  if (a.includes('crime')) return 31
  if (a.includes('fundo de comércio')) return 33
  return 1
}

function buildDescricaoCaso(p: Pericia): string {
  return `No caso em exame, a perícia contábil foi determinada com a finalidade de ${p.assunto || 'analisar a matéria técnico-contábil objeto da demanda'}, conforme determinado nos autos do processo ${p.numeroProcesso}.`
}

// Livre — cada decisão de nomeação é redigida diferente pelo juízo (às vezes cita "página",
// às vezes "evento", às vezes há mais de uma decisão quando o perito anterior não se manifestou).
// O padrão cobre o caso simples; a Gabi reescreve inteiro quando o caso for mais complexo.
const TRECHO_DECISAO_PADRAO = `“(...) Nomeio para a realização da perícia contábil a perita GABRIELLA BENTO DE OLIVEIRA, CRC/GO n° 028466/O-5, que deverá ser intimada pessoalmente para dizer se aceita o encargo e, em caso afirmativo, apresentar proposta de honorários no prazo de 05 (cinco) dias. (...)”`

const ESCOPO_PADRAO = `A execução dos trabalhos periciais demandará análise técnica dos documentos constantes nos autos, exame dos contratos e registros contábeis objeto da demanda, realização dos cálculos pertinentes e elaboração do laudo pericial contábil.`

const ITENS_ESCOPO_PADRAO = [
  'análise da documentação constante dos autos;',
  'exame técnico dos documentos e contratos objeto da demanda;',
  'verificação dos lançamentos contábeis e registros financeiros;',
  'realização de cálculos e simulações pertinentes;',
  'elaboração de planilhas técnicas;',
  'emissão do laudo pericial contábil;',
  'respostas aos quesitos apresentados pelas partes;',
  'prestação de esclarecimentos técnicos solicitados pelas partes e por este Juízo.',
]

function formatItensEscopo(raw: string | string[]): string {
  const items = Array.isArray(raw)
    ? raw
    : raw.split('\n').map(s => s.trim()).filter(Boolean)
  return items.map(s => (s.startsWith('•') ? s : `• ${s}`)).join('\n')
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Pendente':  { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
  'Enviada':   { bg: 'rgba(59,130,246,0.15)',  text: '#3B82F6', border: 'rgba(59,130,246,0.3)'  },
  'Aceita':    { bg: 'rgba(34,197,94,0.15)',   text: '#22C55E', border: 'rgba(34,197,94,0.3)'   },
  'Recusada':  { bg: 'rgba(239,68,68,0.15)',   text: '#EF4444', border: 'rgba(239,68,68,0.3)'   },
}

export default function PropostaModal({ pericia: p, onClose, onSaved }: PropostaModalProps) {
  const suggestedCat = suggestCategory(p.assunto)
  const suggestedItem = ASPECON_TABLE.find(i => i.id === suggestedCat) || ASPECON_TABLE[0]

  const [categoriaId, setCategoriaId] = useState(
    p.propostaCategoria ? parseInt(p.propostaCategoria) : suggestedCat
  )
  const [valor, setValor] = useState(
    p.propostaValor ? parseFloat(p.propostaValor).toFixed(2).replace('.', ',') : formatValorBR(suggestedItem.valorMin)
  )
  const [status, setStatus] = useState<PropostaStatus>(p.propostaStatus as PropostaStatus || 'Pendente')
  const [eventoNum, setEventoNum] = useState('')
  const [trechoDecisao, setTrechoDecisao] = useState(TRECHO_DECISAO_PADRAO)
  const [descricao, setDescricao] = useState(buildDescricaoCaso(p))
  const [escopo, setEscopo] = useState(ESCOPO_PADRAO)
  const [itensEscopo, setItensEscopo] = useState<string[]>(ITENS_ESCOPO_PADRAO)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [valorFlash, setValorFlash] = useState(false)

  const selectedItem = ASPECON_TABLE.find(i => i.id === categoriaId)

  function handleCategoriaChange(id: number) {
    setCategoriaId(id)
    const item = ASPECON_TABLE.find(i => i.id === id)
    if (item) {
      setValor(formatValorBR(item.valorMin))
      setValorFlash(true)
      setTimeout(() => setValorFlash(false), 600)
    }
  }

  function parseValor(): number {
    return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
  }

  async function handleSave() {
    const valorNum = String(parseValor())
    // saveProposta updates cache synchronously before the API call — safe to close immediately
    const savePromise = saveProposta(p.id, status, valorNum, String(categoriaId))
    onSaved()
    onClose()
    try {
      const res = await savePromise
      if (!res.ok) throw new Error(res.error || 'Falha ao salvar')
      toast.success('Proposta salva')
    } catch {
      toast.error('Erro ao salvar proposta — tente novamente')
    }
  }

  async function handleClearProposta() {
    if (!confirm('Excluir a proposta deste processo? Os dados de valor e categoria serão removidos.')) return
    const savePromise = saveProposta(p.id, '', '', '')
    onSaved()
    onClose()
    try {
      const res = await savePromise
      if (!res.ok) throw new Error(res.error || 'Falha')
      toast.success('Proposta excluída')
    } catch {
      toast.error('Erro ao excluir proposta — tente novamente')
    }
  }

    async function handleGenerate() {
    setGenerating(true)
    try {
      const valorNum = parseValor()
      const valorNumStr = formatValorBR(valorNum)
      const valorExtensoStr = valorParaExtenso(valorNum)

      const varaComarca = [p.vara, p.cidade, p.uf].filter(Boolean).join(', ')
      const data = {
        vara_comarca: varaComarca || 'VARA CÍVEL',
        numero_processo: p.numeroProcesso || '—',
        natureza: p.assunto || p.tipo || 'PROCEDIMENTO',
        polo_ativo: p.poloAtivo.toUpperCase() || '—',
        polo_passivo: p.poloPassivo.toUpperCase() || '—',
        evento_numero: eventoNum || 'XX',
        trecho_decisao: trechoDecisao,
        descricao_caso: descricao,
        escopo_trabalhos: escopo,
        itens_escopo: formatItensEscopo(itensEscopo),
        valor_numerico: valorNumStr,
        valor_extenso: valorExtensoStr,
      }

      const [PizZip, Docxtemplater] = await Promise.all([
        import('pizzip').then(m => m.default),
        import('docxtemplater').then(m => m.default),
      ])

      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/template-proposta.docx?v=` + Date.now(), { cache: 'no-store' })
      if (!response.ok) throw new Error('Template não encontrado')
      const arrayBuffer = await response.arrayBuffer()
      const zip = new PizZip(arrayBuffer)
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true })
      doc.render(data)

      const blob = doc.getZip().generate({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Proposta_${(p.numeroProcesso || p.id).toString().replace(/[^a-z0-9]/gi, '_')}.docx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      // Save status as Enviada after generating
      if (status === 'Pendente') {
        setStatus('Enviada')
        await saveProposta(p.id, 'Enviada', String(parseValor()), String(categoriaId))
      } else {
        await saveProposta(p.id, status, String(parseValor()), String(categoriaId))
      }
      onSaved()
      toast.success('Proposta gerada e baixada!')
    } catch (err) {
      console.error(err)
      toast.error(`Erro ao gerar proposta: ${err instanceof Error ? err.message : 'verifique o template'}`)
    } finally {
      setGenerating(false)
    }
  }

  const sc = STATUS_COLORS[status] || STATUS_COLORS['Pendente']

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-2xl max-h-[94vh] sm:max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl font-montserrat mx-0 sm:mx-4"
        style={{
          background: 'linear-gradient(160deg, var(--comp-modal-from) 0%, var(--comp-modal-to) 100%)',
          border: '1px solid var(--border)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Handle (mobile bottom sheet) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <FileText size={16} style={{ color: '#D4AF37' }} />
              <span className="text-[12px] font-semibold uppercase tracking-[0.15em] text-gold/70">Proposta de Honorários</span>
            </div>
            <h2 className="font-cinzel text-[17px] text-text/90 leading-snug">
              {p.poloAtivo} <span className="text-text/30 font-normal">×</span> {p.poloPassivo}
            </h2>
            <p className="text-[12px] text-text/35 mt-1 font-mono">{p.numeroProcesso}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-text/30 hover:text-text/70 transition-all flex-shrink-0 mt-0.5" onMouseEnter={e=>(e.currentTarget.style.background='var(--comp-close-hover)')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
            <X size={15} />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Status */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">Status da Proposta</label>
            <div className="flex gap-2 flex-wrap">
              {PROPOSTA_STATUS.filter(Boolean).map(s => {
                const c = STATUS_COLORS[s!] || STATUS_COLORS['Pendente']
                const active = status === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s!)}
                    className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all duration-150"
                    style={{
                      background: active ? c.bg : 'var(--surface-2)',
                      color: active ? c.text : 'var(--muted)',
                      border: `1px solid ${active ? c.border : 'var(--border)'}`,
                      transform: active ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    {s}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Categoria ASPECON + Valor */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
            <div className="flex flex-col gap-2.5">
              <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">
                Categoria ASPECON-GO 2026
              </label>
              <div className="relative">
                <select
                  value={categoriaId}
                  onChange={e => handleCategoriaChange(parseInt(e.target.value))}
                  className="w-full appearance-none rounded-xl px-3 py-2.5 pr-8 text-[13px] text-text/80 outline-none cursor-pointer"
                  style={{
                    background: 'var(--comp-cell-input)',
                    border: '1px solid rgba(212,175,55,0.2)',
                  }}
                >
                  {ASPECON_TABLE.map(item => (
                    <option key={item.id} value={item.id} style={{ background: 'var(--surface)' }}>
                      {item.id}. {item.descricao}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text/30 pointer-events-none" />
              </div>
              {selectedItem && (
                <p className="text-[12px] text-text/30">
                  A partir de <span className="text-gold/70">{formatCurrency(selectedItem.valorMin)}</span>
                  {selectedItem.valorMedio > 0 && (
                    <>, valor médio: <span className="text-text/45">{formatCurrency(selectedItem.valorMedio)}</span></>
                  )}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">Valor (R$)</label>
              <input
                type="text"
                value={valor}
                onChange={e => setValor(e.target.value)}
                className="w-full sm:w-36 rounded-xl px-3 py-2.5 text-[15px] font-bold text-center outline-none tabular-nums"
                style={{
                  background: valorFlash ? 'rgba(212,175,55,0.22)' : 'rgba(212,175,55,0.07)',
                  border: `1px solid ${valorFlash ? 'rgba(212,175,55,0.7)' : 'rgba(212,175,55,0.25)'}`,
                  color: valorFlash ? '#F5D76E' : 'var(--gold)',
                  boxShadow: valorFlash ? '0 0 12px rgba(212,175,55,0.35)' : 'none',
                  transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s',
                  transform: valorFlash ? 'scale(1.04)' : 'scale(1)',
                }}
                placeholder="0,00"
              />
              {parseValor() > 0 && (
                <p className="text-[12px] text-text/50 text-center leading-tight max-w-[144px]">
                  {valorParaExtenso(parseValor())}
                </p>
              )}
            </div>
          </div>

          {/* Evento */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">Nº do Evento</label>
            <input
              type="text"
              value={eventoNum}
              onChange={e => setEventoNum(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-[13px] text-text/80 outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              placeholder="ex: 119"
            />
          </div>

          {/* Trecho da decisão */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">Trecho da Decisão de Nomeação (Seção 1)</label>
            <p className="text-[11px] text-text/35 -mt-1">Reescreva inteiro se o caso tiver mais de uma decisão (ex: perito anterior que não se manifestou) — o campo é livre.</p>
            <textarea
              value={trechoDecisao}
              onChange={e => setTrechoDecisao(e.target.value)}
              rows={5}
              className="w-full rounded-xl px-3 py-2.5 text-[13px] text-text/75 outline-none resize-none leading-relaxed"
              style={{ background: 'var(--comp-textarea)', border: '1px solid var(--border)' }}
              placeholder="Cole aqui o(s) trecho(s) real(is) da decisão que nomeou a perita neste processo"
            />
          </div>

          {/* Descrição do caso */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">Descrição do Caso (Seção 4)</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              rows={4}
              className="w-full rounded-xl px-3 py-2.5 text-[13px] text-text/75 outline-none resize-none leading-relaxed"
              style={{ background: 'var(--comp-textarea)', border: '1px solid var(--border)' }}
            />
          </div>

          {/* Escopo */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[13px] uppercase tracking-[0.1em] text-text/60 font-semibold">Escopo dos Trabalhos</label>
            <textarea
              value={escopo}
              onChange={e => setEscopo(e.target.value)}
              rows={2}
              className="w-full rounded-xl px-3 py-2.5 text-[13px] text-text/75 outline-none resize-none leading-relaxed"
              style={{ background: 'var(--comp-textarea)', border: '1px solid var(--border)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] text-text/50 hover:text-text/80 transition-colors"
          >
            Cancelar
          </button>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleClearProposta}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] transition-all duration-150 text-red-400/60 hover:text-red-400 hover:bg-red-400/10"
            >
              <Trash2 size={12} />
              Excluir proposta
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] transition-all duration-150 disabled:opacity-40"
              style={{
                background: 'var(--comp-save-btn-bg)',
                border: '1px solid var(--border)',
                color: 'var(--comp-save-btn-text)',
              }}
            >
              <Save size={12} />
              {saving ? 'Salvando…' : 'Salvar Status'}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="btn-gold-shimmer flex items-center gap-2 px-5 py-2 rounded-xl text-[13px] font-cinzel font-semibold tracking-wider text-bg disabled:opacity-40"
            >
              <Download size={12} />
              {generating ? 'Gerando…' : 'Gerar .docx'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
