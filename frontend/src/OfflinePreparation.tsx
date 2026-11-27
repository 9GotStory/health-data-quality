import { useEffect, useState } from 'react';

function checkPack(worker: ServiceWorker, action: 'prepare' | 'check'): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    function finish(ready: boolean) {
      clearTimeout(timer);
      channel.port1.close();
      resolve(ready);
    }
    const timer = setTimeout(() => finish(false), 30000);
    channel.port1.onmessage = (event) => finish(event.data === true);
    worker.postMessage({ action, entry: import.meta.url }, [channel.port2]);
  });
}

async function prepareOffline() {
  const registration = await navigator.serviceWorker.register(
    import.meta.env.BASE_URL + 'offline-worker.js',
  );
  const worker = registration.active ?? registration.installing ?? registration.waiting;
  if (!worker) return false;
  if (worker.state !== 'activated') {
    await new Promise<void>((resolve, reject) => {
      const changed = () => {
        if (worker.state !== 'activated' && worker.state !== 'redundant') return;
        worker.removeEventListener('statechange', changed);
        if (worker.state === 'activated') resolve();
        else reject(new Error('Offline preparation incomplete'));
      };
      worker.addEventListener('statechange', changed);
      changed();
    });
  }
  return checkPack(worker, 'prepare');
}

export function OfflinePreparation() {
  const [state, setState] = useState<'idle' | 'preparing' | 'ready' | 'unavailable'>('idle');

  useEffect(() => {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return;
    let current = true;
    void checkPack(worker, 'check').then((ready) => {
      if (current)
        setState((previous) =>
          previous === 'idle' ? (ready ? 'ready' : 'unavailable') : previous,
        );
    });
    return () => {
      current = false;
    };
  }, []);

  async function prepare() {
    setState('preparing');
    try {
      setState((await prepareOffline()) ? 'ready' : 'unavailable');
    } catch {
      setState('unavailable');
    }
  }

  return (
    <div className="mb-4 text-sm">
      {state !== 'ready' && (
        <button
          type="button"
          className="rounded border px-3 py-2 font-semibold"
          onClick={prepare}
          disabled={state === 'preparing'}
        >
          เตรียมใช้งานออฟไลน์
        </button>
      )}
      <p role="status" className="mt-1 text-slate-700">
        {state === 'idle' && 'เตรียมครั้งเดียวขณะออนไลน์เพื่อเปิดแอปและใช้ชุดอ้างอิงทั้งสามชุดเมื่อไม่มีเครือข่าย'}
        {state === 'preparing' && 'กำลังเตรียมแอปและชุดอ้างอิง…'}
        {state === 'ready' && 'แอปและชุดอ้างอิงพร้อมใช้งานออฟไลน์'}
        {state === 'unavailable' && 'ยังเตรียมแอปและชุดอ้างอิงสำหรับเปิดออฟไลน์ไม่ครบ กรุณาเชื่อมต่อแล้วลองอีกครั้ง'}
      </p>
    </div>
  );
}
