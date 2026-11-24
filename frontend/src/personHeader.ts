interface PersonReference {
  readonly version: string;
  readonly source: string;
  readonly url: string;
  readonly columns: readonly string[];
}

export const personReference: PersonReference = {
  version: 'PERSON-header-1',
  source: 'คู่มือโครงสร้างข้อมูล 43 แฟ้ม รุ่น 2.4.1 หน้า PDF 6–9',
  url: 'https://hdata.moph.go.th/site/wp-content/uploads/2025/04/43-file-Structure_Version-2.4.128.04.68.pdf#page=6',
  columns: [
    'HOSPCODE',
    'CID',
    'PID',
    'HID',
    'PRENAME',
    'NAME',
    'LNAME',
    'HN',
    'SEX',
    'BIRTH',
    'MSTATUS',
    'OCCUPATION_OLD',
    'OCCUPATION_NEW',
    'RACE',
    'NATION',
    'RELIGION',
    'EDUCATION',
    'FSTATUS',
    'FATHER',
    'MOTHER',
    'COUPLE',
    'VSTATUS',
    'MOVEIN',
    'DISCHARGE',
    'DDISCHARGE',
    'ABOGROUP',
    'RHGROUP',
    'LABOR',
    'PASSPORT',
    'TYPEAREA',
    'D_UPDATE',
    'TELEPHONE',
    'MOBILE',
    'HOSPCODE9',
  ],
};

function inspectColumns(names: string[], reference: PersonReference) {
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

export async function inspectPersonHeader(file: File, reference: PersonReference) {
  const bytes = await file.arrayBuffer();
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
  const hospcode9Index = bindings.indexOf('HOSPCODE9');
  const rows = lines.map((record, index) => {
    const line = index + 2;
    if (record === '') return { line, status: 'blank' as const };
    const fields = record.split('|');
    if (fields.length !== names.length) {
      return { line, status: 'wrong-width' as const, actual: fields.length };
    }
    const whitespace = fields.flatMap((value, index) =>
      /^\p{White_Space}+$/u.test(value) ? [{ column: index + 1, field: bindings[index] }] : [],
    );
    return {
      line,
      status: 'readable' as const,
      whitespace,
      emptyHospcode9: fields[hospcode9Index] === '',
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
