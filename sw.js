const V = 'ib-v3';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', ...['util', 'ui', 'store', 'doc', 'render', 'shapes', 'pen', 'conn', 'media', 'adv', 'editor', 'act', 'tools', 'extras', 'io', 'panels', 'toolbar', 'study', 'study-ui', 'study-pro', 'shortcuts', 'app'].map(n => 'js/' + n + '.js'), 'icons/icon-192.png', 'icons/icon-512.png', 'js/vendor/pdf.min.js', 'js/vendor/pdf.worker.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(r, cp)); return res; }).catch(() => caches.match(r, { ignoreSearch: true }).then(m => m || caches.match('index.html'))));
});
