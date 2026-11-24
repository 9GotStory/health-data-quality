import type { FileReference } from './structureReference';

function inspectColumns(names: string[], reference: FileReference) {
  const positions = new Map<string, number[]>();
  const extraColumns: number[] = [];
  let lastPosition = -1;
  let reordered = false;
  for (const [index, name] of names.entries()) {
    const columns = positions.get(name);
    if (columns) columns.push(index + 1);
    else positions.set(name, [index + 1]);

    const referencePosition = reference.columns.indexOf(name);
    if (referencePosition === -1) extraColumns.push(index + 1);
    else if (!columns) {
      if (referencePosition < lastPosition) reordered = true;
      lastPosition = referencePosition;
    }
  }
  const duplicates = Array.from(positions)
    .filter(([, columns]) => columns.length > 1)
    .map(([name, columns]) => ({
      field: reference.columns.includes(name) ? name : undefined,
      columns,
    }));
  return {
    bindings: names.map((name) =>
      reference.columns.includes(name) && positions.get(name)?.length === 1 ? name : undefined,
    ),
    missing: reference.columns.filter((name) => !positions.has(name)),
    extraColumns,
    duplicates,
    reordered,
  };
}

const whitespaceOnly = /^\p{White_Space}+$/u;

function requiredValueStatus(value: string | undefined) {
  if (value === undefined) return 'unavailable';
  if (value === '') return 'empty';
  if (whitespaceOnly.test(value)) return 'whitespace';
  return 'present';
}

export async function inspectTxt(file: File, reference: FileReference) {
  let bytes: ArrayBuffer;
  try {
    bytes = await file.arrayBuffer();
  } catch {
    return {
      fileName: file.name,
      reference,
      status: 'unreadable' as const,
      reason: 'read-failed' as const,
    };
  }
  const base = { fileName: file.name, reference };
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ...base, status: 'unreadable' as const, reason: 'invalid-utf8' as const };
  }
  if (/\r(?!\n)/.test(text)) {
    return { ...base, status: 'unreadable' as const, reason: 'bare-cr' as const };
  }
  const [header, ...lines] = text.split(/\r?\n/);
  if (!header) return { ...base, status: 'no-header' as const };
  if (text.endsWith('\n')) lines.pop();
  const names = header.split('|');
  const { bindings, ...columnReport } = inspectColumns(names, reference);
  const hospcode9Index = reference.name === 'PERSON' ? bindings.indexOf('HOSPCODE9') : -1;
  const rows = lines.map((record, index) => {
    const line = index + 2;
    if (record === '') return { line, status: 'blank' as const };
    const fields = record.split('|');
    if (fields.length !== names.length) {
      return { line, status: 'wrong-width' as const, actual: fields.length };
    }
    const whitespace = fields.flatMap((value, index) =>
      whitespaceOnly.test(value) ? [{ column: index + 1, field: bindings[index] }] : [],
    );
    return {
      line,
      status: 'readable' as const,
      whitespace,
      hospcode9: requiredValueStatus(fields[hospcode9Index]),
    };
  });
  return {
    ...base,
    status: 'checked' as const,
    rows,
    expectedWidth: names.length,
    ...columnReport,
  };
}
