/* ============================================================
   paso1.js — Editor visual del canvas (§7): paleta, requisitos,
   y panel contextual de la ficha seleccionada (cono fila §7.4 /
   dorsal del jugador §7.5).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { palette, requisitos } from '../canvas/palette.js';
import { spinner } from '../ui/components.js';
import { TEAM_LABEL, COLORS } from '../canvas/colors.js';

// 8 direcciones alrededor del cono. 0° = derecha, sentido horario (90 = abajo).
// gx/gy = celda en una rejilla 3×3 con el cono en el centro (2,2).
const DIRS = [
  { a: 225, gx: 1, gy: 1, ch: '↖' }, { a: 270, gx: 2, gy: 1, ch: '↑' }, { a: 315, gx: 3, gy: 1, ch: '↗' },
  { a: 180, gx: 1, gy: 2, ch: '←' }, /* centro: cono */                  { a: 0,   gx: 3, gy: 2, ch: '→' },
  { a: 135, gx: 1, gy: 3, ch: '↙' }, { a: 90,  gx: 2, gy: 3, ch: '↓' }, { a: 45,  gx: 3, gy: 3, ch: '↘' },
];

export function paso1(ctx) {
  const { stage, onDraftChange } = ctx;
  const board = stage.board;
  stage.showBoard();

  const selHost = h('div', { class: 'sel-panel' });

  function renderSel(elm) {
    if (!elm) { mount(selHost, h('p', { class: 'muted' }, 'Selecciona una ficha en la pista para ajustarla.')); return; }
    if (elm.kind === 'jugador') {
      const dorsal = h('input', {
        class: 'input', type: 'number', min: '0', max: '99', placeholder: elm.label,
        value: elm.dorsal ?? '', 'aria-label': 'Dorsal',
        onInput: (e) => { elm.dorsal = e.target.value === '' ? null : e.target.value; board.render(); },
      });
      mount(selHost,
        h('p', { class: 'eyebrow' }, `${TEAM_LABEL[elm.equipo] || elm.equipo} · Jugador ${elm.label}`),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Dorsal'), dorsal),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => { board.remove(elm.id); } }, 'Quitar ficha'),
      );
    } else if (elm.kind === 'cono') {
      // Función del cono: decorativo (estático), fila (cola de jugadores) o
      // rodear (el motor hace que el jugador lo sortee en zigzag).
      const FUNCIONES = [['decorativo', 'Decorativo'], ['fila', 'Fila'], ['rodear', 'Rodear']];
      const setFuncion = (f) => {
        elm.funcion = f;
        if (f === 'fila') ensureFila(elm); else elm.fila_config = null;
        board.render(); renderSel(elm);
      };
      const seg = h('div', { class: 'q-opts' },
        ...FUNCIONES.map(([val, label]) => h('button', {
          class: 'chip' + ((elm.funcion || 'decorativo') === val ? ' is-active' : ''),
          type: 'button', onClick: () => setFuncion(val),
        }, label)),
      );
      const filaCtrls = elm.funcion === 'fila' ? h('div', { class: 'fila-ctrls' },
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Jugadores en cola'),
          spinner({ min: 1, max: 10, value: elm.fila_config?.n_jugadores ?? 3, onChange: (v) => { ensureFila(elm); elm.fila_config.n_jugadores = v; board.render(); } })),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Equipo de la fila'),
          equipoFilaChips(elm.fila_config?.equipo ?? 'A', (t) => { ensureFila(elm); elm.fila_config.equipo = t; board.render(); })),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Dirección de la cola'),
          direccionPad(elm.fila_config?.direccion_grados ?? 0, (a) => { ensureFila(elm); elm.fila_config.direccion_grados = a; board.render(); })),
      ) : null;
      const ayudaRodear = elm.funcion === 'rodear'
        ? h('p', { class: 'muted' }, 'El jugador que trabaje este cono lo rodeará en zigzag al generar la animación.')
        : null;
      mount(selHost,
        h('p', { class: 'eyebrow' }, 'Cono'),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Función'), seg),
        filaCtrls,
        ayudaRodear,
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => board.remove(elm.id) }, 'Quitar ficha'),
      );
    } else {
      mount(selHost, h('p', { class: 'eyebrow' }, 'Balón'), h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => board.remove(elm.id) }, 'Quitar ficha'));
    }
  }
  function ensureFila(elm) {
    if (!elm.fila_config) elm.fila_config = { n_jugadores: 3, direccion_grados: 0, equipo: 'A' };
    if (elm.fila_config.direccion_grados == null) elm.fila_config.direccion_grados = 0;
    if (!elm.fila_config.equipo) elm.fila_config.equipo = 'A';
    elm.funcion = 'fila';
  }

  board.on('select', renderSel);
  board.on('change', () => onDraftChange?.());
  renderSel(board.get(board.selected));

  const el = h('div', { class: 'flow' },
    h('div', { class: 'card flow' },
      h('p', { class: 'eyebrow' }, 'Paso 1'),
      h('h2', { class: 'section-title' }, 'Coloca a los jugadores'),
      h('p', { class: 'muted' }, 'Pulsa un elemento y haz clic en la pista. Arrastra para recolocar; Supr para quitar.'),
      palette(board),
    ),
    requisitos(board),
    h('div', { class: 'card' }, selHost),
  );

  return { el };
}

/* ---- Pad de dirección de la fila (§7.4): cono al centro, 8 flechas ---- */
function direccionPad(value, onChange) {
  const grid = h('div', { class: 'dir-pad' });
  const cono = h('span', { class: 'dir-pad__cono', style: 'grid-area:2/2', 'aria-hidden': 'true' }, '▲');
  const paint = (val) => grid.replaceChildren(cono, ...DIRS.map((d) => h('button', {
    class: 'dir-pad__btn' + (d.a === val ? ' is-active' : ''), type: 'button',
    style: `grid-area:${d.gy}/${d.gx}`, 'aria-label': `Dirección ${d.a}°`,
    onClick: () => { onChange(d.a); paint(d.a); },
  }, d.ch)));
  paint(value);
  return grid;
}

/* ---- Selector de equipo de la fila ---- */
function equipoFilaChips(value, onChange) {
  const row = h('div', { class: 'q-opts' });
  const paint = (val) => row.replaceChildren(...['A', 'B', 'C', 'D'].map((t) => h('button', {
    class: 'chip team-chip' + (t === val ? ' is-active' : ''), type: 'button',
    style: `--c:${COLORS[t]}`, title: TEAM_LABEL[t],
    onClick: () => { onChange(t); paint(t); },
  }, h('span', { class: 'team-dot' }), TEAM_LABEL[t].replace('Equipo ', 'E'))));
  paint(value);
  return row;
}
