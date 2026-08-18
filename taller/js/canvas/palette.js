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
  // Material: no participa en la animación (nadie le pasa ni lo rodea), pero
  // ocupa sitio en el suelo y se dibuja a su medida real.
  { kind: 'pelota', label: 'Pelota de tenis', color: COLORS.tenis },
  { kind: 'escalera', label: 'Escalera', color: '#FFFFFF' },
  // Zonas (Tramo 2.7). No se colocan con un clic: se arrastran, porque
  // hacen falta dos puntos para decir de dónde a dónde.
  { kind: 'zona', tipo: 'rect', label: 'Zona · rectángulo' },
  { kind: 'zona', tipo: 'circulo', label: 'Zona · círculo' },
  { kind: 'zona', tipo: 'linea', label: 'Zona · línea' },
];

function swatch(it) {
  if (it.kind === 'zona') return h('span', { class: `pal-swatch pal-swatch--zona pal-swatch--zona-${it.tipo}` });
  if (it.kind === 'cono') return h('span', { class: 'pal-swatch pal-swatch--cono', style: { '--c': it.color } });
  if (it.kind === 'escalera') return h('span', { class: 'pal-swatch pal-swatch--escalera' });
  if (it.kind === 'balon' || it.kind === 'pelota') return h('span', { class: 'pal-swatch pal-swatch--ball', style: { background: it.color } });
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
  const m = h('b', { class: 'mono' }, '0');
  const z = h('b', { class: 'mono' }, '0');
  const root = h('div', { class: 'reqs' },
    stat('Jugadores', j), stat('Balones', b), stat('Conos', c), stat('Material', m), stat('Zonas', z));
  const update = ({ counts }) => {
    j.textContent = counts.jugadores; b.textContent = counts.balones;
    c.textContent = counts.conos; m.textContent = counts.material ?? 0;
    z.textContent = counts.zonas ?? 0;
  };
  board.on('change', update);
  update({ counts: board.counts() });
  return root;
}
