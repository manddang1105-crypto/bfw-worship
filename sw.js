const CACHE = 'bfw-worship-v8';
const ASSETS = [
  '/bfw-worship/',
  '/bfw-worship/index.html',
  '/bfw-worship/icon.svg',
  '/bfw-worship/icon-192.png',
  '/bfw-worship/icon-512.png',
  '/bfw-worship/og-image.png',
  '/bfw-worship/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
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
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
