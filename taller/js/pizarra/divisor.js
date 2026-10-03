/* ============================================================
   pizarra/divisor.js — el borde de un panel que se arrastra para
   ensancharlo (§2.1), y que recuerda el ancho entre sesiones.

   La parte PURA —qué ancho vale— la prueba en Node
   taller/tools/eval-divisor.mjs; el DOM va encima, en la clase de abajo.

   El ancho vive en una variable CSS de la pantalla de la Pizarra
   (`--pz-izq`, `--pz-der`), no en el panel: así el panel no sabe nada de
   esto y el CSS decide cómo se pliega.
   ============================================================ */

import { h } from '../ui/dom.js';

/** Lo que se guarda en el navegador, con este prefijo. */
const CLAVE = 'cbp.pizarra.ancho.';

/** Lo menos que se le deja a la pista: sin esto, dos paneles anchos se
 *  la comen y no queda dónde dibujar. */
export const MIN_PISTA = 420;

/** Cuánto se mueve un panel con una flecha del teclado, y con Mayús. */
const PASO = 16;
const PASO_GRANDE = 48;

/** Un ancho dentro de sus límites. Con un tope menor que el suelo manda
 *  el suelo: un panel nunca es más estrecho de lo que se puede leer. */
export function limitarAncho(v, min, max) {
  const tope = Math.max(min, max);
  return v < min ? min : v > tope ? tope : v;
}

/** El ancho guardado, leído como texto; si no es un número, el de serie. */
export function anchoDeTexto(texto, { min, max, defecto }) {
  const n = Number.parseFloat(texto);
  return Number.isFinite(n) ? limitarAncho(Math.round(n), min, max) : defecto;
}

/** Hasta dónde puede crecer un panel: el máximo que se le ha puesto, sin
 *  dejar a la pista menos de `minPista` una vez contados el otro panel y
 *  los bordes. */
export function topeDeAncho({ ventana, otro = 0, minPista = MIN_PISTA, max }) {
  return Math.max(0, Math.min(max, ventana - otro - minPista));
}

/* ── El almacén: sin él la pizarra funciona igual ─────────── */

function almacen() {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
}

/** El ancho que se dejó la última vez, o el de serie. */
export function anchoGuardado(nombre, limites) {
  try { return anchoDeTexto(almacen()?.getItem(CLAVE + nombre), limites); } catch { return limites.defecto; }
}

function guardarAncho(nombre, px) {
  try { almacen()?.setItem(CLAVE + nombre, String(px)); } catch { /* sin almacén: se pierde al recargar, y ya está */ }
}

/* ============================================================
   La parte con DOM
   ============================================================ */

export class Divisor {
  /**
   * @param pantalla  el elemento que lleva la variable CSS
   * @param lado      'izq' o 'der': de qué lado de la pista está el panel
   * @param panel     el panel que se ensancha (se mide al empezar a arrastrar)
   * @param otro      () => ancho que ocupa lo demás (el otro panel y sus bordes)
   * @param limites   { min, max, defecto }
   * @param onAncho   (px) — se ha cambiado el ancho
   * @param etiqueta  para los lectores de pantalla
   */
  constructor({ pantalla, lado, panel, otro = () => 0, limites, onAncho = null, etiqueta = 'Ancho del panel' }) {
    this.pantalla = pantalla;
    this.lado = lado;
    this.panel = panel;
    this.otro = otro;
    this.limites = limites;
    this.onAncho = onAncho;
    this.variable = `--pz-${lado}`;
    this.ancho = anchoGuardado(lado, limites);

    this.el = h('div', {
      class: `pz-divisor pz-divisor--${lado}`, role: 'separator', 'aria-orientation': 'vertical',
      tabindex: '0', title: 'Arrastra para ensanchar · doble clic para volver al ancho de serie', 'aria-label': etiqueta,
    });
    this.poner(this.ancho, { guardar: false });

    this.el.addEventListener('pointerdown', (ev) => this._empezar(ev));
    this.el.addEventListener('dblclick', () => this.poner(limites.defecto));
    this.el.addEventListener('keydown', (ev) => this._tecla(ev));
    /* Una ventana que se encoge no puede dejar al panel más ancho que lo
       que cabe: se vuelve a limitar. */
    this._alRedimensionar = () => this.poner(this.ancho, { guardar: false });
    if (typeof window !== 'undefined') window.addEventListener('resize', this._alRedimensionar);
  }

  /** Pone el ancho (limitado) y, si se quiere, lo recuerda. */
  poner(px, { guardar = true } = {}) {
    const ventana = this.pantalla.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 0);
    const tope = ventana ? topeDeAncho({ ventana, otro: this.otro(), max: this.limites.max }) : this.limites.max;
    this.ancho = limitarAncho(Math.round(px), this.limites.min, tope);
    this.pantalla.style.setProperty(this.variable, `${this.ancho}px`);
    this.el.setAttribute('aria-valuenow', String(this.ancho));
    this.el.setAttribute('aria-valuemin', String(this.limites.min));
    this.el.setAttribute('aria-valuemax', String(this.limites.max));
    if (guardar) guardarAncho(this.lado, this.ancho);
    this.onAncho?.(this.ancho);
  }

  _empezar(ev) {
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    ev.preventDefault();
    const x0 = ev.clientX;
    const w0 = this.panel.getBoundingClientRect().width || this.ancho;
    try { this.el.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ }
    this.el.classList.add('is-arrastrando');
    this.pantalla.classList.add('is-redimensionando');
    const mover = (e) => {
      const dx = e.clientX - x0;
      this.poner(this.lado === 'izq' ? w0 + dx : w0 - dx, { guardar: false });
    };
    const soltar = () => {
      this.el.removeEventListener('pointermove', mover);
      this.el.removeEventListener('pointerup', soltar);
      this.el.removeEventListener('pointercancel', soltar);
      this.el.classList.remove('is-arrastrando');
      this.pantalla.classList.remove('is-redimensionando');
      guardarAncho(this.lado, this.ancho);
    };
    this.el.addEventListener('pointermove', mover);
    this.el.addEventListener('pointerup', soltar);
    this.el.addEventListener('pointercancel', soltar);
  }

  /** Con el teclado: flechas para mover, Inicio para volver al de serie. */
  _tecla(ev) {
    const paso = ev.shiftKey ? PASO_GRANDE : PASO;
    /* Un panel de la izquierda crece hacia la derecha, y al revés. */
    const signo = this.lado === 'izq' ? 1 : -1;
    if (ev.key === 'ArrowRight') this.poner(this.ancho + signo * paso);
    else if (ev.key === 'ArrowLeft') this.poner(this.ancho - signo * paso);
    else if (ev.key === 'Home') this.poner(this.limites.defecto);
    else return;
    ev.preventDefault();
  }

  destroy() {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this._alRedimensionar);
    this.el.remove();
  }
}
