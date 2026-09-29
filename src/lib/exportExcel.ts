'use client'

import type { Pericia } from './types'

// Mesmas colunas da planilha antiga (Google Sheets), na mesma ordem — pra abrir
// no Excel e continuar reconhecível pra quem usava o sistema anterior.
type ColTipo = 'texto' | 'dinheiro' | 'data'

const COLUNAS: { header: string; tipo: ColTipo; get: (p: Pericia) => string | number }[] = [
  { header: 'Qtd',                       tipo: 'texto',    get: p => p.qtd || '' },
  { header: 'Origem',                    tipo: 'texto',    get: p => p.origem },
  { header: 'Polo Ativo',                tipo: 'texto',    get: p => p.poloAtivo },
  { header: 'Polo Passivo',              tipo: 'texto',    get: p => p.poloPassivo },
  { header: 'UF',                        tipo: 'texto',    get: p => p.uf },
  { header: 'Cidade',                    tipo: 'texto',    get: p => p.cidade },
  { header: 'Vara',                      tipo: 'texto',    get: p => p.vara },
  { header: 'Número do Processo',        tipo: 'texto',    get: p => p.numeroProcesso },
  { header: 'Código de Acesso',          tipo: 'texto',    get: p => p.codigoAcesso },
  { header: 'Assunto',                   tipo: 'texto',    get: p => p.assunto },
  { header: 'Tipo',                      tipo: 'texto',    get: p => p.tipo },
  { header: 'Valor Proposta (R$)',       tipo: 'dinheiro', get: p => p.valorPropostaHonorarios ? parseFloat(p.valorPropostaHonorarios) : '' },
  { header: 'Valor Honorários (R$)',     tipo: 'dinheiro', get: p => p.valorHonorarios ? parseFloat(p.valorHonorarios) : '' },
  { header: 'Honorários Recebidos (R$)', tipo: 'dinheiro', get: p => p.honorariosRecebidos ? parseFloat(p.honorariosRecebidos) : '' },
  { header: 'Solicitar Docs',            tipo: 'texto',    get: p => p.solicitarDocs },
  { header: 'Início',                    tipo: 'data',     get: p => p.inicio },
  { header: 'Entrega Prevista',          tipo: 'data',     get: p => p.entregaPrevista },
  { header: 'Fase',                      tipo: 'texto',    get: p => p.fase },
  { header: 'Arquivado',                 tipo: 'texto',    get: p => p.arquivado ? 'Sim' : 'Não' },
  { header: 'Status da Proposta',        tipo: 'texto',    get: p => p.propostaStatus || '' },
  { header: 'Categoria ASPECON',         tipo: 'texto',    get: p => p.propostaCategoria || '' },
]

// Data como texto ISO ("YYYY-MM-DD") → serial de data do Excel (dias desde 1899-12-30),
// só com aritmética UTC pura — nunca `new Date(string)` — pra não correr risco de
// deslocar um dia por fuso horário, o mesmo cuidado já seguido em businessDays.ts.
function isoDateToExcelSerial(iso: string): number | '' {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000)
}

function colLetter(i: number): string {
  let s = ''
  let n = i + 1
  while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(65 + rem) + s; n = Math.floor((n - 1) / 26) }
  return s
}

