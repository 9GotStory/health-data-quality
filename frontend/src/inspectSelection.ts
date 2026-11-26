import {
  BlobReader,
  BlobWriter,
  ZipReader,
  type Entry,
  WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
  WARNING_MISMATCHED_CENTRAL_DIRECTORY_OFFSET,
  WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
} from '@zip.js/zip.js/index-native.js';
import { referencePacks, type ReferencePack } from './referencePacks';
import { inspectTxt } from './inspectTxt';
import { ruleManifest } from './ruleManifest';

type EntryDetail = { name: string; problem?: string };
type TxtInput = Pick<File, 'name' | 'arrayBuffer'> & { verifyIntegrity?: () => Promise<void> };

type Input = TxtInput | { name: string; problem: string };

export class SelectionError extends Error {}
const invalidDirectory = 'IO-15 · อ่านรายการใน ZIP ไม่ครบ จึงหยุดรอบตรวจ โปรดเลือก ZIP อีกครั้ง';
const invalidEntry = 'IO-15 · อ่านหรือตรวจความสมบูรณ์ของข้อมูลใน ZIP ไม่สำเร็จ';

// For duplicates and supplements, verify the transport without decoding or retaining TXT rows.
async function inspectEntryOnly(file: Input): Promise<EntryDetail> {
  if ('problem' in file) return file;
  try {
    await file.verifyIntegrity?.();
    return { name: file.name };
  } catch {
    return { name: file.name, problem: invalidEntry };
  }
}

function zipEntryProblem(entry: Entry) {
  const path = entry.filename.replaceAll('\\', '/').replace(/\/$/, '');
  if (
    /^[a-z]:/i.test(path) ||
    path.includes('\0') ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  )
    return 'IO-14 · เส้นทางไม่ปลอดภัย';
  if (entry.symlink) return 'IO-14 · ไม่ตาม symlink';
  if (!entry.directory && /\.zip$/i.test(path)) return 'IO-14 · ไม่เปิด ZIP ซ้อน';
  if (entry.encrypted) return 'IO-15 · รายการเข้ารหัส';
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8)
    return 'IO-15 · ไม่รองรับวิธีบีบอัดของรายการนี้';
}

async function inspectFiles(files: Input[], pack: ReferencePack) {
  const fileReferences = pack.schema.files;
  const outside: EntryDetail[] = [];
  const byName = new Map<string, Input[]>();
  for (const file of files) {
    const basename = file.name.split(/[\\/]/).pop() ?? file.name;
    const name = basename.slice(0, -4).toUpperCase();
    if (!/\.txt$/i.test(basename) || !fileReferences.some((reference) => reference.name === name)) {
      outside.push(await inspectEntryOnly(file));
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
      const members = [];
      for (const member of group) members.push(await inspectEntryOnly(member));
      coverage.push({ name: reference.name, status: 'duplicate' as const, members });
    } else if ('problem' in group[0]) {
      const { name: fileName, problem } = group[0];
      coverage.push({ name: reference.name, status: 'unavailable' as const, fileName, problem });
    } else {
      const report = await inspectTxt(group[0], reference, pack.facility);
      if (
        group[0].verifyIntegrity &&
        report.status === 'unreadable' &&
        report.reason === 'read-failed'
      ) {
        coverage.push({
          name: reference.name,
          status: 'unavailable' as const,
          fileName: report.fileName,
          problem: invalidEntry,
        });
      } else {
        coverage.push({ name: reference.name, status: 'submitted' as const, report });
      }
    }
  }
  return { pack, manifest: ruleManifest(pack), coverage, outside, submitted: byName.size };
}

async function inspectZip(file: File, pack: ReferencePack) {
  const reader = new ZipReader(new BlobReader(file), {
    useWebWorkers: false,
    checkSignature: true,
    checkLocalFilename: true,
  });
  try {
    // Keep the original names so an unsafe entry can be reported without opening it.
    const entries = await reader.getEntries({ filenameValidation: 'tolerant' }).catch(() => {
      throw new SelectionError(invalidDirectory);
    });
    if (
      reader.warnings?.some(({ reason }) =>
        [
          WARNING_TRAILING_CENTRAL_DIRECTORY_DATA,
          WARNING_MISMATCHED_CENTRAL_DIRECTORY_OFFSET,
          WARNING_MISMATCHED_ZIP64_END_OF_CENTRAL_DIRECTORY,
        ].includes(reason),
      )
    )
      throw new SelectionError(invalidDirectory);
    const inputs: Input[] = [];
    for (const entry of entries) {
      const problem = zipEntryProblem(entry);
      if (problem) inputs.push({ name: entry.filename, problem });
      else if (!entry.directory)
        inputs.push({
          name: entry.filename,
          async arrayBuffer() {
            const blob = await entry.getData(new BlobWriter());
            return blob.arrayBuffer();
          },
          async verifyIntegrity() {
            await entry.getData(new WritableStream<Uint8Array>());
          },
        });
    }
    return await inspectFiles(inputs, pack);
  } finally {
    await reader.close();
  }
}

export function inspectSelection(files: File[], pack: ReferencePack = referencePacks['schema-1']) {
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) return inspectZip(files[0], pack);
  if (files.some((file) => !/\.txt$/i.test(file.name)))
    throw new SelectionError('IO-01 · โปรดเลือก ZIP หนึ่งไฟล์ หรือ TXT จากชุดส่งออกเดียวกัน');
  return inspectFiles(files, pack);
}

export type SelectionReport = Awaited<ReturnType<typeof inspectFiles>>;
