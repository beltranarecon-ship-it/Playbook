/* ============================================================
   main.js — arranque de la SPA Equipos/Sesiones.
   Guard de sesión (mismo storageKey que la app raíz) + registro
   de rutas /equipos/* y /sesiones/*. Orden: específico antes que
   :param (el router devuelve el primer match).
   ============================================================ */

import { Router } from './router.js';
import { getSession, getProfile, onAuthChange } from '/js/auth.js';
import { chrome } from './ui/chrome.js';
import { setState } from './store.js';
import * as lista from './views/equipos-lista.js';
import * as nuevo from './views/equipo-nuevo.js';
import * as detalle from './views/equipo-detalle.js';
import * as calendario from './views/calendario.js';
import * as planner from './views/sesion-planner.js';
import * as cierre from './views/sesion-cierre.js';
import * as sesionActiva from './views/sesion-activa.js';
import * as partido from './views/partido.js';
import * as convocatoria from './views/convocatoria.js';
import * as dossier from './views/dossier.js';

export const router = new Router();

const app = document.getElementById('app');
let activa = null;

function show(mod, params = {}) {
  if (activa?.destroy) activa.destroy();
  app.replaceChildren();
  activa = mod.render(app, params) || null;
  window.scrollTo(0, 0);
}

router
  .on('/equipos/nuevo', () => show(nuevo))
  .on('/equipos/:teamId', (p) => show(detalle, p))
  .on('/equipos', () => show(lista))
  .on('/sesiones/:sessionId/activa', (p) => show(sesionActiva, p))
  .on('/sesiones/:sessionId/cierre', (p) => show(cierre, p))
  .on('/sesiones/:sessionId', (p) => show(planner, p))
  .on('/sesiones', () => show(calendario))
  .on('/partidos/:matchId/convocatoria', (p) => show(convocatoria, p))
  .on('/partidos/:matchId', (p) => show(partido, p))
  .on('/dossier/:teamId', (p) => show(dossier, p))
  .otherwise(() => router.navigate('/sesiones', { replace: true }));

(async () => {
  const session = await getSession();
  if (!session) { window.location.replace('/index.html'); return; }

  // chrome persistente (fuera del root de vistas)
  document.body.prepend(...chrome(location.pathname.startsWith('/equipos') ? 'equipos' : 'sesiones'));

  // marca activo el nav al navegar
  const marcaNav = () => {
    const activo = location.pathname.startsWith('/equipos') ? 'equipos' : 'sesiones';
    document.querySelectorAll('.topbar .nav-item, .eq-tabbar .eq-tab').forEach((el) => {
      const href = el.getAttribute('href') || '';
      const key = href.startsWith('/equipos') ? 'equipos' : href.startsWith('/sesiones') ? 'sesiones' : null;
      el.classList.toggle('active', key === activo);
    });
  };
  window.addEventListener('popstate', marcaNav);
  document.addEventListener('click', () => queueMicrotask(marcaNav));

  // perfil (para gates de admin); un fallo aquí no bloquea el módulo
  try { setState({ perfil: await getProfile(session.user.id) }); } catch { /* coach sin perfil */ }

  onAuthChange((event) => {
    if (event === 'SIGNED_OUT') window.location.replace('/index.html');
  });

  router.start();
})();
