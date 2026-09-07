/* ============================================================
   court.js — pista de fondo + lienzo overlay con coordenadas
   normalizadas [0–1] (§9.4). El motor de animación y el editor de
   colocación comparten esta vista.
   ============================================================ */

import { h } from '../ui/dom.js';
import { REGLAS, PISTAS_M, marcoDe, pistaANorm } from './medidas.js';
import {
  neutro, ajustar, proyectar, despoyectar, anchoPista, altoPista,
  zoomA as encZoomA, desplazar, limitar, pellizcar, ventana as encVentana,
  hairline as encHairline, guardable, desdeGuardado,
} from './encuadre.js';

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
  constructor({ pista = 'entera', rotate = 0, encuadre = false } = {}) {
    this.rot = rotate === 90 ? 90 : 0;
    /* ── MODO ENCUADRE LIBRE (§3.1) ───────────────────────────
       Apagado, la vista es la de siempre: una caja con la FORMA de la
       pista, que la pista llena entera. Encendido, la vista es un
       HUECO —lo que sobre entre los paneles de la Pizarra— dentro del
       cual la pista se encaja, se acerca y se arrastra.

       Es una bandera y no una clase aparte porque lo único que cambia
       es de dónde sale el encuadre: la conversión de coordenadas, el
       lienzo, el giro y el dibujo son exactamente los mismos. */
    this.encuadreLibre = !!encuadre;
    this.bg = h('div', { class: 'court__bg' });
    this.canvas = h('canvas', { class: 'court__layer' });
    this.root = h('div', {
      class: 'court'
        + (this.rot ? ' court--landscape' : '')
        + (this.encuadreLibre ? ' court--encuadre' : ''),
    }, this.bg, this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.w = 0; this.h = 0; this.dpr = 1;
    /* ── LA VENTANA Y LA PISTA DEJAN DE SER LO MISMO ──────────
       Hasta ahora `w` y `h` significaban dos cosas a la vez: el
       tamaño del lienzo y el tamaño de la pista. Coincidían porque la
       pista siempre ocupaba el lienzo entero.

       La Pizarra (§3.1) necesita separarlas: con zoom, la pista es
       mayor que la ventana y solo se ve un trozo. Así que ahora
       `vw`/`vh` son LA VENTANA (el lienzo) y `w`/`h` siguen siendo LA
       PISTA, que es lo que consumen `radii()` y `pxPorMetro()`.

       En este modo —el único que existe hoy— la pista ocupa la
       ventana entera, así que `w === vw` y `h === vh` y nadie nota
       nada. La comprobación de que eso es cierto al carácter está en
       taller/tools/eval-encuadre.mjs. */
    this.vw = 0; this.vh = 0;
    this.enc = neutro(this.w, this.h, this.rot);
    this.onResize = null;
    /* Hueco aparte del de redimensionar: mover o acercar la pista NO
       cambia el tamaño del lienzo, así que quien dibuja necesita
       enterarse por otro sitio. Un solo hueco, como `onResize`. */
    this.onEncuadre = null;
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
    this.vw = r.width; this.vh = r.height;
    this._reencuadrar();
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.onResize) this.onResize();
  }

  /**
   * Rehace el encuadre a partir del tamaño de la ventana.
   *
   * En modo clásico la pista ocupa la ventana entera, así que el
   * encuadre es el NEUTRO y `w`/`h` salen valiendo `vw`/`vh` — los
   * mismos números de siempre.
   *
   * Va aquí y no dentro de `_resize` porque `_resize` sale sin hacer
   * nada cuando el lienzo mide 0×0 (un panel plegándose, el cajón del
   * móvil, la pestaña oculta), y en ese caso el encuadre NO se puede
   * tocar: reiniciarlo ahí haría que al desplegar un panel se perdiera
   * el sitio donde estabas mirando, y parecería un fallo aleatorio.
   */
  _reencuadrar() {
    if (!this.encuadreLibre) {
      this.enc = neutro(this.vw, this.vh, this.rot);
    } else {
      /* La BASE (la pista encajada) se recalcula siempre desde la
         ventana de ahora, porque la ventana cambia al plegar un panel
         o al girar la tablet. El zoom y el desplazamiento del
         entrenador se conservan y se vuelven a recortar: perder el
         sitio donde estabas mirando por haber plegado un panel se lee
         como un fallo, no como una decisión. */
      const base = ajustar({ vw: this.vw, vh: this.vh, aspect: this.pista.aspect, rot: this.rot });
      this.enc = desdeGuardado(base, guardable(this.enc), this.vw, this.vh);
    }
    this.w = anchoPista(this.enc);
    this.h = altoPista(this.enc);
    if (this.encuadreLibre) this._pintarFondo();
  }

  /**
   * Coloca la imagen de la pista donde diga el encuadre.
   *
   * En modo clásico no se toca: el fondo llena el elemento entero por
   * CSS y ya está. En modo encuadre el fondo es un rectángulo dentro
   * de un hueco mayor, así que hay que darle sitio y tamaño a mano.
   *
   * Girado 90° el rectángulo del fondo es el TRASPUESTO del de la
   * pista —alto por ancho— y se gira sobre su centro, que es la misma
   * cuenta que hace hoy `.court--landscape .court__bg` con
   * porcentajes; aquí va en píxeles porque el contenedor ya no tiene
   * la forma de la pista.
   *
   * ── LA INCÓGNITA, YA MEDIDA ───────────────────────────────
   * Quedaba por saber si el navegador rasteriza el TILE ENTERO de un
   * `background-size` grande o solo lo visible. Si fuera lo primero,
   * al 400 % se dispararía la memoria y el gesto se atascaría, y
   * habría que mover el fondo con `transform` durante el gesto.
   *
   * Medido en un navegador de verdad con dev/pizarra-encuadre.html,
   * pista entera girada 90°, 200 fichas, dpr 1:
   *
   *     zoom   pintado   gesto p50/p95   memoria del lienzo
   *      50 %   1,09 ms   13,3 / 14,6     1,8 MB
   *     100 %   0,98 ms   13,3 / 14,4     1,8 MB
   *     400 %   0,19 ms   13,3 / 13,7     1,8 MB
   *
   * El p50 clavado en 13,3 ms es la cadencia de la pantalla (75 Hz),
   * no trabajo: el fondo NO se está rasterizando entero. Aguanta, y la
   * red de seguridad del `transform` no hace falta. Si algún día
   * aparece un navegador que sí lo haga, el sitio de arreglarlo es
   * este método y solo este.
   */
  _pintarFondo() {
    const s = this.bg.style;
    const cx = this.enc.ox + this.w / 2;
    const cy = this.enc.oy + this.h / 2;
    if (this.rot === 90) {
      s.left = `${cx - this.h / 2}px`;
      s.top = `${cy - this.w / 2}px`;
      s.width = `${this.h}px`;
      s.height = `${this.w}px`;
      s.transform = 'rotate(90deg)';
    } else {
      s.left = `${this.enc.ox}px`;
      s.top = `${this.enc.oy}px`;
      s.width = `${this.w}px`;
      s.height = `${this.h}px`;
      s.transform = 'none';
    }
  }

  /* ---- lo que solo usa el modo encuadre (§3.1) ----------------
     Nada de esto lo llama todavía nadie: la Pizarra se monta encima en
     el paso siguiente. En modo clásico siguen funcionando —el
     encuadre neutro es un encuadre válido—, simplemente no hacen
     nada interesante. */

  /** Como `toNorm`, pero SIN recortar a [0,1]: ver encuadre.js. */
  toNormRaw(px, py) { return despoyectar(this.enc, px, py); }

  /** Píxeles del lienzo bajo el puntero (sin convertir a normalizado). */
  pointerPx(ev) {
    const r = this.canvas.getBoundingClientRect();
    return [ev.clientX - r.left, ev.clientY - r.top];
  }

  /**
   * El puntero en normalizado, sin recortar. Es el que usa el acierto
   * sobre fichas: recortar al borde haría que un clic en la banda
   * pareciera un clic en la línea de fondo.
   */
  pointerNormRaw(ev) {
    const [px, py] = this.pointerPx(ev);
    return this.toNormRaw(px, py);
  }

  /** Qué trozo de pista se ve, en normalizado (para no dibujar el resto). */
  ventana() { return encVentana(this.enc, this.vw, this.vh); }

  /** Grosor de una línea que debe medir un píxel en pantalla. */
  hairline(v = 1) { return encHairline(v, this.dpr); }

  /**
   * Acerca o aleja dejando quieto un punto de la PANTALLA. Sin punto,
   * el centro de la ventana.
   */
  zoomA(escala, cx = this.vw / 2, cy = this.vh / 2) {
    if (!this.encuadreLibre) return;
    this._aplicar(limitar(encZoomA(this.enc, escala, cx, cy), this.vw, this.vh));
  }

  /** Arrastra la pista por un incremento en píxeles de pantalla. */
  desplazarPx(dx, dy) {
    if (!this.encuadreLibre) return;
    this._aplicar(limitar(desplazar(this.enc, dx, dy), this.vw, this.vh));
  }

  /**
   * Escalar y mover A LA VEZ: el pellizco de dos dedos, que abre la
   * mano y se desplaza en el mismo gesto.
   *
   * Existe como método propio y no como `zoomA` seguido de
   * `desplazarPx` porque cada uno de esos recorta por su cuenta, y con
   * dos recortes por fotograma el punto que hay bajo los dedos se
   * escapa contra el tope. Aquí el recorte es uno solo, al final
   * (canvas/encuadre.js#pellizcar).
   */
  pellizco(escala, cx, cy, dx, dy) {
    if (!this.encuadreLibre) return;
    this._aplicar(pellizcar(this.enc, escala, cx, cy, dx, dy, this.vw, this.vh));
  }

  /** Vuelve a la pista entera, encajada y centrada. */
  encajarPista() {
    if (!this.encuadreLibre) return;
    this._aplicar(ajustar({ vw: this.vw, vh: this.vh, aspect: this.pista.aspect, rot: this.rot }));
  }

  /** El encuadre para guardarlo (localStorage, NO el JSON de la jugada). */
  encuadreActual() { return guardable(this.enc); }

  /** Repone un encuadre guardado sobre la ventana de ahora. */
  ponerEncuadre(g) {
    if (!this.encuadreLibre) return;
    const base = ajustar({ vw: this.vw, vh: this.vh, aspect: this.pista.aspect, rot: this.rot });
    this._aplicar(desdeGuardado(base, g, this.vw, this.vh));
  }

  /* El único sitio por el que se cambia el encuadre en caliente: deja
     `w`/`h` al día, recoloca el fondo y avisa. No toca el lienzo —el
     tamaño no ha cambiado—, así que no pasa por `_resize`. */
  _aplicar(enc) {
    this.enc = enc;
    this.w = anchoPista(enc);
    this.h = altoPista(enc);
    this._pintarFondo();
    if (this.onEncuadre) this.onEncuadre();
  }

  /* La cuenta ya no vive aquí: la hace canvas/encuadre.js, que es un
     módulo puro y por tanto se puede probar en Node. Con el encuadre
     neutro estas dos líneas dan exactamente lo mismo que las que
     había —el banco compara contra la fórmula antigua copiada a mano,
     en los dos giros—, y cuando la Pizarra pida zoom será el mismo
     código el que lo aplique. */
  toPx(x, y) { return proyectar(this.enc, x, y); }
  toNorm(px, py) { const [x, y] = despoyectar(this.enc, px, py); return [clamp01(x), clamp01(y)]; }
  pointerNorm(ev) {
    const r = this.canvas.getBoundingClientRect();
    return this.toNorm(ev.clientX - r.left, ev.clientY - r.top);
  }
  clear() { this.ctx.clearRect(0, 0, this.vw, this.vh); }
  basket(which) { return this.pista.baskets[which] || this.pista.baskets.norte; }
  destroy() { this._ro.disconnect(); }
}
