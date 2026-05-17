const CACHE_NAME = "little-fox-training-cloud-v79";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./avatar-fix.css",
  "./calendar-profile.css",
  "./messages-ui.css",
  "./friend-request-alert.css",
  "./mobile-optimizer.js",
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
  "./log-option-fix.js",
  "./calendar-tracking.js",
  "./inventory-rebuild.js",
  "./threadedarmor-print-presets-v77.js",
  "./suggestion-fix.js",
  "./messages.js",
  "./message-ping-friend-v78.js",
  "./messages-v70-fix.js",
  "./friends-tab.js",
  "./friend-search.js",
  "./friend-request-send-fix.js",
  "./friend-request-accept-fix.js",
  "./friend-request-alert.js",
  "./username-settings.js",
  "./accept-friend-request-schema.sql",
  "./public.js",
  "./account-rebuild-fix.js",
  "./launch-readiness.js",
  "./dashboard-polish-v74.js",
  "./usage-polish-v75.js",
  "./log-auto-v76.js",
  "./log-two-diapers-v78.js",
  "./owner-calendar-rename-v79.js",
  "./app-version.js",
  "./all_diaper_catalog_with_prices.csv",
  "./threaded_armor_ecoable_diapers_boosters.csv",
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
