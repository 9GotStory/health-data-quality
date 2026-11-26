import type { SelectionReport } from './inspectSelection';

import { policy, txtFindings } from './txtFindings';

type Coverage = SelectionReport['coverage'][number];
export type TxtReport = Extract<Coverage, { status: 'submitted' }>['report'];
type Severity = 'error' | 'review' | 'cannot_check' | 'pass' | 'not_applicable';
export type ResultFilter = 'all' | Exclude<Severity, 'pass' | 'not_applicable'>;
export type Finding = {
  result: Severity;
  rule: string;
  reason: string;
  source: string;
  line?: number;
  field?: string;
  file?: FileLocation;
};

export type FileLocation = { label: string; original: string };

export type FileResult = {
  name: string;
  file: FileLocation;
  status: 'absent' | 'duplicate' | 'unreadable' | 'header_only' | 'with_data' | 'outside';
  limitation?: string;
  members?: FileLocation[];
  rows?: { total: number; readable: number; unreadable: number };
  txt?: TxtReport;
  findings: Finding[];
};

export const statusLabels = {
  absent: 'ไม่ได้ส่ง',
  duplicate: 'ชื่อแฟ้มซ้ำ',
  unreadable: 'อ่านไม่ได้',
  header_only: 'มีเฉพาะหัวตาราง',
  with_data: 'มีข้อมูล',
  outside: 'นอกขอบเขต',
};

function submittedFile(txt: TxtReport, file: FileLocation, round: SelectionReport): FileResult {
  const findings = txtFindings(txt, round);
  const rules = round.manifest.filter((rule) => rule.file === txt.reference.name);
  for (const rule of rules) {
    if (rule.status === 'unavailable') {
      findings.push({
        result: 'cannot_check',
        rule: rule.id,
        field: rule.field,
        reason: rule.reason,
        source: rule.evidence.map((item) => item.source).join(' · '),
      });
    }
  }
  const status =
    txt.status === 'checked' ? (txt.rows.length ? 'with_data' : 'header_only') : 'unreadable';
  const limitation = txt.reference.checksRequiredHospcode9
    ? round.pack.facility
      ? 'กฎรายแถวของชุดทดสอบครอบคลุมเฉพาะค่าว่างของ HOSPCODE9 และการเทียบรหัสสังเคราะห์เมื่อผูกคอลัมน์ได้ กฎความหมายอื่นยังตรวจไม่ได้'
      : 'ยังไม่พร้อมตรวจความหมายของข้อมูลรายแถวนอกเหนือจากการตรวจค่าว่างของ HOSPCODE9 ตาม PER-REQUIRED · กฎอื่นตรวจไม่ได้'
    : 'การตรวจความหมาย · ตรวจไม่ได้ เพราะยังไม่เปิดใช้กฎรายแถวสำหรับแฟ้มนี้';
  let rows;
  if (txt.status === 'checked') {
    const total = txt.rows.length;
    const readable = txt.rows.filter((row) => row.status === 'readable').length;
    rows = { total, readable, unreadable: total - readable };
  }
  return { name: txt.reference.name, file, status, txt, findings, limitation, rows };
}

type Entry = SelectionReport['outside'][number];

function transportFindings(file: FileLocation, problem: Entry['problem']): Finding[] {
  if (!problem) return [];
  return [{ file, result: 'cannot_check', ...problem, source: policy }];
}

function coreLocation(original: string, ordinal?: number): FileLocation {
  // The inspector has already matched this basename against the reference registry.
  const basename = original.split(/[\\/]/).pop()!;
  return { original, label: ordinal ? basename + ' (' + ordinal + ')' : basename };
}

export function fileResults(round: SelectionReport): FileResult[] {
  const files = round.coverage.map((entry): FileResult => {
    const { name } = entry;
    const group = { label: name, original: name };
    switch (entry.status) {
      case 'submitted':
        return submittedFile(entry.report, coreLocation(entry.report.fileName), round);
      case 'absent':
        return { name, file: group, status: 'absent', findings: [] };
      case 'unavailable': {
        const file = coreLocation(entry.fileName);
        return {
          name,
          file,
          status: 'unreadable',
          findings: transportFindings(file, entry.problem),
        };
      }
      case 'duplicate': {
        const members = entry.members.map((member, index) => coreLocation(member.name, index + 1));
        return {
          name,
          file: group,
          status: 'duplicate',
          members,
          findings: [
            {
              result: 'cannot_check',
              rule: 'IO-13',
              reason: 'ชื่อแฟ้มหลักซ้ำ โปรดให้ชุดที่เลือกมีแฟ้มชื่อนี้เพียงไฟล์เดียว',
              source: policy,
            },
            ...entry.members.flatMap((entry, index) =>
              transportFindings(members[index], entry.problem),
            ),
          ],
        };
      }
    }
  });
  return files.concat(
    round.outside.map((entry, index) => {
      const label = /^(POLICY|DATA_CORRECT)\.txt$/i.test(entry.name)
        ? entry.name
        : 'รายการนอกขอบเขต ' + (index + 1);
      const file = { original: entry.name, label };
      return {
        name: label,
        file,
        status: 'outside',
        findings: transportFindings(file, entry.problem),
      };
    }),
  );
}

export function filteredFindings(file: FileResult, filter: ResultFilter) {
  return filter === 'all'
    ? file.findings
    : file.findings.filter((finding) => finding.result === filter);
}

function csvCell(text: string) {
  const needsPrefix = /^[\t\r\n]|^\s*[=+@\-＝＋－＠]/u.test(text);
  const literal = needsPrefix ? "'" + text : text;
  return '"' + literal.replaceAll('"', '""') + '"';
}

export function reportCsv(files: FileResult[], filter: ResultFilter, version: string) {
  const rows = [
    [
      'result',
      'file',
      'line',
      'field',
      'rule',
      'reason',
      'source',
      'version',
      'file_status',
      'rows_total',
      'rows_readable',
      'rows_unreadable',
    ],
  ];
  for (const file of files) {
    for (const location of file.members ?? [file.file]) {
      rows.push([
        'file_status',
        location.label,
        '',
        '',
        '',
        [statusLabels[file.status], file.limitation].filter(Boolean).join(' · '),
        policy,
        version,
        file.status,
        String(file.rows?.total ?? ''),
        String(file.rows?.readable ?? ''),
        String(file.rows?.unreadable ?? ''),
      ]);
    }
    for (const finding of filteredFindings(file, filter)) {
      rows.push([
        finding.result,
        (finding.file ?? file.file).label,
        String(finding.line ?? ''),
        finding.field ?? '',
        finding.rule,
        finding.reason,
        finding.source,
        version,
        '',
        '',
        '',
        '',
      ]);
    }
  }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
