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

/**
 * Confirmación simple. resolve(true) si acepta.
 *
 * La respuesta se guarda ANTES de cerrar. El botón de aceptar llamaba a
 * `cerrar()` primero, y `cerrar()` dispara `alCerrar`, que resolvía
 * `false`: una promesa solo se resuelve una vez, así que el `true` que
 * venía detrás no llegó nunca y TODA confirmación de la aplicación
 * respondía que no. Se veía como que el botón no hacía nada.
 */
export function confirmar({ titulo, mensaje, textoOk = 'Confirmar', textoNo = 'Cancelar' }) {
  return new Promise((resolve) => {
    let dicho = false;
    const responder = (v) => { if (!dicho) { dicho = true; resolve(v); } };
    const m = abrirModal({
      titulo,
      cuerpo: h('p', { class: 'eq-confirm-text' }, mensaje),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { responder(false); m.cerrar(); } }, textoNo),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: () => { responder(true); m.cerrar(); } }, textoOk),
      ],
      // cerrar por Escape, por la X o por el fondo es decir que no
      alCerrar: () => responder(false),
    });
  });
}

/** Pide un texto (p. ej. motivo de cancelación). resolve(string|null).
 *  Responde antes de cerrar, por lo mismo que `confirmar`: cerrar dispara
 *  `alCerrar`, y una promesa ya resuelta no se vuelve a resolver. */
/**
 * La segunda confirmación de un borrado sin vuelta atrás: hay que
 * ESCRIBIR el nombre exacto de lo que se va a borrar.
 *
 * ── POR QUÉ ESCRIBIRLO Y NO OTRO «¿SEGURO?» ─────────────────
 * Porque un segundo «¿seguro?» se pulsa con el mismo dedo y la misma
 * inercia que el primero. Escribir «Alevín Tello Téllez» obliga a
 * mirar QUÉ se está borrando, que es exactamente lo que hay que
 * comprobar. El botón no se enciende hasta que el texto coincide, así
 * que no hay forma de darle sin haber leído el nombre.
 *
 * @param nombre    lo que hay que teclear, tal cual
 * @param queSeLleva lista de frases: «9 entrenamientos», «3 partidos»…
 * @returns el texto escrito si coincide, o null si se cancela
 */
export function confirmarEscribiendo({ titulo, nombre, queSeLleva = [], aviso = null, textoOk = 'Borrar del todo' }) {
  return new Promise((resolve) => {
    let input, boton, dicho = false;
    const responder = (v) => { if (!dicho) { dicho = true; resolve(v); } };
    const coincide = () => input.value.trim() === String(nombre).trim();
    const revisar = () => { boton.disabled = !coincide(); };
    const enviar = () => { if (!coincide()) return; responder(input.value.trim()); m.cerrar(); };

    const m = abrirModal({
      titulo,
      clase: 'modal-peligro',
      cuerpo: h('div', { class: 'flow' },
        queSeLleva.length
          ? h('div', { class: 'eq-borrar-lleva' },
              h('p', {}, 'Esto se va a perder y no se puede recuperar:'),
              h('ul', {}, ...queSeLleva.map((x) => h('li', {}, x))))
          : null,
        aviso ? h('p', { class: 'eq-ayuda' }, aviso) : null,
        h('div', { class: 'field-group' },
          h('label', { class: 'field-label' },
            'Escribe ', h('strong', {}, String(nombre)), ' para confirmar'),
          input = h('input', {
            class: 'field-input', type: 'text', autocomplete: 'off',
            placeholder: String(nombre),
            onInput: revisar,
            onKeydown: (e) => { if (e.key === 'Enter') enviar(); },
          }),
        ),
      ),
      pie: [
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { responder(null); m.cerrar(); } }, 'Cancelar'),
        boton = h('button', { class: 'btn btn-secondary eq-btn-peligro', type: 'button', disabled: true, onClick: enviar }, textoOk),
      ],
      alCerrar: () => responder(null),
    });
    input.focus();
  });
}

export function pedirTexto({ titulo, etiqueta, placeholder = '', obligatorio = true }) {
  return new Promise((resolve) => {
    let input, dicho = false;
    const responder = (v) => { if (!dicho) { dicho = true; resolve(v); } };
    const enviar = () => {
      const v = input.value.trim();
      if (obligatorio && !v) { input.focus(); input.classList.add('animate-shake'); return; }
      responder(v || null); m.cerrar();
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
        h('button', { class: 'btn btn-secondary', type: 'button', onClick: () => { responder(null); m.cerrar(); } }, 'Cancelar'),
        h('button', { class: 'btn btn-primary', type: 'button', onClick: enviar }, 'Aceptar'),
      ],
      alCerrar: () => responder(null),
    });
    input.focus();
  });
}
