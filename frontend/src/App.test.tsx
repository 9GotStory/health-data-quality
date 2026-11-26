import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import complete from '../qa/fixtures/complete/PERSON.TXT?raw';
import App from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('selects a local PERSON file and reports missing names without contacting the starter API', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<App />);

  const file = new File(['PID|HOSPCODE\n00042|00123'], 'PERSON.TXT');
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), { target: { files: [file] } });

  expect(await screen.findByText('HOSPCODE9')).toBeVisible();
  expect(screen.getByText('PERSON-header-1')).toBeVisible();
  expect(screen.getByText(/ยังไม่พร้อมตรวจความหมาย/)).toBeVisible();
  expect(screen.queryByText(/00042/)).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('shows the physical line, cause and scope of each limitation alongside independent results', async () => {
  render(<App />);
  const file = new File(['PID|PID|HOSPCODE9\n01|02|\r\n\n01|02\n01|02| '], 'PERSON.TXT');
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), { target: { files: [file] } });
  expect(await screen.findByText('แถวข้อมูล 4 แถว · อ่านได้ 2 · อ่านไม่ได้ 2')).toBeVisible();
  expect(screen.getByText(/IO-11.*PID.*ตรวจไม่ได้/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*PER-REQUIRED.*HOSPCODE9/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 3.*บรรทัดว่าง.*ตรวจไม่ได้/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 4.*2 ช่อง.*3 ช่อง.*ตรวจไม่ได้/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 5.*IO-09.*HOSPCODE9.*ช่องว่าง/)).toBeVisible();
});

it('explains once why missing HOSPCODE9 blocks its row rule while readable rows still count', async () => {
  render(<App />);
  const file = new File(['PID\n1\n2'], 'PERSON.TXT');
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), { target: { files: [file] } });
  expect(await screen.findByText(/PER-REQUIRED.*ตรวจไม่ได้.*ขาดคอลัมน์ HOSPCODE9/)).toBeVisible();
  expect(screen.getByText('แถวข้อมูล 2 แถว · อ่านได้ 2 · อ่านไม่ได้ 0')).toBeVisible();
});

it('IT-22/23 shows the reordered complete header and distinguishes an extra position from a missing name', async () => {
  render(<App />);
  const input = screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP');
  const names = complete.split(/\r?\n/, 1)[0].split('|');
  const reordered = ['HOSPCODE9', ...names.slice(0, -1)].join('|');
  const values = ['', ...Array(33).fill('1')].join('|');
  fireEvent.change(input, {
    target: { files: [new File([reordered + '\n' + values], 'PERSON.TXT')] },
  });
  expect(await screen.findByText(/IO-10.*ลำดับคอลัมน์ต่างจากทะเบียน/)).toBeVisible();
  expect(screen.getByText(/พบชื่อคอลัมน์อ้างอิงครบ 34/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*PER-REQUIRED.*HOSPCODE9/)).toBeVisible();

  fireEvent.change(input, { target: { files: [new File([names.join('|') + ' '], 'PERSON.TXT')] } });
  expect(await screen.findByText(/IO-10.*คอลัมน์เพิ่มเติมที่ตำแหน่ง 34/)).toBeVisible();
  expect(screen.getByRole('list', { name: 'ชื่อคอลัมน์ที่ขาด' })).toHaveTextContent('HOSPCODE9');
  expect(screen.queryByText(/ลำดับคอลัมน์ต่างจากทะเบียน/)).not.toBeInTheDocument();
});

it('reports all 43 submission statuses and local details for a partial multi-TXT selection', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render(<App />);
  const files = [
    new File(['HID|HOSPCODE\nSYNTHETIC-PRIVATE|00001'], 'hOmE.TxT'),
    new File(['HOSPCODE'], 'ICF.TXT'),
    new File(['private supplement'], 'POLICY.txt'),
  ];
  const input = screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP');
  expect(input).toHaveAttribute('multiple');
  fireEvent.change(input, { target: { files } });
  const coverage = await screen.findByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
  expect(coverage.children).toHaveLength(43);
  expect(coverage).toHaveTextContent('PERSON · ไม่ได้ส่ง');
  expect(coverage).toHaveTextContent('HOME · มีข้อมูล');
  expect(coverage).toHaveTextContent('ICF · มีเฉพาะหัวตาราง');
  expect(screen.getByText('POLICY.txt')).toBeVisible();
  expect(screen.getByText(/แฟ้มหลักที่ส่ง 2 จาก 43 แฟ้ม/)).toBeVisible();
  expect(coverage).toHaveTextContent('DATE_SERRV');
  expect(coverage).toHaveTextContent('HOSPCODE9');
  expect(coverage).toHaveTextContent(/ลำดับคอลัมน์ต่างจากทะเบียน/);
  expect(coverage).toHaveTextContent(/ตรวจความหมาย.*ตรวจไม่ได้/);
  expect(document.body).not.toHaveTextContent('SYNTHETIC-PRIVATE');
  expect(fetch).not.toHaveBeenCalled();
});

