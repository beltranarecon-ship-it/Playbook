/* ============================================================
   court.js — pista de fondo + lienzo overlay con coordenadas
   normalizadas [0–1] (§9.4). El motor de animación y el editor de
   colocación comparten esta vista.
   ============================================================ */

import { h } from '../ui/dom.js';

export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// Registro de pistas. baskets en coordenadas normalizadas (§10 tiros norte/sur).
// Coordenadas de aro medidas sobre el arte real de cada SVG (línea de fondo +
// 1.575 m de retranqueo reglamentario), no estimadas a ojo — ver commit que
// introdujo este comentario para la metodología (escaneo de píxeles del PNG
// incrustado). "entera"/"entera_fiba" tienen los aros arriba/abajo (retrato);
// "media"/"media_fiba" están dibujadas en paisaje dentro del lienzo retrato,
// con el aro a la IZQUIERDA (no arriba) — el motor lee x e y del registro sin
// asumir orientación, así que el valor es correcto aunque el nombre "norte"
// ya no describa una posición cardinal real para estas dos pistas.
// escalaJugador: factor de tamaño de las fichas por pista ("entera" = 1 de
// referencia). Las medias pistas dibujan MEDIO campo dentro del MISMO marco
// 210×297 que la entera dibuja el campo COMPLETO: el mismo rasgo físico (p.ej.
// el ancho de la llave) ocupa más unidades de ese marco en la media que en la
// entera — medido sobre el arte real de los SVG (llave y líneas de límites),
// ese zoom lineal es ~1.4× (no 2×: 2× es la lectura "en área" — media pista =
// mitad de superficie real en el mismo lienzo — y zoom lineal = √2 ≈ 1.41,
// que es justo lo medido). Con radio de ficha CONSTANTE en px, esa ficha
// representaría un tamaño real ~1.4× más pequeño en la media que en la
// entera (más unidades de lienzo por metro real ⇒ los mismos px cubren menos
// metros) — así que las fichas se AGRANDAN ×1.4 en la media para representar
// el mismo tamaño real y quedar proporcionadas a la llave/círculos del SVG.
export const PISTAS = {
  entera:      { src: '/taller/assets/pistas/pista-mini-entera.svg', aspect: 210 / 297, label: 'Pista entera',         baskets: { norte: [0.5, 0.098], sur: [0.5, 0.894] }, escalaJugador: 1 },
  media:       { src: '/taller/assets/pistas/pista-mini-mitad.svg',  aspect: 210 / 297, label: 'Media pista',           baskets: { norte: [0.143, 0.497] }, escalaJugador: 1.4 },
  entera_fiba: { src: '/taller/assets/pistas/pista-fiba-entera.svg', aspect: 210 / 297, label: 'Entera · triple FIBA',  baskets: { norte: [0.5, 0.100], sur: [0.5, 0.889] }, escalaJugador: 1 },
  media_fiba:  { src: '/taller/assets/pistas/pista-fiba-mitad.svg',  aspect: 210 / 297, label: 'Media · triple FIBA',   baskets: { norte: [0.141, 0.501] }, escalaJugador: 1.4 },
};

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
