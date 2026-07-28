/* ============================================================
   components.js — piezas compartidas del módulo:
   selector de color de equipo, chips de día (ISO 1-7), editor de
   slots semanales y avatar por iniciales.
   ============================================================ */

import { h } from './dom.js';
import { WEEKDAYS, TEAM_COLORS } from '../config.js';

/** Paleta curada. onChange(color). */
export function colorPicker(valor, onChange) {
  let seleccionado = valor || TEAM_COLORS[0];
  const wrap = h('div', { class: 'eq-colors', role: 'radiogroup', 'aria-label': 'Color del equipo' });
  const pinta = () => {
    wrap.replaceChildren(...TEAM_COLORS.map((c) =>
      h('button', {
        class: 'eq-color' + (c === seleccionado ? ' sel' : ''),
        type: 'button', role: 'radio',
        'aria-checked': String(c === seleccionado), 'aria-label': c,
        style: { background: c },
        onClick: () => { seleccionado = c; pinta(); onChange(c); },
      })));
  };
  pinta();
  return wrap;
}

/** Chips L-D (ISO 1-7). onChange(iso|null). nullable = se puede desmarcar. */
export function diaChips(valor, onChange, { nullable = true } = {}) {
  let sel = valor ?? null;
  const wrap = h('div', { class: 'eq-diachips', role: 'radiogroup', 'aria-label': 'Día de la semana' });
  const pinta = () => {
    wrap.replaceChildren(...WEEKDAYS.map((d) =>
      h('button', {
        class: 'eq-diachip' + (d.iso === sel ? ' sel' : ''),
        type: 'button', role: 'radio', 'aria-checked': String(d.iso === sel),
        'aria-label': d.nombre, title: d.nombre,
        onClick: () => { sel = (nullable && sel === d.iso) ? null : d.iso; pinta(); onChange(sel); },
      }, d.corto)));
  };
  pinta();
  return wrap;
}

/**
 * Editor de slots semanales. Estado interno; leer() devuelve las filas
 * válidas [{id?, weekday, hora_inicio, hora_fin, lugar}].
 */
export function slotsEditor(slotsIniciales = []) {
  const filas = slotsIniciales.map((s) => ({ ...s }));
  const lista = h('div', { class: 'eq-slots' });

  const filaEl = (f) => {
    const el = h('div', { class: 'eq-slot' },
      h('select', {
        class: 'field-select eq-slot-dia', 'aria-label': 'Día',
        onChange: (e) => { f.weekday = Number(e.target.value); },
      }, ...WEEKDAYS.map((d) =>
        h('option', { value: d.iso, ...(d.iso === f.weekday ? { selected: true } : {}) }, d.nombre))),
      h('input', {
        class: 'field-input', type: 'time', value: f.hora_inicio || '', 'aria-label': 'Hora de inicio',
        onChange: (e) => { f.hora_inicio = e.target.value; },
      }),
      h('span', { class: 'eq-slot-sep', 'aria-hidden': 'true' }, '–'),
      h('input', {
        class: 'field-input', type: 'time', value: f.hora_fin || '', 'aria-label': 'Hora de fin',
        onChange: (e) => { f.hora_fin = e.target.value; },
      }),
      h('input', {
        class: 'field-input eq-slot-lugar', type: 'text', value: f.lugar || '',
        placeholder: 'Lugar (opcional)', 'aria-label': 'Lugar',
        onChange: (e) => { f.lugar = e.target.value; },
      }),
      h('button', {
        class: 'eq-slot-quitar', type: 'button', 'aria-label': 'Quitar horario',
        onClick: () => { filas.splice(filas.indexOf(f), 1); el.remove(); },
      }, '×'),
    );
    return el;
  };

  filas.forEach((f) => lista.append(filaEl(f)));

  const root = h('div', {},
    lista,
    h('button', {
      class: 'btn btn-secondary eq-slot-add', type: 'button',
      onClick: () => {
        const f = { weekday: 1, hora_inicio: '18:00', hora_fin: '19:30', lugar: '' };
        filas.push(f); lista.append(filaEl(f));
      },
    }, '+ Añadir día de entreno'),
  );

  root.leer = () => filas
    .filter((f) => f.weekday && f.hora_inicio && f.hora_fin && f.hora_fin > f.hora_inicio)
    .map((f) => ({ id: f.id, weekday: f.weekday, hora_inicio: f.hora_inicio, hora_fin: f.hora_fin, lugar: f.lugar || null }));
  return root;
}

/** Avatar por iniciales con color derivado del nombre (fallback sin foto). */
export function avatar(nombre, color = null, size = 36) {
  const iniciales = nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || '').join('');
  const tono = color || TEAM_COLORS[[...nombre].reduce((a, c) => a + c.charCodeAt(0), 0) % TEAM_COLORS.length];
  return h('span', {
    class: 'eq-avatar', 'aria-hidden': 'true',
    style: { width: size + 'px', height: size + 'px', background: tono + '22', color: tono },
  }, iniciales || '·');
}

/**
 * Estrellas 1..max. Volver a tocar la estrella marcada deja la valoración
 * en blanco (así se puede DESvalorar sin recargar). onChange(n|null).
 * La usan la reflexión post-sesión (M5) y las 5 valoraciones del partido (M6).
 */
export function estrellas(valor, onChange, { max = 5, labels = null, soloLectura = false } = {}) {
  let sel = Number(valor) || 0;
  const wrap = h('div', { class: 'eq-estrellas', role: 'radiogroup', 'aria-label': `Valoración de 1 a ${max}` });
  const pinta = () => wrap.replaceChildren(
    ...Array.from({ length: max }, (_, i) => {
      const n = i + 1;
      const txt = labels?.[n] ? `${n} · ${labels[n]}` : `${n} de ${max}`;
      return h('button', {
        class: 'eq-estrella' + (n <= sel ? ' on' : ''), type: 'button', role: 'radio',
        'aria-checked': String(n === sel), 'aria-label': txt, title: txt, disabled: soloLectura,
        onClick: () => { sel = sel === n ? 0 : n; pinta(); onChange(sel || null); },
      }, '★');
    }),
    labels ? h('span', { class: 'eq-estrella-lbl' }, sel ? labels[sel] : 'Sin valorar') : null,
  );
  pinta();
  return wrap;
}

/** Punto de color de equipo. */
export const puntoEquipo = (color) =>
  h('span', { class: 'eq-dot', style: { background: color || 'var(--muted)' }, 'aria-hidden': 'true' });
