// @vitest-environment node
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
        file: 'SERVICE',
        status: 'unavailable',
        reason: expect.stringContaining('ตำแหน่งที่ 2'),
      }),
    ]),
  );
});
