/**
 * Google Apps Script Web App entrypoint (GAS-1 .. GAS-5, SEC-1 .. SEC-3, EXC-2).
 * Pure business/schema logic is mirrored & unit-tested offline in `src/sheetsLogic.ts`.
 */

var SHEET_NAME = 'Items';
var ITEMS_HEADERS = ['id', 'code', 'name', 'createdAt'];

function getSpreadsheet_() {
  var scriptProps = PropertiesService.getScriptProperties();
  var spreadsheetId = scriptProps.getProperty('SPREADSHEET_ID');
  return spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateItemsSheet_() {
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, ITEMS_HEADERS.length).setValues([ITEMS_HEADERS]);
  }
  return sheet;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function okResponse_(data) {
  return jsonResponse_({ ok: true, data: data });
}

function errorResponse_(code, message) {
  return jsonResponse_({ ok: false, error: { code: code, message: message } });
}

function sanitizeCell_(value) {
  var str = String(value == null ? '' : value).trim();
  if (/^[=+\-@]/.test(str)) {
    return "'" + str;
  }
  return str;
}

function buildColumnMap_(headerRow) {
  var map = {};
  for (var i = 0; i < headerRow.length; i++) {
    map[String(headerRow[i]).trim()] = i;
  }
  return map;
}

function doGet(e) {
  try {
    var action = e && e.parameter ? e.parameter.action : '';
    if (action !== 'listItems') {
      return errorResponse_('INVALID_ACTION', 'Unsupported GET action');
    }

    var sheet = getOrCreateItemsSheet_();
    var values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return okResponse_([]);
    }

    var col = buildColumnMap_(values[0]);
    var items = [];
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      items.push({
        id: String(row[col.id] || ''),
        code: String(row[col.code] || ''),
        name: String(row[col.name] || ''),
        createdAt: String(row[col.createdAt] || ''),
      });
    }

    return okResponse_(items);
  } catch (err) {
    return errorResponse_('INTERNAL_ERROR', err && err.message ? err.message : 'Unexpected error');
  }
}

function doPost(e) {
  var rawBody = e && e.postData && e.postData.contents ? e.postData.contents : '';
  var parsed;
  try {
    parsed = JSON.parse(rawBody);
  } catch (_err) {
    return errorResponse_('INVALID_JSON', 'Request body must be valid JSON');
  }

  if (!parsed || parsed.action !== 'createItem' || !parsed.payload) {
    return errorResponse_('INVALID_ACTION', 'Unsupported POST action or missing payload');
  }

  var code = sanitizeCell_(parsed.payload.code);
  var name = sanitizeCell_(parsed.payload.name);
  if (!code || !name) {
    return errorResponse_('VALIDATION_ERROR', 'Both code and name are required');
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return errorResponse_('LOCK_TIMEOUT', 'Server is busy, please retry');
  }

  try {
    var sheet = getOrCreateItemsSheet_();
    var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var col = buildColumnMap_(headerRow);

    var item = {
      id: Utilities.getUuid(),
      code: code,
      name: name,
      createdAt: new Date().toISOString(),
    };

    var newRow = new Array(headerRow.length);
    newRow[col.id] = item.id;
    newRow[col.code] = item.code;
    newRow[col.name] = item.name;
    newRow[col.createdAt] = item.createdAt;

    var nextRowIndex = sheet.getLastRow() + 1;
    var targetRange = sheet.getRange(nextRowIndex, 1, 1, headerRow.length);

    // Preserve leading zeros/codes on text columns before writing values (GAS-2)
    sheet.getRange(nextRowIndex, col.code + 1, 1, 1).setNumberFormat('@');
    targetRange.setValues([newRow]);

    return okResponse_(item);
  } catch (err) {
    return errorResponse_('INTERNAL_ERROR', err && err.message ? err.message : 'Unexpected error');
  } finally {
    lock.releaseLock();
  }
}
