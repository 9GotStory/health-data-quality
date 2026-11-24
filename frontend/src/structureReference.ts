import registry from './structureRegistry.json';

export const structureRegistry = registry;

export const fileReferences = registry.files.map(({ name, firstPage, lastPage, positions }) => ({
  name,
  version: name === 'PERSON' ? 'PERSON-header-1' : registry.version,
  source: `คู่มือโครงสร้างข้อมูล 43 แฟ้ม รุ่น 2.4.1 หน้า PDF ${firstPage}–${lastPage}`,
  url: `${registry.sourceUrl}#page=${firstPage}`,
  columns: positions.filter((column): column is string => column !== null),
  unknownPositions: positions.flatMap((column, index) => (column === null ? [index + 1] : [])),
}));

export type FileReference = (typeof fileReferences)[number];
