// Regras de prazo pedidas pela Gabi em 05/10/2026 (respostas do questionário, ver CLAUDE.md).
// Funções puras, sem dependência de browser ou servidor: usadas pela tabela, pelo formulário
// de nova perícia e pela rota de sincronização do Calendar.

import { addCalendarDays } from './businessDays'

export const FASE_IMPUGNACAO = 'Impugnação de laudo'
export const FASE_REVOGADO = 'Revogado'

// Entrega do laudo = início + 30 dias corridos, vale pra todos os tipos de perícia.
// Se cair em fim de semana ou feriado, mantém a data como saiu (resposta da Gabi).
export const PRAZO_ENTREGA_DIAS = 30

// Ligado em 05/10/2026 depois da confirmação da Gabi (rodada 2): "30 dias corridos". Ela foi
// perguntada porque 3 de 9 entregas dela estão no mesmo dia do mês seguinte (31 dias); manteve 30.
export const ENTREGA_AUTOMATICA_ATIVA = true

export function calcEntregaAuto(inicioISO: string): string {
  return addCalendarDays(inicioISO, PRAZO_ENTREGA_DIAS)
}

// Decide se a entrega deve ser preenchida sozinha quando a data de início muda.
// Devolve a nova entrega, ou null pra deixar como está.
//  - entrega vazia: preenche;
//  - entrega igual ao que o app calcularia pro início ANTERIOR: era automática, recalcula;
//  - qualquer outra: a Gabi digitou à mão, mantém.
// Só aceita data completa e plausível. O campo de data do navegador emite valores
// intermediários enquanto se digita o ano (0002, 0020, 0202...), que não podem virar prazo.
export function dataValida(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  if (!m) return false
  const y = +m[1], mo = +m[2], d = +m[3]
  if (y < 1900 || y > 2100) return false
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

// Início apagado: se a entrega era exatamente a calculada a partir dele, ela some junto
// (devolve ''); se a Gabi digitou a entrega à mão, fica (devolve null).
export function entregaAoLimparInicio(args: { inicioAntigo: string; entregaAtual: string }): string | null {
  const { inicioAntigo, entregaAtual } = args
  if (!dataValida(inicioAntigo) || !entregaAtual) return null
  return entregaAtual === calcEntregaAuto(inicioAntigo) ? '' : null
}

export function entregaAutomatica(args: { inicioNovo: string; inicioAntigo: string; entregaAtual: string }): string | null {
  const { inicioNovo, inicioAntigo, entregaAtual } = args
  if (!dataValida(inicioNovo)) return null
  const nova = calcEntregaAuto(inicioNovo)
  if (!entregaAtual) return nova
  if (dataValida(inicioAntigo) && entregaAtual === calcEntregaAuto(inicioAntigo)) return nova === entregaAtual ? null : nova
  return null
}

// Fases em que o laudo já foi entregue: a coluna Entrega vira só registro, sem "Atrasado"/"Urgente".
export const FASES_SEM_ALERTA_ENTREGA = new Set<string>([FASE_IMPUGNACAO, 'Entregue', FASE_REVOGADO])

export function entregaTemAlerta(fase: string): boolean {
  return !FASES_SEM_ALERTA_ENTREGA.has(fase)
}

// Processo revogado (resposta da Gabi, 07/10/2026): fica visível na tabela com a fase "Revogado",
// mas sai de TODOS os totais (KPIs, rodapé, filtros de "A receber" e "Recebido") e não tem eventos
// na agenda, igual a um arquivado.
export function contaNosTotais(p: { fase?: string; arquivado?: boolean }): boolean {
  return !p.arquivado && p.fase !== FASE_REVOGADO
}
