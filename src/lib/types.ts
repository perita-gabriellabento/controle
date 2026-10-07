export type Fase =
  | 'Entregue'
  | 'Impugnação de laudo'
  | 'Em diligência'
  | 'Aguardando intimação para início'
  | 'Em produção'
  | 'Proposta de honorários'
  | 'Aguardando recebimento honorários'
  | 'Aguardando intimação para proposta de honorários'
  | 'Revogado'
  | ''

export type Tipo = 'Particular' | 'Assistência Judiciária Gratuita' | ''
export type Origem = 'Autônoma' | 'Indicação' | ''
export type SolicitarDocs = 'Sim' | 'Não' | ''
export type PropostaStatus = 'Pendente' | 'Enviada' | 'Aceita' | 'Recusada' | ''

export interface Pericia {
  id: string
  createdAt: string
  qtd: string
  origem: Origem
  poloAtivo: string
  poloPassivo: string
  uf: string
  cidade: string
  vara: string
  numeroProcesso: string
  codigoAcesso: string
  assunto: string
  tipo: Tipo
  valorPropostaHonorarios?: string
  valorHonorarios: string
  honorariosRecebidos: string
  solicitarDocs: SolicitarDocs
  inicio: string
  entregaPrevista: string
  fase: Fase
  arquivado?: boolean
  // novos campos
  checklistDone?: string        // JSON array: "[1,3,5]"
  faseChangedAt?: string        // quando a fase atual começou — base do cálculo de prazo
  propostaStatus?: PropostaStatus
  propostaValor?: string
  propostaCategoria?: string
}

export interface ChecklistItem {
  id: string
  descricao: string
  pericia_row?: string | null  // null/undefined = tarefa global; id = tarefa específica da perícia
}

export interface AspeconItem {
  id: number
  descricao: string
  valorMin: number
  valorMedio: number
}

export interface KPIs {
  total: number
  aReceber: number
  recebido: number
  emProducao: number
  entregues: number
  emProposta: number
}

export interface ApiResponse {
  ok: boolean
  error?: string
  id?: string
}

export const FASES: Fase[] = [
  'Entregue',
  'Impugnação de laudo',
  'Em diligência',
  'Aguardando intimação para início',
  'Em produção',
  'Proposta de honorários',
  'Aguardando recebimento honorários',
  'Aguardando intimação para proposta de honorários',
  'Revogado',
]

export const TIPOS: Tipo[] = ['Particular', 'Assistência Judiciária Gratuita']
export const ORIGENS: Origem[] = ['Autônoma', 'Indicação']
export const PROPOSTA_STATUS: PropostaStatus[] = ['Pendente', 'Enviada', 'Aceita', 'Recusada']
export const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']

