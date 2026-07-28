/* ============================================================
   toast.js — avisos efímeros y confirmaciones (§13).
   ============================================================ */

import { h } from './dom.js';

let container;
function ensure() {
  if (!container) { container = h('div', { class: 'toast-container', 'aria-live': 'polite' }); document.body.append(container); }
  return container;
}

export function toast(msg, { type = 'info', actions = null, timeout = 3200 } = {}) {
  const node = h('div', { class: `toast toast--${type}`, role: 'status' },
    h('span', { class: 'toast__msg' }, msg),
    ...(actions || []).map((a) => h('button', { class: 'toast__btn', type: 'button', onClick: () => { a.onClick?.(); dismiss(); } }, a.label)),
  );
  ensure().append(node);
  let timer = timeout ? setTimeout(dismiss, timeout) : null;
  function dismiss() { if (timer) clearTimeout(timer); node.classList.add('is-out'); setTimeout(() => node.remove(), 200); }
  requestAnimationFrame(() => node.classList.add('is-in'));
  return { dismiss };
}

/** Confirmación Sí/Cancelar (p. ej. guardar sin animación §13). */
export function confirmToast(msg, { confirmLabel = 'Sí', cancelLabel = 'Cancelar', type = 'warn' } = {}) {
  return new Promise((resolve) => {
    toast(msg, { type, timeout: 0, actions: [
      { label: confirmLabel, onClick: () => resolve(true) },
      { label: cancelLabel, onClick: () => resolve(false) },
    ] });
  });
}
