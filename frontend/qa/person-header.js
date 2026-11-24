// Open the local production preview with playwright-cli, then
// npx playwright-cli run-code --filename=frontend/qa/person-header.js
async function verifyPersonHeader(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const input = page.getByLabel('เลือกไฟล์ PERSON.TXT');
  let requestCount = 0;
  const countRequest = () => requestCount++;
  page.on('request', countRequest);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      for (const [fixture, expected] of [
        ['complete', 'พบชื่อคอลัมน์อ้างอิงครบ 34 ชื่อในบรรทัดแรก'],
        ['missing', 'ข้อผิดพลาดในบรรทัดแรก · ขาด 1 คอลัมน์'],
        ['empty', 'ตรวจชื่อคอลัมน์ไม่ได้ เพราะไม่มีหัวตารางในบรรทัดแรก'],
      ]) {
        await input.setInputFiles(
          fixture === 'empty'
            ? { name: 'PERSON.TXT', mimeType: 'text/plain', buffer: Buffer.alloc(0) }
            : 'frontend/qa/fixtures/' + fixture + '/PERSON.TXT',
        );
        await page.getByText(expected, { exact: true }).waitFor();
        if (fixture === 'missing') await page.getByText('HOSPCODE9', { exact: true }).waitFor();
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
}
