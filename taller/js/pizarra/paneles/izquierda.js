/* ============================================================
   pizarra/paneles/izquierda.js — el panel de las fichas (§2.3).

   De aquí salen las fichas a la pista, con los dos gestos del §2.3,
   que conviven:

     · ARRASTRAR una a la pista: se queda donde se suelta;
     · PULSARLA y pinchar en la pista, tantas veces como se quiera
       —cinco jugadores son cinco clics, no diez—, hasta volver a
       pulsarla o hasta Esc.

   Debajo, el recuento en vivo: lo que el paso 3 va a leer para los
   requisitos, a la vista mientras se coloca.

   Toca el DOM, así que no tiene banco propio: qué se crea y cómo se
   cuenta es de elementos.js, que sí lo tiene. Aquí solo queda el
   pegamento. Zonas y «Traer» (equipo del club, colocaciones y fases
   guardadas) llegan en sus capas (6 y 10).
   ============================================================ */

import { h } from '../../ui/dom.js';
import { COLORS } from '../../canvas/colors.js';

/** Lo que se puede sacar a la pista, en el orden del §2.3. */
export const FICHAS = [
  { kind: 'jugador', equipo: 'A', nombre: 'Equipo 1', color: COLORS.A },
  { kind: 'jugador', equipo: 'B', nombre: 'Equipo 2', color: COLORS.B },
  { kind: 'jugador', equipo: 'C', nombre: 'Equipo 3', color: COLORS.C },
  { kind: 'jugador', equipo: 'D', nombre: 'Equipo 4', color: COLORS.D },
  { kind: 'balon', nombre: 'Balón', color: COLORS.ball },
  { kind: 'cono', nombre: 'Cono', color: COLORS.cono },
  { kind: 'escalera', nombre: 'Escalera', color: COLORS.ink },
  { kind: 'pelota', nombre: 'Pelota de tenis', color: COLORS.tenis },
];

/** Lo que hay que mover el puntero para que sea arrastrar y no pulsar.
 *  Con menos, un pulso tembloroso se convertía en un arrastre que
 *  soltaba la ficha en el propio panel, y no pasaba nada. */
const UMBRAL_PX = 6;

/* Las zonas no están porque todavía no se pueden poner (capa 6): una
   fila que siempre dice cero solo hace dudar. */
const RECUENTO = [
  ['jugadores', 'Jugadores en juego'],
  ['balones', 'Balones'],
  ['conos', 'Conos'],
  ['material', 'Material'],
];

export class PanelIzquierdo {
  /**
   * @param onArmar  (ficha|null) — se ha pulsado una ficha, o se ha
   *                 dejado de tener una pulsada
   * @param onSoltar (ficha, evento) — se ha arrastrado una ficha fuera
   *                 del panel; el evento dice dónde, en la pantalla
   */
  constructor({ onArmar = null, onSoltar = null } = {}) {
    this.onArmar = onArmar;
    this.onSoltar = onSoltar;
    this.armada = null;
    this._tragar = false;

    this._botones = new Map();
    const lista = h('div', { class: 'pz-izq__fichas' });
    for (const f of FICHAS) {
      const b = this._boton(f);
      this._botones.set(f, b);
      lista.append(b);
    }

    this._cifras = {};
    const cuenta = h('dl', { class: 'pz-recuento' });
    for (const [clave, texto] of RECUENTO) {
      this._cifras[clave] = h('dd', null, '0');
      cuenta.append(h('dt', null, texto), this._cifras[clave]);
    }

    this.el = h('aside', { class: 'pz-izq', 'aria-label': 'Fichas' },
      h('h3', { class: 'pz-izq__titulo' }, 'Fichas'),
      lista,
      h('p', { class: 'pz-izq__nota' }, 'Arrástralas a la pista, o púlsalas y pincha donde van.'),
      h('h3', { class: 'pz-izq__titulo' }, 'En la pista'),
      cuenta);
  }

  /** Deja una ficha pulsada para ponerla pinchando, o ninguna con `null`. */
  armar(f) {
    this.armada = f || null;
    for (const [ficha, b] of this._botones) {
      const on = ficha === this.armada;
      b.classList.toggle('is-armada', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    this.onArmar?.(this.armada);
  }

  /** Pone al día el recuento, con lo que devuelve `recuento()` de elementos.js. */
  recuento(c = {}) {
    for (const [clave] of RECUENTO) this._cifras[clave].textContent = String(c[clave] ?? 0);
  }

  _boton(f) {
    const muestra = () => h('span', { class: `pz-muestra pz-muestra--${f.kind}`, style: { '--c': f.color } });
    const b = h('button', {
      class: 'pz-izq__ficha', type: 'button', 'aria-pressed': 'false',
      title: `${f.nombre}: arrástrala a la pista, o púlsala y pincha donde va`,
    }, muestra(), h('span', null, f.nombre));

    /* El clic arma. Llega también después de un arrastre —el puntero se
       captura en el botón, así que su `pointerup` y su clic caen aquí—,
       y ese no cuenta: soltar una ficha en la pista no puede dejarla
       además pulsada. */
    b.addEventListener('click', () => {
      if (this._tragar) { this._tragar = false; return; }
      this.armar(this.armada === f ? null : f);
    });

    b.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse' && ev.button !== 0) return;
      const x0 = ev.clientX;
      const y0 = ev.clientY;
      let fantasma = null;
      try { b.setPointerCapture(ev.pointerId); } catch { /* puntero sintético */ }

      const mover = (e) => {
        if (!fantasma) {
          if (Math.hypot(e.clientX - x0, e.clientY - y0) < UMBRAL_PX) return;
          fantasma = h('div', { class: 'pz-fantasma' }, muestra());
          document.body.append(fantasma);
          b.classList.add('is-arrastrando');
        }
        fantasma.style.left = `${e.clientX}px`;
        fantasma.style.top = `${e.clientY}px`;
      };
      const fin = (e, vale) => {
        b.removeEventListener('pointermove', mover);
        b.removeEventListener('pointerup', alSoltar);
        b.removeEventListener('pointercancel', alCancelar);
        if (!fantasma) return;
        fantasma.remove();
        b.classList.remove('is-arrastrando');
        /* El clic que viene detrás se traga UNA vez. Y si no llega —hay
           navegadores que no lo mandan cuando el puntero acaba sobre otro
           elemento—, se olvida enseguida, para no comerse la siguiente
           pulsación de verdad. */
        this._tragar = true;
        setTimeout(() => { this._tragar = false; }, 0);
        if (vale) this.onSoltar?.(f, e);
      };
      const alSoltar = (e) => fin(e, true);
      const alCancelar = (e) => fin(e, false);
      b.addEventListener('pointermove', mover);
      b.addEventListener('pointerup', alSoltar);
      b.addEventListener('pointercancel', alCancelar);
    });
    return b;
  }
}
