/* global self, caches, fetch, Response, URL, setTimeout */
// The game's service worker, so it still starts with a weak or no signal once
// it has been opened. scripts/pwa.ts puts VERSION and PRECACHE in front of
// this at build time.
/* global VERSION, PRECACHE */
const CACHE = `squad ${VERSION}`;
const NETWORK_WAIT_MS = 3000;

// Fetch the whole game up front: the page was loaded before this worker
// existed, so nothing it fetched went through the cache.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

// A new build's worker deletes the old build's cache.
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function fromCache(request) {
  return caches.match(request, { ignoreSearch: true }).then((hit) => hit ?? caches.match('./'));
}

// The page itself comes from the network when it answers in time, so a new
// deploy shows up straight away; otherwise from the cache.
async function page(request) {
  const network = fetch(request).catch(() => null);
  const late = new Promise((resolve) => setTimeout(() => resolve(null), NETWORK_WAIT_MS));
  const fresh = await Promise.race([network, late]);
  if (fresh?.ok) return fresh;
  const cached = await fromCache(request);
  return cached ?? (await network) ?? Response.error();
}

// Everything else has a content hash in its name (or is an icon), so a cached
// copy is never stale.
function file(request) {
  return caches.match(request, { ignoreVary: true }).then((hit) => hit ?? fetch(request));
}

self.addEventListener('fetch', (e) => {
  const request = e.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  e.respondWith(request.mode === 'navigate' ? page(request) : file(request));
});
