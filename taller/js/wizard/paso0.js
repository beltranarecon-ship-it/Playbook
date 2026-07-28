/* ============================================================
   paso0.js — Identificación básica y elección de pista (§5).
   ============================================================ */

import { h } from '../ui/dom.js';
import { field, chipsSingle, pistaPicker } from '../ui/components.js';
import { TIPOS_EJERCICIO, PISTA_OPCIONES } from '../config.js';
import { validarPaso0 } from './draft.js';

export function paso0(ctx) {
  const { draft, stage, onDraftChange } = ctx;

  const counter = h('span', { class: 'field__counter' }, `${draft.nombre.length}/80`);
  const nombre = h('input', {
    class: 'input', type: 'text', maxlength: '80', value: draft.nombre,
    placeholder: 'Contraataque 3vs2', 'aria-label': 'Nombre del ejercicio',
    onInput: (e) => { draft.nombre = e.target.value; counter.textContent = `${draft.nombre.length}/80`; nombre.classList.remove('is-error'); onDraftChange?.(); },
  });

  const tipoChips = chipsSingle(TIPOS_EJERCICIO, draft.tipo, (v) => { draft.tipo = v; tipoWrap.classList.remove('field--error'); onDraftChange?.(); });
  const tipoWrap = field('Tipo de ejercicio', tipoChips, { required: true });

  const pista = pistaPicker(PISTA_OPCIONES, draft.tipo_pista, (k) => { draft.tipo_pista = k; stage.setPista(k); });

  const el = h('div', { class: 'flow' },
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Paso 0'),
      h('h2', { class: 'section-title' }, 'Identifica el ejercicio'),
      field('Nombre del ejercicio', nombre, { required: true, counter }),
      tipoWrap,
    ),
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Pista'),
      h('h3', { class: 'section-title' }, 'Elige el tipo de pista'),
      pista,
    ),
  );

  function validate() {
    const v = validarPaso0(draft);
    if (!v.nombre) nombre.classList.add('is-error');
    if (!v.tipo) tipoWrap.classList.add('field--error');
    return v.ok();
  }

  return { el, validate };
}
