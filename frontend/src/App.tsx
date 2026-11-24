import { useState, type ChangeEvent } from 'react';
import type { inspectTxt } from './inspectTxt';
import { inspectSelection, type SelectionReport } from './inspectSelection';
import { structureRegistry } from './structureReference';

type Report = Awaited<ReturnType<typeof inspectTxt>>;
type Selection =
  | { status: 'idle' | 'reading' }
  | { status: 'error'; message: string }
  | { status: 'done'; report: SelectionReport };

type CheckedReport = Extract<Report, { status: 'checked' }>;
type DataRow = CheckedReport['rows'][number];

function HeaderResult({ report }: { report: CheckedReport }) {
  if (!report.missing.length) {
    return <p>พบชื่อคอลัมน์อ้างอิงครบ {report.reference.columns.length} ชื่อในบรรทัดแรก</p>;
  }
  return (
    <>
      <p className="font-semibold text-red-800">
        ข้อผิดพลาดในบรรทัดแรก · ขาด {report.missing.length} คอลัมน์
      </p>
      <ul aria-label="ชื่อคอลัมน์ที่ขาด" className="mt-3 flex flex-wrap gap-2">
        {report.missing.map((name) => (
          <li key={name} className="rounded bg-red-50 px-2 py-1 font-mono text-sm text-red-900">
            {name}
          </li>
        ))}
      </ul>
    </>
  );
}

function RowResult({ row, expectedWidth }: { row: DataRow; expectedWidth: number }) {
  if (row.status !== 'readable') {
    const reason =
      row.status === 'blank'
        ? 'IO-05 · บรรทัดว่าง'
        : `IO-07 · พบ ${row.actual} ช่อง หัวตารางมี ${expectedWidth} ช่อง`;
    return (
      <li>
        บรรทัด {row.line} · {reason} · อ่านแถวไม่ได้ กฎที่ใช้ข้อมูลแถวนี้ตรวจไม่ได้
      </li>
    );
  }
  return (
    <li>
      <p>บรรทัด {row.line} · อ่านได้</p>
      {row.hospcode9 === 'empty' && (
        <p className="text-red-800">
          บรรทัด {row.line} · ข้อผิดพลาดตามมาตรฐาน PER-REQUIRED · HOSPCODE9 ต้องมีค่า
        </p>
      )}
      {row.whitespace.map(({ column, field }) => (
        <p key={column}>
          บรรทัด {row.line} · IO-09 · ช่องที่ {column} {field} มีแต่ช่องว่าง ควรตรวจทานตาม Q20
          ยังตัดสินเงื่อนไขบังคับกรอกไม่ได้
        </p>
      ))}
    </li>
  );
}

