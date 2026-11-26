import type { SelectionReport } from './inspectSelection';

import { policy, txtFindings } from './txtFindings';

type Coverage = SelectionReport['coverage'][number];
export type TxtReport = Extract<Coverage, { status: 'submitted' }>['report'];
type Severity = 'error' | 'review' | 'cannot_check' | 'pass';
export type ResultFilter = 'all' | Exclude<Severity, 'pass'>;
export type Finding = {
  result: Severity;
  rule: string;
  reason: string;
  source: string;
  line?: number;
  field?: string;
  file?: string;
};

export type FileResult = {
  name: string;
  file: string;
  status: 'absent' | 'duplicate' | 'unreadable' | 'header_only' | 'with_data' | 'outside';
  limitation?: string;
  members?: SelectionReport['outside'];
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

function submittedFile(txt: TxtReport, round: SelectionReport): FileResult {
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
  return { name: txt.reference.name, file: txt.fileName, status, txt, findings, limitation };
}

type Entry = SelectionReport['outside'][number];

function transportFindings({ name, problem }: Entry): Finding[] {
  if (!problem) return [];
  const [rule, reason] = problem.split(' · ');
  return [{ file: name, result: 'cannot_check', rule, reason, source: policy }];
}

export function fileResults(round: SelectionReport): FileResult[] {
  const files = round.coverage.map((entry): FileResult => {
    const { name } = entry;
    switch (entry.status) {
      case 'submitted':
        return submittedFile(entry.report, round);
      case 'absent':
        return { name, file: name, status: 'absent', findings: [] };
      case 'unavailable':
        return {
          name,
          file: entry.fileName,
          status: 'unreadable',
          findings: transportFindings({ name: entry.fileName, problem: entry.problem }),
        };
      case 'duplicate':
        return {
          name,
          file: name,
          status: 'duplicate',
          members: entry.members,
          findings: [
            {
              result: 'cannot_check',
              rule: 'IO-13',
              reason: 'ชื่อแฟ้มหลักซ้ำ โปรดให้ชุดที่เลือกมีแฟ้มชื่อนี้เพียงไฟล์เดียว',
              source: policy,
            },
            ...entry.members.flatMap(transportFindings),
          ],
        };
    }
  });
  return files.concat(
    round.outside.map((entry) => ({
      name: entry.name,
      file: entry.name,
      status: 'outside',
      findings: transportFindings(entry),
    })),
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
    ['result', 'file', 'line', 'field', 'rule', 'reason', 'source', 'version', 'file_status'],
  ];
  for (const file of files) {
    for (const name of file.members?.map((member) => member.name) ?? [file.file]) {
      rows.push([
        'file_status',
        name,
        '',
        '',
        '',
        [statusLabels[file.status], file.limitation].filter(Boolean).join(' · '),
        policy,
        version,
        file.status,
      ]);
    }
    for (const finding of filteredFindings(file, filter)) {
      rows.push([
        finding.result,
        finding.file ?? file.file,
        String(finding.line ?? ''),
        finding.field ?? '',
        finding.rule,
        finding.reason,
        finding.source,
        version,
        '',
      ]);
    }
  }
  return '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
