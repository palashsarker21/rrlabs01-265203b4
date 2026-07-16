/**
 * RRLabs production service worker.
 *
 * Scope: enable PWA installability (fetch handler required by browsers) and
 * safely cache immutable static assets. Intentionally minimal — does not
 * cache HTML, API responses, or Supabase requests.
 *
 * Kill switch: navigate to any page with `?sw=off` — the registration wrapper
 * unregisters this worker and clears its caches.
 */
const VERSION = "rrlabs-sw-v1";
const STATIC_CACHE = `${VERSION}-static`;
const ASSET_ORIGINS_ALLOWED = ["/__l5e/assets-v1/", "/assets/"];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("rrlabs-sw-") && !n.startsWith(VERSION))
          .map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isCacheableAsset(url) {
  if (url.origin !== self.location.origin) return false;
  return ASSET_ORIGINS_ALLOWED.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // NetworkFirst for HTML navigations — never serve stale app shell.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((r) => r || Response.error())),
    );
    return;
  }

  // CacheFirst for immutable hashed assets only.
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(req, res.clone());
        return res;
      }),
    );
  }
});
