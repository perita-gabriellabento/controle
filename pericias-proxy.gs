// ============================================================
// pericias-proxy.gs
// Google Apps Script — Web App
// Controle de Perícias GB — Gabriella Bento Perita Contábil
// ============================================================

const SPREADSHEET_ID      = '1vgxXcTUTKdHeaQBWJRTg4eBH1zs1_u0ULLB25t4t_0k';
const SHEET_NAME          = 'perícias';
const CHECKLIST_SHEET_NAME = 'checklist';
const AUTH_TOKEN          = 'pericias_gb_2026';

// Colunas da aba "perícias" (0-based)
const COL_QTD                = 0;  // A
const COL_ORIGEM             = 1;  // B
const COL_POLO_ATIVO         = 2;  // C
const COL_POLO_PASSIVO       = 3;  // D
const COL_UF                 = 4;  // E
const COL_CIDADE             = 5;  // F
const COL_VARA               = 6;  // G
const COL_NUM_PROCESSO       = 7;  // H
const COL_COD_ACESSO         = 8;  // I
const COL_ASSUNTO            = 9;  // J
const COL_TIPO               = 10; // K
const COL_VALOR_PROPOSTA     = 11; // L — Valor Proposta Honorários
const COL_VALOR_HONOR        = 12; // M — Valor honorários
const COL_HONOR_RECEB        = 13; // N — Honorários Recebidos
const COL_SOLICITAR_DOCS     = 14; // O
const COL_INICIO             = 15; // P
const COL_ENTREGA            = 16; // Q
const COL_FASE               = 17; // R
const COL_ARQUIVADO          = 18; // S
const COL_CHECKLIST_DONE     = 19; // T — JSON array: "[1,3,5]"
const COL_PROPOSTA_STATUS    = 20; // U — Pendente/Enviada/Aceita/Recusada
const COL_PROPOSTA_VALOR     = 21; // V
const COL_PROPOSTA_CATEGORIA = 22; // W

const CAMPO_MAP = {
  qtd:                      COL_QTD,
  origem:                   COL_ORIGEM,
  poloAtivo:                COL_POLO_ATIVO,
  poloPassivo:              COL_POLO_PASSIVO,
  uf:                       COL_UF,
  cidade:                   COL_CIDADE,
  vara:                     COL_VARA,
  numeroProcesso:           COL_NUM_PROCESSO,
  codigoAcesso:             COL_COD_ACESSO,
  assunto:                  COL_ASSUNTO,
  tipo:                     COL_TIPO,
  valorPropostaHonorarios:  COL_VALOR_PROPOSTA,
  valorHonorarios:          COL_VALOR_HONOR,
  honorariosRecebidos:      COL_HONOR_RECEB,
  solicitarDocs:            COL_SOLICITAR_DOCS,
  inicio:              COL_INICIO,
  entregaPrevista:     COL_ENTREGA,
  fase:                COL_FASE,
  checklistDone:       COL_CHECKLIST_DONE,
  propostaStatus:      COL_PROPOSTA_STATUS,
  propostaValor:       COL_PROPOSTA_VALOR,
  propostaCategoria:   COL_PROPOSTA_CATEGORIA,
};

// ── HELPERS ──────────────────────────────────────────────────

function getSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
}

function getChecklistSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  return ss.getSheetByName(CHECKLIST_SHEET_NAME);
}

function norm(v) { return String(v || '').trim(); }

function fmtDate(v) {
  if (!v) return '';
  try {
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return '';
      return Utilities.formatDate(v, 'America/Sao_Paulo', 'yyyy-MM-dd');
    }
    if (typeof v === 'number') {
      var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return Utilities.formatDate(d, 'America/Sao_Paulo', 'yyyy-MM-dd');
    }
    var str = String(v).trim();
    if (!str) return '';
    var iso = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      var d2 = new Date(+iso[1], +iso[2]-1, +iso[3]);
      return Utilities.formatDate(d2, 'America/Sao_Paulo', 'yyyy-MM-dd');
    }
    var br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (br) {
      var d3 = new Date(+br[3], +br[2]-1, +br[1]);
      return Utilities.formatDate(d3, 'America/Sao_Paulo', 'yyyy-MM-dd');
    }
    var parsed = new Date(str);
    if (!isNaN(parsed.getTime())) return Utilities.formatDate(parsed, 'America/Sao_Paulo', 'yyyy-MM-dd');
    return str;
  } catch(_) { return ''; }
}

function fmtMoney(v) {
  if (!v) return '';
  if (typeof v === 'number') return String(v);
  var s = String(v).trim().replace(/R\$\s*/g,'').replace(/\./g,'').replace(',','.');
  var n = parseFloat(s);
  return isNaN(n) ? '' : String(n);
}

