const CACHE_NAME = "silencio-v2";
const ASSETS = ["./", "./index.html", "./manifest.json", "./sw.js"];
const CACHE_URLS = ASSETS.map((asset) => new URL(asset, self.location).href);
const CACHE_PATHS = new Set(CACHE_URLS.map((url) => new URL(url).pathname));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request, { cache: "no-store" })
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
            return response;
          }

          return caches.match("./index.html").then((cached) => cached || response);
        })
        .catch(() =>
          caches.match("./index.html").then(
            (cached) =>
              cached ||
              new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
          )
        )
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (!CACHE_PATHS.has(requestUrl.pathname)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) {
            return response;
          }

          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() =>
          new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
        );
    })
  );
});
