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
   pegamento. Debajo, las COLOCACIONES guardadas del club (§7.8): se
   guarda la de ahora con un nombre y se pone cualquiera, sustituyendo lo
   que hay o añadiéndose.
   ============================================================ */

import { h } from '../../ui/dom.js';
import { COLORS } from '../../canvas/colors.js';
import { icono } from '../iconos.js';

/** Por debajo de este ancho de ventana el panel empieza plegado (§2.6). */
const ANCHO_PLEGADO_BAJO = 1100;

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
  ['jugadores', 'Jugadores', 'Jugadores en juego'],
  ['balones', 'Balones', 'Balones'],
  ['conos', 'Conos', 'Conos'],
  ['material', 'Material', 'Material (escaleras y pelotas)'],
];

export class PanelIzquierdo {
  /**
   * @param onArmar  (ficha|null) — se ha pulsado una ficha, o se ha
   *                 dejado de tener una pulsada
   * @param onSoltar (ficha, evento) — se ha arrastrado una ficha fuera
   *                 del panel; el evento dice dónde, en la pantalla
   * @param onGuardarColocacion (nombre) — guardar la de ahora; devuelve
   *                 (una promesa de) lo guardado, o null
   * @param onPonerColocacion (plantilla, 'sustituir'|'anadir')
   * @param onQuitarPlantilla (plantilla)
   * @param onPlegar (plegado) — el panel se ha plegado o desplegado
   */
  constructor({ onArmar = null, onSoltar = null, onGuardarColocacion = null, onPonerColocacion = null, onQuitarPlantilla = null, onPlegar = null } = {}) {
    this.onPlegar = onPlegar;
    this.onArmar = onArmar;
    this.onSoltar = onSoltar;
    this.onGuardarColocacion = onGuardarColocacion;
    this.onPonerColocacion = onPonerColocacion;
    this.onQuitarPlantilla = onQuitarPlantilla;
    this._abierta = null;      // la colocación con sus botones a la vista
    this._seguro = false;      // «Sustituir» pulsado una vez: falta confirmar
    this._lista = [];
    this.armada = null;
    this._tragar = false;

    /* Los jugadores y el material, cada uno en su cuadrícula: lo primero
       que se busca es de qué equipo es el jugador, y lo segundo es otra
       cosa. */
    this._botones = new Map();
    const jugadores = h('div', { class: 'pz-izq__rejilla' });
    const material = h('div', { class: 'pz-izq__rejilla' });
    for (const f of FICHAS) {
      const b = this._boton(f);
      this._botones.set(f, b);
      (f.kind === 'jugador' ? jugadores : material).append(b);
    }

    this._cifras = {};
    const cuenta = h('dl', { class: 'pz-recuento' });
    for (const [clave, texto, largo] of RECUENTO) {
      this._cifras[clave] = h('dd', null, '0');
      cuenta.append(h('div', { class: 'pz-recuento__dato', title: largo }, h('dt', null, texto), this._cifras[clave]));
    }

    this._plegar = h('button', { class: 'pz-izq__plegar', type: 'button', onClick: () => this.plegar(!this.plegado) });
    this.el = h('aside', { class: 'pz-izq', 'aria-label': 'Fichas' },
      h('div', { class: 'pz-izq__cabecera' },
        h('span', { class: 'pz-izq__pestana' }, 'Fichas'),
        this._plegar),
      h('div', { class: 'pz-izq__cuerpo' },
        h('h3', { class: 'pz-izq__titulo' }, 'Jugadores'),
        jugadores,
        h('h3', { class: 'pz-izq__titulo' }, 'Material'),
        material,
        h('p', { class: 'pz-izq__nota' }, 'Arrástralas a la pista, o púlsalas y pincha donde van.'),
        h('h3', { class: 'pz-izq__titulo' }, 'En la pista'),
        cuenta,
        h('h3', { class: 'pz-izq__titulo' }, 'Colocaciones'),
        this._hueco = h('div', { class: 'pz-coloc' }),
        this._formGuardar()));
    const ancho = typeof window !== 'undefined' ? window.innerWidth : 0;
    this.plegar(ancho > 0 && ancho < ANCHO_PLEGADO_BAJO);
    this.colocaciones([]);
  }

  /** Pliega el panel a una tira de iconos, o lo despliega. Plegado, las
   *  fichas se siguen pudiendo sacar: lo que se esconde es el texto. */
  plegar(on) {
    this.plegado = !!on;
    this.el.classList.toggle('is-plegado', this.plegado);
    this._plegar.replaceChildren(icono(this.plegado ? 'derecha' : 'izquierda', { size: 16 }));
    this._plegar.title = this.plegado ? 'Abrir el panel de fichas' : 'Plegar el panel';
    this._plegar.setAttribute('aria-label', this._plegar.title);
    this._plegar.setAttribute('aria-expanded', this.plegado ? 'false' : 'true');
    this.onPlegar?.(this.plegado);
  }

  /* Guardar la colocación de ahora, con un nombre. */
  _formGuardar() {
    const nombre = h('input', { class: 'pz-coloc__nombre', type: 'text', maxlength: '60', placeholder: '1-4 alto', 'aria-label': 'Nombre de la colocación' });
    const form = h('form', { class: 'pz-coloc__form' }, nombre,
      h('button', { class: 'pz-coloc__b', type: 'submit', title: 'Guarda dónde está cada ficha, para todo el club' }, 'Guardar la de ahora'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const hecha = await this.onGuardarColocacion?.(nombre.value);
      if (hecha) nombre.value = '';
    });
    return form;
  }

  /** Pinta las colocaciones guardadas (las de la pista que hay delante). */
  colocaciones(lista = this._lista) {
    this._lista = lista || [];
    if (!this._lista.some((p) => p.id === this._abierta)) { this._abierta = null; this._seguro = false; }
    if (!this._lista.length) {
      this._hueco.replaceChildren(h('p', { class: 'pz-izq__nota' }, 'Todavía no hay ninguna guardada para esta pista.'));
      return;
    }
    const boton = (texto, titulo, alPulsar, clase = '') => {
      const b = h('button', { class: `pz-coloc__b ${clase}`.trim(), type: 'button', title: titulo }, texto);
      b.addEventListener('click', alPulsar);
      return b;
    };
    this._hueco.replaceChildren(...this._lista.map((p) => {
      const abierta = p.id === this._abierta;
      const fila = h('div', { class: 'pz-coloc__fila' + (abierta ? ' is-abierta' : '') },
        boton(p.nombre, 'Ponerla en la pista', () => { this._abierta = abierta ? null : p.id; this._seguro = false; this.colocaciones(); }, 'pz-coloc__n'));
      if (abierta) {
        fila.append(h('div', { class: 'pz-coloc__acciones' },
          boton('Añadir', 'La suma a las fichas que ya hay', () => { this._abierta = null; this.colocaciones(); this.onPonerColocacion?.(p, 'anadir'); }),
          /* Sustituir se lleva lo dibujado: se pide dos veces. */
          boton(this._seguro ? '¿Seguro? Se borra lo dibujado' : 'Sustituir todo', 'Empieza de nuevo con esta colocación', () => {
            if (!this._seguro) { this._seguro = true; this.colocaciones(); return; }
            this._abierta = null; this._seguro = false; this.colocaciones();
            this.onPonerColocacion?.(p, 'sustituir');
          }, this._seguro ? 'pz-coloc__b--ojo' : ''),
          boton('Quitar', 'La quita de las guardadas del club', () => this.onQuitarPlantilla?.(p), 'pz-coloc__b--quitar')));
      }
      return fila;
    }));
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
