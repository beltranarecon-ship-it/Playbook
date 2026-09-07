/* ============================================================
   pizarra/anillo.js — el menú que sale alrededor de la ficha (§4).

   La GEOMETRÍA es pura y la prueba en Node
   taller/tools/eval-anillo.mjs; el DOM va encima, en la clase de
   abajo.

   ── EL PROBLEMA QUE RESUELVE LA PARTE PURA ──────────────────
   Un anillo repartido en 360° alrededor de una ficha se sale de la
   pantalla en cuanto la ficha está cerca de un borde — y en una
   pizarra media colocación está pegada a la línea de fondo o a la
   banda. Las casillas que se salen no se pueden pulsar, y las que se
   quedan a medias se leen cortadas.

   Así que el anillo se VUELCA: cuando no cabe entero, las casillas se
   reparten en un arco que mira hacia donde hay sitio, o sea hacia el
   centro de la ventana. Sigue siendo un anillo, sigue estando
   alrededor de la ficha, y entra siempre.

   ── POR QUÉ EN PÍXELES DE PANTALLA ──────────────────────────
   Todo lo de aquí va en píxeles de la ventana y NO escala con el zoom.
   Un menú que se hiciera enorme al acercar sería absurdo: el texto de
   una casilla mide lo que mide, y el dedo también.
   ============================================================ */

import { h } from '../ui/dom.js';

/** Radio del anillo, como fracción del lado MENOR de la ventana. Del
 *  lado menor y no del ancho: en un móvil en vertical, un radio sacado
 *  del alto pondría las casillas fuera por los lados. */
export const RADIO_INTERIOR = 0.19;
export const RADIO_EXTERIOR = 0.27;

/** Y sus topes en píxeles, para que no sea ridículo en una ventana
 *  pequeña ni desmesurado en una grande. */
export const RADIO_MIN = 76;
export const RADIO_MAX = 170;

/** Cuánto abre el arco cuando el anillo se vuelca. 170° deja las
 *  casillas repartidas casi en medio círculo: más y las de los
 *  extremos vuelven a acercarse al borde; menos y se amontonan. */
export const APERTURA = 170;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * El radio que toca para esta ventana.
 *
 * El tope se aplica al anillo INTERIOR y el exterior sale
 * proporcional. Aplicándoselo a los dos por separado, en una pantalla
 * grande los dos chocaban contra el mismo techo y salían del mismo
 * tamaño — o sea que las variantes se dibujarían encima de las
 * acciones, que es exactamente lo que el segundo anillo existe para
 * evitar.
 */
export function radioDe(vw, vh, fraccion = RADIO_INTERIOR) {
  const base = clamp(Math.min(vw, vh) * RADIO_INTERIOR, RADIO_MIN, RADIO_MAX);
  return base * (fraccion / RADIO_INTERIOR);
}

/**
 * Dónde va cada casilla.
 *
 * @param n        cuántas
 * @param cx,cy    el centro (la ficha), en píxeles de la ventana
 * @param vw,vh    la ventana
 * @param radio    del anillo
 * @param ancho,alto  el tamaño de una casilla, para no dejarla a medias
 * @param margen   aire mínimo contra el borde
 * @returns [{ x, y, angulo }] — el centro de cada casilla
 */
export function repartir(n, {
  cx, cy, vw, vh, radio, ancho = 110, alto = 34, margen = 8,
} = {}) {
  if (!(n > 0)) return [];
  const mx = ancho / 2 + margen;
  const my = alto / 2 + margen;
  /* El anillo se aplasta en vertical a propósito: las casillas son
     anchas y bajas, así que repartirlas en un círculo perfecto deja
     las de arriba y abajo demasiado lejos y las de los lados
     demasiado cerca. */
  const ry = radio * 0.82;

  const dentro = (p) => p.x >= mx && p.x <= vw - mx && p.y >= my && p.y <= vh - my;
  const en = (ang) => ({ x: cx + Math.cos(ang) * radio, y: cy + Math.sin(ang) * ry, angulo: ang });

  // 1) el reparto de siempre: en círculo, empezando por arriba
  const completo = [];
  for (let i = 0; i < n; i++) completo.push(en(-Math.PI / 2 + (i * TAU) / n));
  if (completo.every(dentro)) return completo;

  /* 2) no cabe: se vuelca hacia donde hay sitio, que es hacia el
     centro de la ventana. Con la ficha justo en el centro —imposible
     que no quepa, pero por si la ventana es diminuta— se abre hacia
     abajo, que es donde suele haber más. */
  const hx = vw / 2 - cx;
  const hy = vh / 2 - cy;
  const haciaDentro = (Math.abs(hx) < 1e-6 && Math.abs(hy) < 1e-6) ? Math.PI / 2 : Math.atan2(hy, hx);

  const arco = (APERTURA * Math.PI) / 180;
  const paso = n > 1 ? arco / (n - 1) : 0;
  const salida = [];
  for (let i = 0; i < n; i++) {
    const ang = haciaDentro - arco / 2 + i * paso;
    const p = en(ang);
    /* Y aun así se recorta: con la ventana muy estrecha, ni el arco
       entero cabe. Recortar mueve la casilla de su sitio ideal, pero
       una casilla desplazada se pulsa y una fuera de pantalla no. */
    salida.push({ x: clamp(p.x, mx, Math.max(mx, vw - mx)), y: clamp(p.y, my, Math.max(my, vh - my)), angulo: ang });
  }
  return salida;
}

