// Minimal service worker: keeps the app shell so the installed PWA opens with a
// flaky connection. Data is never cached here: it lives in Supabase and the app
// needs a connection to read or write it (see PRODUCT.md). Intercepting those
// requests would show stale data as if it were live, so only same-origin pages
// and static assets go through this worker.
const CACHE = "paula-shell-v2";
const SHELL = ["/hoy", "/calendario", "/clientes", "/ads", "/plata"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Supabase, fonts and anything else cross-origin goes straight to the network.
  if (url.origin !== self.location.origin) return;

  const esPagina = request.mode === "navigate";
  const esEstatico = url.pathname.startsWith("/_next/static/") || /\.(?:png|svg|jpg|ico|woff2?)$/.test(url.pathname);
  if (!esPagina && !esEstatico) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((res) => res ?? (esPagina ? caches.match("/hoy") : Response.error())),
      ),
  );
});
