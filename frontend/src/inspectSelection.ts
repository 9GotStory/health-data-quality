import { inspectTxt } from './inspectTxt';
import { fileReferences } from './structureReference';

export async function inspectSelection(files: File[]) {
  const outside: string[] = [];
  const byName = new Map<string, File[]>();
  for (const file of files) {
    const basename = file.name.split(/[\\/]/).pop() ?? file.name;
    const name = basename.slice(0, -4).toUpperCase();
    if (!fileReferences.some((reference) => reference.name === name)) {
      outside.push(basename);
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
    } else {
      const report = await inspectTxt(group[0], reference);
      coverage.push({ name: reference.name, status: 'submitted' as const, report });
    }
  }
  return { coverage, outside, submitted: byName.size };
}
export type SelectionReport = Awaited<ReturnType<typeof inspectSelection>>;
