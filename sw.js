// Service Worker — Playbook CBP v2
// Estrategia: network-first (sirve código fresco online; cae a caché offline).
// Cache-first servía módulos del Taller obsoletos; network-first lo evita.
// Las llamadas a Supabase y esm.sh NUNCA se cachean aquí.

const CACHE_NAME = 'cbp-v2-shell-v13'; // v13: push y notificationclick (Tramo 4.7)

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

/* ============================================================
   AVISOS PUSH (Tramo 4.7)

   El service worker deja de solo cachear y pasa a manejar `push` y
   `notificationclick` (§9).

   LO QUE LLEGA
   La función programada manda un JSON con {titulo, cuerpo, url, tag}.
   Si por lo que sea llega sin cuerpo —una prueba desde el navegador, un
   push vacío de mantenimiento— se enseña algo genérico en vez de no
   enseñar nada: un push que no muestra notificación hace que el
   navegador retire el permiso.

   TODO SE PUEDE HACER ABRIENDO EL AVISO (§5.8)
   Al tocarlo se abre `url`. Y si ya hay una pestaña de la app abierta,
   se REUTILIZA y se navega dentro: abrir una segunda deja al entrenador
   con dos copias de la app y los cambios a medias en la de atrás.
   ============================================================ */

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = {}; }

  const titulo = d.titulo || 'Playbook CBP';
  const opciones = {
    body: d.cuerpo || '',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    // el tag hace que un aviso nuevo del MISMO hecho sustituya al
    // anterior en la bandeja en vez de apilarse
    tag: d.tag || d.clave || 'cbp',
    renotify: false,
    data: { url: d.url || '/equipos/' },
    // vibra: en el bolsillo, durante un entrenamiento, es lo único que
    // se percibe
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url) || '/equipos/';

  event.waitUntil((async () => {
    const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of abiertas) {
      // misma app abierta: se navega dentro y se trae al frente
      if (new URL(c.url).origin === self.location.origin) {
        await c.focus();
        if ('navigate' in c) { try { await c.navigate(destino); } catch { /* algunos navegadores no dejan */ } }
        return;
      }
    }
    await self.clients.openWindow(destino);
  })());
});

