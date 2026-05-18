'use client'

import { Pericia, GASResponse, GASListResponse, ChecklistItem, GASChecklistResponse } from './types'

export const GAS_URL = process.env.NEXT_PUBLIC_GAS_URL || ''
export const GAS_TOKEN = process.env.NEXT_PUBLIC_GAS_TOKEN || 'pericias_gb_2026'

let _cache: Pericia[] | null = null
let _cacheTs = 0
const CACHE_TTL = 30_000

let _checklistCache: ChecklistItem[] | null = null
let _checklistCacheTs = 0

const DEMO_CHECKLIST: ChecklistItem[] = [
  { id: 1, descricao: 'Proposta de Honorários' },
  { id: 2, descricao: 'Manifestação de Inicio' },
  { id: 3, descricao: 'Laudo Pericial' },
  { id: 4, descricao: 'Resposta a impugnação de laudo' },
  { id: 5, descricao: 'Solicitação de Honorários Remanescente' },
]

const DEMO_DATA: Pericia[] = [
  { row: 2,  qtd: '1',  origem: 'Autônoma',   poloAtivo: 'João Mendes da Silva',         poloPassivo: 'Banco Meridional S/A',           uf: 'GO', cidade: 'Goiânia',      vara: '3ª Vara Cível',         numeroProcesso: '5001234-12.2023.8.09.0051', codigoAcesso: 'AC2891', assunto: 'Revisão de contrato bancário',       tipo: 'Particular',                     valorPropostaHonorarios: '5000', valorHonorarios: '4500',  honorariosRecebidos: '2250',  solicitarDocs: 'Sim', inicio: '2024-01-15', entregaPrevista: '2024-04-30', fase: 'Em produção',          checklistDone: '[1,2,3]',    propostaStatus: 'Aceita',  propostaValor: '4500',  propostaCategoria: '1'  },
  { row: 3,  qtd: '2',  origem: 'Indicação',   poloAtivo: 'Comércio Bela Vista Ltda',     poloPassivo: 'Ministério Público Estadual',    uf: 'DF', cidade: 'Brasília',      vara: '1ª Vara Empresarial',   numeroProcesso: '5009876-54.2022.8.07.0001', codigoAcesso: 'AC4412', assunto: 'Apuração de haveres societários',    tipo: 'Particular',                     valorPropostaHonorarios: '30000', valorHonorarios: '12000', honorariosRecebidos: '4800', solicitarDocs: 'Não', inicio: '2023-06-10', entregaPrevista: '2023-12-01', fase: 'Entregue',             checklistDone: '[1,2,3,4,5]', propostaStatus: 'Aceita', propostaValor: '12000', propostaCategoria: '23' },
  { row: 4,  qtd: '3',  origem: 'Autônoma',    poloAtivo: 'Maria Aparecida Ferreira',     poloPassivo: 'Construtora Norte Ltda',        uf: 'MG', cidade: 'Belo Horizonte', vara: '7ª Vara Cível',         numeroProcesso: '5003321-78.2024.8.13.0024', codigoAcesso: '',       assunto: 'Danos materiais em imóvel',         tipo: 'Assistência Judiciária Gratuita', valorPropostaHonorarios: '3500', valorHonorarios: '3200',  honorariosRecebidos: '0',     solicitarDocs: 'Sim', inicio: '2024-03-01', entregaPrevista: '2024-07-15', fase: 'Em diligência',        checklistDone: '[1,2]',     propostaStatus: 'Aceita',  propostaValor: '3200',  propostaCategoria: '22' },
  { row: 5,  qtd: '4',  origem: 'Indicação',   poloAtivo: 'Carlos Eduardo Pinto',         poloPassivo: 'Seguradora Garantia S/A',       uf: 'SP', cidade: 'São Paulo',      vara: '15ª Vara Cível',        numeroProcesso: '1023456-90.2023.8.26.0100', codigoAcesso: 'AC7731', assunto: 'Apuração de perdas e danos',         tipo: 'Particular',                     valorPropostaHonorarios: '21000', valorHonorarios: '8500',  honorariosRecebidos: '3400',  solicitarDocs: 'Não', inicio: '2024-02-20', entregaPrevista: '2024-06-10', fase: 'Impugnação de laudo',  checklistDone: '[1,2,3,4]', propostaStatus: 'Aceita', propostaValor: '8500', propostaCategoria: '22' },
  { row: 6,  qtd: '5',  origem: 'Autônoma',    poloAtivo: 'Fernanda Oliveira Souza',      poloPassivo: 'União Federal',                 uf: 'GO', cidade: 'Goiânia',      vara: '4ª Vara Federal',       numeroProcesso: '5007654-11.2023.4.01.3500', codigoAcesso: 'AC0021', assunto: 'Revisão de benefício previdenciário', tipo: 'Assistência Judiciária Gratuita', valorPropostaHonorarios: '2800', valorHonorarios: '2800',  honorariosRecebidos: '2800',  solicitarDocs: 'Não', inicio: '2023-09-05', entregaPrevista: '2023-12-20', fase: 'Entregue',             checklistDone: '[1,2,3,4,5]', propostaStatus: 'Aceita', propostaValor: '2800', propostaCategoria: '17' },
  { row: 7,  qtd: '6',  origem: 'Indicação',   poloAtivo: 'Transportadora Rota Sul Ltda', poloPassivo: 'Petrobrás Distribuidora S/A',  uf: 'PR', cidade: 'Curitiba',      vara: '2ª Vara Empresarial',   numeroProcesso: '0012345-67.2024.8.16.0001', codigoAcesso: 'AC9910', assunto: 'Prestação de contas societárias',    tipo: 'Particular',                     valorPropostaHonorarios: '45000', valorHonorarios: '18000', honorariosRecebidos: '0',  solicitarDocs: 'Sim', inicio: '2024-04-01', entregaPrevista: '2024-09-30', fase: 'Aguardando intimação para início', checklistDone: '[1]',   propostaStatus: 'Enviada', propostaValor: '18000', propostaCategoria: '18' },
  { row: 8,  qtd: '7',  origem: 'Autônoma',    poloAtivo: 'Roberto Alves Teixeira',       poloPassivo: 'Banco do Brasil S/A',          uf: 'GO', cidade: 'Anápolis',      vara: '1ª Vara Cível',         numeroProcesso: '5002211-44.2024.8.09.0042', codigoAcesso: '',       assunto: 'Revisão de contrato de empréstimo', tipo: 'Assistência Judiciária Gratuita', valorPropostaHonorarios: '', valorHonorarios: '3500',  honorariosRecebidos: '0',     solicitarDocs: 'Sim', inicio: '',           entregaPrevista: '',           fase: 'Proposta de honorários', checklistDone: '',       propostaStatus: 'Pendente', propostaValor: '',     propostaCategoria: '' },
  { row: 9,  qtd: '8',  origem: 'Indicação',   poloAtivo: 'Indústria Cerâmica Planalto',  poloPassivo: 'Fazenda Pública Estadual',     uf: 'GO', cidade: 'Goiânia',      vara: '3ª Vara da Fazenda',    numeroProcesso: '5004499-22.2022.8.09.0051', codigoAcesso: 'AC3380', assunto: 'Levantamento fiscal e tributário',   tipo: 'Particular',                     valorPropostaHonorarios: '62000', valorHonorarios: '25000', honorariosRecebidos: '10000', solicitarDocs: 'Não', inicio: '2023-01-10', entregaPrevista: '2023-08-30', fase: 'Entregue',             checklistDone: '[1,2,3,4,5]', propostaStatus: 'Aceita', propostaValor: '25000', propostaCategoria: '14' },
  { row: 10, qtd: '9',  origem: 'Autônoma',    poloAtivo: 'Luciana Martins de Castro',    poloPassivo: 'Construtora Alfa Engenharia',  uf: 'DF', cidade: 'Brasília',      vara: '5ª Vara Cível',         numeroProcesso: '5008873-01.2024.8.07.0015', codigoAcesso: 'AC6654', assunto: 'Medição de obras e serviços',        tipo: 'Particular',                     valorPropostaHonorarios: '6500', valorHonorarios: '6000',  honorariosRecebidos: '3000',  solicitarDocs: 'Não', inicio: '2024-03-15', entregaPrevista: '2024-08-01', fase: 'Em produção',          checklistDone: '[1,2,3]',   propostaStatus: 'Aceita',  propostaValor: '6000',  propostaCategoria: '22' },
  { row: 11, qtd: '10', origem: 'Indicação',   poloAtivo: 'Paulo Henrique Rodrigues',     poloPassivo: 'Caixa Econômica Federal',      uf: 'SP', cidade: 'Campinas',      vara: '8ª Vara Federal',       numeroProcesso: '1098765-33.2023.4.03.6100', codigoAcesso: 'AC8823', assunto: 'Apuração de FGTS não recolhido',    tipo: 'Assistência Judiciária Gratuita', valorPropostaHonorarios: '10500', valorHonorarios: '4200',  honorariosRecebidos: '0',     solicitarDocs: 'Sim', inicio: '',           entregaPrevista: '',           fase: 'Aguardando recebimento honorários', checklistDone: '[1,2,3,4,5]', propostaStatus: 'Aceita', propostaValor: '4200', propostaCategoria: '11' },
  { row: 12, qtd: '11', origem: 'Autônoma',    poloAtivo: 'Agropecuária São Bento S/A',   poloPassivo: 'Banco Sicredi',                uf: 'MT', cidade: 'Cuiabá',        vara: '1ª Vara Cível',         numeroProcesso: '5001122-55.2024.8.11.0001', codigoAcesso: '',       assunto: 'Revisão de contrato rural',         tipo: 'Particular',                     valorPropostaHonorarios: '', valorHonorarios: '9500',  honorariosRecebidos: '0',     solicitarDocs: 'Sim', inicio: '',           entregaPrevista: '',           fase: 'Aguardando intimação para proposta de honorários', checklistDone: '', propostaStatus: '', propostaValor: '', propostaCategoria: '' },
]

