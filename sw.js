const CACHE_NAME = "time-chain-v1";
const APP_SHELL = [
  "/",
  "/index.html",
  "/assets/styles.css",
  "/assets/config.js",
  "/assets/app.js",
  "/assets/favicon.svg",
  "/assets/icon-192.png",
  "/assets/icon-512.png",
  "/assets/og-card.svg",
  "/assets/og-card.png",
  "/site.webmanifest",
  "/45-minutes-later/",
  "/time-chain-calculator/",
  "/leave-time-calculator/"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === self.location.origin) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
  );
});
