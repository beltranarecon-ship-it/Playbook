/* ============================================================
   borrador.js — autoguardado del borrador del Taller (§13).

   La mecánica —cuándo se ofrece, cuándo caduca, cómo se compara— vive
   en `taller/js/borradores.js`, compartida con el módulo de sesiones
   desde el Tramo 3.13. Aquí queda lo que es del Taller: qué se guarda
   y qué cuenta como «tiene contenido».

   ── LO QUE CAMBIA EN 3.13 ───────────────────────────────────
   Había UNA sola clave, así que empezar un ejercicio nuevo pisaba el
   borrador de la corrección que estabas a medias, y al revés. Ahora
   cada ejercicio ya creado tiene la suya.
   ============================================================ */

import { guardar, leer, borrar, claveEjercicio, fechaDe } from '../borradores.js';

/** @param id  el del ejercicio que se está editando; null si es nuevo */
export function guardarBorrador(draft, elementos, step, id = null) {
  return guardar(claveEjercicio(id), { draft, elementos, step });
}

export function leerBorrador(id = null) {
  return leer(claveEjercicio(id));
}

export function borrarBorrador(id = null) {
  borrar(claveEjercicio(id));
}

/** ¿El borrador tiene contenido que merezca ofrecer recuperación? */
export function borradorConContenido(b) {
  if (!b || !b.draft) return false;
  return !!(b.draft.nombre?.trim() || (b.elementos && b.elementos.length) || b.draft.animacion);
}

export const fechaBorrador = fechaDe;