export async function fetchPericias(force = false): Promise<Pericia[]> {
  if (!force && _cache && Date.now() - _cacheTs < CACHE_TTL) return _cache

  if (GAS_URL === 'demo') {
    await new Promise(r => setTimeout(r, 600))
    _cache = DEMO_DATA
    _cacheTs = Date.now()
    return _cache
  }

  const url = `${GAS_URL}?action=list&token=${GAS_TOKEN}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Erro ao buscar dados: ${res.status}`)
  const data: GASListResponse = await res.json()
  if (!data.pericias) throw new Error('Resposta inválida do servidor')
  _cache = data.pericias
  _cacheTs = Date.now()
  return _cache
}

export async function fetchChecklist(force = false): Promise<ChecklistItem[]> {
  if (!force && _checklistCache && Date.now() - _checklistCacheTs < 300_000) {
    return _checklistCache
  }
  if (GAS_URL === 'demo') {
    // em demo, preservar cache (pode conter tarefas custom adicionadas na sessão)
    if (!_checklistCache) {
      _checklistCache = [...DEMO_CHECKLIST]
      _checklistCacheTs = Date.now()
    }
    return _checklistCache
  }
  const url = `${GAS_URL}?action=getChecklist&token=${GAS_TOKEN}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return DEMO_CHECKLIST
  const data: GASChecklistResponse = await res.json()
  _checklistCache = data.items || []
  _checklistCacheTs = Date.now()
  return _checklistCache
}

export function invalidateChecklistCache(): void {
  _checklistCache = null
  _checklistCacheTs = 0
}

export async function addCustomTask(
  pericia_row: number,
  descricao: string
): Promise<GASResponse & { id?: number }> {
  if (GAS_URL === 'demo') {
    const id = 10000 + Math.floor(Math.random() * 89999)
    if (!_checklistCache) _checklistCache = [...DEMO_CHECKLIST]
    _checklistCache = [..._checklistCache, { id, descricao, pericia_row }]
    _checklistCacheTs = Date.now()
    return { ok: true, id }
  }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'addCustomTask', token: GAS_TOKEN, pericia_row, descricao }),
  })
  const data: GASResponse & { id?: number } = await res.json()
  if (data.ok && data.id && _checklistCache) {
    _checklistCache = [..._checklistCache, { id: data.id, descricao, pericia_row }]
  }
  return data
}

export async function deleteCustomTask(task_id: number): Promise<GASResponse> {
  if (GAS_URL === 'demo') {
    if (_checklistCache) _checklistCache = _checklistCache.filter(i => i.id !== task_id)
    return { ok: true }
  }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'deleteCustomTask', token: GAS_TOKEN, task_id }),
  })
  const data: GASResponse = await res.json()
  if (data.ok && _checklistCache) {
    _checklistCache = _checklistCache.filter(i => i.id !== task_id)
  }
  return data
}

export function invalidateCache(): void {
  _cache = null
  _cacheTs = 0
}

export function updateCache(row: number, campo: keyof Pericia, valor: string): void {
  if (!_cache) return
  _cache = _cache.map(p => p.row === row ? { ...p, [campo]: valor } : p)
}

export function revertCache(row: number, campo: keyof Pericia, oldValor: string): void {
  if (!_cache) return
  _cache = _cache.map(p => p.row === row ? { ...p, [campo]: oldValor } : p)
}

export async function updatePericia(
  row: number,
  campo: keyof Pericia,
  valor: string
): Promise<GASResponse> {
  if (GAS_URL === 'demo') return { ok: true }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'update', token: GAS_TOKEN, row, campo, valor }),
  })
  return res.json()
}

export async function appendPericia(fields: Omit<Pericia, 'row'>): Promise<GASResponse> {
  if (GAS_URL === 'demo') return { ok: true }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'append', token: GAS_TOKEN, fields }),
  })
  return res.json()
}

export async function archivePericia(row: number): Promise<GASResponse> {
  if (GAS_URL === 'demo') return { ok: true }
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({ action: 'archive', token: GAS_TOKEN, row }),
  })
  return res.json()
}

export async function saveChecklistStatus(row: number, doneIds: number[]): Promise<GASResponse> {
  const valor = JSON.stringify(doneIds)
  updateCache(row, 'checklistDone', valor)
  if (GAS_URL === 'demo') return { ok: true }
  return updatePericia(row, 'checklistDone', valor)
}

export async function saveProposta(
  row: number,
  status: string,
  valor: string,
  categoria: string
): Promise<GASResponse> {
  updateCache(row, 'propostaStatus', status)
  updateCache(row, 'propostaValor', valor)
  updateCache(row, 'propostaCategoria', categoria)
  if (GAS_URL === 'demo') return { ok: true }
  await updatePericia(row, 'propostaStatus', status)
  await updatePericia(row, 'propostaValor', valor)
  return updatePericia(row, 'propostaCategoria', categoria)
}
