import { useState } from 'react';
import type { SelectionReport } from './inspectSelection';

export function ReferenceManifest({ report }: { report: SelectionReport }) {
  const { pack, manifest, coverage } = report;
  const [file, setFile] = useState(
    coverage.find((entry) => entry.status !== 'absent')?.name ?? 'PERSON',
  );
  const rules = manifest.filter((rule) => rule.file === file);
  return (
    <div className="my-4 space-y-2">
      <p className="font-semibold">
        ชุดที่ใช้ตรวจ · {pack.label} ({pack.version})
      </p>
      {pack.facility && <p>ผลเทียบรหัสหน่วยบริการใช้รายการสังเคราะห์เพื่อทดสอบเท่านั้น</p>}
      <p>ยังไม่ทราบจำนวนกฎทั้งหมดของแต่ละแฟ้ม ความครอบคลุมของกฎแสดงเฉพาะรายการที่มีในชุดนี้</p>
      <details className="rounded border border-slate-200 p-3">
        <summary className="cursor-pointer font-semibold">บัญชีกฎและหลักฐานรายแฟ้ม</summary>
        <label className="mt-3 block">
          แฟ้มในบัญชีกฎ
          <select
            className="ml-2 max-w-full rounded border p-1"
            value={file}
            onChange={(event) => setFile(event.target.value)}
          >
            {coverage.map((entry) => (
              <option key={entry.name}>{entry.name}</option>
            ))}
          </select>
        </label>
        <ul className="mt-2 divide-y divide-slate-200">
          {rules.map((rule) => (
            <li key={rule.id} className="space-y-1 py-2">
              <p className="font-semibold">
                {rule.id} · {rule.status === 'ready' ? 'พร้อมตรวจ' : 'ตรวจไม่ได้'}
              </p>
              <p>
                {rule.appliesTo} · ต้องใช้{rule.dependency}
              </p>
              {rule.status === 'unavailable' && <p>{rule.reason}</p>}
              {rule.evidence.map((item) => (
                <p key={item.sha256} className="text-sm">
                  {item.url ? (
                    <a href={item.url} rel="noreferrer" className="text-teal-800 underline">
                      {item.source}
                    </a>
                  ) : (
                    item.source
                  )}
                  {' · SHA-256 '}
                  <code className="break-all">{item.sha256}</code>
                </p>
              ))}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
