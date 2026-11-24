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
