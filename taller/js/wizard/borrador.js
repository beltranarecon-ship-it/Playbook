/* ============================================================
   borrador.js — autoguardado del borrador en localStorage (§13).
   Clave: cbp_borrador_ejercicio. Guarda el draft + la foto inicial
   del canvas + el paso, para poder retomar tras cerrar el taller.
   ============================================================ */

const KEY = 'cbp_borrador_ejercicio';

export function guardarBorrador(draft, elementos, step) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ draft, elementos, step, fecha: Date.now() }));
  } catch { /* almacenamiento lleno o no disponible */ }
}

export function leerBorrador() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

export function borrarBorrador() {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}

/** ¿El borrador tiene contenido que merezca ofrecer recuperación? */
export function borradorConContenido(b) {
  if (!b || !b.draft) return false;
  return !!(b.draft.nombre?.trim() || (b.elementos && b.elementos.length) || b.draft.animacion);
}

export function fechaBorrador(b) {
  if (!b?.fecha) return '';
  try { return new Date(b.fecha).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
