const CACHE_PURGE_VERSION = "qrstack-platform-network-first-20260709";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// The dashboard must always show fresh data and fresh code. Keeping no fetch
// handler lets the browser use the network normally after old caches are purged.
