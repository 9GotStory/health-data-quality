// Open the local production preview with playwright-cli, then
// npx playwright-cli run-code --filename=frontend/qa/person-header.js
async function verifyPersonHeader(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const input = page.getByLabel('เลือกไฟล์ TXT');
  async function verifyViewport() {
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
      throw new Error('Report overflows the viewport');
    }
  }
  let requestCount = 0;
  const countRequest = () => requestCount++;
  page.on('request', countRequest);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      for (const [fixture, expected] of [
        ['complete', 'พบชื่อคอลัมน์อ้างอิงครบ 34 ชื่อในบรรทัดแรก'],
        ['missing', 'ข้อผิดพลาดในบรรทัดแรก · ขาด 1 คอลัมน์'],
        ['empty', /IO-03\/06 · ตรวจชื่อคอลัมน์ไม่ได้ เพราะไม่มีหัวตารางในบรรทัดแรก/],
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
        await verifyViewport();
      }
      const cases = [
        {
          buffer: Buffer.from(
            '\ufeffPID|PID|HOSPCODE9\r\n001|002|\n\r\n"private|text"|0|9\n001|002| \t',
          ),
          results: [
            'แถวข้อมูล 4 แถว · อ่านได้ 2 · อ่านไม่ได้ 2',
            /IO-11.*PID.*ตรวจไม่ได้/,
            /บรรทัด 2.*PER-REQUIRED.*HOSPCODE9/,
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
        await verifyViewport();
      }
      const txt = (name, body) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(body) });
      await input.setInputFiles([
        txt('hOmE.TxT', 'HID|HOSPCODE\nSYNTHETIC-PRIVATE|00001'),
        txt('ICF.txt', 'HOSPCODE|DATE_SERV'),
        txt('SERVICE.txt', 'HOSPCODE|PID'),
        txt('PERSON.txt', 'PID'),
        txt('person.TXT', 'PID'),
        txt('POLICY.txt', 'SYNTHETIC-SUPPLEMENT'),
      ]);
      const coverage = page.getByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
      await page.getByText(/แฟ้มหลักที่ส่ง 4 จาก 43 แฟ้ม/).waitFor();
      if ((await coverage.locator(':scope > li').count()) !== 43)
        throw new Error('Incomplete coverage');
      await page.getByText(/PERSON · ชื่อแฟ้มซ้ำ 2/).waitFor();
      await page.getByText('POLICY.txt', { exact: true }).waitFor();
      async function openDetails(label) {
        const details = coverage
          .locator('details')
          .filter({ has: page.locator('summary', { hasText: label }) });
        await details.locator('summary').click();
        return details;
      }
      const home = await openDetails(/^HOME · มีข้อมูล/);
      await home.getByText(/ลำดับคอลัมน์ต่างจากทะเบียน/).waitFor();
      await home.getByText('HOSPCODE9', { exact: true }).waitFor();
      const icf = await openDetails(/^ICF · มีเฉพาะหัวตาราง/);
      await icf.getByText('DATE_SERRV', { exact: true }).waitFor();
      const service = await openDetails(/^SERVICE ·/);
      await service.getByText(/ตำแหน่งที่ 2 · คู่มือไม่ระบุชื่อคอลัมน์/).waitFor();
      if (await page.getByText(/SYNTHETIC-/).count()) throw new Error('Raw data in report');
      await verifyViewport();
    }
    if (requestCount) throw new Error('Selecting a local file triggered a network request');
  } finally {
    page.off('request', countRequest);
  }
  return 'Single- and multi-TXT reports verified at two viewport sizes, zero file-selection requests';
}
