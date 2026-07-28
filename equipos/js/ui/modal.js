/* ============================================================
   modal.js — modales del módulo (reutiliza .modal-* de app.css).
   abrirModal({titulo, cuerpo, pie}) → {cerrar}. Escape y clic fuera
   cierran. confirmar() devuelve una promesa boolean.
   ============================================================ */

import { h } from './dom.js';

/** `clase` viaja al overlay: deja que un modal concreto (el picker de
 *  ejercicios, el visor en móvil) pida más ancho sin tocar el resto. */
export function abrirModal({ titulo, cuerpo, pie, alCerrar, clase = '' }) {
  const cerrar = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    alCerrar?.();
  };
  // Escape lo atiende SOLO la capa de más arriba. Sin esto, con el proyector
  // abierto encima del picker un único Escape cerraba los dos: se iba el
  // proyector y, de paso, la búsqueda, el filtro y la selección del picker.
  // Los dos listeners cuelgan de `document`, así que stopPropagation no vale
  // (ni siquiera el inmediato: el de la modal se registró antes y corre
  // primero). Se decide por orden en el DOM, que es el orden de apilado.
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    const capas = document.querySelectorAll('.modal-overlay, .proyector');
    if (capas[capas.length - 1] !== overlay) return;
    cerrar();
  };

  const overlay = h('div', {
    class: 'modal-overlay' + (clase ? ' ' + clase : ''), role: 'dialog', 'aria-modal': 'true',
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
