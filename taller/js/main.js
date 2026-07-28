/* ============================================================
   main.js — arranque de la app. Registra rutas (§20) y monta vistas.
   ============================================================ */

import { Router } from './router.js';
import * as wizard from './views/wizard.js';
import * as detalle from './views/detalle.js';
import * as editor from './views/editor.js';
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
  .on('/ejercicios/nuevo', () => show(wizard, { mode: 'nuevo' }))
  .on('/ejercicios/:id/editar', (p) => show(editor, p))
  .on('/ejercicios/:id', (p) => show(detalle, p))
  .otherwise(() => router.navigate('/ejercicios/nuevo', { replace: true }));

// Guard de sesión: el Taller vive dentro de cbp-v2 y comparte su login.
// Sin sesión -> al login de la app principal.
(async () => {
  const session = await getSession();
  if (!session) { window.location.replace('/index.html'); return; }
  router.start();
})();
