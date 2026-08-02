// Hand-rolled service worker — no next-pwa/Workbox (this project builds with
// Turbopack, and next-pwa hooks into Webpack config, so it isn't a reliable
// fit here; a plain static file in public/ needs zero bundler plugin at
// all). See optimización mobile Fase 5 plan for the reasoning.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// Deliberately small and hand-picked — NOT an aggressive full-app precache.
// /_next/static/* is content-hashed by the Next.js build, so caching it
// cache-first is safe: a new deploy ships new filenames, it can never serve
// a stale chunk under a name that still matches. Everything else (pages,
// API responses) stays network-first below, so a logged-in user is never
// served a stale/cached copy of an authenticated page as the default path.
const PRECACHE_URLS = ["/icon.svg", "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== STATIC_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || PRECACHE_URLS.includes(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET") return;

  if (isStaticAsset(url)) {
    // Cache-first: instant on repeat visits, no network round trip.
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, copy));
          return response;
        });
      }),
    );
    return;
  }

  if (event.request.mode === "navigate") {
    // Network-first for page navigations, falling back to a cached copy
    // only when actually offline — "actualización automática" means the
    // freshest page always wins when there's a connection.
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached ?? Response.error())),
    );
  }
});

// Push architecture is ready to receive — no self.registration.pushManager
// .subscribe() call anywhere yet, because there's no VAPID public key to
// subscribe with. Actually sending a push (server-side VAPID + web-push +
// a subscriptions table) is deliberately out of scope for this pass, per
// the same "Notification API simple, not full Web Push" decision already
// made for src/lib/notifications/browserPush.ts.
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Growth Link", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Growth Link", {
      body: payload.body,
      icon: "/icon.svg",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