/** Dónde va la pastilla de «⋯ más»: debajo del anillo, y si no cabe,
 *  encima. Nunca dentro, que taparía la ficha. */
export function posicionMas({ cx, cy, vw, vh, radio, alto = 30, margen = 8 }) {
  const abajo = cy + radio * 0.82 + alto + margen;
  const arriba = cy - radio * 0.82 - alto - margen;
  const y = abajo <= vh - alto / 2 - margen ? abajo : arriba;
  return {
    x: clamp(cx, 60, Math.max(60, vw - 60)),
    y: clamp(y, alto / 2 + margen, Math.max(alto / 2 + margen, vh - alto / 2 - margen)),
  };
}

/* ============================================================
   La parte con DOM
   ============================================================ */

/**
 * El anillo, montado sobre una capa que cubre el lienzo.
 *
 * Dos niveles (§4.3): el interior con las seis acciones, y al elegir
 * una que tenga variantes, el exterior con el «cómo». El centro pasa a
 * ser la acción elegida, y se puede saltar el segundo nivel pinchando
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
    this.estado = null;   // { cx, cy, opciones, nivel, accion }
  }

  get abierto() { return !!this.capa; }

  /**
   * @param cx,cy     centro, en píxeles del host
   * @param opciones  [{ slug, nombre, icono, pendiente, motivo }]
   * @param centro    texto del centro (null en el anillo interior)
   * @param nivel     'interior' | 'exterior'
   * @param conMas    si se ofrece «⋯ más»
   */
  abrir({ cx, cy, opciones, centro = null, nivel = 'interior', conMas = true, accion = null }) {
    this.cerrar();
    this.estado = { cx, cy, opciones, centro, nivel, accion };
    const r = this.host.getBoundingClientRect();
    const vw = r.width, vh = r.height;
    const radio = radioDe(vw, vh, nivel === 'exterior' ? RADIO_EXTERIOR : RADIO_INTERIOR);

    this.capa = h('div', { class: 'pz-anillo' });
    /* Un velo transparente por debajo: es lo que convierte «pinchar
       fuera» en un evento que se puede escuchar, sin tener que atar
       nada al documento y acordarse de soltarlo. */
    const velo = h('div', { class: 'pz-anillo__velo' });
    velo.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); this.cerrar(true); });
    this.capa.append(velo);

    if (centro) {
      const c = h('div', { class: 'pz-anillo__centro' },
        h('b', null, centro),
        h('small', null, 'o pincha ya en la pista'));
      c.style.left = `${cx}px`; c.style.top = `${cy}px`;
      this.capa.append(c);
    }

    const sitios = repartir(opciones.length, { cx, cy, vw, vh, radio });
    opciones.forEach((o, i) => {
      const b = h('button', {
        class: 'pz-anillo__caja' + (o.pendiente ? ' is-pendiente' : ''),
        type: 'button',
        title: o.pendiente ? o.motivo : (o.descripcion || o.nombre),
        disabled: o.pendiente ? '' : null,
      }, o.icono ? h('em', null, o.icono) : null, h('span', null, o.nombre));
      b.style.left = `${sitios[i].x}px`;
      b.style.top = `${sitios[i].y}px`;
      if (!o.pendiente) {
        b.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); });
        b.addEventListener('click', (ev) => { ev.stopPropagation(); this._elegir(o); });
      }
      this.capa.append(b);
    });

    if (conMas) {
      const p = posicionMas({ cx, cy, vw, vh, radio });
      const mas = h('button', { class: 'pz-anillo__mas', type: 'button' }, '⋯ más acciones');
      mas.style.left = `${p.x}px`; mas.style.top = `${p.y}px`;
      mas.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      mas.addEventListener('click', (ev) => { ev.stopPropagation(); this.onElegir?.('__mas__', {}); });
      this.capa.append(mas);
    }

    this.host.append(this.capa);
    return this;
  }

  _elegir(o) {
    const { nivel, accion } = this.estado;
    if (nivel === 'exterior') { this.cerrar(); this.onElegir?.(accion, { variante: o.slug }); return; }
    this.onElegir?.(o.slug, { variante: null, opcion: o });
  }

  cerrar(porFuera = false) {
    if (!this.capa) return;
    this.capa.remove();
    this.capa = null;
    this.estado = null;
    if (porFuera) this.onCerrar?.();
  }
}
