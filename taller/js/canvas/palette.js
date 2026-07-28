/* ============================================================
   palette.js — paleta de elementos (§7.1) y lector de requisitos
   (§7.3). Click en un elemento -> modo colocación del board.
   ============================================================ */

import { h } from '../ui/dom.js';
import { COLORS } from './colors.js';

// Equipos neutrales (sin rol fijo). El rol atacante/defensor lo decide la
// descripción de la acción y se asigna por fase en la animación (§8/§10).
const ITEMS = [
  { kind: 'jugador', equipo: 'A', label: 'Equipo 1', color: COLORS.A },
  { kind: 'jugador', equipo: 'B', label: 'Equipo 2', color: COLORS.B },
  { kind: 'jugador', equipo: 'C', label: 'Equipo 3', color: COLORS.C },
  { kind: 'jugador', equipo: 'D', label: 'Equipo 4', color: COLORS.D },
  { kind: 'balon', label: 'Balón', color: COLORS.ball },
  { kind: 'cono', label: 'Cono', color: COLORS.cono },
];

function swatch(it) {
  if (it.kind === 'cono') return h('span', { class: 'pal-swatch pal-swatch--cono', style: { '--c': it.color } });
  if (it.kind === 'balon') return h('span', { class: 'pal-swatch pal-swatch--ball', style: { background: it.color } });
  return h('span', { class: 'pal-swatch pal-swatch--player', style: { background: it.color } });
}

export function palette(board) {
  const root = h('div', { class: 'palette' });
  ITEMS.forEach((it) => {
    const btn = h('button', {
      class: 'palette__item', type: 'button',
      onClick: () => {
        const armed = btn.classList.contains('is-armed');
        root.querySelectorAll('.is-armed').forEach((x) => x.classList.remove('is-armed'));
        if (armed) { board.cancelPlacing(); } else { btn.classList.add('is-armed'); board.startPlacing(it); }
      },
    }, swatch(it), h('span', null, it.label));
    root.append(btn);
  });
  // sincroniza el estado "armed" con el board (p.ej. tras colocar o Esc)
  board.on('placing', (spec) => { if (!spec) root.querySelectorAll('.is-armed').forEach((x) => x.classList.remove('is-armed')); });
  return root;
}

function stat(labelText, valEl) {
  return h('div', { class: 'stat' }, h('small', null, labelText), valEl);
}

/** Lector de requisitos en vivo (§7.3). */
export function requisitos(board) {
  const j = h('b', { class: 'mono' }, '0');
  const b = h('b', { class: 'mono' }, '0');
  const c = h('b', { class: 'mono' }, '0');
  const root = h('div', { class: 'reqs' },
    stat('Jugadores', j), stat('Balones', b), stat('Conos', c));
  const update = ({ counts }) => { j.textContent = counts.jugadores; b.textContent = counts.balones; c.textContent = counts.conos; };
  board.on('change', update);
  update({ counts: board.counts() });
  return root;
}
