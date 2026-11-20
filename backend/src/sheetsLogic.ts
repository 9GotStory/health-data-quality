export const ITEMS_HEADERS = ['id', 'code', 'name', 'createdAt'] as const;

export type ItemHeader = (typeof ITEMS_HEADERS)[number];

export interface ItemRecord {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}

export type ColumnMap = Record<ItemHeader, number>;

export type ApiEnvelope<T> =
  { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

export function okEnvelope<T>(data: T): ApiEnvelope<T> {
  return { ok: true, data };
}

export function errorEnvelope(code: string, message: string): ApiEnvelope<never> {
  return { ok: false, error: { code, message } };
}

/**
 * Prevents Google Sheets formula injection by prefixing cells starting with
 * `=`, `+`, `-`, or `@` with a single quote (`'`).
 */
export function sanitizeSheetCell(value: unknown): string {
  const str = String(value ?? '').trim();
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Builds a column-index map from the central header row so handlers
 * never rely on hardcoded column positions.
 */
export function buildColumnMap(headerRow: readonly unknown[]): ColumnMap {
  const indexByName = new Map<string, number>();
  headerRow.forEach((cell, idx) => {
    indexByName.set(String(cell).trim(), idx);
  });

  const map = {} as ColumnMap;
  for (const header of ITEMS_HEADERS) {
    const idx = indexByName.get(header);
    if (idx === undefined) {
      throw new Error(`Missing required sheet header: ${header}`);
    }
    map[header] = idx;
  }
  return map;
}

/**
 * Maps a 2D batch range from `getValues()` into typed `ItemRecord[]`.
 */
export function mapRowsToItems(values: readonly (readonly unknown[])[]): ItemRecord[] {
  if (values.length <= 1) {
    return [];
  }

  const col = buildColumnMap(values[0]);
  return values.slice(1).map((row) => ({
    id: String(row[col.id] ?? ''),
    code: String(row[col.code] ?? ''),
    name: String(row[col.name] ?? ''),
    createdAt: String(row[col.createdAt] ?? ''),
  }));
}

/**
 * Validates raw `createItem` POST payload parsed as `unknown`.
 */
export function validateCreateItemPayload(
  raw: unknown,
): { ok: true; value: { code: string; name: string } } | { ok: false; error: string } {
  if (typeof raw !== 'object' || raw === null) {
    return { ok: false, error: 'Payload must be an object' };
  }

  const record = raw as Record<string, unknown>;
  const code = sanitizeSheetCell(record.code);
  const name = sanitizeSheetCell(record.name);

  if (!code || !name) {
    return { ok: false, error: 'Both code and name are required' };
  }

  return { ok: true, value: { code, name } };
}
