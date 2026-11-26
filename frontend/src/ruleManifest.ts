import type { ReferencePack } from './referencePacks';

type Evidence = { source: string; sha256: string; url?: string };

export type ManifestRule = {
  file: string;
  id: string;
  appliesTo: string;
  dependency: string;
  evidence: Evidence[];
} & ({ status: 'ready' } | { status: 'unavailable'; reason: string });

export function ruleManifest({ schema, facility }: ReferencePack): ManifestRule[] {
  const rules: ManifestRule[] = [];
  for (const file of schema.files) {
    const manual = { source: file.source, url: file.url, sha256: schema.sha256 };
    const common = { file: file.name, evidence: [manual] };
    rules.push({
      ...common,
      id: file.headerRule,
      appliesTo: 'ชื่อคอลัมน์ที่ยืนยันแล้วในหัวตารางบรรทัดแรก',
      dependency: 'หัวตาราง TXT ที่อ่านได้',
      status: 'ready',
    });
    for (const position of file.unknownPositions) {
      rules.push({
        ...common,
        id: 'SCHEMA-NAME',
        appliesTo: 'ชื่อคอลัมน์',
        dependency: 'ชื่อฟิลด์จากหลักฐานที่ยืนยันได้',
        status: 'unavailable',
        reason: `คู่มือเว้นชื่อคอลัมน์ตำแหน่งที่ ${position}`,
      });
    }
    if (file.checksRequiredHospcode9) {
      rules.push(
        {
          ...common,
          id: 'PER-REQUIRED',
          appliesTo: 'HOSPCODE9 ของแถวที่อ่านได้',
          dependency: 'ผูกคอลัมน์ HOSPCODE9 ได้เพียงตำแหน่งเดียว',
          status: 'ready',
        },
        {
          ...common,
          id: 'FACILITY-LOOKUP',
          appliesTo: facility ? 'HOSPCODE9 เทียบเฉพาะรายการสังเคราะห์' : 'HOSPCODE9',
          dependency: 'คอลัมน์ที่ผูกได้ มีค่า และมีชุดรหัสของรุ่นที่เลือก',
          evidence: facility ? [{ source: facility.source, sha256: facility.sha256 }] : [manual],
          ...(facility
            ? { status: 'ready' as const }
            : {
                status: 'unavailable' as const,
                reason: 'ขาดชุดรหัสหน่วยบริการที่ยืนยันรุ่นและขอบเขตการใช้',
              }),
        },
      );
    }
    if (file.name === 'DIAGNOSIS_OPD') {
      rules.push({
        ...common,
        id: 'COD-001',
        appliesTo: 'DIAGTYPE เฉพาะผู้ป่วยนอก',
        evidence: [
          manual,
          {
            source: 'ทะเบียน hdata 85,139 · รหัสประเภทการวินิจฉัย OPD/IPD',
            sha256: '5eaaeb57520f94294b412a00cb6e6f4fd7f55333de6a3bc7c9576ced2679bb6e',
          },
        ],
        dependency: 'ข้อยุติการใช้ชุดรหัสเฉพาะ OPD',
        status: 'unavailable',
        reason: 'แหล่งขัดกันเรื่องสถานะรหัส 2 และ 3 ระหว่างคู่มือหน้า 47 กับตารางรหัสรวม',
      });
    }
    if (file.name === 'PROVIDER') {
      rules.push({
        ...common,
        id: 'PROVIDER-COUNCIL',
        appliesTo: 'COUNCIL ตามประกาศปรับรหัสสภาวิชาชีพ',
        evidence: [
          manual,
          {
            source: 'หนังสือปรับรหัสสภาวิชาชีพ 4 พฤศจิกายน 2568 หน้า 1',
            url: 'https://hdata.moph.go.th/site/wp-content/uploads/2025/11/แจ้งปรับปรุงรหัส-Provider_041168.pdf',
            sha256: 'f3ad679a59fe69b88227af60bae394fb447d0d697825362b4da15b58aaaa3e70',
          },
        ],
        dependency: 'ชุดรหัสที่ทบทวนแล้วพร้อมช่วงเวลาที่ใช้',
        status: 'unavailable',
        reason: 'ยังไม่ทราบวันมีผลของรหัสสภาวิชาชีพที่เพิ่มในประกาศ',
      });
    }
  }
  return rules;
}
