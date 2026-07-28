/* ============================================================
   modal.js — modales del módulo (reutiliza .modal-* de app.css).
   abrirModal({titulo, cuerpo, pie}) → {cerrar}. Escape y clic fuera
   cierran. confirmar() devuelve una promesa boolean.
   ============================================================ */

import { h } from './dom.js';

export function abrirModal({ titulo, cuerpo, pie, alCerrar }) {
  const cerrar = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    alCerrar?.();
  };
  const onKey = (e) => { if (e.key === 'Escape') cerrar(); };

  const overlay = h('div', {
    class: 'modal-overlay', role: 'dialog', 'aria-modal': 'true',
    onClick: (e) => { if (e.target === overlay) cerrar(); },
  },
    h('div', { class: 'modal' },
      h('div', { class: 'modal-header' },
        h('h2', { class: 'modal-title' }, titulo),
        h('button', { class: 'modal-close', type: 'button', 'aria-label': 'Cerrar', onClick: cerrar },
          h('svg', { width: 20, height: 20, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, viewBox: '0 0 24 24' },
            h('path', { d: 'M6 18 18 6M6 6l12 12' }))),
      ),
      h('div', { class: 'modal-body' }, cuerpo),
      pie ? h('div', { class: 'modal-footer' }, pie) : null,
    ),
  );
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  overlay.querySelector('input, select, textarea, button.btn-primary')?.focus();
  return { cerrar };
}

/** Confirmación simple. resolve(true) si acepta. */
export function confirmar({ titulo, mensaje, textoOk = 'Confirmar', textoNo = 'Cancelar' }) {
  return new Promise((resolve) => {
    const m = abrirModal({
      titulo,
      cuerpo: h('p', { class: 'eq-confirm-text' }, mensaje),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { m.cerrar(); resolve(false); } }, textoNo),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => { m.cerrar(); resolve(true); } }, textoOk),
      ],
      alCerrar: () => resolve(false),
    });
  });
}

/** Pide un texto (p. ej. motivo de cancelación). resolve(string|null). */
export function pedirTexto({ titulo, etiqueta, placeholder = '', obligatorio = true }) {
  return new Promise((resolve) => {
    let input;
    const enviar = () => {
      const v = input.value.trim();
      if (obligatorio && !v) { input.focus(); input.classList.add('animate-shake'); return; }
      m.cerrar(); resolve(v || null);
    };
    const m = abrirModal({
      titulo,
      cuerpo: h('div', { class: 'field-group' },
        h('label', { class: 'field-label' }, etiqueta),
        input = h('input', {
          class: 'field-input', type: 'text', placeholder,
          onKeydown: (e) => { if (e.key === 'Enter') enviar(); },
        }),
      ),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { m.cerrar(); resolve(null); } }, 'Cancelar'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: enviar }, 'Aceptar'),
      ],
      alCerrar: () => resolve(null),
    });
    input.focus();
  });
}