function rowToPericia(r, rowIndex) {
  return {
    row:                rowIndex,
    qtd:                norm(r[COL_QTD]),
    origem:             norm(r[COL_ORIGEM]),
    poloAtivo:          norm(r[COL_POLO_ATIVO]),
    poloPassivo:        norm(r[COL_POLO_PASSIVO]),
    uf:                 norm(r[COL_UF]),
    cidade:             norm(r[COL_CIDADE]),
    vara:               norm(r[COL_VARA]),
    numeroProcesso:     norm(r[COL_NUM_PROCESSO]),
    codigoAcesso:       norm(r[COL_COD_ACESSO]),
    assunto:            norm(r[COL_ASSUNTO]),
    tipo:               norm(r[COL_TIPO]),
    valorPropostaHonorarios: fmtMoney(r[COL_VALOR_PROPOSTA]),
    valorHonorarios:    fmtMoney(r[COL_VALOR_HONOR]),
    honorariosRecebidos: fmtMoney(r[COL_HONOR_RECEB]),
    solicitarDocs:      norm(r[COL_SOLICITAR_DOCS]),
    inicio:             fmtDate(r[COL_INICIO]),
    entregaPrevista:    fmtDate(r[COL_ENTREGA]),
    fase:               norm(r[COL_FASE]),
    arquivado:          r[COL_ARQUIVADO] === true || String(r[COL_ARQUIVADO]).toLowerCase() === 'true',
    checklistDone:      norm(r[COL_CHECKLIST_DONE]),
    propostaStatus:     norm(r[COL_PROPOSTA_STATUS]),
    propostaValor:      fmtMoney(r[COL_PROPOSTA_VALOR]),
    propostaCategoria:  norm(r[COL_PROPOSTA_CATEGORIA]),
  };
}

function jsonOk(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function jsonErr(msg) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: msg })).setMimeType(ContentService.MimeType.JSON);
}

// ── GET ───────────────────────────────────────────────────────

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var action = params.action || 'list';
  var token  = params.token  || '';
  if (token !== AUTH_TOKEN) return jsonErr('token inválido');
  try {
    if (action === 'list')         return handleList();
    if (action === 'getChecklist') return handleGetChecklist();
    return jsonErr('action inválida: ' + action);
  } catch(err) {
    return jsonErr(err.message || String(err));
  }
}

function handleList() {
  var sheet = getSheet();
  var data  = sheet.getDataRange().getValues();
  data.shift();
  var pericias = [];
  data.forEach(function(r, i) {
    pericias.push(rowToPericia(r, i + 2));
  });
  var lastModified = '';
  try {
    lastModified = Utilities.formatDate(
      DriveApp.getFileById(SPREADSHEET_ID).getLastUpdated(),
      'America/Sao_Paulo', "yyyy-MM-dd'T'HH:mm:ss"
    );
  } catch(_) {}
  return jsonOk({ pericias: pericias, lastModified: lastModified });
}

function handleGetChecklist() {
  var sheet = getChecklistSheet();
  if (!sheet) return jsonOk({ items: [] });
  var data = sheet.getDataRange().getValues();
  if (data.length > 1) data.shift(); // remove header se houver
  var items = data.map(function(r) {
    var id = parseInt(r[0]) || 0;
    var descricao = String(r[1] || '').trim();
    if (!id || !descricao) return null;
    var pericia_row = r[2] ? (parseInt(r[2]) || null) : null;
    return { id: id, descricao: descricao, pericia_row: pericia_row };
  }).filter(Boolean);
  return jsonOk({ items: items });
}

// ── POST ──────────────────────────────────────────────────────

function doPost(e) {
  try {
    var body   = JSON.parse(e.postData.contents);
    var token  = String(body.token  || '').trim();
    var action = String(body.action || '').trim();
    if (token !== AUTH_TOKEN) return jsonErr('token inválido');
    if (action === 'update')          return handleUpdate(body);
    if (action === 'append')          return handleAppend(body);
    if (action === 'archive')         return handleArchive(body);
    if (action === 'addCustomTask')   return handleAddCustomTask(body);
    if (action === 'deleteCustomTask') return handleDeleteCustomTask(body);
    return jsonErr('action inválida: ' + action);
  } catch(err) {
    return jsonErr(err.message || String(err));
  }
}

function handleUpdate(body) {
  var row   = parseInt(body.row, 10);
  var campo = String(body.campo || '').trim();
  var valor = String(body.valor !== undefined ? body.valor : '');
  if (isNaN(row) || row < 2) return jsonErr('row inválido');
  if (!CAMPO_MAP.hasOwnProperty(campo)) return jsonErr('campo não permitido: ' + campo);
  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();
  if (row > lastRow) return jsonErr('row fora do intervalo');
  var col = CAMPO_MAP[campo] + 1;
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var writeVal = valor;
    if ((campo === 'inicio' || campo === 'entregaPrevista') && valor) {
      var isoM = valor.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (isoM) writeVal = new Date(+isoM[1], +isoM[2]-1, +isoM[3]);
    }
    if (campo === 'valorHonorarios' || campo === 'honorariosRecebidos' || campo === 'propostaValor') {
      var n = parseFloat(String(valor).replace(/[^\d.-]/g,''));
      writeVal = isNaN(n) ? 0 : n;
    }
    sheet.getRange(row, col).setValue(writeVal);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return jsonOk({ ok: true });
}

