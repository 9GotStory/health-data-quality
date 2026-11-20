import { afterEach, describe, expect, it, vi } from 'vitest';
import { createItem, fetchItems, GasApiError, parseGasEnvelope } from './gasClient';

describe('parseGasEnvelope', () => {
  const isString = (v: unknown): v is string => typeof v === 'string';

  it('returns typed data when ok is true and validator passes', () => {
    const result = parseGasEnvelope({ ok: true, data: 'hello' }, isString);
    expect(result).toBe('hello');
  });

  it('throws GasApiError when ok is false', () => {
    expect(() =>
      parseGasEnvelope(
        { ok: false, error: { code: 'BAD_INPUT', message: 'Missing code' } },
        isString,
      ),
    ).toThrowError(new GasApiError('BAD_INPUT', 'Missing code'));
  });

  it('throws GasApiError on malformed envelope', () => {
    expect(() => parseGasEnvelope('not-an-object', isString)).toThrowError(GasApiError);
  });

  it('throws GasApiError when data fails validation', () => {
    expect(() => parseGasEnvelope({ ok: true, data: 123 }, isString)).toThrowError(
      new GasApiError('INVALID_DATA', 'Response data failed boundary validation'),
    );
  });
});

describe('gasClient HTTP calls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with text/plain;charset=utf-8 to avoid CORS preflight', async () => {
    const created = {
      id: '1',
      code: '0042',
      name: 'Sample',
      createdAt: '2026-11-20T00:00:00.000Z',
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: created }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await createItem(
      { code: '0042', name: 'Sample' },
      'https://script.google.com/macros/s/test/exec',
    );

    expect(result).toEqual(created);
    expect(fetchMock).toHaveBeenCalledWith('https://script.google.com/macros/s/test/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action: 'createItem',
        payload: { code: '0042', name: 'Sample' },
      }),
    });
  });

  it('fetches and validates item list via GET', async () => {
    const items = [
      { id: '1', code: '0042', name: 'Sample', createdAt: '2026-11-20T00:00:00.000Z' },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, data: items }),
      }),
    );

    const result = await fetchItems('https://script.google.com/macros/s/test/exec');
    expect(result).toEqual(items);
  });
});
