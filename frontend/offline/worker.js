// The production build supplies assets (path and integrity) and revision above.
const scope = self.registration.scope;
const prefix = 'hdq-offline:' + scope + ':';
const cacheName = prefix + revision;
const indexUrl = new URL('index.html', scope).href;
const requests = assets.map(
  ([path, integrity]) =>
    new Request(new URL(path, scope), {
      integrity,
      cache: 'reload',
      credentials: 'omit',
      redirect: 'error',
    }),
);
const urls = new Set(requests.map((request) => request.url));

async function hasAllAssets() {
  const cache = await caches.open(cacheName);
  const cached = new Set((await cache.keys()).map((request) => request.url));
  return requests.every((request) => cached.has(request.url));
}

async function prepare() {
  const cache = await caches.open(cacheName);
  await cache.addAll(requests);
}

self.addEventListener('install', (event) => event.waitUntil(prepare()));
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith(prefix) && name !== cacheName) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const { action, entry } = event.data ?? {};
  if (!event.ports[0] || (action !== 'check' && action !== 'prepare')) return;
  event.waitUntil(
    (async () => {
      let ready = false;
      try {
        if (urls.has(entry)) {
          ready = await hasAllAssets();
          if (!ready && action === 'prepare') {
            await prepare();
            ready = true;
          }
        }
      } catch {
        ready = false;
      }
      event.ports[0].postMessage(ready);
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const navigation = request.mode === 'navigate' && [scope, indexUrl].includes(request.url);
  if (!navigation && !urls.has(request.url)) return;
  event.respondWith(
    (async () => {
      if (navigation && !(await hasAllAssets())) {
        try {
          return await fetch(request);
        } catch {
          return new Response(
            'แอปและชุดอ้างอิงสำหรับเปิดออฟไลน์ไม่ครบ กรุณาเชื่อมต่อ เปิดหน้าแอปใหม่ แล้วกดเตรียมใช้งานออฟไลน์',
            {
              headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
            },
          );
        }
      }
      const stored = await caches.match(navigation ? indexUrl : request.url, { cacheName });
      return stored ?? fetch(request);
    })(),
  );
});
