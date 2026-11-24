// @vitest-environment node
import { expect, it } from 'vitest';
import complete from '../qa/fixtures/complete/PERSON.TXT?raw';
import missing from '../qa/fixtures/missing/PERSON.TXT?raw';
import { inspectTxt as inspectPersonTxt } from './inspectTxt';
import { fileReferences } from './structureReference';

const personReference = fileReferences.find(({ name }) => name === 'PERSON')!;

it('finds all 34 referenced names without including record values in the report', async () => {
  const file = new File([complete], 'PERSON.TXT');
  const result = await inspectPersonTxt(file, personReference);
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
  expect(await inspectPersonTxt(file, personReference)).toMatchObject({
    status: 'checked',
    missing: ['HOSPCODE9'],
  });
});

it('reports no readable header for a zero-byte file', async () => {
  expect(await inspectPersonTxt(new File([], 'PERSON.TXT'), personReference)).toMatchObject({
    status: 'no-header',
  });
});

function inspect(...parts: BlobPart[]) {
  return inspectPersonTxt(new File(parts, 'PERSON.TXT'), personReference);
}

it.each([
  [
    'IT-06 invalid byte after a readable prefix',
    new Uint8Array([0x50, 0x49, 0x44, 0x0a, 0x31, 0xff]),
    'invalid-utf8',
  ],
  ['IT-07 UTF-16 signature', new Uint8Array([0xff, 0xfe, 0x41, 0]), 'invalid-utf8'],
  ['IT-09 bare CR', 'PID\n1\rX', 'bare-cr'],
])('%s makes the entire file unavailable', async (_, contents, reason) => {
  const result = await inspect(contents);
  expect(result).toMatchObject({ status: 'unreadable', reason });
  expect(result).not.toHaveProperty('missing');
  expect(result).not.toHaveProperty('rows');
});

it('IT-05/08/10–12/17–19 counts physical lines, literal pipes and trailing fields', async () => {
  const result = await inspect('\ufeffPID|CID\r\n"ทดสอบ"|\n\r\n"ทดสอบ|แยก"|0\n001\n9|99');
  expect(result).toMatchObject({
    status: 'checked',
    rows: [
      { line: 2, status: 'readable' },
      { line: 3, status: 'blank' },
      { line: 4, status: 'wrong-width', actual: 3 },
      { line: 5, status: 'wrong-width', actual: 1 },
      { line: 6, status: 'readable' },
    ],
    expectedWidth: 2,
  });
  expect(JSON.stringify(result)).not.toContain('ทดสอบ');
});

it('IT-22–24 distinguishes missing, reordered, extra and ambiguous names without exposing input headers', async () => {
  const result = await inspect('\ufeffPID|HOSPCODE|PID|HOSPCODE9 |private-extra|private-extra\n');
  expect(result).toMatchObject({
    status: 'checked',
    extraColumns: [4, 5, 6],
    duplicates: [{ field: 'PID', columns: [1, 3] }, { columns: [5, 6] }],
    reordered: true,
    rows: [],
  });
  if (result.status !== 'checked') throw new Error('Expected a readable header');
  expect(result.missing).toContain('HOSPCODE9');
  expect(result.missing).not.toContain('PID');
  expect(JSON.stringify(result)).not.toContain('private-extra');
});

it('IT-16/20/21 applies the empty-field rule only to an unambiguous HOSPCODE9 on readable rows', async () => {
  const result = await inspect(
    'PID|PID|HOSPCODE9\n1|2|\n1|2| \t\n1|2|NULL\n1|2|0\n1|2|""\n1|2|001\n1|2|99\n1|2|9',
  );
  expect(result).toMatchObject({
    rows: [
      { hospcode9: 'empty', whitespace: [] },
      { hospcode9: 'whitespace', whitespace: [{ column: 3, field: 'HOSPCODE9' }] },
      ...Array(6).fill({ hospcode9: 'present', whitespace: [] }),
    ],
  });
  expect(await inspect('HOSPCODE9|PID|HOSPCODE9\n|\t|a')).toMatchObject({
    rows: [{ hospcode9: 'unavailable', whitespace: [{ column: 2, field: 'PID' }] }],
  });
  expect(await inspect('PID|HOSPCODE9\n001|')).toMatchObject({ rows: [{ hospcode9: 'empty' }] });
  expect(await inspect('HOSPCODE9|PID\n|001')).toMatchObject({ rows: [{ hospcode9: 'empty' }] });
});

it.each([
  ['IT-13 empty first line', '\nPID\n1', 'no-header'],
  ['IT-14 zero bytes', '', 'no-header'],
  ['IT-14 BOM only', '\ufeff', 'no-header'],
])('%s cannot bind a header from a later line', async (_, contents, status) => {
  expect(await inspect(contents)).toMatchObject({ status });
});

it.each([
  ['header only', 'PID', []],
  ['header with CRLF', 'PID\r\n', []],
  ['one final LF', 'PID\n001\n', [{ line: 2, status: 'readable' }]],
  [
    'two final CRLF',
    'PID\r\n001\r\n\r\n',
    [
      { line: 2, status: 'readable' },
      { line: 3, status: 'blank' },
    ],
  ],
])('IT-08/11/14 %s counts only physical records', async (_, contents, rows) => {
  expect(await inspect(contents)).toMatchObject({ status: 'checked', rows });
});

it('IT-05/23 removes a single initial BOM and preserves interior BOM and header whitespace', async () => {
  const result = await inspect('\ufeffPID|\ufeffHOSPCODE|HOSPCODE9 \n');
  if (result.status !== 'checked') throw new Error('Expected a readable header');
  expect(result.extraColumns).toEqual([2, 3]);
  expect(result.missing).toEqual(expect.arrayContaining(['HOSPCODE', 'HOSPCODE9']));
  expect(result.missing).not.toContain('PID');
  expect(result.reordered).toBe(false);
});

it('IT-15–17 checks a real 34-field layout and withholds dependent results on overflow', async () => {
  const result = await inspect(complete.trimEnd() + '\n' + Array(35).fill('x').join('|'));
  expect(result).toMatchObject({
    expectedWidth: 34,
    rows: [
      { line: 2, status: 'readable', hospcode9: 'empty' },
      { line: 3, status: 'wrong-width', actual: 35 },
    ],
  });
  if (result.status !== 'checked') throw new Error('Expected a readable header');
  expect(result.rows[1]).not.toHaveProperty('hospcode9');
});

it('IT-22 reads all 34 reordered fields by exact name', async () => {
  const header = complete.split(/\r?\n/, 1)[0].split('|');
  const reordered = ['HOSPCODE9', ...header.slice(0, -1)].join('|');
  const values = ['', ...Array(33).fill('1')].join('|');
  expect(await inspect(reordered + '\n' + values)).toMatchObject({
    missing: [],
    duplicates: [],
    extraColumns: [],
    reordered: true,
    rows: [{ status: 'readable', hospcode9: 'empty' }],
  });
});
