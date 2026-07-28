/* ============================================================
   components.js — controles de formulario reutilizables del wizard.
   ============================================================ */

import { h } from './dom.js';

const optVal = (o) => (typeof o === 'string' ? o : o.value);
const optLabel = (o) => (typeof o === 'string' ? o : o.label);

/** Campo con etiqueta + control. */
export function field(labelText, control, { required = false, hint = null, counter = null } = {}) {
  return h('div', { class: 'field' },
    h('label', { class: 'field__label' },
      h('span', null, labelText, required ? h('span', { class: 'req' }, ' *') : null),
      counter ? counter : null,
    ),
    control,
    hint ? h('p', { class: 'field__hint muted' }, hint) : null,
  );
}

/** Chips de selección única (§5/§6). */
export function chipsSingle(options, value, onChange) {
  const root = h('div', { class: 'chip-group' });
  const paint = (val) => root.replaceChildren(...options.map((o) => {
    const v = optVal(o), active = v === val;
    return h('button', { class: 'chip' + (active ? ' is-active' : ''), type: 'button', 'aria-pressed': String(active), onClick: () => { onChange(v); paint(v); } }, optLabel(o));
  }));
  paint(value);
  root.setValue = paint;
  return root;
}

/** Chips de selección múltiple (§6). */
export function chipsMulti(options, values, onChange) {
  let sel = new Set(values || []);
  const root = h('div', { class: 'chip-group' });
  const paint = () => root.replaceChildren(...options.map((o) => {
    const v = optVal(o), active = sel.has(v);
    return h('button', { class: 'chip' + (active ? ' is-active' : ''), type: 'button', 'aria-pressed': String(active), onClick: () => { active ? sel.delete(v) : sel.add(v); onChange([...sel]); paint(); } }, optLabel(o));
  }));
  paint();
  root.setValues = (vals) => { sel = new Set(vals || []); paint(); };
  return root;
}

/** Selector visual de pista (§5): tarjetas con preview. */
export function pistaPicker(options, value, onChange) {
  const root = h('div', { class: 'pista-picker' });
  const paint = (val) => root.replaceChildren(...options.map((o) => h('button', {
    class: 'pista-card' + (o.key === val ? ' is-active' : ''), type: 'button', 'aria-pressed': String(o.key === val),
    onClick: () => { onChange(o.key); paint(o.key); },
  },
    h('span', { class: 'pista-card__img', style: { backgroundImage: `url("${o.src}")` } }),
    h('span', { class: 'pista-card__label' }, h('b', null, o.label), h('small', null, o.sub)),
  )));
  paint(value);
  return root;
}

/** Slider con valor en vivo. */
export function slider({ min, max, step = 1, value, onInput, format }) {
  const out = h('span', { class: 'slider__val mono' }, format ? format(value) : String(value));
  const input = h('input', { class: 'slider', type: 'range', min, max, step, value, onInput: (e) => { const v = +e.target.value; out.textContent = format ? format(v) : String(v); onInput(v); } });
  const wrap = h('div', { class: 'slider-wrap' }, input, out);
  wrap.setValue = (v) => { input.value = v; out.textContent = format ? format(v) : String(v); };
  return wrap;
}

/** Slider de rango con dos pulgares (mín. y máx.). Mantiene mín ≤ máx − gap.
 *  onInput recibe { min, max }. format(a,b) -> texto del valor. */
export function rangeSlider({ min, max, step = 1, valueMin, valueMax, gap = 0, onInput, format }) {
  let lo = Math.min(valueMin ?? min, valueMax ?? max);
  let hi = Math.max(valueMin ?? min, valueMax ?? max);
  const span = (max - min) || 1;
  const fmt = (a, b) => (format ? format(a, b) : `${a}–${b}`);
  const out = h('span', { class: 'slider__val mono' }, fmt(lo, hi));
  const fill = h('span', { class: 'range__fill' });
  const inLo = h('input', { class: 'range__in', type: 'range', min, max, step, value: lo, 'aria-label': 'Duración mínima' });
  const inHi = h('input', { class: 'range__in', type: 'range', min, max, step, value: hi, 'aria-label': 'Duración máxima' });
  const paint = () => {
    fill.style.left = `${((lo - min) / span) * 100}%`;
    fill.style.right = `${100 - ((hi - min) / span) * 100}%`;
    out.textContent = fmt(lo, hi);
  };
  inLo.addEventListener('input', () => { lo = Math.min(+inLo.value, hi - gap); inLo.value = lo; paint(); onInput?.({ min: lo, max: hi }); });
  inHi.addEventListener('input', () => { hi = Math.max(+inHi.value, lo + gap); inHi.value = hi; paint(); onInput?.({ min: lo, max: hi }); });
  const rail = h('div', { class: 'range' }, h('span', { class: 'range__track' }), fill, inLo, inHi);
  const wrap = h('div', { class: 'slider-wrap slider-wrap--range' }, rail, out);
  wrap.setValues = (a, b) => { lo = a; hi = b; inLo.value = a; inHi.value = b; paint(); };
  paint();
  return wrap;
}

/** Spinner numérico. */
export function spinner({ min, max, value, onChange }) {
  const input = h('input', { class: 'input spinner', type: 'number', min, max, value, onChange: (e) => { let v = Math.max(min, Math.min(max, +e.target.value || min)); e.target.value = v; onChange(v); } });
  return input;
}

/** Entrada de etiquetas con autocompletado (§12). */
export function tagInput({ value = [], suggestions = [], onChange }) {
  let tags = [...value];
  const listId = 'tags-' + Math.random().toString(36).slice(2, 7);
  const input = h('input', { class: 'input tag-input', placeholder: 'Añade una etiqueta y pulsa Enter', list: listId });
  const datalist = h('datalist', { id: listId }, ...suggestions.map((s) => h('option', { value: s })));
  const chips = h('div', { class: 'tag-list' });
  const paint = () => chips.replaceChildren(...tags.map((t) => h('span', { class: 'tag' }, t, h('button', { class: 'tag__x', type: 'button', 'aria-label': `Quitar ${t}`, onClick: () => { tags = tags.filter((x) => x !== t); onChange([...tags]); paint(); } }, '×'))));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); const v = input.value.trim(); if (v && !tags.includes(v)) { tags.push(v); onChange([...tags]); paint(); } input.value = ''; }
    else if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); onChange([...tags]); paint(); }
  });
  paint();
  return h('div', { class: 'taginput' }, chips, input, datalist);
}

/** Sección plegable (§2.2 / §8.1). */
export function collapsible({ label, open = false, content }) {
  const body = h('div', { class: 'collapsible__body' }, content);
  body.hidden = !open;
  const toggle = h('button', { class: 'collapsible__toggle' + (open ? ' is-open' : ''), type: 'button', 'aria-expanded': String(open),
    onClick: () => { const willOpen = body.hidden; body.hidden = !willOpen; toggle.classList.toggle('is-open', willOpen); toggle.setAttribute('aria-expanded', String(willOpen)); } },
    h('span', { class: 'collapsible__chevron', 'aria-hidden': 'true' }), label);
  return h('div', { class: 'collapsible' }, toggle, body);
}
