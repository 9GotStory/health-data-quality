import { useState, type ChangeEvent } from 'react';
import { inspectPersonHeader, personReference } from './personHeader';

type Report = Awaited<ReturnType<typeof inspectPersonHeader>>;
type Selection =
  | { status: 'idle' | 'reading' }
  | { status: 'error'; message: string }
  | { status: 'done'; report: Report };

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
      {row.emptyHospcode9 && (
        <p className="text-red-800">
          บรรทัด {row.line} · ข้อผิดพลาดตามมาตรฐาน PER-NN · HOSPCODE9 ต้องมีค่า
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
      <h3 className="mt-5 font-semibold">ผลการอ่าน TXT ตามนโยบายเครื่องมือ Q20</h3>
      <p>อ่านไฟล์ด้วย UTF-8 ได้ · หัวตารางมี {report.expectedWidth} ช่อง</p>
      {report.reordered && (
        <p>IO-10 · บรรทัด 1 ลำดับคอลัมน์ต่างจากทะเบียน ควรตรวจทาน เครื่องมืออ่านตามชื่อคอลัมน์</p>
      )}
      {report.extraColumns.length > 0 && (
        <p>IO-10 · บรรทัด 1 มีคอลัมน์เพิ่มเติมที่ตำแหน่ง {report.extraColumns.join(', ')} ควรตรวจทาน</p>
      )}
      {report.duplicates.map(({ field, columns }) => (
        <p key={columns[0]}>
          IO-11 · บรรทัด 1 ชื่อคอลัมน์ซ้ำ {field} ที่ตำแหน่ง {columns.join(', ')} กฎที่ใช้ชื่อนี้ตรวจไม่ได้
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

export function App() {
  const [selection, setSelection] = useState<Selection>({ status: 'idle' });

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) {
      setSelection({ status: 'idle' });
      return;
    }
    if (file.name.toUpperCase() !== 'PERSON.TXT') {
      setSelection({ status: 'error', message: 'รอบตรวจนี้รองรับเฉพาะไฟล์ชื่อ PERSON.TXT' });
      return;
    }
    setSelection({ status: 'reading' });
    try {
      const report = await inspectPersonHeader(file, personReference);
      setSelection({ status: 'done', report });
    } catch {
      setSelection({ status: 'error', message: 'เปิดไฟล์ในเครื่องไม่ได้ โปรดเลือกไฟล์อีกครั้ง' });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-7 border-l-4 border-teal-700 pl-4">
        <h1 className="text-3xl font-bold">ตรวจโครงสร้างแฟ้ม PERSON</h1>
        <p className="mt-2 text-slate-700">ตรวจหัวตารางและแถวข้อมูลในเครื่อง ข้อมูลและผลตรวจอยู่บนอุปกรณ์นี้</p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <label htmlFor="person-file" className="block text-lg font-semibold">
          เลือกไฟล์ PERSON.TXT
        </label>
        <input
          id="person-file"
          type="file"
          accept=".txt"
          onChange={selectFile}
          disabled={selection.status === 'reading'}
          className="mt-3 w-full rounded border border-slate-300 p-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:bg-teal-800 file:px-4 file:py-2 file:font-semibold file:text-white focus-visible:outline-2 focus-visible:outline-teal-700"
        />
      </section>
      <div aria-live="polite" aria-atomic="true">
        {selection.status === 'reading' && <p className="mt-5">กำลังอ่านไฟล์ในเครื่อง…</p>}
        {selection.status === 'error' && <p className="mt-5 text-red-800">{selection.message}</p>}
        {selection.status === 'done' && (
          <section className="mt-5 rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
            <h2 className="mb-3 text-xl font-semibold">ผลตรวจ {selection.report.fileName}</h2>
            <TxtResult report={selection.report} />
            <p className="mt-4 text-slate-700">
              ยังไม่พร้อมตรวจความหมายของข้อมูลรายแถวนอกเหนือจากการตรวจค่าว่างของ HOSPCODE9
            </p>
            <dl className="mt-5 grid gap-x-4 gap-y-1 border-t border-slate-200 pt-4 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold">กฎที่ใช้</dt>
              <dd>PER-STRUCT · ตรวจชื่อคอลัมน์ PERSON ตามทะเบียน โดยเทียบตัวพิมพ์ตรงกัน</dd>
              <dt className="font-semibold">รุ่นชุดอ้างอิง</dt>
              <dd>{selection.report.reference.version}</dd>
              <dt className="font-semibold">แหล่งอ้างอิง</dt>
              <dd>
                <a
                  href={selection.report.reference.url}
                  rel="noreferrer"
                  className="text-teal-800 underline"
                >
                  {selection.report.reference.source}
                </a>
              </dd>
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
