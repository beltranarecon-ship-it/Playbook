/* ============================================================
   pizarra/dibujo.js — el modo destino (§5.1).

   Entre elegir una acción en el anillo y tener un trazo dibujado. Se
   cuelga del Lienzo, se queda con TODOS los gestos mientras dura —para
   que nadie arrastre una ficha sin querer a mitad de un trazo— y se
   suelta al terminar o al cancelar.

   ── LOS TRES GESTOS, Y CÓMO SE DISTINGUEN ───────────────────
     clic              termina: recta hasta ahí. Es el caso rápido.
     Alt + clic        añade un nodo y el trazo sigue abierto.
     arrastrar         dibuja a pulso; al soltar se suaviza.

   El clic simple y los clics sucesivos son EL MISMO EVENTO hasta que
   llega el segundo, así que hay que decidirlo con algo que no sea el
   tiempo: esperar 300 ms a ver si viene otro clic haría que el caso
   más común —una recta— se sintiera pegajoso en todos los ejercicios.
   Alt lo resuelve sin ambigüedad y sin esperas, y la barra de ayuda lo
   dice mientras se dibuja.

   ── LA FLECHA FANTASMA ──────────────────────────────────────
   Mientras se elige el destino, la flecha sigue al puntero CON SU
   ESTILO REAL —blanca sólida para una carrera con balón, discontinua
   para un corte, naranja punteada para un pase— y un rótulo dice los
   metros y los segundos que lleva. Ver la flecha que va a quedar,
   antes de soltar, es lo que evita el «suéltalo y a ver qué sale».
   ============================================================ */

import { drawArrow, MOV_TO_ARROW } from '../canvas/arrows.js';
import { COLORS } from '../canvas/colors.js';
import { nuevoTrazo, desdePuntos, suavizar, rotulo, RITMOS } from './trazo.js';
import { puntosDeIman, imantar } from './iman.js';

/** Qué flecha dibuja cada acción. Sale del `simbolo` que la acción
 *  declara en el catálogo, así que una acción nueva del club hereda su
 *  flecha sin tocar esto.
 *
 *  El bloqueo se queda fuera a propósito: no es un trazo sino una
 *  RELACIÓN entre dos fichas —el motor lo dibuja con `drawBloqueo`
 *  entre bloqueador y compañero (engine.js)— y por eso «bloquea» pide
 *  compañero y no destino. Aquí caería en `run` y el fantasma
 *  enseñaría una flecha que luego no va a existir; el modo de elegir
 *  compañero es de una capa posterior y hasta que llegue, esta acción
 *  no debe entrar en el modo destino. */
export function tipoFlecha(accion) {
  const s = accion && accion.simbolo;
  if (s === 'pase' || s === 'tiro') return 'pass';
  return MOV_TO_ARROW[s] || 'run';
}

/** A qué ritmo se recorre, para poder decir los segundos.
 *
 *  Se pregunta a RITMOS en vez de repetir aquí la lista: escrita dos
 *  veces, añadir un ritmo en trazo.js y olvidarlo aquí no daría ningún
 *  error — el ritmo nuevo se aplanaría a «normal» y los segundos
 *  saldrían mal sin que nada lo dijera. Andando son 1,5 m/s y normal
 *  4,0: casi el triple. */
export function ritmoDe(accion) {
  if (!accion) return 'normal';
  if (accion.familia === 'balon') return 'pase';
  const r = accion.parametros && accion.parametros.ritmo;
  return RITMOS[r] ? r : 'normal';
}

/** Cuánto hay que dejar el dedo quieto para que sea «marca un punto»
 *  y no «termina aquí». 400 ms es lo que usan las listas de iOS y
 *  Android para su menú contextual: por debajo se dispara sin querer al
 *  apuntar, y por encima se siente colgado. */
export const PULSACION_LARGA = 400;

/** Y cuánto se puede mover el dedo sin que deje de ser una pulsación
 *  quieta. Un dedo apoyado nunca está del todo parado. */
export const TEMBLOR_PX = 8;

const AYUDAS = {
  mouse: {
    destino: 'Clic para el destino · <b>Alt</b>+clic añade un punto por el camino · arrastra para dibujarlo a pulso · <b>Intro</b> termina · <b>Esc</b> cancela',
    siguiendo: 'Clic para terminar aquí · <b>Alt</b>+clic para seguir marcando · <b>Intro</b> termina · <b>Esc</b> cancela',
  },
  touch: {
    destino: 'Toca el destino · <b>mantén pulsado</b> para añadir un punto por el camino · arrastra para dibujarlo a pulso',
    siguiendo: 'Toca para terminar aquí · <b>mantén pulsado</b> para seguir marcando',
  },
};

