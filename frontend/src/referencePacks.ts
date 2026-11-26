import fixture1 from './references/facility-fixture-1.txt?raw';
import fixture2 from './references/facility-fixture-2.txt?raw';
import { structureRegistry } from './structureReference';

type FacilitySnapshot = {
  source: string;
  sha256: string;
  codes: readonly string[];
};

export type ReferencePack = {
  version: string;
  label: string;
  schema: typeof structureRegistry;
  facility: FacilitySnapshot | null;
};

export const referencePacks = {
  'schema-1': {
    version: 'schema-1',
    label: 'ชุดฐาน · คู่มือ 2.4.1',
    schema: structureRegistry,
    facility: null,
  },
  'fixture-1': {
    version: 'fixture-1',
    label: 'ชุดทดสอบสังเคราะห์ 1',
    schema: structureRegistry,
    facility: {
      source: 'facility-fixture-1.txt',
      sha256: '3b2996e44453c1e3d6550347ef01aa2d759e2cda22ecbf6e08fa39510ed711a2',
      codes: fixture1.trimEnd().split('\n'),
    },
  },
  'fixture-2': {
    version: 'fixture-2',
    label: 'ชุดทดสอบสังเคราะห์ 2',
    schema: structureRegistry,
    facility: {
      source: 'facility-fixture-2.txt',
      sha256: '794813a4195e8711636d98b1ad38df82ec03d480d1077cf3f8a9bda64fddd6f9',
      codes: fixture2.trimEnd().split('\n'),
    },
  },
} satisfies Record<string, ReferencePack>;
