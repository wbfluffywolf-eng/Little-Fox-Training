const CACHE_NAME = "little-fox-training-cloud-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./log-fix.js",
  "./friend-link-fix.js",
  "./auth-redirect-fix.js",
  "./member-actions-fix.js",
  "./cloud-full.js",
  "./event-multi-fix.js",
  "./preset-catalog.js",
  "./extra-preset-catalog.js",
  "./preset-size-select-fix.js",
  "./unified-preset-ui.js",
  "./messages.js",
  "./manifest.webmanifest",
  "../assets/app-icon.png",
  "../assets/sidebar-wag-wag.png",
  "../assets/sidebar-daily-log.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.hostname.includes("supabase.co")) return;
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match("./index.html")))
  );
});