export class Dibujo {
  /**
   * @param onTrazo  ({ elemento, accion, variante, trazo, tipo }) — hecho
   * @param onCambio ()  — algo se movió y hay que repintar la ayuda
   */
  constructor(lienzo, {
    canasta = 'norte', posiciones = {}, elementos = () => [],
    onTrazo, onCancelar, onCambio,
  } = {}) {
    this.lienzo = lienzo;
    this.canasta = canasta;
    this.posiciones = posiciones;
    /* De dónde salen las fichas para el imán. Es una FUNCIÓN y no una
       lista: lo colocado cambia mientras la Pizarra está abierta, y
       guardarse una copia dejaría el imán pegándose a fichas que ya no
       están donde dice. */
    this.elementos = elementos;
    this.onTrazo = onTrazo;
    this.onCancelar = onCancelar;
    this.onCambio = onCambio;

    this.activo = null;    // { elemento, accion, variante, tipo, ritmo, nodos, puntero, pegado, aPulso }
    this._puntos = null;   // el trazo a pulso mientras se dibuja
    this._conDedo = false; // con qué se está dibujando, para la ayuda
    this._reloj = null;    // el temporizador de la pulsación larga
    this._marcado = false; // la pulsación larga ya puso su nodo

    this._quitarCapas = [
      lienzo.capa('dibujo', (c) => this._dibujar(c), { tipo: 'mundo', orden: 20 }),
      lienzo.capa('dibujo-rotulo', (c) => this._rotulo(c), { tipo: 'pantalla', orden: 20 }),
    ];
    /* Orden alto: mientras se dibuja, este gesto gana a las fichas. Si
       no, el primer clic del destino cogería la ficha que hubiera
       debajo y la arrastraría. */
    this._quitarGesto = lienzo.gesto('dibujo', (i) => this._atender(i), { orden: 100 });

    this._onMoverRaton = (ev) => this._seguir(ev);
    this._onTecla = (ev) => this._tecla(ev);
    lienzo.el.addEventListener('pointermove', this._onMoverRaton);
    lienzo.el.addEventListener('keydown', this._onTecla);
  }

  get dibujando() { return !!this.activo; }

  /** El texto que la barra de arriba tiene que estar enseñando. Cambia
   *  con el puntero: nombrar Alt e Intro en una tablet es prometer
   *  teclas que no hay. */
  ayuda() {
    if (!this.activo) return null;
    const juego = this._conDedo ? AYUDAS.touch : AYUDAS.mouse;
    return this.activo.nodos.length ? juego.siguiendo : juego.destino;
  }

  /* ---- entrar y salir ---------------------------------------- */

  /** @param conDedo  con qué se ha llegado hasta aquí. La barra de
   *  ayuda lo necesita ANTES del primer gesto: si se espera a saberlo
   *  por el puntero, el texto de la primera vez siempre está al revés. */
  empezar({ elemento, accion, variante = null, conDedo = false }) {
    this._conDedo = !!conDedo;
    this.activo = {
      elemento,
      accion,
      variante,
      tipo: tipoFlecha(accion),
      ritmo: ritmoDe(accion),
      nodos: [],            // los puntos intermedios ya fijados (Alt+clic)
      puntero: null,        // dónde está el ratón ahora
      pegado: null,
    };
    this._puntos = null;
    this._imanes = puntosDeIman({
      pista: this.lienzo.vista.pistaKey,
      canasta: this.canasta,
      elementos: this.elementos() || [],
      posiciones: this.posiciones,
      excluir: [elemento.id],
    });
    this.lienzo.el.focus?.({ preventScroll: true });
    this.onCambio?.();
    this.lienzo.pintar();
  }

  cancelar() {
    if (!this.activo) return;
    this._pararReloj();
    this.activo = null;
    this._puntos = null;
    this.onCancelar?.();
    this.onCambio?.();
    this.lienzo.pintar();
  }

  /** Cierra el trazo con lo que haya. */
  terminar(punto) {
    const a = this.activo;
    if (!a) return;
    const fin = punto || a.puntero;
    if (!fin) return;
    const origen = { x: a.elemento.x, y: a.elemento.y };
    const trazo = a.nodos.length
      ? desdePuntos([origen, ...a.nodos, fin])
      : nuevoTrazo(origen, fin);
    const datos = { elemento: a.elemento, accion: a.accion, variante: a.variante, trazo, tipo: a.tipo };
    this._pararReloj();
    this.activo = null;
    this._puntos = null;
    this.onTrazo?.(datos);
    this.onCambio?.();
    this.lienzo.pintar();
  }

  /* ---- el puntero -------------------------------------------- */

