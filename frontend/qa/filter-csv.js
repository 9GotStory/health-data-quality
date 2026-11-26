// Open the local production preview, then use playwright-cli run-code --filename=frontend/qa/filter-csv.js
async function verifyFilteredCsv(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const txt = (name, contents) => ({ name, mimeType: 'text/plain', buffer: Buffer.from(contents) });
  const privateName = 'PRIVATE-SYNTHETIC-NAME';
  const cid = '1234567890123';
  const outside = '=fixture,"quoted"\n' + privateName + '-' + cid + '.txt';
  let requests = 0;
  const block = (route) => {
    requests++;
    return route.abort();
  };
  await page.route('**/*', block);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page.getByLabel('ชุดอ้างอิงสำหรับรอบถัดไป').selectOption('fixture-1');
      await page
        .getByLabel('เลือกไฟล์ TXT หรือ ZIP')
        .setInputFiles([
          txt('PERSON.TXT', 'PID|HOSPCODE9\n' + privateName + '|\n' + cid + '| '),
          txt(outside, privateName),
        ]);
      await page.getByLabel('กรองผลตรวจ').selectOption('error');
      await page.getByText(/บรรทัด 2.*PER-REQUIRED.*HOSPCODE9/).waitFor();
      const coverage = page.getByRole('list', { name: 'สถานะการส่ง 43 แฟ้มหลัก' });
      if ((await coverage.locator(':scope > li').count()) !== 43)
        throw new Error('Incomplete coverage');
      const text = await page.locator('main').innerText();
      if ([privateName, cid, 'IO-09'].some((marker) => text.includes(marker)))
        throw new Error('Unexpected detail in filtered UI');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
        throw new Error('Report overflows viewport');
      await page.getByLabel('แสดงชื่อไฟล์และเส้นทางต้นฉบับบนหน้าจอ').check();
      await page.getByText(outside, { exact: true }).waitFor();
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'ดาวน์โหลด CSV' }).click();
      const download = await pending;
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const csv = Buffer.concat(chunks).toString('utf8');
      const expected = [
        '\ufeff"result","file","line","field","rule","reason","source","version","file_status","rows_total","rows_readable","rows_unreadable"\r\n',
        '"error","PERSON.TXT","2","HOSPCODE9","PER-REQUIRED"',
        '"file_status","รายการนอกขอบเขต 1","","","","นอกขอบเขต"',
        '"file_status","HOME","",""',
        '"fixture-1"',
      ];
      if (!expected.every((part) => csv.includes(part)))
        throw new Error('Downloaded CSV lost location, coverage or quoting');
      if ([privateName, cid, '"review"', '"cannot_check"'].some((part) => csv.includes(part)))
        throw new Error('Unexpected detail in downloaded CSV');
      if ((csv.match(/^"file_status",/gm) || []).length !== 44)
        throw new Error('Incomplete CSV coverage');
    }
    if (requests) throw new Error('Report triggered network requests');
    return 'PASS · two viewport sizes · filtered UI and downloaded CSV · 43 core statuses and 1 outside file · zero requests';
  } finally {
    await page.unroute('**/*', block);
  }
}
