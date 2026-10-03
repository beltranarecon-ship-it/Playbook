/* ============================================================
   pizarra/iconos.js — los iconos de la Pizarra.

   Líneas de una sola figura en una rejilla de 24×24, para que se
   lean igual de claras a 16 px en la barra que a 22 px en una casilla
   del menú de acciones. Heredan el color del texto (`currentColor`),
   así que lo que los tiñe es el CSS, no esta lista.

   Antes la barra y el menú usaban letras y símbolos de texto (⛹ ➜ ◎ ⇥
   ↯…), que cada sistema dibuja a su manera y que a 20 px no se
   distinguen unos de otros. Los dibujos propios sí se distinguen, y se
   ven iguales en un ordenador, en una tablet y en un móvil.

   No toca el DOM más que para crear el <svg>, y no tiene banco propio:
   es una lista de dibujos, no lógica.
   ============================================================ */

import { h } from '../ui/dom.js';

const P = (d) => ['path', { d }];
const C = (cx, cy, r) => ['circle', { cx, cy, r }];
const R = (x, y, width, height, rx = 0) => ['rect', { x, y, width, height, rx }];
const L = (x1, y1, x2, y2) => ['line', { x1, y1, x2, y2 }];
/* Un punto relleno: el trazo de 2 px no lo dibuja bien con un círculo vacío. */
const PUNTO = (cx, cy, r = 1.4) => ['circle', { cx, cy, r, fill: 'currentColor', stroke: 'none' }];

