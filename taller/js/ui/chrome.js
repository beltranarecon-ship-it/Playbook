/* ============================================================
   chrome.js — piezas de UI compartidas por las vistas del taller:
   header (§4), barra de guardado flotante (§13), navegación de pasos.
   ============================================================ */

import { h, icon } from './dom.js';

const ARROW_LEFT = 'M15 18l-6-6 6-6';

/**
 * Header del taller (§4): ← Volver · título · herramientas.
 * @param {object} o
 * @param {string} o.title
 * @param {string} [o.backHref='/ejercicios/nuevo']
 * @param {boolean} [o.editableTitle=false] título editable inline (modo edición)
 * @param {(v:string)=>void} [o.onTitleChange]
 * @param {()=>boolean} [o.beforeBack] devuelve false para cancelar la salida
 * @param {HTMLElement[]} [o.tools] iconos a la derecha (deshacer/rehacer, etc.)
 */
export function header({ title, backHref = '/ejercicios/nuevo', backLabel = 'Volver', editableTitle = false, onTitleChange, beforeBack, tools = [] }) {
  // Solo las rutas /ejercicios/* son del router SPA del Taller. Cualquier otro
  // destino (p.ej. /app.html, la biblioteca) debe ser navegación normal del
  // navegador — marcarlo data-link haría que el router lo interceptara y,
  // al no reconocer la ruta, rebotara de vuelta a /ejercicios/nuevo.
  const interno = backHref.startsWith('/ejercicios');
  const back = h('a', {
    class: 'header-back', href: backHref, 'data-link': interno || null,
    onClick: (e) => { if (beforeBack && beforeBack() === false) e.preventDefault(); },
  }, icon(ARROW_LEFT, { size: 18 }), backLabel);

  const titleEl = editableTitle
    ? h('input', {
        class: 'header-title header-title__edit', value: title || '', 'aria-label': 'Nombre del ejercicio',
        onChange: (e) => onTitleChange?.(e.target.value),
      })
    : h('div', { class: 'header-title', title: title || '' }, title || '');

  return h('header', { class: 'taller-header' },
    back,
    titleEl,
    h('div', { class: 'header-tools' }, ...tools),
  );
}

/**
 * Barra de guardado flotante (§13). Botón principal + secundario opcional.
 */
export function savebar({ onSave, saveLabel = 'Guardar ejercicio', secondary, hint } = {}) {
  return h('div', { class: 'savebar' },
    hint ? h('span', { class: 'savebar__hint' }, hint) : null,
    secondary ? h('button', { class: 'btn btn--ghost', type: 'button', onClick: secondary.onClick }, secondary.label) : null,
    h('button', { class: 'btn btn--primary btn--lg', type: 'button', id: 'btn-guardar', onClick: onSave }, saveLabel),
  );
}

/**
 * Navegación de pasos del wizard (§3). steps: [{n,label}], current = índice activo.
 */
export function stepNav(steps, current, { onJump } = {}) {
  return h('nav', { class: 'step-nav', 'aria-label': 'Pasos' },
    ...steps.map((s, i) => h('button', {
      class: 'step-pip' + (i === current ? ' is-active' : i < current ? ' is-done' : ''),
      type: 'button',
      'aria-current': i === current ? 'step' : null,
      onClick: () => onJump?.(i),
    },
      h('span', { class: 'step-pip__n' }, `PASO ${s.n}`),
      h('span', { class: 'step-pip__label' }, s.label),
    )),
  );
}
