// @vitest-environment node
import { expect, it } from 'vitest';
import complete from '../qa/fixtures/complete/PERSON.TXT?raw';
import missing from '../qa/fixtures/missing/PERSON.TXT?raw';
import { inspectPersonHeader, personReference } from './personHeader';

it('finds all 34 referenced names without including record values in the report', async () => {
  const file = new File([complete], 'PERSON.TXT');
  const result = await inspectPersonHeader(file, personReference);
  expect(result).toMatchObject({
    fileName: 'PERSON.TXT',
    reference: { version: 'PERSON-header-1', columns: { length: 34 } },
    status: 'checked',
    missing: [],
  });
  expect(JSON.stringify(result)).not.toContain('00042');
});

it('reports the exact missing name on a header-only file even when its lowercase spelling exists', async () => {
  const file = new File([missing.trimEnd() + '|hospcode9'], 'person.txt');
  expect(await inspectPersonHeader(file, personReference)).toMatchObject({
    status: 'checked',
    missing: ['HOSPCODE9'],
  });
});

it('reports no readable header for a zero-byte file', async () => {
  expect(await inspectPersonHeader(new File([], 'PERSON.TXT'), personReference)).toMatchObject({
    status: 'no-header',
  });
});
