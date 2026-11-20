import {
  ITEMS_HEADERS,
  buildColumnMap,
  errorEnvelope,
  mapRowsToItems,
  okEnvelope,
  validateCreateItemPayload,
  type ApiEnvelope,
  type ItemRecord,
} from './sheetsLogic';

const SHEET_NAME = 'Items';

function getSpreadsheet(): GoogleAppsScript.Spreadsheet.Spreadsheet {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  return spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
}

function getOrCreateItemsSheet(): GoogleAppsScript.Spreadsheet.Sheet {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, ITEMS_HEADERS.length).setValues([[...ITEMS_HEADERS]]);
  }
  return sheet;
}

function jsonResponse<T>(payload: ApiEnvelope<T>): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

/**
 * GAS Web App GET entrypoint (GAS-1 .. GAS-5, SEC-1 .. SEC-3, EXC-2).
 * Exposed globally via `backend/build.mjs` footer when bundled to `dist/Code.js`.
 */
export function doGet(e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  try {
    const action = e?.parameter?.action ?? '';
    if (action !== 'listItems') {
      return jsonResponse(errorEnvelope('INVALID_ACTION', 'Unsupported GET action'));
    }

    const sheet = getOrCreateItemsSheet();
    const values = sheet.getDataRange().getValues();
    const items = mapRowsToItems(values);

    return jsonResponse(okEnvelope(items));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return jsonResponse(errorEnvelope('INTERNAL_ERROR', message));
  }
}

/**
 * GAS Web App POST entrypoint (GAS-1 .. GAS-5, SEC-1 .. SEC-3, EXC-2).
 * Exposed globally via `backend/build.mjs` footer when bundled to `dist/Code.js`.
 */
export function doPost(e?: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  const rawBody = e?.postData?.contents ?? '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return jsonResponse(errorEnvelope('INVALID_JSON', 'Request body must be valid JSON'));
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>).action !== 'createItem'
  ) {
    return jsonResponse(errorEnvelope('INVALID_ACTION', 'Unsupported POST action'));
  }

  const validation = validateCreateItemPayload((parsed as Record<string, unknown>).payload);
  if (!validation.ok) {
    return jsonResponse(errorEnvelope('VALIDATION_ERROR', validation.error));
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return jsonResponse(errorEnvelope('LOCK_TIMEOUT', 'Server is busy, please retry'));
  }

  try {
    const sheet = getOrCreateItemsSheet();
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const col = buildColumnMap(headerRow);

    const item: ItemRecord = {
      id: Utilities.getUuid(),
      code: validation.value.code,
      name: validation.value.name,
      createdAt: new Date().toISOString(),
    };

    const newRow: string[] = new Array<string>(headerRow.length).fill('');
    newRow[col.id] = item.id;
    newRow[col.code] = item.code;
    newRow[col.name] = item.name;
    newRow[col.createdAt] = item.createdAt;

    const nextRowIndex = sheet.getLastRow() + 1;
    const targetRange = sheet.getRange(nextRowIndex, 1, 1, headerRow.length);

    // Preserve leading zeros/codes on text columns before writing values (GAS-2)
    sheet.getRange(nextRowIndex, col.code + 1, 1, 1).setNumberFormat('@');
    targetRange.setValues([newRow]);

    return jsonResponse(okEnvelope(item));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return jsonResponse(errorEnvelope('INTERNAL_ERROR', message));
  } finally {
    lock.releaseLock();
  }
}
