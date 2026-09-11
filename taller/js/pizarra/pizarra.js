/* ============================================================
   pizarra/pizarra.js — la pantalla de la Pizarra (§2.1).

   Monta lo que ya existía suelto —el Lienzo, el Tablero, la línea de
   tiempo— y le pone alrededor lo que le faltaba para poder CREAR un
   ejercicio: el panel de las fichas (§2.3) y la barra de arriba con sus
   herramientas y la ayuda (§2.2).

   Es el único sitio que sabe que existen todas las piezas. Cada una
   sigue sin saber nada de las demás: el Tablero no conoce el panel, y
   el panel no conoce la pista. Aquí se cablean.

   ── LO QUE TODAVÍA NO ESTÁ, Y DÓNDE LLEGA ───────────────────
   El panel derecho con sus tres pestañas (§2.4), los paneles plegables
   y redimensionables, las zonas y «Traer», deshacer y rehacer: capas 6,
   7 y 10. La canasta, que en el §2.4 vive en «Ajustes del ejercicio»,
   va de momento en la barra de arriba.

   Toca el DOM, así que no tiene banco propio. Se prueba en
   dev/pizarra.html y dentro del asistente.
   ============================================================ */

import { h } from '../ui/dom.js';
import { Lienzo } from './lienzo.js';
import { Tablero } from './tablero.js';
import { LineaTiempo } from './linea-tiempo.js';
import { PanelIzquierdo } from './paneles/izquierda.js';
import { recuento } from './elementos.js';

/* Los aros se llaman por su número, que es como los ve el entrenador
   sobre la pista (la misma convención que el resto del Taller). */
const NOMBRE_CANASTA = { norte: 'Canasta 1', sur: 'Canasta 2' };

/** Cuánto se queda a la vista un aviso: lo bastante para leer una línea
 *  con calma, y no tanto como para tapar la pista. */
const AVISO_MS = 6000;

/** Cómo se nombra lo que se va a poner, para la barra de ayuda. */
const queEs = (f) => (f.kind === 'jugador'
  ? `un jugador del ${f.nombre}`
  : ({ balon: 'un balón', cono: 'un cono', escalera: 'una escalera', pelota: 'una pelota de tenis' })[f.kind] || f.nombre);

export class Pizarra {
  /**
   * @param pista    clave de pista
   * @param canasta  el aro al que se ataca, si la pista tiene dos
   * @param onCambio () — algo de la jugada ha cambiado (para autoguardar)
   */
  constructor({ pista = 'entera', canasta = 'norte', onCambio = null } = {}) {
    this.onCambio = null;   // se pone al final: montar no es cambiar nada
    this._relojAviso = null;
    this._ayudaTablero = '';

    this.lienzo = new Lienzo({ pista });
    this.panel = new PanelIzquierdo({
      onArmar: (f) => this._armar(f),
      onSoltar: (f, ev) => this._soltarDelPanel(f, ev),
    });

    const aros = Object.keys(this.lienzo.vista.pista?.baskets || {});
    this.tablero = new Tablero(this.lienzo, {
      canasta: aros.includes(canasta) ? canasta : (aros[0] || 'norte'),
      onAyuda: (t) => { this._ayudaTablero = t || ''; this._pintarAyuda(); },
      onTramos: () => { this.linea?.refrescar(); this._cambio(); },
      onFases: (fases, enCurso, huerfanos) => {
        this.linea?.refrescar();
        if (huerfanos && huerfanos.length) {
          const n = huerfanos.length;
          this.avisar(`<b>${n} tramo${n > 1 ? 's' : ''}</b> de fases posteriores ya no encaja${n > 1 ? 'n' : ''}: su protagonista no está en la pista.`);
        }
        this._cambio();
      },
      onSinSoporte: (a) => this.avisar(`<b>«${a.nombre}»</b> todavía no se puede dibujar en la Pizarra: llega en una capa posterior.`),
      onNoPuede: (a, motivo) => this.avisar(`<b>«${a.nombre}»</b> no se puede: ${motivo}.`),
      onEscena: (elementos) => { this.panel.recuento(recuento(elementos)); this._cambio(); },
    });

    /* ---- la barra de arriba (§2.2) ---- */
    this.elAyuda = h('span', { class: 'pz-arriba__ayuda', 'aria-live': 'polite' });
    const boton = (texto, titulo, alHacer) => h('button', {
      class: 'pz-arriba__b', type: 'button', title: titulo, 'aria-label': titulo, onClick: alHacer,
    }, texto);
    const herramientas = h('div', { class: 'pz-arriba__herramientas' },
      boton('−', 'Alejar (−)', () => this.lienzo.alejar()),
      boton('+', 'Acercar (+)', () => this.lienzo.acercar()),
      boton('⛶', 'Encajar la pista (0)', () => this.lienzo.encajar()),
      h('span', { class: 'pz-arriba__sep' }),
      boton('▶', 'Ver la jugada desde el principio', () => this.ver()));
    /* Solo con dos aros hay nada que elegir: en media pista sobra. */
    if (aros.length > 1) {
      const sel = h('select', { 'aria-label': 'Canasta a la que se ataca' },
        ...aros.map((k) => h('option', { value: k, selected: k === this.tablero.canasta }, NOMBRE_CANASTA[k] || k)));
      sel.addEventListener('change', () => { this.tablero.setCanasta(sel.value); this._cambio(); });
      herramientas.append(h('span', { class: 'pz-arriba__sep' }), h('label', { class: 'pz-arriba__canasta' }, 'Ataca a', sel));
    }

    this.elAviso = h('div', { class: 'pz-aviso', role: 'status' });
    this.elAviso.hidden = true;
    const tiempo = h('div', { class: 'pz-centro__tiempo' });
    this.el = h('div', { class: 'pz-pantalla' },
      h('div', { class: 'pz-arriba' }, herramientas, this.elAyuda),
      h('div', { class: 'pz-cuerpo' },
        this.panel.el,
        h('div', { class: 'pz-centro' }, this.lienzo.el, this.elAviso, tiempo)));
    this.linea = new LineaTiempo(tiempo, this.tablero);

    /* Con una ficha pulsada en el panel, pinchar la pista la pone. Va por
       delante de todo —dibujar incluido— porque mientras hay una
       pulsada, pinchar la pista significa eso y nada más. */
    this._quitarGesto = this.lienzo.gesto('colocar', (i) => this._atenderColocar(i), { orden: 200 });

    this._onTecla = (ev) => {
      if (ev.key === 'Escape' && this.panel.armada) { ev.preventDefault(); this.panel.armar(null); }
    };
    this.el.addEventListener('keydown', this._onTecla);

    this.tablero.poner([]);
    this.panel.recuento(recuento([]));
    this.onCambio = onCambio;
  }

