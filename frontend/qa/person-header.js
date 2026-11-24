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
      const cases = [
        {
          buffer: Buffer.from(
            '\ufeffPID|PID|HOSPCODE9\r\n001|002|\n\r\n"private|text"|0|9\n001|002| \t',
          ),
          results: [
            'แถวข้อมูล 4 แถว · อ่านได้ 2 · อ่านไม่ได้ 2',
            /IO-11.*PID.*ตรวจไม่ได้/,
            /บรรทัด 2.*PER-NN.*HOSPCODE9/,
            /บรรทัด 3.*บรรทัดว่าง.*ตรวจไม่ได้/,
            /บรรทัด 4.*4 ช่อง.*3 ช่อง/,
            /บรรทัด 5.*IO-09.*HOSPCODE9/,
          ],
        },
        { buffer: Buffer.from('PID\n0\r99'), results: [/IO-04.*CR เดี่ยว.*ทั้งแฟ้ม/] },
        {
          buffer: Buffer.concat([Buffer.from('PID\n001\n'), Buffer.from([0xff])]),
          results: [/IO-02.*UTF-8.*ทั้งแฟ้ม/],
        },
      ];
      for (const { buffer, results } of cases) {
        await input.setInputFiles({ name: 'PERSON.TXT', mimeType: 'text/plain', buffer });
        for (const expected of results) await page.getByText(expected, { exact: true }).waitFor();
        if (await page.getByText(/private|001/).count()) throw new Error('Raw data in report');
        if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
          throw new Error('TXT report overflows the viewport');
        }
      }
    }
    if (requestCount) throw new Error('Selecting a local file triggered a network request');
  } finally {
    page.off('request', countRequest);
  }
  return 'Six PERSON reports verified at two viewport sizes, zero file-selection requests';
}
