// Service Worker — Playbook CBP v2
// Estrategia: network-first (sirve código fresco online; cae a caché offline).
// Cache-first servía módulos del Taller obsoletos; network-first lo evita.
// Las llamadas a Supabase y esm.sh NUNCA se cachean aquí.

const CACHE_NAME = 'cbp-v2-shell-v12'; // v12: caída al lector local sin clave de IA

const PRECACHE_ASSETS = [
  '/index.html',
  '/app.html',
  '/css/base.css',
  '/css/auth.css',
  '/css/app.css',
  '/js/config.js',
  '/js/supabase-client.js',
  '/js/auth.js',
  '/js/app.js',
  '/js/modules/ejercicios.js',
  // Shell de la SPA Equipos/Sesiones (M2)
  '/equipos/index.html',
  '/equipos/css/panel.css',
  '/equipos/css/calendario.css',
  '/equipos/js/main.js',
  '/equipos/js/router.js',
  '/equipos/js/store.js',
  '/equipos/js/config.js',
  '/equipos/js/ui/dom.js',
  '/equipos/js/ui/chrome.js',
  // Los iconos se cachean si existen, pero no bloquean la instalación del SW
];

// Dominios que nunca se cachean (siempre red)
const NETWORK_ONLY_HOSTS = [
  'supabase.co',
  'esm.sh',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(() => {}))
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Red siempre para APIs y CDNs externos
  if (NETWORK_ONLY_HOSTS.some(host => url.hostname.includes(host))) {
    return;
  }

  // Solo GET
  if (event.request.method !== 'GET') return;

  // Network-first: intenta la red (código fresco) y cae a la caché si falla.
  event.respondWith(
    fetch(event.request).then(response => {
      if (response.ok && response.type === 'basic' && url.origin === self.location.origin) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }).catch(() => caches.match(event.request))
  );
});
