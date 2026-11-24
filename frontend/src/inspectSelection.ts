import {
  BlobReader,
  BlobWriter,
  ZipReader,
  type Entry,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
  WARNING_MISMATCHED_CENTRAL_DIRECTORY_OFFSET,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
} from '@zip.js/zip.js/index-native.js';
import { inspectTxt } from './inspectTxt';
import { fileReferences } from './structureReference';

type TxtInput = Pick<File, 'name' | 'arrayBuffer'>;

type Input = TxtInput | { name: string; problem: string };

function zipEntryProblem(entry: Entry) {
  const path = entry.filename.replaceAll('\\', '/').replace(/\/$/, '');
  if (
    /^[a-z]:/i.test(path) ||
    path.includes('\0') ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return 'IO-14 · เส้นทางไม่ปลอดภัย';
  if (entry.symlink) return 'IO-14 · ไม่ตาม symlink';
  if (/\.zip$/i.test(path)) return 'IO-14 · ไม่เปิด ZIP ซ้อน';
  if (entry.encrypted) return 'IO-15 · รายการเข้ารหัส';
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
    return 'IO-15 · ไม่รองรับวิธีบีบอัดของรายการนี้';
}

export async function inspectFiles(files: Input[], fromZip = false) {
  const outside: string[] = [];
  const byName = new Map<string, Input[]>();
  for (const file of files) {
    const basename = file.name.split(/[\\/]/).pop() ?? file.name;
    const name = basename.slice(0, -4).toUpperCase();
    if (!/\.txt$/i.test(basename) || !fileReferences.some((reference) => reference.name === name)) {
      outside.push(
        'problem' in file ? file.name + ' · ' + file.problem + ' · ตรวจไม่ได้' : file.name,
      );
      continue;
    }
    const group = byName.get(name) ?? [];
    group.push(file);
    byName.set(name, group);
  }

  const coverage = [];
  for (const reference of fileReferences) {
    const group = byName.get(reference.name);
    if (!group) {
      coverage.push({ name: reference.name, status: 'absent' as const });
    } else if (group.length > 1) {
      coverage.push({ name: reference.name, status: 'duplicate' as const, count: group.length });
    } else if ('problem' in group[0]) {
      const { name: fileName, problem } = group[0];
      coverage.push({ name: reference.name, status: 'unavailable' as const, fileName, problem });
    } else {
      const report = await inspectTxt(group[0], reference);
      if (fromZip && report.status === 'unreadable' && report.reason === 'read-failed') {
        coverage.push({
          name: reference.name,
          status: 'unavailable' as const,
          fileName: report.fileName,
          problem: 'IO-15 · อ่านหรือตรวจความสมบูรณ์ของข้อมูลใน ZIP ไม่สำเร็จ',
        });
      } else {
        coverage.push({ name: reference.name, status: 'submitted' as const, report });
      }
    }
  }
  return { coverage, outside, submitted: byName.size };
}
export async function inspectZip(file: File) {
  const reader = new ZipReader(new BlobReader(file), { useWebWorkers: false });
  try {
    // Keep the original names so an unsafe entry can be reported without opening it.
    const entries = await reader.getEntries({ filenameValidation: 'tolerant' });
    if (
      reader.warnings?.some(({ reason }) =>
        [
          WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
          WARNING_MISMATCHED_CENTRAL_DIRECTORY_OFFSET,
          WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
        ].includes(reason),
      )
    )
      throw new Error('Incomplete ZIP directory');
    const inputs: Input[] = [];
    for (const entry of entries) {
      const problem = zipEntryProblem(entry);
      if (problem) inputs.push({ name: entry.filename, problem });
      else if (!entry.directory)
        inputs.push({
          name: entry.filename,
          async arrayBuffer() {
            const blob = await entry.getData(new BlobWriter(), {
              checkSignature: true,
              checkLocalFilename: true,
            });
            return blob.arrayBuffer();
          },
        });
    }
    return await inspectFiles(inputs, true);
  } finally {
    await reader.close();
  }
}

export type SelectionReport = Awaited<ReturnType<typeof inspectFiles>>;
