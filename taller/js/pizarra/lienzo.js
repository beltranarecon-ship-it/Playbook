/* ============================================================
   pizarra/lienzo.js — el lienzo de la Pizarra (§3.1).

   Es el dueño de la CourtView en modo encuadre y el único sitio por el
   que se pinta. Todo lo demás —selección, imán, trazos, fichas— se
   cuelga de aquí como CAPAS y no sabe nada de zoom ni de píxeles.

   ── LAS DOS CLASES DE CAPA ──────────────────────────────────
   · MUNDO    dibuja sobre la pista: fichas, trazos, zonas. Crece con
              el zoom, porque sus tamaños salen de `R` (que sale de
              `view.w`, que es la pista al zoom actual). Recibe qué
              trozo se ve para no dibujar lo que no cabe.
   · PANTALLA dibuja sobre el cristal: el marco de selección, las guías
              de alineación, los rótulos. NO crece con el zoom — un
              marco de selección de 1 px mide 1 px al 50 % y al 400 %.

   Confundirlas es el error clásico de un editor con zoom: o el marco
   de selección se vuelve gordísimo al acercar, o las fichas no crecen.
   Por eso son dos listas y no una con una bandera.

   ── LA REGLA DE ORO PARA QUIEN ESCRIBA UNA CAPA ─────────────
   Dibujar SOLO con `toPx()` y con los radios de `R`. Nunca con
   `vista.vw`/`vh`, y nunca multiplicando por la escala a mano. Si una
   capa necesita saber el zoom para dibujar, casi seguro que es una
   capa de pantalla mal puesta en mundo.
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView } from '../canvas/court.js';
import { seVe, pasoRejilla, lineasRejilla } from '../canvas/encuadre.js';
import { pxPorMetro, marcoDe } from '../canvas/medidas.js';
import { radii } from '../canvas/symbols.js';

/* A partir de este zoom aparece la rejilla de metros. Por debajo se ve
   la pista entera o casi, y sus propias líneas ya dicen dónde está
   todo; la rejilla solo ensuciaría. */
export const ZOOM_REJILLA = 1.5;

/* Cuánto acerca un paso de rueda o una pulsación de «+». Un 15 % es lo
   que se siente como «un punto más» sin marearse; el navegador manda
   deltas muy distintos según el ratón, así que la rueda se normaliza
   antes de llegar aquí. */
const PASO_ZOOM = 1.15;
const PASO_TECLA = 60;      // px que desplaza una flecha del teclado

export class Lienzo {
  /**
   * @param pista   clave de pista ('entera', 'media'…)
   * @param rotate  0 | 90
   * @param rejilla si se dibuja la rejilla de metros al acercar
   */
  constructor({ pista = 'entera', rotate = 0, rejilla = true } = {}) {
    this.vista = new CourtView({ pista, rotate, encuadre: true });
    this.el = h('div', { class: 'pz-lienzo', tabindex: '0' }, this.vista.root);
    this.conRejilla = rejilla;

    this._mundo = [];
    this._pantalla = [];
    this._pendiente = false;
    this._raf = null;
    this._reloj = null;
    this._arrastre = null;
    this._espacio = false;
    this._espacioUsado = false;

    /** Aviso de que el encuadre ha cambiado: lo escucha la barra que
     *  enseña el porcentaje, y quien guarde el encuadre. */
    this.onEncuadre = null;

    this.vista.onResize = () => this.pintar();
    this.vista.onEncuadre = () => { this.pintar(); this.onEncuadre?.(this.zoom()); };

    this._atar();
  }

  /* ---- capas ------------------------------------------------- */

  /**
   * Registra una capa. `dibujar` recibe un solo objeto con todo lo que
   * necesita, para que ninguna capa tenga que ir a buscar nada:
   *
   *   { ctx, vista, R, vis, metro, hairline, toPx, seVe }
   *
   * `orden` decide quién va encima de quién (mayor, más arriba).
   * Devuelve una función que la quita.
   */
  capa(nombre, dibujar, { tipo = 'mundo', orden = 0 } = {}) {
    const lista = tipo === 'pantalla' ? this._pantalla : this._mundo;
    const capa = { nombre, dibujar, orden };
    lista.push(capa);
    lista.sort((a, b) => a.orden - b.orden);
    this.pintar();
    return () => this.quitarCapa(nombre);
  }

  quitarCapa(nombre) {
    this._mundo = this._mundo.filter((c) => c.nombre !== nombre);
    this._pantalla = this._pantalla.filter((c) => c.nombre !== nombre);
    this.pintar();
  }

  /* ---- pintado ----------------------------------------------- */

