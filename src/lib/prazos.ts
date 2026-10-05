// Regras de prazo pedidas pela Gabi em 05/10/2026 (respostas do questionário, ver CLAUDE.md).
// Funções puras, sem dependência de browser ou servidor: usadas pela tabela, pelo formulário
// de nova perícia e pela rota de sincronização do Calendar.

import { addCalendarDays } from './businessDays'

export const FASE_IMPUGNACAO = 'Impugnação de laudo'
export const TAREFA_IMPUGNACAO = 'Impugnação'

// Entrega do laudo = início + 30 dias corridos, vale pra todos os tipos de perícia.
// Se cair em fim de semana ou feriado, mantém a data como saiu (resposta da Gabi).
export const PRAZO_ENTREGA_DIAS = 30

// DESLIGADO de propósito (05/10/2026): a Gabi respondeu "30 dias corridos", mas nas perícias dela
// 3 de 9 entregas estão no mesmo dia do mês seguinte (31 dias) e só 2 têm exatamente 30. Só liga
// depois que ela confirmar se a regra é "30 dias corridos" ou "1 mês". Ligar = trocar pra true.
export const ENTREGA_AUTOMATICA_ATIVA = false

export function calcEntregaAuto(inicioISO: string): string {
  return addCalendarDays(inicioISO, PRAZO_ENTREGA_DIAS)
}

// Decide se a entrega deve ser preenchida sozinha quando a data de início muda.
// Devolve a nova entrega, ou null pra deixar como está.
//  - entrega vazia: preenche;
//  - entrega igual ao que o app calcularia pro início ANTERIOR: era automática, recalcula;
//  - qualquer outra: a Gabi digitou à mão, mantém.
export function entregaAutomatica(args: { inicioNovo: string; inicioAntigo: string; entregaAtual: string }): string | null {
  const { inicioNovo, inicioAntigo, entregaAtual } = args
  if (!inicioNovo) return null
  const nova = calcEntregaAuto(inicioNovo)
  if (!entregaAtual) return nova
  if (inicioAntigo && entregaAtual === calcEntregaAuto(inicioAntigo)) return nova === entregaAtual ? null : nova
  return null
}

// Fases em que o laudo já foi entregue: a coluna Entrega vira só registro, sem "Atrasado"/"Urgente".
export const FASES_SEM_ALERTA_ENTREGA = new Set<string>([FASE_IMPUGNACAO, 'Entregue'])

export function entregaTemAlerta(fase: string): boolean {
  return !FASES_SEM_ALERTA_ENTREGA.has(fase)
}