export async function exportPericiasToExcel(pericias: Pericia[]): Promise<void> {
  const [XLSX, PizZipMod] = await Promise.all([import('xlsx'), import('pizzip')])
  const PizZip = PizZipMod.default

  const headerRow = COLUNAS.map(c => c.header)
  const dataRows = pericias.map(p => COLUNAS.map(c => {
    const v = c.get(p)
    if (c.tipo === 'data' && typeof v === 'string') return isoDateToExcelSerial(v)
    return v
  }))

  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
  ws['!cols'] = COLUNAS.map(c => ({ wch: Math.max(c.header.length + 2, 14) }))
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataRows.length, c: COLUNAS.length - 1 } }) }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Perícias')
  const baseBuf: ArrayBuffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

  const zip = new PizZip(baseBuf)
  aplicarFormatacao(zip, dataRows.length)

  const blob = zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const hoje = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')
  a.download = `Pericias_Gabriella_${hoje}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Injeta estilo real no XLSX gerado — a biblioteca xlsx (community) escreve os dados
// certos mas NÃO aplica negrito/cor/borda ao gravar (isso é limitação conhecida da
// versão gratuita); por isso a formatação visual é adicionada aqui, direto no XML,
// depois que os dados já foram gravados. Testado byte a byte com leitura independente
// (openpyxl) antes de ir pra produção — cabeçalho, moeda, data e zebra confirmados.
function aplicarFormatacao(zip: any, numDataRows: number): void {
  let styles: string = zip.file('xl/styles.xml').asText()

  const FONT_HEADER = '<font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>'
  const FILL_HEADER = '<fill><patternFill patternType="solid"><fgColor rgb="FF1B2A4A"/><bgColor indexed="64"/></patternFill></fill>'
  const FILL_ZEBRA = '<fill><patternFill patternType="solid"><fgColor rgb="FFF7F3E8"/><bgColor indexed="64"/></patternFill></fill>'
  const BORDER_THIN = '<border><left style="thin"><color rgb="FFD9D3C0"/></left><right style="thin"><color rgb="FFD9D3C0"/></right><top style="thin"><color rgb="FFD9D3C0"/></top><bottom style="thin"><color rgb="FFD9D3C0"/></bottom><diagonal/></border>'
  const NUMFMT_MONEY = '<numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00"/>'
  const NUMFMT_DATE = '<numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>'

  const fontBase = parseInt(styles.match(/<fonts count="(\d+)">/)![1])
  styles = styles.replace(/<fonts count="\d+">/, () => `<fonts count="${fontBase + 1}">`)
  styles = styles.replace('</fonts>', () => FONT_HEADER + '</fonts>')

  const fillBase = parseInt(styles.match(/<fills count="(\d+)">/)![1])
  styles = styles.replace(/<fills count="\d+">/, () => `<fills count="${fillBase + 2}">`)
  styles = styles.replace('</fills>', () => FILL_HEADER + FILL_ZEBRA + '</fills>')

  const borderBase = parseInt(styles.match(/<borders count="(\d+)">/)![1])
  styles = styles.replace(/<borders count="\d+">/, () => `<borders count="${borderBase + 1}">`)
  styles = styles.replace('</borders>', () => BORDER_THIN + '</borders>')

  const numFmtMatch = styles.match(/<numFmts count="(\d+)">/)
  if (numFmtMatch) {
    const numFmtBase = parseInt(numFmtMatch[1])
    styles = styles.replace(/<numFmts count="\d+">/, () => `<numFmts count="${numFmtBase + 2}">`)
    styles = styles.replace('</numFmts>', () => NUMFMT_MONEY + NUMFMT_DATE + '</numFmts>')
  } else {
    styles = styles.replace('<fonts', () => `<numFmts count="2">${NUMFMT_MONEY}${NUMFMT_DATE}</numFmts><fonts`)
  }

  const FONT_HEADER_IDX = fontBase
  const FILL_HEADER_IDX = fillBase
  const FILL_ZEBRA_IDX = fillBase + 1
  const BORDER_IDX = borderBase

  const xfBase = parseInt(styles.match(/<cellXfs count="(\d+)">/)![1])
  const newXfs = [
    `<xf numFmtId="0" fontId="${FONT_HEADER_IDX}" fillId="${FILL_HEADER_IDX}" borderId="${BORDER_IDX}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>`, // header
    `<xf numFmtId="0" fontId="0" fillId="0" borderId="${BORDER_IDX}" xfId="0" applyBorder="1"/>`, // plain
    `<xf numFmtId="0" fontId="0" fillId="${FILL_ZEBRA_IDX}" borderId="${BORDER_IDX}" xfId="0" applyFill="1" applyBorder="1"/>`, // plain zebra
    `<xf numFmtId="164" fontId="0" fillId="0" borderId="${BORDER_IDX}" xfId="0" applyNumberFormat="1" applyBorder="1"/>`, // money
    `<xf numFmtId="164" fontId="0" fillId="${FILL_ZEBRA_IDX}" borderId="${BORDER_IDX}" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>`, // money zebra
    `<xf numFmtId="165" fontId="0" fillId="0" borderId="${BORDER_IDX}" xfId="0" applyNumberFormat="1" applyBorder="1"/>`, // date
    `<xf numFmtId="165" fontId="0" fillId="${FILL_ZEBRA_IDX}" borderId="${BORDER_IDX}" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>`, // date zebra
  ]
  styles = styles.replace(/<cellXfs count="\d+">/, () => `<cellXfs count="${xfBase + newXfs.length}">`)
  styles = styles.replace('</cellXfs>', () => newXfs.join('') + '</cellXfs>')

  zip.file('xl/styles.xml', styles)

  const XF_HEADER = xfBase, XF_PLAIN = xfBase + 1, XF_PLAIN_Z = xfBase + 2
  const XF_MONEY = xfBase + 3, XF_MONEY_Z = xfBase + 4, XF_DATE = xfBase + 5, XF_DATE_Z = xfBase + 6

  let sheet: string = zip.file('xl/worksheets/sheet1.xml').asText()
  for (let col = 0; col < COLUNAS.length; col++) {
    const letter = colLetter(col)
    const tipo = COLUNAS[col].tipo
    sheet = sheet.replace(new RegExp(`<c r="${letter}1"([^>]*)>`), (_m: string, attrs: string) => `<c r="${letter}1"${attrs} s="${XF_HEADER}">`)
    for (let row = 0; row < numDataRows; row++) {
      const excelRow = row + 2
      const zebra = row % 2 === 1
      const xf = tipo === 'dinheiro' ? (zebra ? XF_MONEY_Z : XF_MONEY)
        : tipo === 'data' ? (zebra ? XF_DATE_Z : XF_DATE)
        : (zebra ? XF_PLAIN_Z : XF_PLAIN)
      sheet = sheet.replace(new RegExp(`<c r="${letter}${excelRow}"([^>]*)>`), (_m: string, attrs: string) => `<c r="${letter}${excelRow}"${attrs} s="${xf}">`)
    }
  }
  sheet = sheet.replace(/<row r="1"([^>]*)>/, (_m: string, attrs: string) => `<row r="1"${attrs} ht="20" customHeight="1">`)
  zip.file('xl/worksheets/sheet1.xml', sheet)
}
