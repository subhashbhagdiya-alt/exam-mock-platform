const CACHE_NAME = "examprep-v2";
const STATIC_ASSETS = ["/", "/manifest.json"];

async function matchQuestionCache(request) {
  const cache = await caches.open(CACHE_NAME);
  const exact = await cache.match(request);
  if (exact) return exact;

  const target = new URL(request.url);
  if (target.pathname !== "/api/questions") return null;

  const keys = await cache.keys();
  const candidates = keys.filter(key => {
    const url = new URL(key.url);
    return url.origin === target.origin &&
      url.pathname === target.pathname &&
      url.searchParams.get("exam") === target.searchParams.get("exam");
  });
  if (!candidates.length) return null;

  candidates.sort((a, b) => Number(new URL(b.url).searchParams.get("limit") || 0) - Number(new URL(a.url).searchParams.get("limit") || 0));
  return cache.match(candidates[0]);
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/questions") || url.pathname.startsWith("/api/job-tracks") || url.pathname.startsWith("/api/exams")) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await matchQuestionCache(request);
          return cached || new Response(
            JSON.stringify({ data: [], meta: { available: 0, offline: true } }),
            { headers: { "content-type": "application/json" } }
          );
        })
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => (await caches.match(request)) || (await caches.match("/")))
  );
});
