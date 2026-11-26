import { useState, type ChangeEvent } from 'react';
import { inspectSelection, SelectionError, type SelectionReport } from './inspectSelection';
import { referencePacks, type ReferencePack } from './referencePacks';
import { CoverageResult } from './CoverageResult';

type Selection =
  | { status: 'idle' | 'reading' }
  | { status: 'error'; message: string }
  | { status: 'done'; roundNumber: number; report: SelectionReport };

export function App() {
  const [selection, setSelection] = useState<Selection>({ status: 'idle' });

  const [pack, setPack] = useState<ReferencePack>(referencePacks['schema-1']);
  const packs = Object.values(referencePacks);

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    if (!files.length) return;
    event.currentTarget.value = '';
    try {
      const pending = inspectSelection(files, pack);
      setSelection({ status: 'reading' });
      const report = await pending;
      setSelection({
        status: 'done',
        roundNumber: selection.status === 'done' ? selection.roundNumber + 1 : 1,
        report,
      });
    } catch (error) {
      setSelection({
        status: 'error',
        message:
          error instanceof SelectionError ? error.message : 'เปิดไฟล์ในเครื่องไม่ได้ โปรดเลือกไฟล์อีกครั้ง',
      });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-10 sm:py-16">
      <header className="mb-7 border-l-4 border-teal-700 pl-4">
        <h1 className="text-3xl font-bold">ตรวจโครงสร้าง 43 แฟ้ม</h1>
        <p className="mt-2 text-slate-700">
          เลือก ZIP หนึ่งไฟล์ หรือ TXT หนึ่งหรือหลายไฟล์จากชุดส่งออกเดียวกัน ข้อมูลและผลตรวจอยู่บนอุปกรณ์นี้
        </p>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-7">
        <label htmlFor="reference-pack" className="block text-lg font-semibold">
          ชุดอ้างอิงสำหรับรอบถัดไป
        </label>
        <select
          id="reference-pack"
          className="mt-2 w-full rounded border border-slate-300 p-2"
          disabled={selection.status === 'reading'}
          value={pack.version}
          onChange={(event) => {
            const selected = packs.find((option) => option.version === event.target.value);
            if (selected) setPack(selected);
          }}
        >
          {packs.map((option) => (
            <option key={option.version} value={option.version}>
              {option.label} ({option.version})
            </option>
          ))}
        </select>
        <p className="mb-5 mt-2 text-sm text-slate-700">
          เลือกชุดแล้วเลือกไฟล์เพื่อเริ่มรอบใหม่ รายงานเดิมใช้ชุดที่ระบุในรายงาน
          {pack.facility && ' · ใช้กับข้อมูลทดสอบเท่านั้น เช่น PERSON.HOSPCODE9 ค่า TEST-A'}
        </p>
        <label htmlFor="txt-files" className="block text-lg font-semibold">
          เลือกไฟล์ TXT หรือ ZIP
        </label>
        <input
          id="txt-files"
          type="file"
          accept=".txt,.zip"
          multiple
          onChange={selectFile}
          disabled={selection.status === 'reading'}
          className="mt-3 w-full rounded border border-slate-300 p-2 text-sm file:mr-3 file:cursor-pointer file:rounded file:bg-teal-800 file:px-4 file:py-2 file:font-semibold file:text-white focus-visible:outline-2 focus-visible:outline-teal-700"
        />
      </section>
      <div aria-live="polite" aria-atomic="true">
        {selection.status === 'reading' && <p className="mt-5">กำลังอ่านไฟล์ในเครื่อง…</p>}
        {selection.status === 'error' && <p className="mt-5 text-red-800">{selection.message}</p>}
        {selection.status === 'done' && (
          <CoverageResult key={selection.roundNumber} report={selection.report} />
        )}
      </div>
    </main>
  );
}

export default App;
