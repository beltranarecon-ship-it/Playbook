/* ============================================================
   modal.js — diálogo modal reutilizable (eliminar §14, etc.).
   ============================================================ */

import { h } from './dom.js';

export function modal({ title, content, actions = [] }) {
  const overlay = h('div', { class: 'modal-overlay', onClick: (e) => { if (e.target === overlay) close(); } });
  const box = h('div', { class: 'modal-box', role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'modal-head' },
      h('h2', { class: 'modal-title' }, title),
      h('button', { class: 'modal-x', type: 'button', 'aria-label': 'Cerrar', onClick: close }, '×'),
    ),
    h('div', { class: 'modal-body' }, content),
    actions.length ? h('div', { class: 'modal-foot' }, ...actions) : null,
  );
  overlay.append(box);
  document.body.append(overlay);
  document.addEventListener('keydown', onEsc);
  requestAnimationFrame(() => overlay.classList.add('is-in'));

  function onEsc(e) { if (e.key === 'Escape') close(); }
  function close() { document.removeEventListener('keydown', onEsc); overlay.remove(); }
  return { close };
}

export function confirmModal({ title, message, confirmLabel = 'Eliminar', danger = true }) {
  return new Promise((resolve) => {
    const m = modal({
      title,
      content: h('p', null, message),
      actions: [
        h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => { m.close(); resolve(false); } }, 'Cancelar'),
        h('button', { class: 'btn ' + (danger ? 'btn--danger' : 'btn--primary'), type: 'button', onClick: () => { m.close(); resolve(true); } }, confirmLabel),
      ],
    });
  });
}
