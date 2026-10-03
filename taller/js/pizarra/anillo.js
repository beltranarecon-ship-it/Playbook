/* ============================================================
   pizarra/anillo.js — el menú de acciones que sale junto a la ficha (§4).

   Sigue llamándose «anillo» por lo que fue: seis casillas repartidas en
   círculo alrededor de la ficha. Ahora es una TARJETA anclada junto a
   ella, con las casillas en cuadrícula. El círculo tenía un fallo que
   no se arreglaba con geometría: las casillas son anchas y de ancho
   desigual («Vuelve a la fila» mide el doble que «Corta»), así que, por
   bien repartidas que estuvieran, se pisaban entre sí y con la ficha,
   y cuanto más cerca del borde, peor. Una cuadrícula no se pisa nunca.

   La GEOMETRÍA —en qué lado de la ficha cabe la tarjeta y adónde apunta
   su flecha— es pura y la prueba en Node taller/tools/eval-anillo.mjs;
   el DOM va encima, en la clase de abajo.

   ── POR QUÉ EN PÍXELES DE PANTALLA ──────────────────────────
   Todo lo de aquí va en píxeles de la ventana y NO escala con el zoom.
   Un menú que se hiciera enorme al acercar sería absurdo: el texto de
   una casilla mide lo que mide, y el dedo también.

   ── LOS CUATRO ASPECTOS ─────────────────────────────────────
   La misma tarjeta sirve para los cuatro momentos de §4, y lo único que
   cambia es lo que lleva dentro:
     · interior   las acciones de la ficha, en cuadrícula de 3×2
     · lista      «⋯ más»: el catálogo entero, en lista (con buscador si es larga)
     · exterior   las variantes técnicas de la acción elegida (§4.3)
     · desenlace  «¿entra o falla?» de un tiro (§4.4)
   ============================================================ */

import { h } from '../ui/dom.js';
import { icono, nombreDeIcono } from './iconos.js';
import { normalizarNombre } from '../ia/acciones.js';

/** Del centro de la ficha al borde de la tarjeta: lo que hace falta
 *  para no taparla, con la flecha incluida. */
export const HUECO = 34;
/** Aire mínimo contra el borde de la ventana. */
export const MARGEN = 8;
/** Lo más cerca de una esquina de la tarjeta a lo que puede ir la flecha:
 *  una flecha en la esquina redondeada se vería rota. */
export const RADIO_ESQUINA = 22;
/** Cuántas acciones ha de haber para que «más» lleve buscador. */
export const MIN_PARA_BUSCAR = 9;

const LADOS = ['derecha', 'izquierda', 'abajo', 'arriba'];
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Dónde va la tarjeta, y a qué lado de la ficha.
 *
 * Se prueba por este orden —derecha, izquierda, abajo, arriba— y se queda
 * el primer lado en el que cabe entera sin tapar la ficha. Si no cabe en
 * ninguno (una ventana más pequeña que la tarjeta), se queda el lado al
 * que menos le falta, y entonces sí se recorta contra el borde: una
 * tarjeta que tapa la ficha se pulsa; una fuera de pantalla, no.
 *
 * @param cx,cy        el centro de la ficha, en píxeles de la ventana
 * @param vw,vh        la ventana
 * @param ancho,alto   el tamaño de la tarjeta, ya medido
 * @param margen,hueco ver arriba
 * @returns { left, top, lado, flecha } — `lado` es el de la ficha en el que
 *          se pone la tarjeta; `flecha`, a cuántos píxeles del borde de la
 *          tarjeta (de su esquina superior o izquierda) apunta a la ficha.
 */
