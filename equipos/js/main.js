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
import * as inicio from './views/inicio.js';
import * as admin from './views/admin.js';
import * as perfil from './views/perfil.js';
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
  .on('/inicio', () => show(inicio))
  .on('/admin', () => show(admin))
  .on('/perfil', () => show(perfil))
  // el inicio es la pantalla de abrir la app (§5.11): lo que no se
  // reconozca cae ahí, y no en el calendario
  .otherwise(() => router.navigate('/inicio', { replace: true }));

(async () => {
  const session = await getSession();
  if (!session) { window.location.replace('/index.html'); return; }

  /* Cuál de los cuatro destinos está activo. Se calcula en un sitio y
     lo usan el pintado y el repaso, para que no puedan discrepar. */
  const destinoDe = (ruta) => {
    if (ruta.startsWith('/equipos')) return 'equipos';
    if (ruta.startsWith('/inicio')) return 'inicio';
    if (ruta.startsWith('/app')) return 'ejercicios';
    return 'sesiones';
  };

  // chrome persistente (fuera del root de vistas)
  document.body.prepend(...chrome(destinoDe(location.pathname), { avisos: 0 }));

  /* Los avisos sin leer, para el punto de la campana. Va aparte y sin
     bloquear: si la 031 no está aplicada, o falla la consulta, la app
     entra igual y simplemente no hay punto. */
  (async () => {
    try {
      const { sinLeer } = await import('./data/push.js');
      const n = (await sinLeer({ limite: 20 })).length;
      if (!n) return;
      const campana = document.querySelector('.eq-campana');
      if (!campana || campana.querySelector('.eq-campana-punto')) return;
      campana.classList.add('con-avisos');
      campana.append(Object.assign(document.createElement('span'), { className: 'eq-campana-punto' }));
      campana.title = `${n} aviso(s) sin leer`;
    } catch { /* sin avisos y sin ruido */ }
  })();

  // marca activo el nav al navegar
  const marcaNav = () => {
    const activo = destinoDe(location.pathname);
    document.querySelectorAll('.topbar .nav-item, .eq-tabbar .eq-tab').forEach((el) => {
      const href = el.getAttribute('href') || '';
      el.classList.toggle('active', destinoDe(href) === activo && !!href);
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
