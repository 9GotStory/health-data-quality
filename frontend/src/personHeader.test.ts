// @vitest-environment node
import { expect, it } from 'vitest';
import { inspectPersonHeader, personReference } from './personHeader';

// Synthetic header transcribed from the PERSON table, PDF pages 6–9.
const header =
  'HOSPCODE|CID|PID|HID|PRENAME|NAME|LNAME|HN|SEX|BIRTH|MSTATUS|OCCUPATION_OLD|OCCUPATION_NEW|RACE|NATION|RELIGION|EDUCATION|FSTATUS|FATHER|MOTHER|COUPLE|VSTATUS|MOVEIN|DISCHARGE|DDISCHARGE|ABOGROUP|RHGROUP|LABOR|PASSPORT|TYPEAREA|D_UPDATE|TELEPHONE|MOBILE|HOSPCODE9';

it('finds all 34 referenced names without including record values in the report', async () => {
  const row = ['00123', '0000000000001', '00042', ...Array<string>(31).fill('')].join('|');
  const file = new File([header, '\r\n', row], 'PERSON.TXT');
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
  const file = new File([header.replace('HOSPCODE9', 'hospcode9')], 'person.txt');
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