  /** Mide y pinta. Hay que llamarla DESPUÉS de meter `el` en el DOM,
   *  por lo mismo que `Lienzo.medir`. */
  medir() {
    this.lienzo.medir();
    this.linea.refrescar();
  }

  /** Una escena nueva, sin nada dibujado. */
  poner(elementos) {
    this.tablero.poner(elementos);
    this.panel.recuento(recuento(this.tablero.fichas.elementos));
  }

  /**
   * Reabre una jugada guardada; sin ella, la animación de un ejercicio de
   * antes de la Pizarra, con sus posiciones iniciales (§11.4).
   * @returns { ok, avisos }
   */
  cargar(jugada, { animacion = null } = {}) {
    const r = this.tablero.cargar(jugada, { animacion });
    /* El Tablero adopta la canasta de la jugada: el selector tiene que
       decir lo mismo, o enseñaría un aro y se atacaría el otro. */
    const sel = this.el.querySelector('.pz-arriba__canasta select');
    if (sel) sel.value = this.tablero.canasta;
    this.panel.recuento(recuento(this.tablero.fichas.elementos));
    this.linea.refrescar();
    if (r.avisos.length) this.avisar(r.avisos.join(' '));
    return r;
  }

  /** La jugada tal y como se guarda (§11.1). */
  jugada() { return this.tablero.jugada(); }

  /** Cuántos hay de cada cosa, para los requisitos del paso 3. */
  recuento() { return recuento(this.tablero.fichas.elementos); }

  /** El ▶ de la barra: la jugada entera si hay varias fases, y si no la única. */
  ver() {
    const t = this.tablero;
    const hecho = t.fases.length > 1 ? t.reproducirJugada() : t.reproducirFase();
    if (!hecho) this.avisar('Todavía no hay nada dibujado que ver.');
  }

  /** Una línea encima de la pista, que se va sola. La ayuda de la barra
   *  nunca es un aviso de error (§2.2): lo que no se ha podido hacer se
   *  dice aquí. */
  avisar(html) {
    clearTimeout(this._relojAviso);
    this.elAviso.innerHTML = html;
    this.elAviso.hidden = false;
    this._relojAviso = setTimeout(() => { this.elAviso.hidden = true; }, AVISO_MS);
  }

  _cambio() { this.onCambio?.(); }

  _pintarAyuda() {
    const f = this.panel.armada;
    this.elAyuda.innerHTML = f
      ? `Pincha en la pista para poner <b>${queEs(f)}</b> · puedes poner varios seguidos · <b>Esc</b> termina`
      : this._ayudaTablero;
  }

  _armar(f) {
    /* Pulsar una ficha cierra lo que hubiera abierto: con el anillo a la
       vista, el siguiente clic en la pista sería a la vez «pon aquí» y
       «dibuja hasta aquí». */
    if (f) { this.tablero.cerrar(); this.tablero.fichas.seleccionar([]); }
    this.lienzo.el.classList.toggle('is-colocando', !!f);
    this._pintarAyuda();
    if (f) this.lienzo.el.focus?.({ preventScroll: true });
  }

  _atenderColocar(intento) {
    const f = this.panel.armada;
    if (!f) return null;
    const poner = (p) => this._poner(f, p);
    return { mover: () => {}, soltar: poner, tocar: poner, abortar: () => {} };
  }

  _soltarDelPanel(f, ev) {
    /* Soltarla fuera del lienzo —otra vez en el panel, en la barra— es
       arrepentirse, y no hay nada que decir. */
    const r = this.lienzo.el.getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
    const [x, y] = this.lienzo.vista.pointerNormRaw(ev);
    this._poner(f, { x, y });
    this.lienzo.el.focus?.({ preventScroll: true });
  }

  _poner(f, { x, y }) {
    if (!(x >= 0 && x <= 1 && y >= 0 && y <= 1)) { this.avisar('Pon la ficha dentro de la pista.'); return; }
    this.tablero.anadirFicha({ kind: f.kind, equipo: f.equipo }, { x, y });
  }

  destroy() {
    clearTimeout(this._relojAviso);
    this._quitarGesto?.();
    this.el.removeEventListener('keydown', this._onTecla);
    this.linea.destroy();
    this.tablero.destroy();
    this.lienzo.destroy();
    this.el.remove();
  }
}
