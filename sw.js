// Service Worker — Playbook CBP v2
// Estrategia: cache-first para assets estáticos.
// Las llamadas a Supabase y esm.sh NUNCA se cachean aquí.

const CACHE_NAME = 'cbp-v2-shell-v1';

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

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cachear solo respuestas válidas de nuestro origen
        if (
          response.ok &&
          response.type === 'basic' &&
          url.origin === self.location.origin
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
