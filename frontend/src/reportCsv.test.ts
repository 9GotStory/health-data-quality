import { expect, it } from 'vitest';
import { inspectSelection } from './inspectSelection';
import { referencePacks } from './referencePacks';
import { fileResults, reportCsv } from './reportOutput';

it('exports selected errors with physical locations and keeps coverage for the entire round', async () => {
  const round = await inspectSelection(
    [
      new File(['PID|HOSPCODE9\nSYNTHETIC-NAME-1234567890123|\nprivate| '], 'pErSoN.TxT'),
      new File(['private outside row'], 'POLICY.TXT'),
    ],
    referencePacks['fixture-1'],
  );
  const csv = reportCsv(fileResults(round), 'error', round.pack.version);
  expect(csv).toContain('"error","pErSoN.TxT","2","HOSPCODE9","PER-REQUIRED"');
  expect(csv).toContain(round.pack.schema.files[0].source);
  expect(csv).toContain('"fixture-1"');
  expect(csv).toContain('"file_status","pErSoN.TxT"');
  expect(csv).toContain('"file_status","SERVICE"');
  expect(csv).toContain('"file_status","POLICY.TXT"');
  expect(csv).not.toMatch(/"review"|"cannot_check"|SYNTHETIC-NAME|1234567890123|private/);
});

it('quotes multiline cells and neutralizes spreadsheet prefixes only on output', async () => {
  const base = referencePacks['schema-1'];
  const field = '+fixture';
  const source = '@source, "quoted"\ncontinued';
  const schema = {
    ...base.schema,
    files: base.schema.files.map((ref) =>
      ref.name === 'PERSON' ? { ...ref, columns: [...ref.columns, field], source } : ref,
    ),
  };
  const names = ['=1,"two"\nthree.TXT', ' -1.txt', '\tmarker.txt'];
  const files = [
    new File(['PID\nprivate'], 'PERSON.txt'),
    ...names.map((name) => new File(['private'], name)),
  ];
  const round = await inspectSelection(files, { ...base, schema });
  const csv = reportCsv(fileResults(round), 'all', round.pack.version);
  expect(csv.startsWith('\ufeff')).toBe(true);
  expect(csv).toContain('"\'=1,""two""\nthree.TXT"');
  expect(csv).toContain('"\' -1.txt"');
  expect(csv).toContain('"\'\tmarker.txt"');
  expect(csv).toContain('"\'+fixture"');
  expect(csv).toContain('"\'@source, ""quoted""\ncontinued"');
  expect(round.outside.map((entry) => entry.name)).toEqual(names);
  expect(schema.files.find((ref) => ref.name === 'PERSON')?.columns).toContain(field);
});

it('separates policy reviews, row dependencies and file-level limitations in the pinned pack', async () => {
  const round = await inspectSelection([
    new File(['PID|HOSPCODE9\nprivate| \nprivate|ABC'], 'PERSON.TXT'),
    new File([new Uint8Array([255])], 'HOME.TXT'),
    new File(['HOSPCODE'], 'DIAGNOSIS_OPD.TXT'),
  ]);
  const files = fileResults(round);
  const reviews = reportCsv(files, 'review', round.pack.version);
  expect(reviews).toContain('"review","PERSON.TXT","2","HOSPCODE9","IO-09"');
  const limited = reportCsv(files, 'cannot_check', round.pack.version);
  expect(limited).toContain('"cannot_check","PERSON.TXT","2","HOSPCODE9","PER-REQUIRED"');
  expect(limited).toContain('"cannot_check","PERSON.TXT","3","HOSPCODE9","FACILITY-LOOKUP"');
  expect(limited).toContain('"cannot_check","HOME.TXT","","","IO-02"');
  expect(limited).toContain('"cannot_check","DIAGNOSIS_OPD.TXT","","DIAGTYPE","COD-001"');
  expect(limited).not.toMatch(/"0"|"review"|"error"|private|ABC/);
});