  /**
   * Pide un repintado. Muchas peticiones seguidas se funden en una:
   * durante un arrastre llegan decenas por segundo y pintar en todas
   * es tirar trabajo.
   *
   * Se pide por fotograma y, además, por reloj. No es cinturón y
   * tirantes: hay entornos —paneles incrustados, pestañas que no
   * componen— donde `requestAnimationFrame` NO dispara nunca aunque
   * la página se declare visible, y sin el reloj la pizarra se
   * quedaría en blanco sin decir por qué. Gana el primero que llegue.
   */
  pintar() {
    if (this._pendiente) return;
    this._pendiente = true;
    const hacer = () => { if (this._pendiente) { this._pendiente = false; this._pintarYa(); } };
    this._raf = requestAnimationFrame(hacer);
    this._reloj = setTimeout(hacer, 50);
  }

  /** Pinta AHORA, sin esperar al fotograma. La usan `medir()` y los
   *  arneses que cronometran: para medir hay que pintar cuando se
   *  dice, no cuando el navegador quiera. */
  pintarAhora() {
    this._pendiente = false;
    this._pintarYa();
  }

  _pintarYa() {
    const v = this.vista;
    if (!v.vw || !v.vh) return;
    const ctx = v.ctx;
    const ctx0 = {
      ctx,
      vista: v,
      R: radii(v.w, v.pistaKey),
      vis: v.ventana(),
      metro: pxPorMetro(v.pistaKey, v.w),
      hairline: (px = 1) => v.hairline(px),
      toPx: (x, y) => v.toPx(x, y),
      seVe: (x, y, holgura = 0) => seVe(ctx0.vis, x, y, holgura),
    };

    v.clear();
    if (this.conRejilla && v.enc.escala > ZOOM_REJILLA) this._rejilla(ctx0);

    /* save/restore por capa: una capa que se deje puesto un dash, una
       alfa o un clip no puede ensuciar a la siguiente. Sale gratis y
       ahorra fallos que aparecen «solo cuando hay una zona». */
    for (const c of this._mundo) { ctx.save(); try { c.dibujar(ctx0); } finally { ctx.restore(); } }
    for (const c of this._pantalla) { ctx.save(); try { c.dibujar(ctx0); } finally { ctx.restore(); } }
  }