export function colocarTarjeta({ cx, cy, vw, vh, ancho, alto, margen = MARGEN, hueco = HUECO } = {}) {
  /* Lo que sobra a cada lado una vez descontada la tarjeta: positivo si
     cabe, negativo si falta. */
  const sobra = {
    derecha: vw - margen - (cx + hueco) - ancho,
    izquierda: cx - hueco - margen - ancho,
    abajo: vh - margen - (cy + hueco) - alto,
    arriba: cy - hueco - margen - alto,
  };
  /* Y a lo ancho de ese lado, que la tarjeta quepa en la ventana. */
  const cabeDeLado = (lado) => (lado === 'derecha' || lado === 'izquierda'
    ? alto + 2 * margen <= vh
    : ancho + 2 * margen <= vw);
  let lado = LADOS.find((l) => sobra[l] >= 0 && cabeDeLado(l));
  if (!lado) lado = LADOS.reduce((mejor, l) => (sobra[l] > sobra[mejor] ? l : mejor), LADOS[0]);

  const horizontal = lado === 'derecha' || lado === 'izquierda';
  const xMax = Math.max(margen, vw - ancho - margen);
  const yMax = Math.max(margen, vh - alto - margen);
  let left;
  let top;
  if (lado === 'derecha') { left = cx + hueco; top = cy - alto / 2; }
  else if (lado === 'izquierda') { left = cx - hueco - ancho; top = cy - alto / 2; }
  else if (lado === 'abajo') { left = cx - ancho / 2; top = cy + hueco; }
  else { left = cx - ancho / 2; top = cy - hueco - alto; }
  left = limitar(left, margen, xMax);
  top = limitar(top, margen, yMax);

  const flecha = horizontal
    ? limitar(cy - top, RADIO_ESQUINA, Math.max(RADIO_ESQUINA, alto - RADIO_ESQUINA))
    : limitar(cx - left, RADIO_ESQUINA, Math.max(RADIO_ESQUINA, ancho - RADIO_ESQUINA));
  return { left, top, lado, flecha };
}

/* ============================================================
   La parte con DOM
   ============================================================ */

/** Lo que se dice bajo el título, según el aspecto. */
const PIE = {
  exterior: 'o pincha ya en la pista',
  desenlace: 'pincha fuera para cancelar',
};

/** El dibujo de cada desenlace de un tiro. */
const ICONO_DESENLACE = { entra: 'ok', falla: 'cerrar' };

/**
 * El menú de acciones, montado sobre una capa que cubre el lienzo.
 *
 * Dos niveles (§4.3): el interior con las acciones, y al elegir una que
 * tenga variantes, el exterior con el «cómo». El título pasa a ser la
 * acción elegida, y se puede saltar el segundo nivel pinchando
 * directamente en la pista.
 */
export class Anillo {
  /**
   * @param host   elemento donde se cuelga (posicionado)
   * @param onElegir  (slug, { variante, accion }) — una elección firme
   * @param onCerrar  se cerró sin elegir
   */
  constructor(host, { onElegir, onCerrar } = {}) {
    this.host = host;
    this.onElegir = onElegir;
    this.onCerrar = onCerrar;
    this.capa = null;
    this.tarjeta = null;
    this.estado = null;   // { cx, cy, opciones, nivel, accion, variante }
  }

  get abierto() { return !!this.capa; }

