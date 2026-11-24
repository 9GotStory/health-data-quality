import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
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
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ PERSON.TXT'), { target: { files: [file] } });

  expect(await screen.findByText('HOSPCODE9')).toBeVisible();
  expect(screen.getByText('PERSON-header-1')).toBeVisible();
  expect(screen.getByText(/ยังไม่พร้อมตรวจความหมาย/)).toBeVisible();
  expect(screen.queryByText(/00042/)).not.toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it('shows the physical line, cause and scope of each limitation alongside independent results', async () => {
  render(<App />);
  const file = new File(['PID|PID|HOSPCODE9\n01|02|\r\n\n01|02\n01|02| '], 'PERSON.TXT');
  fireEvent.change(screen.getByLabelText('เลือกไฟล์ PERSON.TXT'), { target: { files: [file] } });
  expect(await screen.findByText('แถวข้อมูล 4 แถว · อ่านได้ 2 · อ่านไม่ได้ 2')).toBeVisible();
  expect(screen.getByText(/IO-11.*PID.*ตรวจไม่ได้/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 2.*PER-NN.*HOSPCODE9/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 3.*บรรทัดว่าง.*ตรวจไม่ได้/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 4.*2 ช่อง.*3 ช่อง.*ตรวจไม่ได้/)).toBeVisible();
  expect(screen.getByText(/บรรทัด 5.*IO-09.*HOSPCODE9.*ช่องว่าง/)).toBeVisible();
});
