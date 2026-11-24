// Open the local production preview with playwright-cli, then
// npx playwright-cli run-code --filename=frontend/qa/person-header.js
async (page) => {
  const header =
    'HOSPCODE|CID|PID|HID|PRENAME|NAME|LNAME|HN|SEX|BIRTH|MSTATUS|OCCUPATION_OLD|OCCUPATION_NEW|RACE|NATION|RELIGION|EDUCATION|FSTATUS|FATHER|MOTHER|COUPLE|VSTATUS|MOVEIN|DISCHARGE|DDISCHARGE|ABOGROUP|RHGROUP|LABOR|PASSPORT|TYPEAREA|D_UPDATE|TELEPHONE|MOBILE|HOSPCODE9';
  await page.reload({ waitUntil: 'networkidle' });
  const input = page.getByLabel('เลือกไฟล์ PERSON.TXT');
  let requestCount = 0;
  const countRequest = () => requestCount++;
  page.on('request', countRequest);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      for (const [contents, expected] of [
        [header, 'พบชื่อคอลัมน์อ้างอิงครบ 34 ชื่อในบรรทัดแรก'],
        [header.replace('|HOSPCODE9', ''), 'ข้อผิดพลาดในบรรทัดแรก · ขาด 1 คอลัมน์'],
        ['', 'ตรวจชื่อคอลัมน์ไม่ได้ เพราะไม่มีหัวตารางในบรรทัดแรก'],
      ]) {
        await input.setInputFiles({
          name: 'PERSON.TXT',
          mimeType: 'text/plain',
          buffer: Buffer.from(contents),
        });
        await page.getByText(expected, { exact: true }).waitFor();
        if (contents && contents !== header)
          await page.getByText('HOSPCODE9', { exact: true }).waitFor();
        await page.getByText('PERSON-header-1', { exact: true }).waitFor();
        await page.getByText(/ยังไม่พร้อมตรวจความหมาย/).waitFor();
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
          throw new Error('Report overflows the viewport');
        }
      }
    }
    if (requestCount) throw new Error('Selecting a local file triggered a network request');
  } finally {
    page.off('request', countRequest);
  }
  return 'Three PERSON reports verified at two viewport sizes, zero file-selection requests';
};