  /**
   * @param cx,cy     centro, en píxeles del host
   * @param opciones  [{ slug, nombre, icono, atajo, accion, pendiente, motivo }]
   * @param centro    título del grupo o de la acción elegida (null en el menú de una ficha)
   * @param nivel     'interior' | 'exterior' | 'desenlace'
   * @param variante  la variante ya elegida, que viaja hasta el desenlace
   * @param conMas    si se ofrece «⋯ más»
   * @param lista     el catálogo en lista, en vez de en cuadrícula
   * @param quien     de quién es el menú: { nombre, detalle, color, numero }, o
   *                  { icono, familia } cuando el título es una acción
   */
  abrir({ cx, cy, opciones, centro = null, nivel = 'interior', conMas = true, accion = null, variante = null, lista = false, quien = null }) {
    this.cerrar();
    this.estado = { cx, cy, opciones, centro, nivel, accion, variante };

    this.capa = h('div', { class: 'pz-anillo' });
    /* Un velo transparente por debajo: es lo que convierte «pinchar
       fuera» en un evento que se puede escuchar, sin tener que atar
       nada al documento y acordarse de soltarlo. */
    const velo = h('div', { class: 'pz-anillo__velo' });
    velo.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); this.cerrar(true); });
    this.capa.append(velo);

    const titulo = nivel === 'interior' && lista ? 'Más acciones' : (centro || (quien && quien.nombre) || 'Acciones');
    this.tarjeta = h('div', {
      class: `pz-tarjeta pz-tarjeta--${nivel}${lista ? ' pz-tarjeta--lista' : ''}`,
      role: 'dialog', 'aria-label': titulo,
    });
    /* Lo que se pulsa dentro de la tarjeta es de la tarjeta: ni arrastra
       la pista ni empieza un trazo. */
    this.tarjeta.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    /* Y la rueda, dentro, desplaza la lista y no acerca la pista. */
    this.tarjeta.addEventListener('wheel', (ev) => ev.stopPropagation(), { passive: true });

    this.tarjeta.append(this._cabecera({ nivel, lista, titulo, centro, quien }));
    let buscador = null;
    if (nivel === 'desenlace') this.tarjeta.append(this._desenlace(opciones));
    else if (nivel === 'exterior') this.tarjeta.append(this._variantes(opciones));
    else if (lista) {
      const l = this._lista(opciones);
      buscador = l.buscador;
      this.tarjeta.append(...l.nodos);
    } else this.tarjeta.append(this._rejilla(opciones));

    /* «Más acciones» solo tiene sentido al elegir qué hace la ficha: con
       las variantes de «Tira» delante, ofrecer otra acción es ofrecer
       abandonar la que se acaba de elegir. */
    if (conMas && nivel === 'interior') {
      const mas = h('button', { class: 'pz-tarjeta__mas', type: 'button' }, icono('mas', { size: 16 }), 'Más acciones');
      mas.addEventListener('click', (ev) => { ev.stopPropagation(); this.onElegir?.('__mas__', {}); });
      this.tarjeta.append(mas);
    }

    this.capa.append(this.tarjeta);
    this.host.append(this.capa);
    this.recolocar(cx, cy);
    /* El buscador toma el foco DESPUÉS de que el Tablero lo devuelva al
       lienzo, que lo hace nada más abrir el menú. */
    if (buscador) setTimeout(() => buscador.focus?.({ preventScroll: true }), 0);
    return this;
  }

  /* ---- las piezas -------------------------------------------- */

  _cabecera({ nivel, lista, titulo, centro, quien }) {
    let marca = null;
    if (quien && quien.icono) {
      marca = h('span', { class: 'pz-tarjeta__marca', 'data-fam': quien.familia || 'otra' }, icono(nombreDeIcono(quien.icono, quien.familia), { size: 20 }));
    } else if (quien && quien.color) {
      marca = h('span', { class: 'pz-tarjeta__ficha', style: { '--c': quien.color } }, quien.numero || '');
    }
    const pie = PIE[nivel] || (quien && quien.detalle) || null;
    const cerrar = h('button', { class: 'pz-tarjeta__x', type: 'button', title: 'Cerrar (Esc)', 'aria-label': 'Cerrar' }, icono('cerrar', { size: 16 }));
    cerrar.addEventListener('click', (ev) => { ev.stopPropagation(); this.cerrar(true); });
    return h('header', { class: 'pz-tarjeta__cab' },
      marca,
      h('div', { class: 'pz-tarjeta__tit' },
        h('b', null, titulo),
        pie ? h('small', null, pie) : null),
      cerrar);
  }

  /** Una casilla de la cuadrícula: el dibujo, el nombre y, si lo tiene, su atajo. */
  _casilla(o) {
    const familia = o.accion ? o.accion.familia : null;
    const atajo = o.atajo ? ` (${o.atajo})` : '';
    const b = h('button', {
      class: 'pz-casilla' + (o.pendiente ? ' is-pendiente' : ''),
      type: 'button',
      'data-fam': familia || 'otra',
      title: o.pendiente ? o.motivo : `${o.descripcion || o.nombre}${atajo}`,
      disabled: o.pendiente ? '' : null,
    },
    o.atajo ? h('kbd', null, o.atajo) : null,
    h('span', { class: 'pz-casilla__ico' }, icono(nombreDeIcono(o.slug, familia), { size: 22 })),
    h('span', { class: 'pz-casilla__nombre' }, o.nombre));
    if (!o.pendiente) b.addEventListener('click', (ev) => { ev.stopPropagation(); this._elegir(o); });
    return b;
  }

  _rejilla(opciones) {
    return h('div', { class: 'pz-tarjeta__rejilla' }, ...opciones.map((o) => this._casilla(o)));
  }

  /** «⋯ más»: una fila por acción, con buscador cuando son muchas. */
  _lista(opciones) {
    const filas = opciones.map((o) => {
      const familia = o.accion ? o.accion.familia : null;
      const b = h('button', {
        class: 'pz-fila', type: 'button', 'data-fam': familia || 'otra',
        title: o.pendiente ? o.motivo : (o.descripcion || o.nombre),
        disabled: o.pendiente ? '' : null,
      },
      h('span', { class: 'pz-fila__ico' }, icono(nombreDeIcono(o.slug, familia), { size: 18 })),
      h('span', { class: 'pz-fila__nombre' }, o.nombre),
      o.atajo ? h('kbd', null, o.atajo) : null);
      if (!o.pendiente) b.addEventListener('click', (ev) => { ev.stopPropagation(); this._elegir(o); });
      return { b, clave: normalizarNombre(o.nombre) };
    });
    const cuerpo = h('div', { class: 'pz-tarjeta__lista' }, ...filas.map((f) => f.b));
    const nodos = [cuerpo];
    let buscador = null;
    if (opciones.length >= MIN_PARA_BUSCAR) {
      buscador = h('input', { class: 'pz-tarjeta__buscar', type: 'search', placeholder: 'Buscar una acción', 'aria-label': 'Buscar una acción', autocomplete: 'off' });
      const vacio = h('p', { class: 'pz-tarjeta__nada' }, 'Ninguna acción se llama así.');
      vacio.hidden = true;
      buscador.addEventListener('input', () => {
        const q = normalizarNombre(buscador.value);
        let vistas = 0;
        for (const f of filas) { const ok = !q || f.clave.includes(q); f.b.hidden = !ok; if (ok) vistas++; }
        vacio.hidden = vistas > 0;
        this.recolocar(this.estado.cx, this.estado.cy);
      });
      /* Escribir en el buscador no puede lanzar los atajos de la pista ni
         borrar la ficha con Retroceso. Solo Esc sube, que es quien cierra. */
      buscador.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') return;
        ev.stopPropagation();
        if (ev.key === 'Enter') { ev.preventDefault(); filas.find((f) => !f.b.hidden && !f.b.disabled)?.b.click(); }
      });
      nodos.unshift(h('div', { class: 'pz-tarjeta__busqueda' }, icono('buscar', { size: 16 }), buscador));
      nodos.push(vacio);
    }
    return { nodos, buscador };
  }

  /** Las variantes técnicas (§4.3): en dos columnas, como pastillas. */
  _variantes(opciones) {
    return h('div', { class: 'pz-tarjeta__variantes' }, ...opciones.map((o) => {
      const b = h('button', { class: 'pz-variante', type: 'button', title: o.descripcion || o.nombre }, o.nombre);
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this._elegir(o); });
      return b;
    }));
  }

  /** «¿Entra o falla?» (§4.4): dos botones grandes, uno al lado del otro. */
  _desenlace(opciones) {
    return h('div', { class: 'pz-tarjeta__desenlace' }, ...opciones.map((o) => {
      const b = h('button', { class: `pz-desen pz-desen--${o.slug}`, type: 'button', title: o.descripcion || o.nombre },
        icono(ICONO_DESENLACE[o.slug] || 'ok', { size: 22, trazo: 2.4 }), o.nombre);
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this._elegir(o); });
      return b;
    }));
  }

  /**
   * Vuelve a poner la tarjeta en su sitio para un centro nuevo, SIN
   * rehacer el DOM.
   *
   * Hace falta porque el menú va en píxeles y la pista se puede mover
   * debajo de él: la rueda del ratón atraviesa el velo —que solo
   * intercepta `pointerdown`— y el lienzo acerca o aleja con el menú
   * abierto. Sin esto se quedaba clavado donde estaba, flotando sobre
   * otra ficha. Sin rehacer el DOM porque recrearlo perdería el foco del
   * teclado y el `:hover` a media pulsación.
   */
  recolocar(cx, cy) {
    if (!this.capa || !this.estado || !this.tarjeta) return;
    this.estado.cx = cx; this.estado.cy = cy;
    const r = this.host.getBoundingClientRect();
    const t = this.tarjeta;
    /* El tope de alto va ANTES de medir: con él, una lista larga se
       desplaza dentro de la tarjeta en vez de salirse de la pista. */
    t.style.maxHeight = `${Math.max(140, r.height - 2 * MARGEN)}px`;
    const s = colocarTarjeta({ cx, cy, vw: r.width, vh: r.height, ancho: t.offsetWidth, alto: t.offsetHeight });
    t.style.left = `${s.left}px`;
    t.style.top = `${s.top}px`;
    t.style.setProperty('--flecha', `${s.flecha}px`);
    if (t.dataset.lado !== s.lado) t.dataset.lado = s.lado;
  }

  _elegir(o) {
    const { nivel, accion, variante } = this.estado;
    if (nivel === 'exterior') { this.cerrar(); this.onElegir?.(accion, { variante: o.slug }); return; }
    if (nivel === 'desenlace') { this.cerrar(); this.onElegir?.(accion, { variante, desenlace: o.slug }); return; }
    this.onElegir?.(o.slug, { variante: null, opcion: o });
  }

  cerrar(porFuera = false) {
    if (!this.capa) return;
    this.capa.remove();
    this.capa = null;
    this.tarjeta = null;
    this.estado = null;
    if (porFuera) this.onCerrar?.();
  }
}