it('marks duplicate basenames ambiguous and checks the independent file in the same round', async () => {
  render(<App />);
  const files = [
    new File(['HOSPCODE'], 'one/PERSON.TXT'),
    new File(['HOSPCODE9'], 'two/person.txt'),
    new File(['HOSPCODE'], 'sErViCe.txt'),
  ];
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), { target: { files } });
  const coverage = await screen.findByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
  expect(coverage).toHaveTextContent('PERSON · ชื่อแฟ้มซ้ำ 2 ไฟล์');
  expect(coverage).toHaveTextContent('SERVICE · มีเฉพาะหัวตาราง');
  expect(coverage).not.toHaveTextContent('PER-REQUIRED');
  expect(screen.getAllByRole('list', { name: 'ชื่อคอลัมน์ที่ขาด', hidden: true })).toHaveLength(1);
});

it('keeps SERVICE position 2 unresolved and requires the exact ICF spelling from the manual', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), {
    target: {
      files: [
        new File(['HOSPCODE|PID|HN\n00001|001|\n00002|002|'], 'SERVICE.txt'),
        new File(['HOSPCODE|DATE_SERV'], 'ICF.txt'),
      ],
    },
  });
  const coverage = await screen.findByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
  expect(coverage).toHaveTextContent(/ตำแหน่งที่ 2.*คู่มือไม่ระบุชื่อ.*ตรวจไม่ได้/);
  expect(coverage).toHaveTextContent('DATE_SERRV');
  expect(coverage).not.toHaveTextContent('PER-REQUIRED');
  expect(coverage).not.toHaveTextContent('ต้องมีค่า');
});

it('reports ambiguous names independently from the order of uniquely bound columns', async () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), {
    target: { files: [new File(['HOSPCODE9|HID|HOSPCODE9'], 'HOME.TXT')] },
  });
  expect(await screen.findByText(/IO-11.*HOSPCODE9.*1, 3/)).toBeVisible();
  expect(screen.queryByText(/ลำดับคอลัมน์ต่างจากทะเบียน/)).not.toBeInTheDocument();
});

it('keeps the reported pack and lookup until the user submits the same TXT for another run', async () => {
  render(<App />);
  const select = screen.getByRole('combobox', { name: 'ชุดอ้างอิงสำหรับรอบถัดไป' });
  const input = screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP');
  const file = new File(['PID|HOSPCODE9\nsecret-id|TEST-A'], 'PERSON.TXT');
  const run = () => fireEvent.change(input, { target: { files: [file] } });

  fireEvent.change(select, { target: { value: 'fixture-1' } });
  run();
  expect(await screen.findByText('ชุดที่ใช้ตรวจ · ชุดทดสอบสังเคราะห์ 1 (fixture-1)')).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*· พบในชุดรหัสสังเคราะห์/)).toBeVisible();
  fireEvent.change(select, { target: { value: 'fixture-2' } });
  expect(screen.getByText(/ชุดที่ใช้ตรวจ.*fixture-1/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*· พบในชุดรหัสสังเคราะห์/)).toBeVisible();
  run();
  expect(await screen.findByText(/ชุดที่ใช้ตรวจ.*fixture-2/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*ไม่พบในชุดรหัสสังเคราะห์/)).toBeVisible();

  fireEvent.change(select, { target: { value: 'schema-1' } });
  run();
  expect(await screen.findByText(/ชุดที่ใช้ตรวจ.*schema-1/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*ตรวจไม่ได้.*ขาดชุดรหัส/)).toBeVisible();
  expect(screen.getByText(/ยังไม่ทราบจำนวนกฎทั้งหมด/)).toBeVisible();
  expect(screen.queryByText(/secret-id/)).not.toBeInTheDocument();
});

it.each([
  ['PID', 'ขาดคอลัมน์'],
  ['HOSPCODE9|HOSPCODE9', 'ชื่อคอลัมน์ซ้ำ'],
])('explains why a ready fixture lookup cannot run with the header %s', async (header, reason) => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('ชุดอ้างอิงสำหรับรอบถัดไป'), {
    target: { value: 'fixture-1' },
  });
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), {
    target: { files: [new File([header], 'PERSON.TXT')] },
  });
  expect(await screen.findByText(new RegExp('FACILITY-LOOKUP.*ตรวจไม่ได้.*' + reason))).toBeVisible();
});

it('filters inspection findings while keeping all 43 file statuses and the export available', async () => {
  render(<App />);
  const file = new File(['PID|HOSPCODE9\nPRIVATE-NAME|\n1234567890123| '], 'PERSON.TXT');
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ TXT หรือ ZIP'), { target: { files: [file] } });
  const filter = await screen.findByLabelText('กรองผลตรวจ');
  fireEvent.change(filter, { target: { value: 'error' } });
  expect(screen.getByText(/บรรทัด 2.*PER-REQUIRED.*HOSPCODE9/)).toBeVisible();
  expect(screen.queryByText(/บรรทัด 3.*IO-09/)).not.toBeInTheDocument();
  expect(screen.getByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' }).children).toHaveLength(43);
  expect(screen.getByRole('button', { name: 'ดาวน์โหลด CSV' })).toBeEnabled();
  fireEvent.change(filter, { target: { value: 'review' } });
  expect(screen.getByText(/บรรทัด 3.*IO-09/)).toBeVisible();
  expect(screen.queryByText(/บรรทัด 2.*PER-REQUIRED/)).not.toBeInTheDocument();
  expect(document.body).not.toHaveTextContent(/PRIVATE-NAME|1234567890123/);
});
