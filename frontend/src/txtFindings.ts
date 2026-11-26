import type { SelectionReport } from './inspectSelection';
import type { Finding, TxtReport } from './reportOutput';

export const policy = 'นโยบายรับไฟล์ Q20';
type Checked = Extract<TxtReport, { status: 'checked' }>;

function headerFindings(txt: Checked, lookupSource: string) {
  const { reference } = txt;
  const findings: Finding[] = txt.missing.map((field) => ({
    result: 'error',
    rule: reference.headerRule,
    field,
    line: 1,
    reason: 'ขาดคอลัมน์ตามทะเบียน',
    source: reference.source,
  }));
  if (txt.reordered)
    findings.push({
      result: 'review',
      rule: 'IO-10',
      line: 1,
      reason: 'ลำดับคอลัมน์ต่างจากทะเบียน ควรตรวจทาน เครื่องมืออ่านตามชื่อคอลัมน์',
      source: policy,
    });
  if (txt.extraColumns.length) {
    const label = reference.unknownPositions.length
      ? 'ชื่อคอลัมน์ที่ผูกกับทะเบียนไม่ได้อยู่ที่ตำแหน่ง'
      : 'มีคอลัมน์เพิ่มเติมที่ตำแหน่ง';
    findings.push({
      result: 'review',
      rule: 'IO-10',
      line: 1,
      reason: label + ' ' + txt.extraColumns.join(', '),
      source: policy,
    });
  }
  for (const { field, columns } of txt.duplicates) {
    findings.push({
      result: 'cannot_check',
      rule: 'IO-11',
      line: 1,
      field,
      reason: 'ชื่อคอลัมน์ซ้ำที่ตำแหน่ง ' + columns.join(', ') + ' กฎที่ใช้ชื่อนี้ตรวจไม่ได้',
      source: policy,
    });
  }
  function blockedColumn(rule: string, field: string, source: string) {
    const reason = txt.missing.includes(field)
      ? 'ขาดคอลัมน์'
      : txt.duplicates.some((d) => d.field === field)
        ? 'ชื่อคอลัมน์ซ้ำ'
        : undefined;
    if (reason)
      findings.push({
        result: 'cannot_check',
        rule,
        field,
        line: 1,
        reason: 'ตรวจไม่ได้ทุกแถว เพราะ' + reason + ' ' + field,
        source,
      });
  }
  if (reference.checksRequiredHospcode9)
    blockedColumn('PER-REQUIRED', 'HOSPCODE9', reference.source);
  if (reference.facilityLookupField)
    blockedColumn('FACILITY-LOOKUP', reference.facilityLookupField, lookupSource);
  return findings;
}

function rowFindings(txt: Checked, lookupSource: string) {
  const findings: Finding[] = [];
  for (const row of txt.rows) {
    const { line } = row;
    if (row.status !== 'readable') {
      const blank = row.status === 'blank';
      const reason = blank ? 'บรรทัดว่าง' : `พบ ${row.actual} ช่อง หัวตารางมี ${txt.expectedWidth} ช่อง`;
      findings.push({
        line,
        result: 'cannot_check',
        rule: blank ? 'IO-05' : 'IO-07',
        reason: reason + ' · อ่านแถวไม่ได้ กฎที่ใช้ข้อมูลแถวนี้ตรวจไม่ได้',
        source: policy,
      });
      continue;
    }
    for (const { column, field } of row.whitespace) {
      findings.push({
        line,
        result: 'review',
        rule: 'IO-09',
        field,
        reason: `ช่องที่ ${column} มีแต่ช่องว่าง ควรตรวจทานตาม Q20`,
        source: policy,
      });
    }
    if (row.hospcode9 === 'empty' || row.hospcode9 === 'whitespace') {
      const empty = row.hospcode9 === 'empty';
      findings.push({
        line,
        field: 'HOSPCODE9',
        result: empty ? 'error' : 'cannot_check',
        rule: 'PER-REQUIRED',
        reason: empty ? 'HOSPCODE9 ต้องมีค่า' : 'ยังตัดสินเงื่อนไขบังคับกรอกไม่ได้ เพราะมีแต่ช่องว่าง',
        source: empty ? txt.reference.source : policy,
      });
    }
    if (row.hospcode9 === 'present') {
      findings.push({
        line,
        field: 'HOSPCODE9',
        result: 'pass',
        rule: 'PER-REQUIRED',
        reason: 'มีค่าในช่องบังคับกรอก',
        source: txt.reference.source,
      });
    }
    if (txt.reference.facilityLookupField && row.hospcode9 === 'empty') {
      findings.push({
        line,
        field: txt.reference.facilityLookupField,
        result: 'not_applicable',
        rule: 'FACILITY-LOOKUP',
        reason: 'ไม่มีรหัสให้เทียบ',
        source: lookupSource,
      });
    }
    if (row.facilityLookup) {
      const lookup = {
        found: ['pass', 'พบในชุดรหัสสังเคราะห์'],
        'not-found': ['review', 'ไม่พบในชุดรหัสสังเคราะห์'],
        'missing-reference': ['cannot_check', 'ตรวจไม่ได้ เพราะขาดชุดรหัสหน่วยบริการ'],
      } as const;
      const [result, reason] = lookup[row.facilityLookup];
      findings.push({
        line,
        result,
        reason,
        field: txt.reference.facilityLookupField,
        rule: 'FACILITY-LOOKUP',
        source: lookupSource,
      });
    }
  }
  return findings;
}

export function txtFindings(txt: TxtReport, round: SelectionReport): Finding[] {
  if (txt.status === 'no-header')
    return [
      {
        result: 'cannot_check',
        rule: 'IO-03/06',
        reason: 'ตรวจชื่อคอลัมน์ไม่ได้ เพราะไม่มีหัวตารางในบรรทัดแรก',
        source: policy,
      },
    ];
  if (txt.status === 'unreadable') {
    const failures = {
      'invalid-utf8': ['IO-02', 'ข้อมูลไม่ใช่ UTF-8 ที่อ่านได้ จึงอ่านทั้งแฟ้มไม่ได้'],
      'bare-cr': ['IO-04', 'พบ CR เดี่ยว จึงอ่านทั้งแฟ้มไม่ได้'],
      'read-failed': ['FILE-READ', 'เปิดไฟล์ในเครื่องไม่ได้ จึงตรวจหัวตารางและแถวข้อมูลไม่ได้'],
    };
    const [rule, reason] = failures[txt.reason];
    return [{ result: 'cannot_check', rule, reason, source: policy }];
  }
  const lookupSource = round.pack.facility?.source ?? 'บัญชีกฎของชุดอ้างอิง · ขาดชุดรหัสหน่วยบริการ';
  return headerFindings(txt, lookupSource).concat(rowFindings(txt, lookupSource));
}