export const FASE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Entregue':                                           { bg: 'rgba(34,197,94,0.15)',  text: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  'Impugnação de laudo':                                { bg: 'rgba(239,68,68,0.15)',  text: '#EF4444', border: 'rgba(239,68,68,0.3)' },
  'Em diligência':                                      { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', border: 'rgba(59,130,246,0.3)' },
  'Aguardando intimação para início':                   { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
  'Em produção':                                        { bg: 'rgba(249,115,22,0.15)', text: '#F97316', border: 'rgba(249,115,22,0.3)' },
  'Proposta de honorários':                             { bg: 'rgba(107,114,128,0.15)',text: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
  'Aguardando recebimento honorários':                  { bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6', border: 'rgba(139,92,246,0.3)' },
  'Aguardando intimação para proposta de honorários':   { bg: 'rgba(55,65,81,0.3)',    text: '#6B7280', border: 'rgba(55,65,81,0.5)' },
  'Revogado':                                           { bg: 'rgba(219,39,119,0.15)', text: '#DB2777', border: 'rgba(219,39,119,0.35)' },
}

// Tabela ASPECON-GO — Resolução nº 001/2026 (27/03/2026), em vigor desde então,
// revoga a Resolução 002/2025. A partir desta resolução a ASPECON deixou de
// publicar "valor médio" — só existe mais o valor "a partir de" (valorMedio
// fica em 0 e a UI já trata isso, exibindo só o "a partir de").
export const ASPECON_TABLE: AspeconItem[] = [
  { id: 1,  descricao: 'Operações financeiras simples sem diligências',                   valorMin: 9743.71,   valorMedio: 0 },
  { id: 2,  descricao: 'Operações financeiras – contratos de SFH/Hipotecário',            valorMin: 9743.71,   valorMedio: 0 },
  { id: 3,  descricao: 'Operações financeiras – contrato de leasing ou consórcio',        valorMin: 9743.71,   valorMedio: 0 },
  { id: 4,  descricao: 'Operações financeiras – cartão de crédito',                       valorMin: 9743.71,   valorMedio: 0 },
  { id: 5,  descricao: 'Operações financeiras – conta corrente / cheque especial',        valorMin: 9743.71,   valorMedio: 0 },
  { id: 6,  descricao: 'Operações financeiras complexas – mais de um contrato',           valorMin: 14615.03,  valorMedio: 0 },
  { id: 7,  descricao: 'Operações financeiras complexas – renovações/confissões de dívida', valorMin: 14615.03, valorMedio: 0 },
  { id: 8,  descricao: 'Operações financeiras complexas – desconto de títulos',           valorMin: 9743.71,   valorMedio: 0 },
  { id: 9,  descricao: 'Operações financeiras complexas – Factoring',                     valorMin: 9743.71,   valorMedio: 0 },
  { id: 10, descricao: 'Operações financeiras complexas – ACC/VENDOR',                    valorMin: 14615.03,  valorMedio: 0 },
  { id: 11, descricao: 'Cálculos Trabalhistas',                                           valorMin: 9743.71,   valorMedio: 0 },
  { id: 12, descricao: 'Execução de títulos extrajudicial',                               valorMin: 14615.03,  valorMedio: 0 },
  { id: 13, descricao: 'Execuções fiscais Municipais',                                    valorMin: 19488.00,  valorMedio: 0 },
  { id: 14, descricao: 'Execuções fiscais Estaduais',                                     valorMin: 19487.43,  valorMedio: 0 },
  { id: 15, descricao: 'Execuções fiscais Federais',                                      valorMin: 19487.43,  valorMedio: 0 },
  { id: 16, descricao: 'Revisão Salarial',                                                valorMin: 19487.43,  valorMedio: 0 },
  { id: 17, descricao: 'Revisão de benefício / aposentadoria / previdência privada',      valorMin: 19487.43,  valorMedio: 0 },
  { id: 18, descricao: 'Prestação de contas',                                             valorMin: 19487.43,  valorMedio: 0 },
  { id: 19, descricao: 'Liquidação de Sentença',                                          valorMin: 9743.71,   valorMedio: 0 },
  { id: 20, descricao: 'Reintegração de posse ou desapropriação',                         valorMin: 19481.08,  valorMedio: 0 },
  { id: 21, descricao: 'Lucro cessante',                                                  valorMin: 19487.43,  valorMedio: 0 },
  { id: 22, descricao: 'Indenização de danos materiais',                                  valorMin: 12179.92,  valorMedio: 0 },
  { id: 23, descricao: 'Apuração de haveres – Micro e pequenas empresas',                 valorMin: 24351.09,  valorMedio: 0 },
  { id: 24, descricao: 'Apuração de haveres – Sociedades médias',                         valorMin: 48703.79,  valorMedio: 0 },
  { id: 25, descricao: 'Apuração de haveres – Sociedades grandes',                        valorMin: 121799.19, valorMedio: 0 },
  { id: 26, descricao: 'Dissolução parcial de sociedades',                                valorMin: 48703.79,  valorMedio: 0 },
  { id: 27, descricao: 'Dissolução de sociedades',                                        valorMin: 48719.68,  valorMedio: 0 },
  { id: 28, descricao: 'Falência / recuperação judicial',                                 valorMin: 48719.68,  valorMedio: 0 },
  { id: 29, descricao: 'Honorários de administrador judicial liquidante (por mês)',       valorMin: 14615.03,  valorMedio: 0 },
  { id: 30, descricao: 'Plano de recuperação de empresas',                                valorMin: 194878.71, valorMedio: 0 },
  { id: 31, descricao: 'Crime de gestão',                                                 valorMin: 24351.09,  valorMedio: 0 },
  { id: 32, descricao: 'Crime contra a ordem pública / relação consumo',                  valorMin: 14017.87,  valorMedio: 0 },
  { id: 33, descricao: 'Fundo de comércio',                                               valorMin: 23356.12,  valorMedio: 0 },
]
