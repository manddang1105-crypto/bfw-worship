const CACHE = 'bfw-worship-v14';
const STATIC_ASSETS = [
  '/bfw-worship/icon.svg',
  '/bfw-worship/icon-192.png',
  '/bfw-worship/icon-512.png',
  '/bfw-worship/og-image.png',
  '/bfw-worship/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // index.html / 루트 경로: 항상 네트워크 우선 → 배포 즉시 반영
  const isHtml = url.pathname === '/bfw-worship/' ||
                 url.pathname === '/bfw-worship/index.html';
  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          // 성공 시 캐시 갱신
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request)) // 오프라인 시 캐시 fallback
    );
    return;
  }

  // 나머지 정적 파일: 캐시 우선 (아이콘, manifest 등)
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