  /* El ratón mueve la flecha fantasma SIN pulsar nada, así que esto no
     puede salir del enganche de gestos, que solo conoce punteros
     apoyados. Con el dedo no hay «encima sin tocar»: el fantasma
     aparece al posar. */
  _seguir(ev) {
    const a = this.activo;
    if (!a || this._puntos) return;
    const [x, y] = this.lienzo.vista.pointerNormRaw(ev);
    this._apuntar({ x, y }, ev.shiftKey);
    this.lienzo.pintar();
  }

  _apuntar(punto, conShift) {
    const a = this.activo;
    a.pegado = null;
    if (conShift) {
      const p = imantar(punto, this._imanes, this.lienzo.vista.pistaKey);
      if (p) { a.pegado = p; a.puntero = { x: p.x, y: p.y }; return; }
    }
    a.puntero = punto;
  }

  _tecla(ev) {
    if (!this.activo) return;
    if (ev.key === 'Escape') { ev.preventDefault(); this.cancelar(); return; }
    if (ev.key === 'Enter') { ev.preventDefault(); this.terminar(); }
  }

  /* ---- los gestos -------------------------------------------- */

  _atender(intento) {
    if (!this.activo) return null;
    const a = this.activo;
    this._conDedo = intento.tipoPuntero === 'touch';
    this._apuntar({ x: intento.x, y: intento.y }, intento.shift);
    this.lienzo.pintar();

    /* MANTENER PULSADO ES EL Alt DEL DEDO (§5.1, principio 5).
       Alt+clic resuelve la ambigüedad entre «termina» y «sigue
       marcando» sin esperas, pero en una tablet no hay Alt, y sin él el
       segundo de los tres gestos desaparecía: en táctil no había manera
       de poner un punto por el camino. Dejar el dedo quieto 400 ms lo
       dice igual de claro y no depende de ninguna tecla.

       Solo con el dedo: con ratón, esperar cuatro décimas para nada
       sería un castigo, y Alt ya está ahí. */
    this._pararReloj();
    this._marcado = false;
    if (this._conDedo) {
      const donde = { x: intento.x, y: intento.y, shift: intento.shift };
      this._reloj = setTimeout(() => {
        this._reloj = null;
        if (!this.activo || this._puntos) return;
        this._apuntar(donde, donde.shift);
        a.nodos.push({ ...a.puntero });
        this._marcado = true;
        this.onCambio?.();
        this.lienzo.pintar();
      }, PULSACION_LARGA);
    }

    return {
      mover: (p) => {
        /* Se ha movido: ya no es una pulsación quieta. */
        if (Math.hypot(p.dpx, p.dpy) > TEMBLOR_PX) this._pararReloj();
        /* Se ha movido con el puntero apoyado: es un trazo A PULSO. Se
           van guardando todas las muestras y al soltar se simplifican
           (§5.1); guardar la polilínea cruda dejaría doscientos nodos
           imposibles de agarrar.

           ARRANCA DONDE SE HABÍA QUEDADO EL TRAZO, no siempre en la
           ficha: si ya hay puntos puestos con Alt, el pulso los
           continúa. Empezando siempre en la ficha, los puntos ya
           marcados se tiraban a la basura al soltar — y encima se
           seguían pintando, así que parecía que contaban. */
        if (!this._puntos) {
          const desde = a.nodos.length ? a.nodos[a.nodos.length - 1] : { x: a.elemento.x, y: a.elemento.y };
          this._puntos = [{ x: desde.x, y: desde.y }];
        }
        this._puntos.push({ x: p.x, y: p.y });
        this._apuntar({ x: p.x, y: p.y }, p.shift);
        this.lienzo.pintar();
      },
      soltar: (p) => {
        this._pararReloj();
        if (this._puntos && this._puntos.length > 2) {
          /* El imán también vale para lo dibujado a pulso. Se pintaba el
             círculo naranja del sitio al que se iba a pegar y luego el
             trazo acababa donde estuviera la yema: la ayuda enseñaba una
             cosa y quedaba otra. */
          this._apuntar({ x: p.x, y: p.y }, p.shift);
          const pulso = suavizar(this._puntos, { pista: this.lienzo.vista.pistaKey });
          if (a.pegado && pulso.length) {
            const u = pulso.length - 1;
            pulso[u] = { ...pulso[u], x: a.pegado.x, y: a.pegado.y };
          }
          /* Lo marcado a mano por delante y lo dibujado a pulso detrás.
             `suavizar` ya devuelve su primer nodo en el punto de
             arranque, que es el último de Alt, así que se descarta para
             no repetirlo. */
          const trazo = a.nodos.length
            ? desdePuntos([{ x: a.elemento.x, y: a.elemento.y }, ...a.nodos]).concat(pulso.slice(1))
            : pulso;
          const datos = { elemento: a.elemento, accion: a.accion, variante: a.variante, trazo, tipo: a.tipo };
          this.activo = null; this._puntos = null;
          this.onTrazo?.(datos);
          this.onCambio?.();
          this.lienzo.pintar();
          return;
        }
        this._puntos = null;
        this.terminar({ x: p.x, y: p.y });
      },
      tocar: (p) => {
        this._pararReloj();
        /* Si la pulsación larga ya puso su nodo, levantar el dedo no
           termina nada: el trazo sigue abierto, que es justo lo que se
           ha pedido al mantenerlo. */
        if (this._marcado) { this._marcado = false; return; }
        this._apuntar({ x: p.x, y: p.y }, p.shift);
        if (p.alt) {
          /* Alt: un punto más por el camino, y el trazo sigue abierto.
             Es lo que distingue «clic para terminar» de «clic para ir
             marcando», sin depender de un temporizador. */
          a.nodos.push({ ...a.puntero });
          this.onCambio?.();
          this.lienzo.pintar();
          return;
        }
        this.terminar(a.puntero);
      },
      abortar: () => {
        this._pararReloj();
        this._marcado = false;
        /* ABORTAR TIRA EL GESTO, NO EL MODO. Lo que aborta un gesto es
           casi siempre un segundo dedo — alguien que apoya el meñique o
           que va a hacer zoom a mitad de un trazo. Cancelando el modo
           entero, ese pellizco borraba también la acción que se acababa
           de elegir en el anillo, y había que volver a empezar por el
           principio. Se tira lo dibujado a pulso en ESTE gesto; la
           acción, la variante y los puntos ya fijados con Alt siguen
           donde estaban. Para salir del modo está Esc. */
        this._puntos = null;
        this.lienzo.pintar();
      },
    };
  }

