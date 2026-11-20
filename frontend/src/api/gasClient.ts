export interface ItemDto {
  id: string;
  code: string;
  name: string;
  createdAt: string;
}

export interface CreateItemInput {
  code: string;
  name: string;
}

export interface GasErrorPayload {
  code: string;
  message: string;
}

export type GasEnvelope<T> = { ok: true; data: T } | { ok: false; error: GasErrorPayload };

export class GasApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GasApiError';
    this.code = code;
  }
}

function getApiUrl(): string {
  const url = import.meta.env.VITE_GAS_API_URL;
  if (!url) {
    throw new GasApiError('CONFIG_MISSING', 'VITE_GAS_API_URL is not configured');
  }
  return url;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates raw JSON parsed as `unknown` against the GAS envelope contract.
 */
export function parseGasEnvelope<T>(raw: unknown, validateData: (data: unknown) => data is T): T {
  if (!isRecord(raw) || typeof raw.ok !== 'boolean') {
    throw new GasApiError('INVALID_ENVELOPE', 'Malformed response envelope from GAS API');
  }

  if (raw.ok === false) {
    const err = isRecord(raw.error) ? raw.error : {};
    const code = typeof err.code === 'string' ? err.code : 'GAS_ERROR';
    const message = typeof err.message === 'string' ? err.message : 'Unknown GAS API error';
    throw new GasApiError(code, message);
  }

  if (!validateData(raw.data)) {
    throw new GasApiError('INVALID_DATA', 'Response data failed boundary validation');
  }

  return raw.data;
}

function isItemDto(value: unknown): value is ItemDto {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.code === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string'
  );
}

function isItemList(value: unknown): value is ItemDto[] {
  return Array.isArray(value) && value.every(isItemDto);
}

/**
 * Fetches items from GAS Web App `doGet`.
 */
export async function fetchItems(apiUrl = getApiUrl()): Promise<ItemDto[]> {
  const url = new URL(apiUrl);
  url.searchParams.set('action', 'listItems');

  const response = await fetch(url.toString(), { method: 'GET' });
  if (!response.ok) {
    throw new GasApiError('HTTP_ERROR', `GAS GET failed with status ${response.status}`);
  }

  const raw: unknown = await response.json();
  return parseGasEnvelope(raw, isItemList);
}

/**
 * Sends a mutation to GAS Web App `doPost` using `text/plain;charset=utf-8`
 * to avoid CORS preflight (`OPTIONS`) requests (see EXC-1).
 */
export async function createItem(input: CreateItemInput, apiUrl = getApiUrl()): Promise<ItemDto> {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify({
      action: 'createItem',
      payload: input,
    }),
  });

  if (!response.ok) {
    throw new GasApiError('HTTP_ERROR', `GAS POST failed with status ${response.status}`);
  }

  const raw: unknown = await response.json();
  return parseGasEnvelope(raw, isItemDto);
}
