/* ============================================================
   main.js — arranque de la app. Registra rutas (§20) y monta vistas.
   ============================================================ */

import { Router } from './router.js';
import * as wizard from './views/wizard.js';
import * as detalle from './views/detalle.js';
import { getSession } from './supabase/auth.js';

const app = document.getElementById('app');
let active = null;

function show(mod, params) {
  if (active && typeof active.destroy === 'function') active.destroy();
  app.replaceChildren();
  active = mod.render(app, params) || null;
  window.scrollTo(0, 0);
}

export const router = new Router();

router
  /* Los tres caminos entran por el MISMO asistente (Tramo 2.13): crear,
     corregir y hacer una variante. El editor a pantalla completa que
     vivía en /editar se ha retirado — solo sabía retocar flechas, y eso
     lo hace ahora el paso 2 con «Manualmente». */
  .on('/ejercicios/nuevo', () => show(wizard, { modo: 'nuevo' }))
  .on('/ejercicios/:id/editar', (p) => show(wizard, { ...p, modo: 'editar' }))
  .on('/ejercicios/:id/duplicar', (p) => show(wizard, { ...p, modo: 'duplicar' }))
  .on('/ejercicios/:id', (p) => show(detalle, p))
  .otherwise(() => router.navigate('/ejercicios/nuevo', { replace: true }));

// Guard de sesión: el Taller vive dentro de cbp-v2 y comparte su login.
// Sin sesión -> al login de la app principal.
(async () => {
  const session = await getSession();
  if (!session) { window.location.replace('/index.html'); return; }
  router.start();
})();
