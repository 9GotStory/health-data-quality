import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import App from './App';

afterEach(cleanup);

function archive(name: string) {
  const bytes = readFileSync(`qa/fixtures/zip/${name}.zip`);
  return new File([Uint8Array.from(bytes)], name + '.ZIP');
}

function select(...files: File[]) {
  fireEvent.change(screen.getByLabelText(/เลือกไฟล์/), { target: { files } });
}

it('IO-12/16 checks stored and deflated TXT by basename and reports supplementary files', async () => {
  render(<App />);
  select(archive('readable'));
  const coverage = await screen.findByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
  expect(coverage.children).toHaveLength(43);
  expect(coverage).toHaveTextContent('PERSON · มีข้อมูล');
  expect(coverage).toHaveTextContent('HOME · มีข้อมูล');
  expect(coverage).toHaveTextContent(/บรรทัด 2.*PER-REQUIRED/);
  expect(screen.getByText('POLICY.txt')).toBeVisible();
  expect(document.body).not.toHaveTextContent('TEST-PERSON');
});

it('IO-13/15 isolates a bad CRC and identical duplicate basenames from a readable sibling', async () => {
  render(<App />);
  select(archive('partial'));
  const coverage = await screen.findByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
  expect(coverage).toHaveTextContent(/PERSON.*อ่านไม่ได้.*IO-15.*ความสมบูรณ์/);
  expect(coverage).toHaveTextContent('HOME · มีข้อมูล');
  expect(coverage).toHaveTextContent('ICF · ชื่อแฟ้มซ้ำ 2 ไฟล์');
  expect(coverage).not.toHaveTextContent('บรรทัด 2 · ข้อผิดพลาดตามมาตรฐาน PER-REQUIRED');
});

it('IO-14/15 identifies skipped entries without interpreting their contents', async () => {
  render(<App />);
  select(archive('restricted'));
  const coverage = await screen.findByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
  for (const [name, reason] of [
    ['PERSON', 'วิธีบีบอัด'],
    ['DEATH', 'เข้ารหัส'],
    ['CARD', 'เส้นทางไม่ปลอดภัย'],
    ['ICF', 'symlink'],
  ]) {
    const row = screen.getByText(name + ' · อ่านไม่ได้').closest('li');
    expect(row).toHaveTextContent(reason);
  }
  expect(coverage).toHaveTextContent('HOME · มีเฉพาะหัวตาราง');
  expect(coverage).toHaveTextContent('SERVICE · ไม่ได้ส่ง');
  expect(screen.getByText(/nested\.zip.*IO-14.*ZIP ซ้อน/)).toBeVisible();
  expect(screen.getByText('SERVICE.bin')).toBeVisible();
});

it.each(['truncated', 'incomplete listing'])(
  'IO-15 stops the entire round for a %s ZIP directory',
  async (fault) => {
    render(<App />);
    select(archive('readable'));
    await screen.findByText(/แฟ้มหลักที่ส่ง 2 จาก 43/);
    const bytes = readFileSync('qa/fixtures/zip/readable.zip');
    const end = bytes.lastIndexOf(Buffer.from('PK\x05\x06', 'binary'));
    // The real directory holds three records. Declare only the first two.
    bytes.writeUInt16LE(2, end + 8);
    bytes.writeUInt16LE(2, end + 10);
    const damaged = fault === 'truncated' ? bytes.subarray(0, end) : bytes;
    select(new File([Uint8Array.from(damaged)], 'broken.zip'));
    expect(await screen.findByText(/IO-15.*อ่านรายการใน ZIP.*หยุดรอบ/)).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'รายงานความครอบคลุม' })).not.toBeInTheDocument();
  },
);

it.each(['two archives', 'archive with TXT'])(
  'IO-01 rejects %s before starting a round',
  (choice) => {
    render(<App />);
    select(
      archive('readable'),
      choice === 'two archives' ? archive('partial') : new File(['PID'], 'PERSON.TXT'),
    );
    expect(screen.getByText(/IO-01.*โปรดเลือก ZIP หนึ่งไฟล์/)).toBeVisible();
    expect(screen.queryByText(/กำลังอ่าน/)).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'รายงานความครอบคลุม' })).not.toBeInTheDocument();
  },
);
