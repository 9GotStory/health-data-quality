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

export async function inspectPersonHeader(file: File, reference: PersonReference) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  const header = text.split(/\r?\n/, 1)[0];
  if (!header) return { fileName: file.name, reference, status: 'no-header' as const };
  const names = header.split('|');
  return {
    fileName: file.name,
    reference,
    status: 'checked' as const,
    missing: reference.columns.filter((name) => !names.includes(name)),
  };
}
