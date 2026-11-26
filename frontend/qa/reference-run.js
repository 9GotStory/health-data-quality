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
  async function readStorage() {
    const originState = await page.context().storageState({ indexedDB: true });
    const browserStorage = await page.evaluate(async () => {
      const cachedRequests = [];
      const cacheNames = (await caches.keys()).sort();
      for (const name of cacheNames) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          cachedRequests.push([name, request.url]);
          const response = await cache.match(request);
          if ((await response.text()).includes('private-fixture-id'))
            throw new Error('Patient identifier in cached response');
        }
      }
      return { session: { ...sessionStorage }, cacheNames, cachedRequests };
    });
    return JSON.stringify({ originState, browserStorage });
  }
  const before = await readStorage();
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
    const after = await readStorage();
    if (requests || before !== after || after.includes('private-fixture-id')) {
      throw new Error('File selection made a request or changed browser storage');
    }
    return 'PASS · 3 versions · 2 viewports · no requests or storage changes during inspection';
  } finally {
    await page.unroute('**/*', blockRequest);
  }
}
