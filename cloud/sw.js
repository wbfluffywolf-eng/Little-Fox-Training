const CACHE_NAME = "little-fox-training-cloud-v41";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./avatar-fix.css",
  "./calendar-profile.css",
  "./messages-ui.css",
  "./tracker-default.js",
  "./app.js",
  "./log-fix.js",
  "./log-event-null-fix.js",
  "./friend-link-fix.js",
  "./auth-redirect-fix.js",
  "./member-actions-fix.js",
  "./member-access-editor.js",
  "./cloud-full.js",
  "./event-multi-fix.js",
  "./calendar-tracking.js",
  "./inventory-rebuild.js",
  "./suggestion-fix.js",
  "./messages.js",
  "./friends-tab.js",
  "./public.js",
  "./account-rebuild-fix.js",
  "./manifest.webmanifest",
  "../assets/app-icon.png",
  "../assets/sidebar-wag-wag.png",
  "../assets/sidebar-daily-log.png",
  "../assets/profile-need-diaper.png",
  "../assets/profile-face-cover.png",
  "../assets/profile-oh-no.png",
  "../assets/profile-wag-wag.png",
  "../assets/profile-ych.png",
  "../assets/profile-heart.png"
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