function TxtResult({ report }: { report: Report }) {
  if (report.status === 'unreadable') {
    if (report.reason === 'read-failed')
      return <p>เปิดไฟล์ในเครื่องไม่ได้ จึงตรวจหัวตารางและแถวข้อมูลไม่ได้</p>;
    const reason =
      report.reason === 'invalid-utf8' ? 'IO-02 · ข้อมูลไม่ใช่ UTF-8 ที่อ่านได้' : 'IO-04 · พบ CR เดี่ยว';
    return <p>นโยบายรับไฟล์ Q20 · {reason} จึงอ่านทั้งแฟ้มและตรวจหัวตารางหรือแถวข้อมูลไม่ได้</p>;
  }
  if (report.status === 'no-header') {
    return (
      <>
        <p>นโยบายรับไฟล์ Q20 · IO-03/06</p>
        <p>ตรวจชื่อคอลัมน์ไม่ได้ เพราะไม่มีหัวตารางในบรรทัดแรก</p>
      </>
    );
  }
  const readable = report.rows.filter((row) => row.status === 'readable').length;
  return (
    <>
      <h3 className="font-semibold">โครงสร้างตามมาตรฐาน · หัวตารางบรรทัด 1</h3>
      <HeaderResult report={report} />
      {report.reference.name === 'PERSON' && report.missing.includes('HOSPCODE9') && (
        <p>PER-REQUIRED · ตรวจไม่ได้ทุกแถว เพราะขาดคอลัมน์ HOSPCODE9</p>
      )}
      <h3 className="mt-5 font-semibold">ผลการอ่าน TXT ตามนโยบายเครื่องมือ Q20</h3>
      <p>อ่านไฟล์ด้วย UTF-8 ได้ · หัวตารางมี {report.expectedWidth} ช่อง</p>
      {report.reordered && (
        <p>IO-10 · บรรทัด 1 ลำดับคอลัมน์ต่างจากทะเบียน ควรตรวจทาน เครื่องมืออ่านตามชื่อคอลัมน์</p>
      )}
      {report.extraColumns.length > 0 && (
        <p>
          IO-10 · บรรทัด 1{' '}
          {report.reference.unknownPositions.length
            ? 'ชื่อคอลัมน์ที่ผูกกับทะเบียนไม่ได้อยู่ที่ตำแหน่ง'
            : 'มีคอลัมน์เพิ่มเติมที่ตำแหน่ง'}{' '}
          {report.extraColumns.join(', ')} ควรตรวจทาน
        </p>
      )}
      {report.duplicates.map(({ field, columns }) => (
        <p key={columns[0]}>
          IO-11 · บรรทัด 1 ชื่อคอลัมน์ซ้ำ {field} ที่ตำแหน่ง {columns.join(', ')} กฎที่ใช้ชื่อนี้ตรวจไม่ได้
          {report.reference.name === 'PERSON' && field === 'HOSPCODE9' && ' รวมถึง PER-REQUIRED'}
        </p>
      ))}
      {report.rows.length === 0 ? (
        <p>มีเฉพาะหัวตาราง · ไม่มีแถวข้อมูล</p>
      ) : (
        <>
          <p className="mt-3 font-semibold">
            แถวข้อมูล {report.rows.length} แถว · อ่านได้ {readable} · อ่านไม่ได้{' '}
            {report.rows.length - readable}
          </p>
          <ul aria-label="ผลตามบรรทัด" className="mt-2 space-y-2">
            {report.rows.map((row) => (
              <RowResult key={row.line} row={row} expectedWidth={report.expectedWidth} />
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function FileDetails({ report }: { report: Report }) {
  const { reference } = report;
  return (
    <div className="space-y-2 border-l-2 border-slate-200 py-2 pl-4">
      <p className="break-all text-sm">ไฟล์ที่เลือก · {report.fileName}</p>
      <TxtResult report={report} />
      {reference.unknownPositions.map((position) => (
        <p key={position}>
          ตำแหน่งที่ {position} · คู่มือไม่ระบุชื่อคอลัมน์ จึงผูกค่ากับตำแหน่งนี้และตรวจตามชื่อไม่ได้ · ตรวจไม่ได้
        </p>
      ))}
      {reference.name !== 'PERSON' && (
        <p>การตรวจความหมาย · ตรวจไม่ได้ เพราะยังไม่เปิดใช้กฎรายแถวสำหรับแฟ้มนี้</p>
      )}
      {reference.name === 'PERSON' && (
        <p>
          ยังไม่พร้อมตรวจความหมายของข้อมูลรายแถวนอกเหนือจากการตรวจค่าว่างของ HOSPCODE9 ตาม PER-REQUIRED ·
          กฎอื่นตรวจไม่ได้
        </p>
      )}
      <p className="text-sm">
        {reference.name === 'PERSON' ? 'PER-STRUCT' : 'IO-10'} · ตรวจชื่อคอลัมน์ตามทะเบียน ·{' '}
        <span>{reference.version}</span>
      </p>
      <a href={reference.url} rel="noreferrer" className="text-sm text-teal-800 underline">
        {reference.source}
      </a>
    </div>
  );
}

function CoverageResult({ report }: { report: SelectionReport }) {
  return (
    <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
      <h2 className="text-xl font-semibold">รายงานความครอบคลุม</h2>
      <p className="mt-2">
        แฟ้มหลักที่ส่ง {report.submitted} จาก 43 แฟ้ม · ไม่ได้ส่ง {43 - report.submitted} แฟ้ม
      </p>
      <p className="text-sm text-slate-700">เลือกส่งบางแฟ้มได้ แฟ้มที่ไม่ได้ส่งไม่มีข้อผิดพลาดจากการขาดแฟ้มนั้น</p>
      {report.outside.length > 0 && (
        <section className="my-4">
          <h3 className="font-semibold">นอกขอบเขต 43 แฟ้มหลัก</h3>
          <ul>
            {report.outside.map((name, index) => (
              <li key={index} className="break-all">
                {name}
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul aria-label="สถานะการส่ง 43 แฟ้มหลัก" className="mt-4 divide-y divide-slate-200">
        {report.coverage.map((entry) => {
          if (entry.status === 'absent')
            return (
              <li key={entry.name} className="py-2 text-slate-600">
                {entry.name} · ไม่ได้ส่ง
              </li>
            );
          if (entry.status === 'duplicate')
            return (
              <li key={entry.name} className="py-2 text-amber-900">
                {entry.name} · ชื่อแฟ้มซ้ำ {entry.count} ไฟล์ · IO-13 · ตรวจไม่ได้
                โปรดเลือกแฟ้มชื่อนี้เพียงไฟล์เดียว
              </li>
            );
          const file = entry.report;
          const status =
            file.status === 'checked' ? (file.rows.length ? 'มีข้อมูล' : 'มีเฉพาะหัวตาราง') : 'อ่านไม่ได้';
          return (
            <li key={entry.name} className="py-2">
              <details open={report.submitted === 1}>
                <summary className="cursor-pointer font-semibold">
                  {entry.name} · {status}
                  {file.status === 'checked' &&
                    file.missing.length > 0 &&
                    ` · ขาด ${file.missing.length} คอลัมน์`}
                </summary>
                <FileDetails report={file} />
              </details>
            </li>
          );
        })}
      </ul>
      <p className="mt-5 text-sm">
        ทะเบียนโครงสร้าง {structureRegistry.version} · SHA-256 ของคู่มือ{' '}
        <code className="break-all">{structureRegistry.sha256}</code>
      </p>
    </section>
  );
}

export function App() {
  const [selection, setSelection] = useState<Selection>({ status: 'idle' });

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) {
      setSelection({ status: 'idle' });
      return;
    }
    if (files.some((file) => !file.name.toLowerCase().endsWith('.txt'))) {
      setSelection({ status: 'error', message: 'โปรดเลือกเฉพาะไฟล์ TXT จากชุดส่งออกเดียวกัน' });
      return;
    }
    setSelection({ status: 'reading' });
    try {
      const report = await inspectSelection(files);
      setSelection({ status: 'done', report });
    } catch {
      setSelection({ status: 'error', message: 'เปิดไฟล์ในเครื่องไม่ได้ โปรดเลือกไฟล์อีกครั้ง' });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-7 border-l-4 border-teal-700 pl-4">
        <h1 className="text-3xl font-bold">ตรวจโครงสร้าง 43 แฟ้ม</h1>
        <p className="mt-2 text-slate-700">
          เลือก TXT หนึ่งหรือหลายไฟล์จากชุดส่งออกเดียวกัน ข้อมูลและผลตรวจอยู่บนอุปกรณ์นี้
        </p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <label htmlFor="txt-files" className="block text-lg font-semibold">
          เลือกไฟล์ TXT
        </label>
        <input
          id="txt-files"
          type="file"
          accept=".txt"
          multiple
          onChange={selectFile}
          disabled={selection.status === 'reading'}
          className="mt-3 w-full rounded border border-slate-300 p-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:bg-teal-800 file:px-4 file:py-2 file:font-semibold file:text-white focus-visible:outline-2 focus-visible:outline-teal-700"
        />
      </section>
      <div aria-live="polite" aria-atomic="true">
        {selection.status === 'reading' && <p className="mt-5">กำลังอ่านไฟล์ในเครื่อง…</p>}
        {selection.status === 'error' && <p className="mt-5 text-red-800">{selection.message}</p>}
        {selection.status === 'done' && <CoverageResult report={selection.report} />}
      </div>
    </main>
  );
}

export default App;
