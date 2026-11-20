import { describe, expect, it } from 'vitest';
import {
  buildColumnMap,
  errorEnvelope,
  mapRowsToItems,
  okEnvelope,
  sanitizeSheetCell,
  validateCreateItemPayload,
} from './sheetsLogic';

describe('sanitizeSheetCell', () => {
  it('neutralizes formula injection prefixes', () => {
    expect(sanitizeSheetCell('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)");
    expect(sanitizeSheetCell('+123')).toBe("'+123");
    expect(sanitizeSheetCell('-123')).toBe("'-123");
    expect(sanitizeSheetCell('@cmd')).toBe("'@cmd");
  });

  it('preserves leading zeros and normal strings', () => {
    expect(sanitizeSheetCell(' 00123 ')).toBe('00123');
    expect(sanitizeSheetCell('Widget A')).toBe('Widget A');
  });
});

describe('buildColumnMap and mapRowsToItems', () => {
  it('maps columns regardless of header order', () => {
    const rows = [
      ['name', 'createdAt', 'code', 'id'],
      ['Widget', '2026-11-20T00:00:00.000Z', '0042', 'abc-1'],
    ];

    expect(mapRowsToItems(rows)).toEqual([
      {
        id: 'abc-1',
        code: '0042',
        name: 'Widget',
        createdAt: '2026-11-20T00:00:00.000Z',
      },
    ]);
  });

  it('throws when a required header is missing', () => {
    expect(() => buildColumnMap(['id', 'code'])).toThrow('Missing required sheet header: name');
  });
});

describe('validateCreateItemPayload & envelopes', () => {
  it('validates and sanitizes valid payloads', () => {
    const res = validateCreateItemPayload({ code: '0099', name: '=HYPERLINK()' });
    expect(res).toEqual({
      ok: true,
      value: { code: '0099', name: "'=HYPERLINK()" },
    });
  });

  it('rejects empty fields', () => {
    expect(validateCreateItemPayload({ code: '  ', name: 'Test' })).toEqual({
      ok: false,
      error: 'Both code and name are required',
    });
  });

  it('builds standard JSON envelopes', () => {
    expect(okEnvelope({ count: 1 })).toEqual({ ok: true, data: { count: 1 } });
    expect(errorEnvelope('ERR', 'Nope')).toEqual({
      ok: false,
      error: { code: 'ERR', message: 'Nope' },
    });
  });
});
