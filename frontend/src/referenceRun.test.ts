// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { inspectSelection } from './inspectSelection';
import { referencePacks } from './referencePacks';

it('checks the same bytes against the selected synthetic snapshot without retaining patient identifiers', async () => {
  const files = [new File(['PID|HOSPCODE9\nprivate-test-id|TEST-A'], 'PERSON.TXT')];
  for (const [version, expected] of [
    ['fixture-1', 'found'],
    ['fixture-2', 'not-found'],
    ['schema-1', 'missing-reference'],
  ] as const) {
    const report = await inspectSelection(files, referencePacks[version]);
    expect(report.pack.version).toBe(version);
    expect(report.coverage[0]).toMatchObject({
      name: 'PERSON',
      report: { rows: [{ line: 2, facilityLookup: expected }] },
    });
    expect(JSON.stringify(report)).not.toContain('private-test-id');
  }
});

it('reports the scope and evidence for ready checks and blocked rules even on a partial submission', async () => {
  const report = await inspectSelection([new File(['HOSPCODE9\nTEST-A'], 'PERSON.TXT')]);
  expect(report.manifest.filter((rule) => ['PER-STRUCT', 'IO-10'].includes(rule.id))).toHaveLength(
    43,
  );
  expect(report.manifest).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'PER-REQUIRED', file: 'PERSON', status: 'ready' }),
      expect.objectContaining({
        id: 'FACILITY-LOOKUP',
        status: 'unavailable',
        reason: expect.stringContaining('ขาดชุดรหัส'),
      }),
      expect.objectContaining({
        file: 'DIAGNOSIS_OPD',
        status: 'unavailable',
        reason: expect.stringContaining('ขัดกัน'),
      }),
      expect.objectContaining({
        file: 'PROVIDER',
        status: 'unavailable',
        reason: expect.stringContaining('วันมีผล'),
      }),
      expect.objectContaining({
        file: 'ICF',
        status: 'unavailable',
        reason: expect.stringContaining('DATE_SERRV'),
      }),
      expect.objectContaining({
        file: 'SERVICE',
        status: 'unavailable',
        reason: expect.stringContaining('ตำแหน่งที่ 2'),
      }),
    ]),
  );
});

it('IT-34 cancels a large synthetic ZIP while a small new selection returns its own coverage', async () => {
  const bytes = readFileSync(new URL('../qa/fixtures/zip/cancel-round.zip', import.meta.url));
  const archive = new File([Uint8Array.from(bytes)], 'cancel-round.zip');
  const round = new AbortController();
  const oldReport = inspectSelection([archive], referencePacks['fixture-1'], round.signal);
  round.abort();
  const [old, current] = await Promise.allSettled([
    oldReport,
    inspectSelection([new File(['HID\nNEW-HOME'], 'HOME.TXT')], referencePacks['fixture-2']),
  ]);
  expect(old).toMatchObject({ status: 'rejected', reason: { name: 'AbortError' } });
  expect(current).toMatchObject({
    status: 'fulfilled',
    value: {
      submitted: 1,
      pack: { version: 'fixture-2' },
      coverage: expect.arrayContaining([
        { name: 'PERSON', status: 'absent' },
        expect.objectContaining({ name: 'HOME', status: 'submitted' }),
      ]),
    },
  });
});

it('IT-34 accepts cancellation during row checks after the TXT bytes have arrived', async () => {
  const round = new AbortController();
  const file = new File(['PID|HOSPCODE9\n' + 'ROW|TEST-A\n'.repeat(65536)], 'PERSON.TXT');
  const readBytes = file.arrayBuffer.bind(file);
  file.arrayBuffer = async () => {
    const bytes = await readBytes();
    setTimeout(() => round.abort(), 0);
    return bytes;
  };
  await expect(
    inspectSelection([file], referencePacks['fixture-1'], round.signal).then(() => 'completed'),
  ).rejects.toMatchObject({ name: 'AbortError' });
});