export const FORMAS = {
  /* ── La barra y los paneles ─────────────────────────────── */
  deshacer: [P('M9 14 4 9l5-5'), P('M4 9h10.5a5.5 5.5 0 0 1 0 11H11')],
  rehacer: [P('m15 14 5-5-5-5'), P('M20 9H9.5a5.5 5.5 0 0 0 0 11H13')],
  alejar: [C(11, 11, 7), L(21, 21, 16.2, 16.2), L(8, 11, 14, 11)],
  acercar: [C(11, 11, 7), L(21, 21, 16.2, 16.2), L(8, 11, 14, 11), L(11, 8, 11, 14)],
  encajar: [P('M8 3H5a2 2 0 0 0-2 2v3'), P('M16 3h3a2 2 0 0 1 2 2v3'), P('M8 21H5a2 2 0 0 1-2-2v-3'), P('M16 21h3a2 2 0 0 0 2-2v-3')],
  reproducir: [['polygon', { points: '7 4 19 12 7 20', fill: 'currentColor' }]],
  repetir: [P('M3 12a9 9 0 1 0 3-6.7'), P('M3 4v5h5')],
  fantasma: [R(9, 9, 13, 13, 2), P('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')],
  izquierda: [P('m15 18-6-6 6-6')],
  derecha: [P('m9 18 6-6-6-6')],
  mas: [PUNTO(5, 12), PUNTO(12, 12), PUNTO(19, 12)],
  cerrar: [P('M18 6 6 18'), P('m6 6 12 12')],
  ok: [P('m5 12.5 4.5 4.5L19 7')],
  ajustes: [P('M4 6h8'), P('M16 6h4'), C(14, 6, 2), P('M4 12h2'), P('M10 12h10'), C(8, 12, 2), P('M4 18h10'), P('M18 18h2'), C(16, 18, 2)],
  fases: [P('M4 6h9'), P('M9 12h11'), P('M6 18h8')],
  texto: [P('M4 6h16'), P('M4 12h16'), P('M4 18h10')],
  buscar: [C(11, 11, 7), L(21, 21, 16.2, 16.2)],
  mas_fase: [P('M12 5v14'), P('M5 12h14')],
  flecha: [P('M5 12h14'), P('m13 6 6 6-6 6')],
  rama: [L(6, 3, 6, 15), C(18, 6, 3), C(6, 18, 3), P('M18 9a9 9 0 0 1-9 9')],
  reunir: [C(18, 18, 3), C(6, 6, 3), P('M6 9v3a6 6 0 0 0 6 6h3')],
  duplicar: [R(9, 9, 13, 13, 2), P('M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1')],
  guardar: [P('m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z')],
  papelera: [P('M3 6h18'), P('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'), P('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2')],
  antes: [P('M4 5v14'), P('M20 12H9'), P('m13 7-5 5 5 5')],
  despues: [P('M20 5v14'), P('M4 12h11'), P('m11 7 5 5-5 5')],
  vertical: [PUNTO(12, 5), PUNTO(12, 12), PUNTO(12, 19)],

  /* ── Las acciones ───────────────────────────────────────── */
  bota: [C(12, 12, 9), P('M3 12h18'), P('M12 3v18'), P('M5.6 5.6a10 10 0 0 1 0 12.8'), P('M18.4 5.6a10 10 0 0 0 0 12.8')],
  pasa: [PUNTO(4.5, 12, 1.5), P('M8 12h11'), P('m14 7 5 5-5 5')],
  tira: [C(12, 12, 9), C(12, 12, 4.5), PUNTO(12, 12, 1)],
  entra: [P('M4 12h11'), P('m10 7 5 5-5 5'), P('M20 5v14')],
  finta: [P('m3 17 5-9 5 8 7-10'), P('M16 6h5v5')],
  para: [R(6, 6, 12, 12, 2.5)],
  corta: [P('M4 20c0-7 4-11 11-11h4'), P('m15 5 4 4-4 4')],
  bloquea: [R(9, 4, 6, 16, 1.5), P('M2 12h4'), P('m4 10 2 2-2 2')],
  recoge: [C(12, 17, 4.5), P('M12 2v7'), P('m9 6 3 3 3-3')],
  vuelve_a_fila: [P('M9 14 4 9l5-5'), P('M4 9h10a6 6 0 0 1 6 6v4')],
  pivota: [P('M21 12a9 9 0 1 1-3-6.7'), P('M21 4v5h-5')],
  defiende: [P('M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z')],
  rodea: [P('M2 12c2.5-7 5.5-7 8 0s5.5 7 8 0'), P('m18 8.5 3.5 3.5-3.5 3.5')],
  cambia_de_mano: [P('M4 8h15'), P('m15 4 4 4-4 4'), P('M20 16H5'), P('m9 12-4 4 4 4')],
  protege: [C(9.5, 12, 3.5), P('M15 5a9 9 0 0 1 0 14')],
  ayuda: [P('M3 12h18'), P('m7 8-4 4 4 4'), P('m17 8 4 4-4 4')],
  sobrepasado: [P('M3 12h2'), P('M8 12h2'), P('M13 12h4'), P('m16 8 4 4-4 4')],
  cambia_marca: [C(6.5, 6.5, 2.5), C(17.5, 17.5, 2.5), P('M9.5 6.5H14a3 3 0 0 1 3 3v2'), P('m15 10 2 2 2-2'), P('M14.5 17.5H10a3 3 0 0 1-3-3v-2'), P('m9 14-2-2-2 2')],
  cierra_rebote: [P('M5 6h14l-2.5 11h-9z'), P('m10 6 1 11'), P('m14 6-1 11')],
  dos_contra_uno: [C(7.5, 8, 2.8), C(16.5, 8, 2.8), C(12, 17, 2.8)],
  roba: [P('M3 12h4'), P('M17 12h4'), P('m9.5 8 5 8'), P('m14.5 8-5 8')],
  /* La que no tiene dibujo propio (una acción del club): una flecha. */
  punto: [P('M5 12h14'), P('m13 6 6 6-6 6')],
};

/* Qué dibujo lleva una acción de una familia cuando no tiene el suyo:
   las del club heredan el de su familia. */
const DE_FAMILIA = {
  desplazamiento: 'corta',
  balon: 'pasa',
  entre_dos: 'defiende',
  gesto: 'pivota',
};

/** El nombre del dibujo de una acción: el suyo, o el de su familia. */
export function nombreDeIcono(slug, familia = null) {
  if (FORMAS[slug]) return slug;
  return DE_FAMILIA[familia] || 'punto';
}

/**
 * Un <svg> con el dibujo `nombre`.
 * @param opciones.size   lado en píxeles
 * @param opciones.trazo  grosor del trazo, en unidades de la rejilla de 24
 */
export function icono(nombre, { size = 18, trazo = 2 } = {}) {
  const formas = FORMAS[nombre] || FORMAS.punto;
  return h('svg', {
    class: 'pz-ico', width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', 'stroke-width': trazo, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    'aria-hidden': 'true', focusable: 'false',
  }, ...formas.map(([etiqueta, atributos]) => h(etiqueta, atributos)));
}
