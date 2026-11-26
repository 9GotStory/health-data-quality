// Open the local production preview, then run with Playwright CLI run-code --filename.
async function verifyReferenceRun(page) {
  await page.reload({ waitUntil: 'networkidle' });
  const pack = page.getByLabel('ชุดอ้างอิงสำหรับรอบถัดไป');
  const input = page.getByLabel('เลือกไฟล์ TXT หรือ ZIP');
  const file = {
    name: 'PERSON.TXT',
    mimeType: 'text/plain',
    buffer: Buffer.from('PID|HOSPCODE9\nprivate-fixture-id|TEST-A'),
  };
  let requests = 0;
  const blockRequest = (route) => {
    requests++;
    return route.abort();
  };
  await page.route('**/*', blockRequest);
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 850 });
      let previousVersion;
      for (const [version, expected] of [
        ['fixture-1', /บรรทัด 2.*· พบในชุดรหัสสังเคราะห์/],
        ['fixture-2', /บรรทัด 2.*ไม่พบในชุดรหัสสังเคราะห์/],
        ['schema-1', /บรรทัด 2.*ตรวจไม่ได้.*ขาดชุดรหัส/],
      ]) {
        await pack.selectOption(version);
        if (previousVersion) {
          await page.getByText(new RegExp('ชุดที่ใช้ตรวจ.*' + previousVersion)).waitFor();
        }
        await input.setInputFiles(file);
        await page.getByText(new RegExp('ชุดที่ใช้ตรวจ.*' + version)).waitFor();
        await page.getByText(expected).waitFor();
        previousVersion = version;
      }
      await page.getByText('บัญชีกฎและหลักฐานรายแฟ้ม', { exact: true }).click();
      const manifest = page.getByLabel('แฟ้มในบัญชีกฎ');
      await manifest.selectOption('PROVIDER');
      await page.getByText(/ยังไม่ทราบวันมีผล/).waitFor();
      await manifest.selectOption('DIAGNOSIS_OPD');
      await page.getByText(/แหล่งขัดกัน/).waitFor();
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) {
        throw new Error('Report overflows the viewport');
      }
      if (await page.getByText(/private-fixture-id/).count()) throw new Error('Record value shown');
    }
    const storage = await page.evaluate(async () => [
      localStorage.length,
      sessionStorage.length,
      (await indexedDB.databases()).length,
      (await caches.keys()).length,
    ]);
    if (requests || storage.some(Boolean))
      throw new Error('Unexpected requests or persistent data');
    return 'PASS · 3 versions · 2 viewports · no requests or stored data';
  } finally {
    await page.unroute('**/*', blockRequest);
  }
}