  /* ---- dibujo ------------------------------------------------ */

  _dibujar({ ctx, vista, R, toPx }) {
    const a = this.activo;
    if (!a) return;
    const origen = { x: a.elemento.x, y: a.elemento.y };
    const puntos = this._puntos && this._puntos.length > 1
      ? this._puntos
      : [origen, ...a.nodos, ...(a.puntero ? [a.puntero] : [])];
    if (puntos.length < 2) return;

    const px = puntos.map((p) => { const [x, y] = toPx(p.x, p.y); return { x, y }; });
    ctx.save();
    ctx.globalAlpha = 0.75;     // fantasma: se ve que aún no está puesto
    drawArrow(ctx, px, a.tipo, R.scale);
    ctx.restore();

    /* Los puntos ya fijados con Alt, para saber cuáles se han puesto.
       En píxeles de PANTALLA y sin `R.scale`, como los tiradores de
       nodos.js: son interfaz, no dibujo, y tienen que medir lo mismo
       al 50 % que al 400 %. */
    for (const n of a.nodos) {
      const [x, y] = toPx(n.x, n.y);
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 2;
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  /* El rótulo va en la capa de PANTALLA: tiene que medir lo mismo al
     50 % y al 400 %, como cualquier texto de interfaz. */
  _rotulo({ ctx, vista }) {
    const a = this.activo;
    if (!a || !a.puntero) return;
    const origen = { x: a.elemento.x, y: a.elemento.y };
    const trazo = desdePuntos([origen, ...a.nodos, a.puntero]);
    const texto = a.pegado
      ? `${rotulo(trazo, vista.pistaKey, a.ritmo)}  ·  ${a.pegado.nombre}`
      : rotulo(trazo, vista.pistaKey, a.ritmo);
    const [px, py] = vista.toPx(a.puntero.x, a.puntero.y);

    ctx.save();
    ctx.font = "600 12px 'Hanken Grotesk', system-ui, sans-serif";
    const ancho = ctx.measureText(texto).width + 16;
    const x = Math.min(Math.max(px + 12, 4), vista.vw - ancho - 4);
    const y = Math.min(Math.max(py - 26, 4), vista.vh - 26);
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, ancho, 22, 6) : ctx.rect(x, y, ancho, 22);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x + 8, y + 11);
    ctx.restore();

    if (a.pegado) {
      const [ix, iy] = vista.toPx(a.pegado.x, a.pegado.y);
      ctx.save();
      ctx.strokeStyle = COLORS.ball;
      ctx.lineWidth = vista.hairline(2);
      ctx.beginPath(); ctx.arc(ix, iy, 9, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
  }

  _pararReloj() {
    if (this._reloj) { clearTimeout(this._reloj); this._reloj = null; }
  }

  destroy() {
    this._pararReloj();
    this.lienzo.el.removeEventListener('pointermove', this._onMoverRaton);
    this.lienzo.el.removeEventListener('keydown', this._onTecla);
    this._quitarCapas.forEach((f) => f());
    this._quitarGesto?.();
  }
}
