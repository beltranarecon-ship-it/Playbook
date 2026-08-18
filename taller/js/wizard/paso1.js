/* ============================================================
   paso1.js — Editor visual del canvas (§7): paleta, requisitos,
   y panel contextual de la ficha seleccionada (cono fila §7.4 /
   dorsal del jugador §7.5).
   ============================================================ */

import { h, mount } from '../ui/dom.js';
import { palette, requisitos } from '../canvas/palette.js';
import { spinner } from '../ui/components.js';
import { repartirSobre, largoMetros, TIPOS_ZONA } from '../canvas/zonas.js';
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

        /* Rondas (Tramo 2.8). Se describe UNA salida y el motor la repite
           con el siguiente hasta que han salido todos. Es lo que convierte
           un turno suelto en la rueda que de verdad se hace en pista. */
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Repetición'),
          h('div', { class: 'q-opts' },
            h('button', {
              class: 'chip' + (elm.fila_config?.rondas ? ' is-active' : ''), type: 'button',
              'aria-pressed': String(Boolean(elm.fila_config?.rondas)),
              onClick: () => { ensureFila(elm); elm.fila_config.rondas = !elm.fila_config.rondas; board.render(); renderSel(elm); },
            }, elm.fila_config?.rondas
              ? `Salen los ${elm.fila_config?.n_jugadores ?? 3}, uno detrás de otro`
              : 'Solo sale el primero'))),

        elm.fila_config?.rondas ? h('div', { class: 'field' },
          h('label', { class: 'field__label' }, 'Cadencia de salida (segundos)'),
          h('input', {
            class: 'input', type: 'number', min: '0', max: '30', step: '0.5',
            placeholder: 'en blanco: sale cuando vuelve el anterior',
            value: elm.fila_config?.cadencia_s ?? '',
            onInput: (e) => {
              ensureFila(elm);
              const v = e.target.value === '' ? null : Number(e.target.value);
              elm.fila_config.cadencia_s = Number.isFinite(v) && v > 0 ? v : null;
            },
          })) : null,

        // Fila de defensores: el rol lo da de qué cola sale, no lo que
        // haga ese turno.
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Qué son'),
          h('div', { class: 'q-opts' }, ...[['atacante', 'Atacantes'], ['defensor', 'Defensores']].map(([val, txt]) => h('button', {
            class: 'chip' + ((elm.fila_config?.rol || 'atacante') === val ? ' is-active' : ''),
            type: 'button',
            onClick: () => { ensureFila(elm); elm.fila_config.rol = val; board.render(); renderSel(elm); },
          }, txt)))),
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
    } else if (elm.kind === 'zona') {
      const ETIQ = { rect: 'Rectángulo', circulo: 'Círculo', linea: 'Línea' };
      const nombre = h('input', {
        class: 'input', type: 'text', maxlength: '32', value: elm.nombre ?? '',
        'aria-label': 'Nombre de la zona',
        onInput: (e) => { elm.nombre = e.target.value; board.render(); },
      });
      const forma = h('div', { class: 'q-opts' }, ...TIPOS_ZONA.map((t) => h('button', {
        class: 'chip' + (elm.tipo === t ? ' is-active' : ''), type: 'button',
        onClick: () => { elm.tipo = t; board.render(); renderSel(elm); },
      }, ETIQ[t])));

      // Interruptor de zona invisible: sigue existiendo como sitio al que
      // referirse y sobre el que repartir conos, pero no se dibuja en la
      // animación. Es para las zonas que son una regla y no un decorado.
      const visible = h('button', {
        class: 'chip' + (elm.visible !== false ? ' is-active' : ''), type: 'button',
        'aria-pressed': String(elm.visible !== false),
        onClick: () => { elm.visible = elm.visible === false; board.render(); renderSel(elm); },
      }, elm.visible !== false ? 'Se ve en la animación' : 'Invisible');

      // Repartir conos por el contorno, a distancia regular EN METROS.
      // Colocarlos a ojo uno a uno es lo que hace que un pasillo de conos
      // salga torcido y que el ejercicio no se pueda repetir igual.
      let cuantos = 4;
      const largo = largoMetros(board.view.pistaKey, elm);
      const repartir = () => {
        for (const p of repartirSobre(board.view.pistaKey, elm, cuantos)) {
          board.add({ kind: 'cono' }, p.x, p.y);
        }
        board.select(elm.id);
      };
      mount(selHost,
        h('p', { class: 'eyebrow' }, 'Zona'),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Nombre'), nombre),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Forma'), forma),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'En la animación'), visible),
        h('p', { class: 'muted' }, `Contorno: ${largo.toFixed(1)} m.`),
        h('div', { class: 'field' },
          h('label', { class: 'field__label' }, 'Repartir conos por el contorno'),
          h('div', { class: 'fila-ctrls' },
            spinner({ min: 1, max: 20, value: cuantos, onChange: (v) => { cuantos = v; } }),
            h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: repartir }, 'Repartir'))),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => board.remove(elm.id) }, 'Quitar zona'),
      );
    } else if (elm.kind === 'escalera') {
      // La escalera mide 4 m: cómo esté puesta cambia por dónde pasa la fila,
      // así que la orientación es lo único que hay que poder tocar.
      mount(selHost,
        h('p', { class: 'eyebrow' }, 'Escalera de coordinación'),
        h('p', { class: 'muted' }, '4,00 × 0,50 m, a escala.'),
        h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Orientación'),
          direccionPad(elm.rot ?? 0, (a) => { elm.rot = a; board.render(); })),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => board.remove(elm.id) }, 'Quitar ficha'),
      );
    } else if (elm.kind === 'pelota') {
      mount(selHost,
        h('p', { class: 'eyebrow' }, 'Pelota de tenis'),
        h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => board.remove(elm.id) }, 'Quitar ficha'));
    } else {
      mount(selHost, h('p', { class: 'eyebrow' }, 'Balón'), h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onClick: () => board.remove(elm.id) }, 'Quitar ficha'));
    }
  }
  function ensureFila(elm) {
    if (!elm.fila_config) elm.fila_config = { n_jugadores: 3, direccion_grados: 0, equipo: 'A', rondas: false, cadencia_s: null, rol: 'atacante' };
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
