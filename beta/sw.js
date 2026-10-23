/* Il mio bilancio - service worker: l'app si apre anche senza connessione.
   I dati arrivano sempre dal Foglio Google (l'app tiene da sola una copia dell'ultima apertura). */
const VERSION = 'bilancio-v5';
const SHELL = ['./', './index.html', './app.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // dati e accesso: sempre dalla rete (li gestisce Firebase)
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com') || /^(firestore|identitytoolkit|securetoken)\.googleapis\.com$/.test(url.hostname) || url.hostname.endsWith('firebaseapp.com')) return;
  // pagina dell'app: prima la rete (così arrivano gli aggiornamenti), poi la copia salvata
  if (req.mode === 'navigate' || (url.origin === location.origin && (url.pathname.endsWith('/index.html') || url.pathname.endsWith('/app.html')))) {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req.mode === 'navigate' ? './index.html' : req, copy)); return r; })
      .catch(() => caches.match('./index.html').then(r => r || caches.match('./'))));
    return;
  }
  // icone, caratteri e librerie per PDF/Excel: copia salvata, aggiornata in background
  if (url.origin === location.origin || url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'www.gstatic.com' || url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com')) {
    e.respondWith(caches.open(VERSION).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })));
  }
});
