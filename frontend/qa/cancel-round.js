// Open the local production preview, then use playwright-cli run-code --filename=frontend/qa/cancel-round.js
async function verifyCancelledRound(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const input = page.getByLabel('เลือกไฟล์ TXT หรือ ZIP');
  const pack = page.getByLabel('ชุดอ้างอิงสำหรับรอบถัดไป');
  const csvButton = page.getByRole('button', { name: 'ดาวน์โหลด CSV' });
  const markers = ['CANCELLED-SYNTHETIC-ROW', 'cancel-round.zip', 'SYNTHETIC-NEW-HOME'];
  let requests = 0;
  const block = (route) => {
    requests++;
    return route.abort();
  };
  await page.route('**/*', block);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await pack.selectOption('fixture-1');
      for (let attempt = 0; attempt < 2; attempt++) {
        await input.setInputFiles('frontend/qa/fixtures/zip/cancel-round.zip');
        await page.getByRole('button', { name: 'ยกเลิกรอบตรวจ' }).click();
        await page.getByText(/ยกเลิกรอบตรวจแล้ว.*ตรวจไม่ครบ/).waitFor();
        if (await csvButton.count()) throw new Error('Cancelled report is exportable');
      }

      await pack.selectOption('fixture-2');
      await input.setInputFiles({
        name: 'HOME.TXT',
        mimeType: 'text/plain',
        buffer: Buffer.from('HID\nSYNTHETIC-NEW-HOME'),
      });
      await page.getByText(/ชุดที่ใช้ตรวจ.*fixture-2/).waitFor();
      await page.getByText('PERSON · ไม่ได้ส่ง', { exact: true }).waitFor();
      await page.getByText('แถวข้อมูล 1 แถว · อ่านได้ 1 · อ่านไม่ได้ 0').waitFor();
      const download = page.waitForEvent('download');
      await csvButton.click();
      const stream = await (await download).createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      const csv = Buffer.concat(chunks).toString('utf8');
      if (
        !csv.includes('"file_status","HOME.TXT"') ||
        !csv.includes('"fixture-2"') ||
        csv.includes('"fixture-1"') ||
        csv.includes('"PERSON.TXT"') ||
        markers.some((marker) => csv.includes(marker))
      )
        throw new Error('Unexpected CSV for the new round');

      const storage = JSON.stringify(await page.context().storageState({ indexedDB: true }));
      if (markers.some((marker) => storage.includes(marker)))
        throw new Error('Input persisted in origin storage');
      await page.evaluate(async (markers) => {
        function check(text) {
          if (markers.some((marker) => text.includes(marker)))
            throw new Error('Input retained after cancellation');
        }
        check(document.querySelector('main').innerText);
        check(JSON.stringify({ ...sessionStorage }));
        for (const name of await caches.keys()) {
          check(name);
          const cache = await caches.open(name);
          for (const request of await cache.keys()) {
            check(request.url);
            check(await (await cache.match(request)).text());
          }
        }
      }, markers);
    }
    if (requests) throw new Error('Inspection triggered a request');
    return 'PASS · cancel and reselect ZIP · new TXT report and CSV · 2 viewports · zero requests · no input markers in storage';
  } finally {
    await page.unroute('**/*', block);
  }
}
