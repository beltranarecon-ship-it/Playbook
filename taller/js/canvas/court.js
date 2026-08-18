/* ============================================================
   court.js — pista de fondo + lienzo overlay con coordenadas
   normalizadas [0–1] (§9.4). El motor de animación y el editor de
   colocación comparten esta vista.
   ============================================================ */

import { h } from '../ui/dom.js';
import { REGLAS, PISTAS_M, marcoDe, pistaANorm } from './medidas.js';

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/*
   Registro de pistas. Todo lo geométrico —relación de aspecto y posición
   de los aros— sale ahora de canvas/medidas.js, que es también de donde
   salen los SVG de fondo y las anclas: una sola tabla de medidas, tres
   consumidores. Antes cada cosa se medía por su cuenta sobre el dibujo y
   no coincidían entre sí.

   `baskets` sigue siendo lo que era: coordenadas normalizadas del centro
   del aro, por canasta (§10 tiros norte/sur). Media docena de módulos las
   leen (compilador, validador, simulador, cliente, paso 2, stage), así
   que la forma no cambia; solo el número, que ahora es exacto.

   "entera"/"entera_fiba" llevan los aros arriba y abajo (retrato);
   "media"/"media_fiba" van en paisaje con el aro a la IZQUIERDA — el
   motor lee x e y sin asumir orientación, así que el nombre "norte" es
   solo una etiqueta, no una posición cardinal.

   Ya no hay `escalaJugador`: era un parche para que las fichas no se
   vieran enanas en la media, que estaba dibujada a otro zoom que la
   entera. Ahora las cuatro pistas están a escala y los elementos se
   dimensionan en METROS (medidas.js → TAMANOS), así que un jugador
   ocupa lo mismo en las cuatro.
*/
const SRC = {
  entera:      '/taller/assets/pistas/pista-entera.svg',
  media:       '/taller/assets/pistas/pista-media.svg',
  entera_fiba: '/taller/assets/pistas/pista-entera-fiba.svg',
  media_fiba:  '/taller/assets/pistas/pista-media-fiba.svg',
};
const LABEL = {
  entera:      'Pista entera',
  media:       'Media pista',
  entera_fiba: 'Entera · triple FIBA',
  media_fiba:  'Media · triple FIBA',
};

export const PISTAS = Object.fromEntries(Object.keys(PISTAS_M).map((k) => {
  const m = marcoDe(k);
  const baskets = {};
  for (const c of m.canastas) {
    const [x, y] = pistaANorm(k, REGLAS.aroRetranqueo, 0, c);
    baskets[c] = [Number(x.toFixed(4)), Number(y.toFixed(4))];
  }
  return [k, { src: SRC[k], aspect: m.aspect, label: LABEL[k], baskets, metros: { ancho: m.ancho, alto: m.alto } }];
}));

export class CourtView {
  // rotate=90 dibuja la pista en paisaje (modo proyector §14): se gira solo la
  // imagen de fondo por CSS (.court--landscape) y se rotan las coordenadas en
  // toPx; los símbolos siguen dibujándose DERECHOS (no se rota el canvas), así
  // que los dorsales quedan legibles. Rotación 90° horaria: (x,y) → (1−y, x).
  constructor({ pista = 'entera', rotate = 0 } = {}) {
    this.rot = rotate === 90 ? 90 : 0;
    this.bg = h('div', { class: 'court__bg' });
    this.canvas = h('canvas', { class: 'court__layer' });
    this.root = h('div', { class: 'court' + (this.rot ? ' court--landscape' : '') }, this.bg, this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    this.onResize = null;
    this.setPista(pista);
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this.root);
  }

  setPista(key) {
    this.pistaKey = key in PISTAS ? key : 'entera';
    this.pista = PISTAS[this.pistaKey];
    this.bg.style.backgroundImage = `url("${this.pista.src}")`;
    // en paisaje el lienzo invierte la relación de aspecto (apaisado).
    const aspect = this.rot ? (1 / this.pista.aspect) : this.pista.aspect;
    this.root.style.setProperty('--court-aspect', String(aspect));
    // El fondo girado 90° se dimensiona con la relación SIN invertir (el
    // CSS lo necesita para rellenar la caja apaisada). Antes iba con dos
    // porcentajes fijos —70.71 % y 141.42 %— que solo valen si todas las
    // pistas son A4; ahora cada una tiene la suya.
    this.root.style.setProperty('--court-bg-aspect', String(this.pista.aspect));
    this._resize();
  }

  _resize() {
    const r = this.root.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.onResize) this.onResize();
  }

  toPx(x, y) { return this.rot ? [(1 - y) * this.w, x * this.h] : [x * this.w, y * this.h]; }
  toNorm(px, py) { return this.rot ? [clamp01(py / this.h), clamp01(1 - px / this.w)] : [clamp01(px / this.w), clamp01(py / this.h)]; }
  pointerNorm(ev) {
    const r = this.canvas.getBoundingClientRect();
    return this.toNorm(ev.clientX - r.left, ev.clientY - r.top);
  }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
  basket(which) { return this.pista.baskets[which] || this.pista.baskets.norte; }
  destroy() { this._ro.disconnect(); }
}