function handleAppend(body) {
  var fields = body.fields || {};
  if (!fields.poloAtivo || !fields.poloPassivo || !fields.numeroProcesso) {
    return jsonErr('poloAtivo, poloPassivo e numeroProcesso são obrigatórios');
  }
  var sheet   = getSheet();
  var lastRow = sheet.getLastRow();
  var newRow  = lastRow + 1;
  var nextQtd = lastRow;

  function prepDate(v) {
    if (!v) return '';
    var m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2]-1, +m[3]) : v;
  }
  function prepMoney(v) {
    if (!v) return '';
    var n = parseFloat(String(v).replace(/[^\d.-]/g,''));
    return isNaN(n) ? '' : n;
  }

  var row = new Array(23).fill('');
  row[COL_QTD]              = norm(fields.qtd) || String(nextQtd);
  row[COL_ORIGEM]           = norm(fields.origem);
  row[COL_POLO_ATIVO]       = norm(fields.poloAtivo);
  row[COL_POLO_PASSIVO]     = norm(fields.poloPassivo);
  row[COL_UF]               = norm(fields.uf);
  row[COL_CIDADE]           = norm(fields.cidade);
  row[COL_VARA]             = norm(fields.vara);
  row[COL_NUM_PROCESSO]     = norm(fields.numeroProcesso);
  row[COL_COD_ACESSO]       = norm(fields.codigoAcesso);
  row[COL_ASSUNTO]          = norm(fields.assunto);
  row[COL_TIPO]             = norm(fields.tipo);
  row[COL_VALOR_PROPOSTA]   = prepMoney(fields.valorPropostaHonorarios);
  row[COL_VALOR_HONOR]      = prepMoney(fields.valorHonorarios);
  row[COL_HONOR_RECEB]      = prepMoney(fields.honorariosRecebidos);
  row[COL_SOLICITAR_DOCS]   = norm(fields.solicitarDocs);
  row[COL_INICIO]           = prepDate(fields.inicio);
  row[COL_ENTREGA]          = prepDate(fields.entregaPrevista);
  row[COL_FASE]             = norm(fields.fase);
  row[COL_ARQUIVADO]        = false;
  row[COL_CHECKLIST_DONE]   = '';
  row[COL_PROPOSTA_STATUS]  = '';
  row[COL_PROPOSTA_VALOR]   = '';
  row[COL_PROPOSTA_CATEGORIA] = '';

  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    sheet.appendRow(row);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return jsonOk({ ok: true, row: newRow });
}

function handleAddCustomTask(body) {
  var pericia_row = parseInt(body.pericia_row, 10);
  var descricao   = String(body.descricao || '').trim();
  if (isNaN(pericia_row) || pericia_row < 2) return jsonErr('pericia_row inválido');
  if (!descricao) return jsonErr('descricao obrigatória');
  var sheet = getChecklistSheet();
  if (!sheet) return jsonErr('aba checklist não encontrada');
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    var newId = sheet.getLastRow() + 1; // usa nº de linha como ID único
    sheet.appendRow([newId, descricao, pericia_row]);
    SpreadsheetApp.flush();
    return jsonOk({ ok: true, id: newId });
  } finally {
    lock.releaseLock();
  }
}

function handleDeleteCustomTask(body) {
  var task_id = parseInt(body.task_id, 10);
  if (isNaN(task_id) || task_id < 1) return jsonErr('task_id inválido');
  var sheet = getChecklistSheet();
  if (!sheet) return jsonErr('aba checklist não encontrada');
  var data = sheet.getDataRange().getValues();
  for (var i = 0; i < data.length; i++) {
    if (parseInt(data[i][0]) === task_id) {
      if (!data[i][2]) return jsonErr('não é possível excluir tarefas globais');
      sheet.deleteRow(i + 1);
      SpreadsheetApp.flush();
      return jsonOk({ ok: true });
    }
  }
  return jsonErr('tarefa não encontrada');
}

function handleArchive(body) {
  var row = parseInt(body.row, 10);
  if (isNaN(row) || row < 2) return jsonErr('row inválido');
  var sheet = getSheet();
  if (row > sheet.getLastRow()) return jsonErr('row fora do intervalo');
  var lock = LockService.getScriptLock();
  lock.waitLock(8000);
  try {
    sheet.getRange(row, COL_ARQUIVADO + 1).setValue(true);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return jsonOk({ ok: true });
}
