'use client'

import type { Pericia } from './types'

// Mesmas colunas da planilha antiga (Google Sheets), na mesma ordem — pra abrir
// no Excel e continuar reconhecível pra quem usava o sistema anterior.
const COLUNAS: { header: string; get: (p: Pericia) => string | number }[] = [
  { header: 'Qtd',                    get: p => p.qtd || '' },
  { header: 'Origem',                 get: p => p.origem },
  { header: 'Polo Ativo',             get: p => p.poloAtivo },
  { header: 'Polo Passivo',           get: p => p.poloPassivo },
  { header: 'UF',                     get: p => p.uf },
  { header: 'Cidade',                 get: p => p.cidade },
  { header: 'Vara',                   get: p => p.vara },
  { header: 'Número do Processo',     get: p => p.numeroProcesso },
  { header: 'Código de Acesso',       get: p => p.codigoAcesso },
  { header: 'Assunto',                get: p => p.assunto },
  { header: 'Tipo',                   get: p => p.tipo },
  { header: 'Valor Proposta (R$)',    get: p => p.valorPropostaHonorarios ? parseFloat(p.valorPropostaHonorarios) : '' },
  { header: 'Valor Honorários (R$)',  get: p => p.valorHonorarios ? parseFloat(p.valorHonorarios) : '' },
  { header: 'Honorários Recebidos (R$)', get: p => p.honorariosRecebidos ? parseFloat(p.honorariosRecebidos) : '' },
  { header: 'Solicitar Docs',         get: p => p.solicitarDocs },
  { header: 'Início',                 get: p => p.inicio },
  { header: 'Entrega Prevista',       get: p => p.entregaPrevista },
  { header: 'Fase',                   get: p => p.fase },
  { header: 'Arquivado',              get: p => p.arquivado ? 'Sim' : 'Não' },
  { header: 'Status da Proposta',     get: p => p.propostaStatus || '' },
  { header: 'Categoria ASPECON',      get: p => p.propostaCategoria || '' },
]

export async function exportPericiasToExcel(pericias: Pericia[]): Promise<void> {
  const XLSX = await import('xlsx')

  const rows = pericias.map(p => {
    const row: Record<string, string | number> = {}
    for (const col of COLUNAS) row[col.header] = col.get(p)
    return row
  })

  const ws = XLSX.utils.json_to_sheet(rows, { header: COLUNAS.map(c => c.header) })
  ws['!cols'] = COLUNAS.map(c => ({ wch: Math.max(c.header.length + 2, 14) }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Perícias')

  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  XLSX.writeFile(wb, `Perícias_Gabriella_${hoje}.xlsx`)
}
