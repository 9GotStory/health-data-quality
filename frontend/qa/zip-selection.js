// From the repository root, open the local production preview with playwright-cli,
// then run: npx playwright-cli run-code --filename=frontend/qa/zip-selection.js
async function verifyZipSelection(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const input = page.getByLabel('เลือกไฟล์ TXT หรือ ZIP');
  let requests = 0;
  const countRequest = () => requests++;
  page.on('request', countRequest);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await input.setInputFiles('frontend/qa/fixtures/zip/readable.zip');
      await page.getByText(/แฟ้มหลักที่ส่ง 2 จาก 43/).waitFor();
      await page.getByText('POLICY.txt', { exact: true }).waitFor();
      await page.locator('summary', { hasText: 'PERSON · มีข้อมูล' }).click();
      await page.getByText(/บรรทัด 2.*PER-REQUIRED.*ต้องมีค่า/).waitFor();

      await input.setInputFiles('frontend/qa/fixtures/zip/partial.zip');
      await page.getByText(/แฟ้มหลักที่ส่ง 3 จาก 43/).waitFor();
      await page.getByText(/ICF · ชื่อแฟ้มซ้ำ 2 ไฟล์/).waitFor();
      await page.locator('summary', { hasText: 'PERSON · อ่านไม่ได้' }).click();
      await page.getByText(/PERSON.TXT.*IO-15.*ความสมบูรณ์/).waitFor();
      await page.locator('summary', { hasText: 'HOME · มีข้อมูล' }).click();
      await page.getByText('แถวข้อมูล 1 แถว · อ่านได้ 1 · อ่านไม่ได้ 0').waitFor();
      if (await page.getByText(/TEST-HOME|WRONG-CRC|TEST-PERSON/).count())
        throw new Error('Report contains raw data');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error('Report overflows the viewport');
    }
    if (requests) throw new Error('ZIP selection triggered a network request');
  } finally {
    page.off('request', countRequest);
  }
  return 'Verified readable and partial ZIP reports at 1280px and 390px, zero selection requests';
}