  /** La rejilla de metros, por debajo de todo. */
  _rejilla({ ctx, vista, vis }) {
    const marco = marcoDe(vista.pistaKey);
    const metrosVisibles = (vis.x1 - vis.x0) * marco.ancho;
    const { xs, ys } = lineasRejilla(vis, marco.ancho, marco.alto, pasoRejilla(metrosVisibles));
    ctx.save();
    ctx.strokeStyle = 'rgba(0,25,56,.16)';
    ctx.lineWidth = vista.hairline(1);
    ctx.beginPath();
    /* Cada línea se traza entre sus dos extremos EN NORMALIZADO y se
       proyecta: así el giro de 90° sale gratis, sin una rama aparte
       que habría que acordarse de mantener. */
    for (const x of xs) {
      const [x0, y0] = vista.toPx(x, 0);
      const [x1, y1] = vista.toPx(x, 1);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    for (const y of ys) {
      const [x0, y0] = vista.toPx(0, y);
      const [x1, y1] = vista.toPx(1, y);
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    ctx.restore();
  }

  /* ---- medir ------------------------------------------------- */

  /**
   * Mide y pinta. Hay que llamarla DESPUÉS de meter `el` en el DOM:
   * cuando el constructor de CourtView mide, el elemento todavía no
   * cuelga de ningún sitio y sale 0×0. La primera medida buena la da
   * el ResizeObserver… si el navegador entrega sus avisos, que no
   * siempre. Quien monta un lienzo, lo mide.
   */
  medir() {
    this.vista._resize();
    this.pintarAhora();
  }

  /* ---- encuadre ---------------------------------------------- */

  zoom() { return this.vista.enc.escala; }
  encajar() { this.vista.encajarPista(); }
  zoomA(escala, cx, cy) { this.vista.zoomA(escala, cx, cy); }
  acercar(cx, cy) { this.vista.zoomA(this.zoom() * PASO_ZOOM, cx, cy); }
  alejar(cx, cy) { this.vista.zoomA(this.zoom() / PASO_ZOOM, cx, cy); }
  setPista(key) { this.vista.setPista(key); this.pintar(); }

  /** Metros que mide una distancia de pantalla. Para umbrales que se
   *  piensan en metros (el imán) partiendo de píxeles. */
  metros(px) { return px / pxPorMetro(this.vista.pistaKey, this.vista.w); }
  /** Y al revés. */
  px(metros) { return metros * pxPorMetro(this.vista.pistaKey, this.vista.w); }

  /* ---- entradas de ratón y teclado ---------------------------
     El dedo (pellizco, dos dedos) va en el paso siguiente: mezclarlo
     aquí obliga a razonar a la vez sobre punteros múltiples y sobre
     el encuadre, y son dos problemas distintos. */

  _atar() {
    const el = this.el;

    /* La rueda acerca y aleja, anclando en el puntero. Los navegadores
       mandan deltas en píxeles, en líneas o en páginas según el ratón
       y el sistema, así que hay que normalizar o el mismo gesto acerca
       el doble en un portátil que en un ratón de bola. */
    this._onRueda = (ev) => {
      ev.preventDefault();
      const unidad = ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1;
      const delta = ev.deltaY * unidad;
      const [px, py] = this.vista.pointerPx(ev);
      this.vista.zoomA(this.zoom() * Math.exp(-delta * 0.0015), px, py);
    };
    el.addEventListener('wheel', this._onRueda, { passive: false });

    /* Arrastrar la vista: botón central siempre, y botón izquierdo con
       la barra espaciadora, que es lo que hace todo editor. El botón
       izquierdo a secas NO se toca: ese es de seleccionar y mover
       fichas, y es de otra capa. */
    this._onDown = (ev) => {
      if (ev.button !== 1 && !(ev.button === 0 && this._espacio)) return;
      ev.preventDefault();
      if (this._espacio) this._espacioUsado = true;
      this._arrastre = { x: ev.clientX, y: ev.clientY };
      el.classList.add('is-arrastrando');
      try { el.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ }
    };
    this._onMove = (ev) => {
      if (!this._arrastre) return;
      this.vista.desplazarPx(ev.clientX - this._arrastre.x, ev.clientY - this._arrastre.y);
      this._arrastre = { x: ev.clientX, y: ev.clientY };
    };
    this._onUp = () => {
      if (!this._arrastre) return;
      this._arrastre = null;
      el.classList.remove('is-arrastrando');
    };
    el.addEventListener('pointerdown', this._onDown);
    el.addEventListener('pointermove', this._onMove);
    el.addEventListener('pointerup', this._onUp);
    el.addEventListener('pointercancel', this._onUp);

    /* Teclado. Va sobre el elemento y no sobre el documento a
       propósito: la barra espaciadora es también el atajo de
       reproducir (§2.2), y un atajo global aquí se lo robaría desde
       cualquier parte de la pantalla. `_espacioUsado` guarda si el
       espacio llegó a mover algo, para poder decidir más adelante —
       cuando exista la barra de herramientas— si esta pulsación era
       para desplazar o para reproducir. */
    this._onKeyDown = (ev) => {
      if (ev.code === 'Space' && !this._espacio) {
        this._espacio = true; this._espacioUsado = false;
        el.classList.add('is-mano');
        ev.preventDefault();          // si no, la página hace scroll
        return;
      }
      const paso = ev.shiftKey ? PASO_TECLA * 3 : PASO_TECLA;
      switch (ev.key) {
        case '0': this.encajar(); break;
        case '+': case '=': this.acercar(); break;
        case '-': this.alejar(); break;
        case 'ArrowLeft': this.vista.desplazarPx(paso, 0); break;
        case 'ArrowRight': this.vista.desplazarPx(-paso, 0); break;
        case 'ArrowUp': this.vista.desplazarPx(0, paso); break;
        case 'ArrowDown': this.vista.desplazarPx(0, -paso); break;
        default: return;
      }
      ev.preventDefault();
    };
    this._onKeyUp = (ev) => {
      if (ev.code !== 'Space') return;
      this._espacio = false;
      el.classList.remove('is-mano');
    };
    el.addEventListener('keydown', this._onKeyDown);
    el.addEventListener('keyup', this._onKeyUp);
  }

  destroy() {
    const el = this.el;
    el.removeEventListener('wheel', this._onRueda);
    el.removeEventListener('pointerdown', this._onDown);
    el.removeEventListener('pointermove', this._onMove);
    el.removeEventListener('pointerup', this._onUp);
    el.removeEventListener('pointercancel', this._onUp);
    el.removeEventListener('keydown', this._onKeyDown);
    el.removeEventListener('keyup', this._onKeyUp);
    if (this._raf) cancelAnimationFrame(this._raf);
    clearTimeout(this._reloj);
    this._pendiente = false;
    this.vista.destroy();
    el.remove();
  }
}
