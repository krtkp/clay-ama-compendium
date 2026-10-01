// Offline support and instant repeat visits. The build stamps a version from the site's content,
// so every deploy installs a fresh cache and drops the old one.
const VERSION = "ama-__VERSION__";
const PRECACHE = __PRECACHE__;
self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const fresh = (req, ms = 3500) => new Promise((resolve, reject) => {   // network first, cache if offline or slow
  const t = setTimeout(() => caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(r => r ? resolve(r) : null), ms);
  fetch(req).then(res => { clearTimeout(t); if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } resolve(res); })
    .catch(() => { clearTimeout(t); caches.match(req, { ignoreSearch: req.mode === "navigate" }).then(r => r ? resolve(r) : reject(new Error("offline"))); });
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.pathname.startsWith("/_vercel/") || url.hostname.includes("posthog")) return;
  if (url.origin === location.origin){
    if (req.mode === "navigate" || url.pathname.endsWith(".json") || url.pathname.endsWith(".html")) return e.respondWith(fresh(req));
    return e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; })));
  }
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")){
    return e.respondWith(caches.match(req).then(hit => { const net = fetch(req).then(res => { caches.open(VERSION).then(c => c.put(req, res.clone())); return res; }).catch(() => hit); return hit || net; }));
  }
});
