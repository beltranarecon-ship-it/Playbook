/* ============================================================
   toast.js — avisos no bloqueantes (reutiliza .toast de app.css).
   toast('Guardado') · toast('Error', 'error') · confirmToast para
   deshacer: toastDeshacer('Jugador dado de baja', () => revertir()).
   ============================================================ */

import { h } from './dom.js';

function contenedor() {
  let c = document.getElementById('toast-container');
  if (!c) {
    c = h('div', { class: 'toast-container', id: 'toast-container', 'aria-live': 'polite' });
    document.body.append(c);
  }
  return c;
}

export function toast(mensaje, tipo = 'success', ms = 3200) {
  const el = h('div', { class: `toast toast-${tipo}` }, mensaje);
  contenedor().append(el);
  setTimeout(() => el.remove(), ms);
  return el;
}

/** Toast con acción "Deshacer" (5 s). Si el usuario pulsa, ejecuta fn. */
export function toastDeshacer(mensaje, fnDeshacer, ms = 5000) {
  let deshecho = false;
  const el = h('div', { class: 'toast toast-success eq-toast-accion' },
    h('span', {}, mensaje),
    h('button', {
      class: 'eq-toast-btn', type: 'button',
      onClick: () => { deshecho = true; el.remove(); fnDeshacer(); },
    }, 'Deshacer'),
  );
  contenedor().append(el);
  setTimeout(() => { if (!deshecho) el.remove(); }, ms);
}
