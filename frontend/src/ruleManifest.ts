import type { ReferencePack } from './referencePacks';

type Evidence = {
  source: string;
  sha256: string;
  url?: string;
  retrievedOn?: string;
  publication?: string;
  applicabilityDate?: string;
};

export type ManifestRule = {
  file: string;
  id: string;
  field?: string;
  appliesTo: string;
  dependency: string;
  evidence: Evidence[];
} & ({ status: 'ready' } | { status: 'unavailable'; reason: string });

export function ruleManifest({ schema, facility }: ReferencePack): ManifestRule[] {
  const rules: ManifestRule[] = [];
  for (const file of schema.files) {
    const manual = {
      source: file.source,
      url: file.url,
      sha256: schema.sha256,
      retrievedOn: '2026-11-22',
    };
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
        reason: `ตำแหน่งที่ ${position} · คู่มือไม่ระบุชื่อคอลัมน์ กฎที่ต้องใช้ชื่อนี้จึงตรวจไม่ได้`,
      });
    }
    if (file.checksRequiredHospcode9) {
      rules.push({
        ...common,
        id: 'PER-REQUIRED',
        appliesTo: 'HOSPCODE9 ของแถวที่อ่านได้',
        dependency: 'ผูกคอลัมน์ HOSPCODE9 ได้เพียงตำแหน่งเดียว',
        status: 'ready',
      });
    }
    if (file.facilityLookupField) {
      rules.push({
        ...common,
        id: 'FACILITY-LOOKUP',
        field: file.facilityLookupField,
        appliesTo: facility ? 'HOSPCODE9 เทียบเฉพาะรายการสังเคราะห์' : 'HOSPCODE9',
        dependency: 'คอลัมน์ที่ผูกได้ มีค่า และมีชุดรหัสของรุ่นที่เลือก',
        evidence: facility ? [{ source: facility.source, sha256: facility.sha256 }] : [manual],
        ...(facility
          ? { status: 'ready' as const }
          : {
              status: 'unavailable' as const,
              reason: 'ขาดชุดรหัสหน่วยบริการที่ยืนยันรุ่นและขอบเขตการใช้',
            }),
      });
    }
    if (file.name === 'ICF') {
      rules.push({
        ...common,
        id: 'ICF-ALIAS',
        field: 'DATE_SERRV',
        appliesTo: 'การผูกคอลัมน์วันที่รับบริการด้วยชื่ออื่น',
        dependency: 'ตารางหรือประกาศทางการที่ยืนยันชื่ออื่นสำหรับคู่มือฉบับนี้',
        status: 'unavailable',
        reason: 'คู่มือใช้ DATE_SERRV และยังไม่มีหลักฐานยืนยันชื่ออื่นที่ใช้แทนได้',
      });
    }
    if (file.name === 'DIAGNOSIS_OPD') {
      rules.push({
        ...common,
        id: 'COD-001',
        field: 'DIAGTYPE',
        appliesTo: 'DIAGTYPE เฉพาะผู้ป่วยนอก',
        evidence: [
          {
            ...manual,
            applicabilityDate: 'คู่มือหน้า 47 ระบุยกเลิกรหัส 2 และ 3 เมื่อ 28 เมษายน 2568 เฉพาะ OPD',
          },
          {
            retrievedOn: '2026-11-23',
            source: 'ทะเบียน hdata 85,139 · รหัสประเภทการวินิจฉัย OPD/IPD · Sheet1!A4:B5',
            url: 'https://drive.google.com/file/d/1o7QU9sNAacfRPpKsG0S1zgVhLOLLdsTk/view',
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
        field: 'COUNCIL',
        appliesTo: 'COUNCIL ตามประกาศปรับรหัสสภาวิชาชีพ',
        evidence: [
          manual,
          {
            source: 'หนังสือปรับรหัสสภาวิชาชีพ หน้า 1',
            publication: '4 พฤศจิกายน 2568',
            retrievedOn: '2026-11-22',
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
