/* ============================================================
   chrome.js — topbar (reutiliza clases de app.css) + tab-bar
   inferior móvil. Enlaces INTERNOS llevan data-link (router);
   los que salen a otra app (/app.html) NO (navegación real).
   ============================================================ */

import { h } from './dom.js';
import { logout } from '/js/auth.js';

const ICONO_CAL = 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5';
const ICONO_EQ = 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z';
const ICONO_EJ = 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0v18M3 12h18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8';

function svgIcon(d) {
  return h('svg', { width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, viewBox: '0 0 24 24', 'aria-hidden': 'true' },
    h('path', { d, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
}

/** activo: 'equipos' | 'sesiones' */
export function chrome(activo) {
  const nav = (href, texto, key, dataLink = true) =>
    h('a', {
      class: 'nav-item' + (activo === key ? ' active' : ''),
      href, ...(dataLink ? { 'data-link': true } : {}),
    }, texto);

  const topbar = h('header', { class: 'topbar' },
    h('a', { class: 'topbar-brand', href: '/app.html' },
      h('img', { src: '/assets/icons/logo-cbp.png', alt: 'CBP', width: 30, height: 30, onError: (e) => { e.target.style.display = 'none'; } }),
      h('span', {}, 'Playbook CBP'),
    ),
    h('nav', { class: 'topbar-nav', 'aria-label': 'Navegación principal' },
      nav('/app.html', 'Ejercicios', 'ejercicios', false),
      nav('/equipos', 'Equipos', 'equipos'),
      nav('/sesiones', 'Calendario', 'sesiones'),
    ),
    h('div', { class: 'topbar-actions' },
      h('button', {
        class: 'btn-logout', type: 'button', title: 'Cerrar sesión', 'aria-label': 'Cerrar sesión',
        onClick: () => logout(),
      },
        h('svg', { width: 18, height: 18, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, viewBox: '0 0 24 24' },
          h('path', { d: 'M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75' })),
      ),
    ),
  );

  // Tab-bar inferior (móvil): objetivos táctiles grandes, pulgar.
  // Lleva los MISMOS tres destinos que la barra de arriba, porque en
  // móvil esa se oculta (no cabía y sacaba scroll horizontal). Si aquí
  // faltase Ejercicios, desde el teléfono no habría vuelta a la
  // biblioteca. Ejercicios vive en otra SPA: sin data-link.
  const tab = (href, texto, icono, key, dataLink = true) =>
    h('a', {
      class: 'eq-tab' + (activo === key ? ' active' : ''),
      href, ...(dataLink ? { 'data-link': true } : {}), 'aria-label': texto,
    }, svgIcon(icono), h('span', {}, texto));

  const tabbar = h('nav', { class: 'eq-tabbar', 'aria-label': 'Navegación móvil' },
    tab('/app.html', 'Ejercicios', ICONO_EJ, 'ejercicios', false),
    tab('/sesiones', 'Calendario', ICONO_CAL, 'sesiones'),
    tab('/equipos', 'Equipos', ICONO_EQ, 'equipos'),
  );

  return [h('div', { class: 'speed-bar', 'aria-hidden': 'true' }), topbar, tabbar];
}
