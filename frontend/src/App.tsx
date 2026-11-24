import { useState, type ChangeEvent } from 'react';
import { inspectPersonHeader, personReference } from './personHeader';

type Report = Awaited<ReturnType<typeof inspectPersonHeader>>;
type Selection =
  | { status: 'idle' | 'reading' }
  | { status: 'error'; message: string }
  | { status: 'done'; report: Report };

function HeaderResult({ report }: { report: Report }) {
  if (report.status === 'no-header') {
    return <p>ตรวจชื่อคอลัมน์ไม่ได้ เพราะไม่มีหัวตารางในบรรทัดแรก</p>;
  }
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
      setSelection({ status: 'error', message: 'อ่านไฟล์ไม่ได้ โปรดตรวจว่าไฟล์เปิดได้และใช้ UTF-8' });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-7 border-l-4 border-teal-700 pl-4">
        <h1 className="text-3xl font-bold">ตรวจโครงสร้างแฟ้ม PERSON</h1>
        <p className="mt-2 text-slate-700">ตรวจชื่อคอลัมน์ในเครื่อง ข้อมูลและผลตรวจอยู่บนอุปกรณ์นี้</p>
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
            <HeaderResult report={selection.report} />
            <p className="mt-4 text-slate-700">ยังไม่พร้อมตรวจความหมายของข้อมูลรายแถว</p>
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
