import type { ReferencePack } from './referencePacks';
import type { FileReference } from './structureReference';

function inspectColumns(names: string[], reference: FileReference) {
  const positions = new Map<string, number[]>();
  const extraColumns: number[] = [];
  for (const [index, name] of names.entries()) {
    const columns = positions.get(name);
    if (columns) columns.push(index + 1);
    else positions.set(name, [index + 1]);
    if (!reference.columns.includes(name)) extraColumns.push(index + 1);
  }
  const bindings = names.map((name) =>
    reference.columns.includes(name) && positions.get(name)?.length === 1 ? name : undefined,
  );
  let lastPosition = -1;
  let reordered = false;
  for (const name of bindings) {
    if (name === undefined) continue;
    const position = reference.columns.indexOf(name);
    if (position < lastPosition) {
      reordered = true;
      break;
    }
    lastPosition = position;
  }
  const duplicates = Array.from(positions)
    .filter(([, columns]) => columns.length > 1)
    .map(([name, columns]) => ({
      field: reference.columns.includes(name) ? name : undefined,
      columns,
    }));
  return {
    bindings,
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

export async function inspectTxt(
  file: Pick<File, 'name' | 'arrayBuffer'>,
  reference: FileReference,
  facility: ReferencePack['facility'] = null,
) {
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
  const hospcode9Index = reference.checksRequiredHospcode9 ? bindings.indexOf('HOSPCODE9') : -1;
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
    const hospcode9 = requiredValueStatus(fields[hospcode9Index]);
    let facilityLookup;
    if (reference.checksRequiredHospcode9 && hospcode9 === 'present') {
      if (!facility) facilityLookup = 'missing-reference' as const;
      else
        facilityLookup = facility.codes.includes(fields[hospcode9Index])
          ? ('found' as const)
          : ('not-found' as const);
    }
    return {
      line,
      status: 'readable' as const,
      whitespace,
      hospcode9,
      facilityLookup,
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
