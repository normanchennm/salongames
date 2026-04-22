// Minimal service worker for offline-first PWA behavior.
//
// Strategy: precache the shell + all game routes + narration MP3s on
// install. Runtime: network-first for HTML (catch fresh builds fast),
// cache-first for static assets (fast + offline). This keeps the app
// functional in a cabin / on a plane after a single visit online.
//
// Cache version bumps on every deploy. Old caches get purged on
// activate so users don't get stuck on stale chunks.

const CACHE = "salongames-v1";
const SHELL = [
  "/",
  "/about/",
  "/games/werewolf/",
  "/games/mafia/",
  "/games/spyfall/",
  "/games/charades/",
  "/games/twotruths/",
  "/games/neverhaveiever/",
  "/games/trivia/",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // HTML: network-first, fall back to cache. Gets fresh builds when
  // online, still works offline.
  if (req.headers.get("Accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r ?? caches.match("/")))
    );
    return;
  }

  // Static assets: cache-first, backfill on miss. Narration MP3s,
  // icons, _next/static chunks all hit this path.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(req, clone));
        return res;
      });
    })
  );
});
