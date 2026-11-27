// Open the local production preview with Playwright CLI and run this file with run-code.
async function verifyOfflineReport(page) {
  const url = page.url();
  const context = await page.context().browser().newContext();
  const requests = [];
  const logs = [];
  context.on('request', (request) => requests.push(request));
  context.on('console', (message) => logs.push(message.text()));
  context.on('weberror', (error) => logs.push(error.error().message));
  const markers = [
    'PRIVATE-OFFLINE-ROW-903',
    'private-offline-903.txt',
    'CANCELLED-SYNTHETIC-ROW',
    'cancel-round.zip',
    'TEST-PERSON',
    'export.zip/hOmE.tXt',
  ];
  const file = {
    name: 'PERSON.TXT',
    mimeType: 'text/plain',
    buffer: Buffer.from('PID|HOSPCODE9\n' + markers[0] + '|TEST-A'),
  };
  const input = (tab) => tab.getByLabel('เลือกไฟล์ TXT หรือ ZIP');
  const pack = (tab) => tab.getByLabel('ชุดอ้างอิงสำหรับรอบถัดไป');
  const prepare = (tab) => tab.getByRole('button', { name: 'เตรียมใช้งานออฟไลน์' }).click();
  const ready = (tab) => tab.getByText('แอปและชุดอ้างอิงพร้อมใช้งานออฟไลน์').waitFor();

  function assertPrivate(text) {
    if (markers.some((marker) => text.includes(marker)))
      throw new Error('Found private fixture data');
  }

  async function verifyStorage(tab, allowed) {
    const state = await context.storageState({ indexedDB: true });
    if (
      state.cookies.length ||
      state.origins.some((origin) => origin.localStorage.length || origin.indexedDB?.length)
    )
      throw new Error('Unexpected persistent origin data');
    const entries = await tab.evaluate(async () => {
      if (sessionStorage.length) throw new Error('Unexpected session data');
      const values = [];
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const key of await cache.keys()) {
          const response = await cache.match(key);
          values.push({
            url: key.url,
            name,
            headers: [...key.headers, ...response.headers],
            body: await response.text(),
          });
        }
      }
      return values;
    });
    if (entries.length !== allowed.length || entries.some((entry) => !allowed.includes(entry.url)))
      throw new Error('Cache contains something other than the prepared static app');
    assertPrivate(JSON.stringify(entries));
  }

  async function downloadCsv(tab) {
    const download = tab.waitForEvent('download');
    await tab.getByRole('button', { name: 'ดาวน์โหลด CSV' }).click();
    const stream = await (await download).createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const contents = Buffer.concat(chunks).toString('utf8');
    assertPrivate(contents);
    return contents;
  }

  try {
    const first = await context.newPage();
    await first.goto(url, { waitUntil: 'networkidle' });
    const assets = await first.evaluate(() => [
      new URL('index.html', document.baseURI).href,
      document.querySelector('script[type=module]').src,
      document.querySelector('link[rel=stylesheet]').href,
    ]);
    let start = requests.length;
    await input(first).setInputFiles([file, { ...file, name: markers[1] }]);
    await first.getByText(/ชุดที่ใช้ตรวจ.*schema-1/).waitFor();
    if (requests.length !== start) throw new Error('Online inspection made a request');

    // Prepare while a report exists, so any accidental upload or persistence is observable.
    await prepare(first);
    await ready(first);
    const allowed = [...assets, new URL('offline-worker.js', url).href];
    for (const request of requests.slice(start)) {
      if (
        !allowed.includes(request.url()) ||
        request.method() !== 'GET' ||
        request.postData() !== null
      )
        throw new Error('Unexpected preparation request');
      assertPrivate(JSON.stringify(await request.allHeaders()));
    }
    await verifyStorage(first, assets);
    await first.close();
    await context.setOffline(true);

    const offline = await context.newPage();
    const cdp = await context.newCDPSession(offline);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const navigation = await offline.goto(url, { waitUntil: 'networkidle' });
    if (!navigation.fromServiceWorker())
      throw new Error('Offline navigation bypassed the prepared app');
    await ready(offline);
    if (await offline.getByLabel('กรองผลตรวจ').count())
      throw new Error('Restored a previous report');

    start = requests.length;
    const logStart = logs.length;
    await pack(offline).selectOption('fixture-1');
    await input(offline).setInputFiles('frontend/qa/fixtures/zip/readable.zip');
    await offline.getByText(/แฟ้มหลักที่ส่ง 2 จาก 43/).waitFor();
    const zipCsv = await downloadCsv(offline);
    if (
      !zipCsv.includes('"error","PERSON.TXT","2","HOSPCODE9","PER-REQUIRED"') ||
      !zipCsv.includes('"fixture-1"')
    )
      throw new Error('Missing ZIP finding or reference version in offline CSV');
    await verifyStorage(offline, assets);
    await input(offline).setInputFiles('frontend/qa/fixtures/zip/cancel-round.zip');
    await offline.getByRole('button', { name: 'ยกเลิกรอบตรวจ' }).click();
    await offline.getByText(/ยกเลิกรอบตรวจแล้ว.*ตรวจไม่ครบ/).waitFor();
    if (await offline.getByRole('button', { name: 'ดาวน์โหลด CSV' }).count())
      throw new Error('Exportable cancelled round');
    await verifyStorage(offline, assets);
    await pack(offline).selectOption('schema-1');
    await input(offline).setInputFiles(file);
    await offline.getByText(/บรรทัด 2.*ตรวจไม่ได้.*ขาดชุดรหัส/).waitFor();
    await offline.getByText('HOME · ไม่ได้ส่ง', { exact: true }).waitFor();
    const txtCsv = await downloadCsv(offline);
    if (
      !txtCsv.includes('"cannot_check","PERSON.TXT","2","HOSPCODE9","FACILITY-LOOKUP"') ||
      txtCsv.includes('"fixture-1"')
    )
      throw new Error('Unexpected TXT report after cancellation');
    await verifyStorage(offline, assets);
    if (requests.length !== start || logs.length !== logStart)
      throw new Error('Offline processing generated a request or log');
    assertPrivate(JSON.stringify(logs));

    // Evict the bundle containing the reference packs, leaving the installed worker and HTML intact.
    await offline.evaluate(async () => {
      const entry = document.querySelector('script[type=module]').src;
      for (const name of await caches.keys()) await (await caches.open(name)).delete(entry);
    });
    await offline.reload();
    await offline.getByText(/ชุดอ้างอิงสำหรับเปิดออฟไลน์ไม่ครบ/).waitFor();
    if (await input(offline).count()) throw new Error('Incomplete app offered inspection');
    await context.setOffline(false);
    await offline.reload();
    await prepare(offline);
    await ready(offline);
    await context.setOffline(true);
    await offline.reload();
    await ready(offline);
    return 'PASS · online preparation with report open · offline reopen, ZIP and TXT CSVs, cancel/new run · zero inspection requests or logs · only static app cached · missing bundle and repair';
  } finally {
    await context.close();
  }
}
