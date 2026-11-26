import { useMemo, useState } from 'react';
import type { SelectionReport } from './inspectSelection';
import { ReferenceManifest } from './ReferenceManifest';
import {
  fileResults,
  filteredFindings,
  reportCsv,
  statusLabels,
  type FileResult,
  type Finding,
  type ResultFilter,
} from './reportOutput';

const labels = {
  all: 'ผลตรวจทั้งหมด',
  error: 'ข้อผิดพลาด',
  review: 'ข้อควรตรวจทาน',
  cannot_check: 'ตรวจไม่ได้',
  pass: 'ผ่าน',
};

function downloadCsv(files: FileResult[], filter: ResultFilter, version: string) {
  const blob = new Blob([reportCsv(files, filter, version)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'health-data-quality-' + version + '.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function FindingList({
  findings,
  file,
  version,
}: {
  findings: Finding[];
  file: FileResult;
  version: string;
}) {
  // Missing header fields share one reason, location and source.
  const isMissing = (item: Finding) =>
    item.rule === file.txt?.reference.headerRule && item.result === 'error';
  const missing = findings.filter(isMissing);
  return (
    <>
      {missing.length > 0 && (
        <>
          <p className="font-semibold text-red-800">
            ข้อผิดพลาดในบรรทัดแรก · ขาด {missing.length} คอลัมน์
          </p>
          <ul aria-label="ชื่อคอลัมน์ที่ขาด" className="flex flex-wrap gap-2">
            {missing.map((item) => (
              <li
                key={item.field}
                className="rounded bg-red-50 px-2 py-1 font-mono text-sm text-red-900"
              >
                {item.field}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-700">
            {missing[0].rule} · {missing[0].reason} · {missing[0].source} · {version}
          </p>
        </>
      )}
      {findings
        .filter((item) => !isMissing(item))
        .map((item, index) => (
          <div key={index} className="my-2">
            <p>
              {item.file && item.file + ' · '}
              {item.line && 'บรรทัด ' + item.line + ' · '}
              {item.rule} · {item.field && item.field + ' · '}
              {item.rule === 'IO-03/06' ? <span>{item.reason}</span> : item.reason}
            </p>
            <p className="text-sm text-slate-600">
              {labels[item.result]} · {item.source} · {version}
            </p>
          </div>
        ))}
    </>
  );
}

function FileDetails({
  file,
  findings,
  report,
}: {
  file: FileResult;
  findings: Finding[];
  report: SelectionReport;
}) {
  const txt = file.txt;
  const readable =
    txt?.status === 'checked' ? txt.rows.filter((row) => row.status === 'readable').length : 0;
  return (
    <div className="space-y-2 border-l-2 border-slate-200 py-2 pl-4">
      {txt && (
        <>
          <p className="break-all text-sm">ไฟล์ที่เลือก · {file.file}</p>
          {txt.status === 'checked' && (
            <>
              {!txt.missing.length && (
                <p>พบชื่อคอลัมน์อ้างอิงครบ {txt.reference.columns.length} ชื่อในบรรทัดแรก</p>
              )}
              <p>อ่านไฟล์ด้วย UTF-8 ได้ · หัวตารางมี {txt.expectedWidth} ช่อง</p>
              <p>
                {txt.rows.length
                  ? `แถวข้อมูล ${txt.rows.length} แถว · อ่านได้ ${readable} · อ่านไม่ได้ ${txt.rows.length - readable}`
                  : 'มีเฉพาะหัวตาราง · ไม่มีแถวข้อมูล'}
              </p>
            </>
          )}
        </>
      )}
      <FindingList file={file} findings={findings} version={report.pack.version} />
      {txt && (
        <>
          <p>{file.limitation}</p>
          <p className="text-sm">
            {txt.reference.headerRule} · ตรวจชื่อคอลัมน์ตามทะเบียน · <span>{txt.reference.version}</span>
          </p>
          <a href={txt.reference.url} rel="noreferrer" className="text-sm text-teal-800 underline">
            {txt.reference.source}
          </a>
        </>
      )}
    </div>
  );
}

function FileStatus({
  file,
  filter,
  report,
}: {
  file: FileResult;
  filter: ResultFilter;
  report: SelectionReport;
}) {
  const findings = filteredFindings(file, filter);
  if (file.status === 'absent')
    return (
      <li className="py-2 text-slate-600">
        {file.name} · {statusLabels.absent}
      </li>
    );
  if (file.status === 'duplicate' || file.status === 'outside')
    return (
      <li className="break-all py-2">
        {file.members ? (
          <>
            <p>
              {file.name} · ชื่อแฟ้มซ้ำ {file.members.length} ไฟล์
            </p>
            <ul>
              {file.members.map((member, index) => (
                <li key={index}>{member.name}</li>
              ))}
            </ul>
          </>
        ) : (
          <span>{file.name}</span>
        )}
        <FindingList findings={findings} file={file} version={report.pack.version} />
      </li>
    );
  return (
    <li className="break-words py-2">
      <details open={report.submitted === 1 || (filter !== 'all' && findings.length > 0)}>
        <summary className="cursor-pointer font-semibold">
          {file.name} · {statusLabels[file.status]}
          {file.txt?.status === 'checked' &&
            file.txt.missing.length > 0 &&
            ` · ขาด ${file.txt.missing.length} คอลัมน์`}
        </summary>
        {!file.txt && <p>ไฟล์ที่เลือก · {file.file}</p>}
        <FileDetails file={file} findings={findings} report={report} />
      </details>
    </li>
  );
}

export function CoverageResult({ report }: { report: SelectionReport }) {
  const [filter, setFilter] = useState<ResultFilter>('all');
  const files = useMemo(() => fileResults(report), [report]);
  const outside = files.filter((file) => file.status === 'outside');
  const count = files.reduce((total, file) => total + filteredFindings(file, filter).length, 0);
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold">รายงานความครอบคลุม</h2>
      <ReferenceManifest report={report} />
      <p className="mt-2">
        แฟ้มหลักที่ส่ง {report.submitted} จาก 43 แฟ้ม · ไม่ได้ส่ง {43 - report.submitted} แฟ้ม
      </p>
      <p className="text-sm text-slate-700">เลือกส่งบางแฟ้มได้ แฟ้มที่ไม่ได้ส่งไม่มีข้อผิดพลาดจากการขาดแฟ้มนั้น</p>
      <div className="my-4 flex flex-wrap items-end gap-3">
        <label>
          กรองผลตรวจ
          <select
            className="mt-1 block rounded border p-2"
            value={filter}
            onChange={(event) => setFilter(event.target.value as ResultFilter)}
          >
            {(['all', 'error', 'review', 'cannot_check'] as const).map((value) => (
              <option key={value} value={value}>
                {labels[value]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded bg-teal-800 px-4 py-2 font-semibold text-white"
          onClick={() => downloadCsv(files, filter, report.pack.version)}
        >
          ดาวน์โหลด CSV
        </button>
      </div>
      <p role="status">ผลตามตัวกรอง {count} รายการ · CSV รวมผลที่แสดงและสถานะแฟ้มทั้งหมด</p>
      {outside.length > 0 && (
        <section className="my-4">
          <h3 className="font-semibold">นอกขอบเขต 43 แฟ้มหลัก</h3>
          <ul>
            {outside.map((file, index) => (
              <FileStatus key={index} file={file} filter={filter} report={report} />
            ))}
          </ul>
        </section>
      )}
      <ul aria-label="สถานะการส่ง 43 แฟ้มหลัก" className="mt-4 divide-y divide-slate-200">
        {files
          .filter((file) => file.status !== 'outside')
          .map((file) => (
            <FileStatus key={file.name} file={file} filter={filter} report={report} />
          ))}
      </ul>
      <p className="mt-5 text-sm">
        ทะเบียนโครงสร้าง {report.pack.schema.version} · SHA-256 ของคู่มือ{' '}
        <code className="break-all">{report.pack.schema.sha256}</code>
      </p>
    </section>
  );
}
