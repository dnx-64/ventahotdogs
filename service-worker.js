const CACHE = "pos-hotdogs-v2";
const ASSETS = [
  "./",
  "./index.html",
  "./ventas.html",
  "./admin.html",
  "./css/styles.css",
  "./js/db.js",
  "./js/app.js",
  "./js/ventas.js",
  "./js/admin.js",
  "./manifest.json",
  "./assets/img/logo.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      return res;
    } catch {
      return caches.match("./index.html");
    }
  })());
});
