/* ============================================================
   pizarra/nodos.js — editar un trazo ya puesto (§5.2, §5.3).

   Se cuelga de un Lienzo, como Fichas y como Dibujo. Toca el canvas,
   así que no tiene banco propio: la geometría —con qué se ha acertado,
   mover, insertar, curvar, borrar— vive en trazo.js, que es puro y la
   prueba en Node. Aquí solo queda el pegamento.

   ── LOS NODOS FIJOS NO SE COGEN, SE ATRAVIESAN ──────────────
   El §5.3 dice que hay nodos que no se pueden mover: el origen de
   cualquier trazo, los dos extremos de un pase, el origen de un tiro.
   No son decisiones del entrenador, son consecuencias de dónde está la
   ficha.

   Lo que hacen aquí es NO QUEDARSE EL GESTO. Y eso no es una rendición
   sino lo que hay que hacer: el nodo de origen está exactamente encima
   de la ficha, así que dejar pasar el clic hace que arrastrar ahí
   mueva la ficha —que es lo que uno quiere hacer— en vez de pelearse
   con un nodo que no se va a mover. Igual con el extremo de un pase,
   que está sobre el receptor.

   ── EL DOBLE CLIC SE CUENTA AQUÍ ────────────────────────────
   El motor de gestos no sabe de dobles clics, y hace bien: es una
   convención de ratón, no un estado de puntero. Se cuenta aquí, y solo
   vale si el segundo toque cae en EL MISMO nodo — si no, mover un nodo
   y tocar el de al lado enderezaría uno de los dos sin querer.

   ── CON EL DEDO NO HAY DOBLE CLIC NI TECLA SUPR ─────────────
   Así que al tocar un nodo salen dos botoncitos junto a él —curvar y
   borrar— y desaparecen al tocar en otro sitio (§5.2). Son DOM y no
   pintura, por lo mismo que el anillo: tienen que medir 44 px con el
   dedo (§2.6) y poder recibir el foco.
   ============================================================ */

import { COLORS } from '../canvas/colors.js';
import { drawArrow } from '../canvas/arrows.js';
import { flattenPath } from '../canvas/geometry.js';
import { h } from '../ui/dom.js';
import {
  nodosFijos, moverNodo, insertarEn, alternarCurva, borrarNodo,
  esCurvo, nodoEn, segmentoEn, rotulo,
} from './trazo.js';
import { puntosDeIman, imantar } from './iman.js';

/** El nodo que se dibuja, en píxeles de PANTALLA: no crece con el
 *  zoom, igual que no crece el texto de un botón. */
export const RADIO_NODO_PX = 5.5;
export const RADIO_FIJO_PX = 4.5;

/** Cuánto más que lo dibujado se puede pinchar. Con el dedo manda el
 *  suelo de 22 px del §2.6, que pone el agarre del Lienzo. */
export const HOLGURA_PX = 6;

/** Dos toques dentro de esto, en el mismo nodo, son un doble clic. */
export const DOBLE_MS = 350;

/** A qué distancia del nodo salen los botoncitos del dedo. */
const SEPARACION_BOTONES = 34;

const AYUDAS = {
  mouse: 'Arrastra un nodo · clic en la línea añade uno · doble clic lo curva · <b>Supr</b> lo borra · <b>Esc</b> sale',
  touch: 'Arrastra un nodo · toca la línea para añadir uno · toca un nodo para curvarlo o borrarlo',
};

export class Nodos {
  /**
   * @param onCambio (trazo) — el trazo ha cambiado y hay que guardarlo
   * @param onSalir  ()      — se ha terminado de editar
   */
  constructor(lienzo, {
    canasta = 'norte', posiciones = {}, elementos = () => [],
    onCambio, onSalir,
  } = {}) {
    this.lienzo = lienzo;
    this.canasta = canasta;
    this.posiciones = posiciones;
    this.elementos = elementos;
    this.onCambio = onCambio;
    this.onSalir = onSalir;

    this.trazo = null;
    this.tipo = 'run';
    this.ritmo = 'normal';
    this.sel = -1;             // el nodo seleccionado, o -1
    this._fijos = new Set();
    this._imanes = [];
    this._antes = null;        // para deshacer si el gesto se aborta
    this._ultimo = null;       // { i, t } del toque anterior, para el doble
    this._pegado = null;       // a qué se ha pegado el imán mientras se mueve
    this._conDedo = false;     // si el último gesto vino de un dedo
    this._botones = null;
    this._botonesEn = -1;

    this._quitarCapas = [
      lienzo.capa('nodos', (c) => this._dibujar(c), { tipo: 'mundo', orden: 15 }),
      lienzo.capa('nodos-rotulo', (c) => this._rotulo(c), { tipo: 'pantalla', orden: 15 }),
    ];
    /* Por encima de las fichas y por debajo del modo destino: mientras
       se está dibujando un trazo nuevo, no se editan los viejos. */
    this._quitarGesto = lienzo.gesto('nodos', (i) => this._atender(i), { orden: 50 });

    this._onTecla = (ev) => this._tecla(ev);
    lienzo.el.addEventListener('keydown', this._onTecla);
  }

  get editando() { return !!this.trazo; }

  ayuda() {
    if (!this.trazo) return null;
    return this._conDedo ? AYUDAS.touch : AYUDAS.mouse;
  }

  /* ---- entrar y salir ---------------------------------------- */

  editar({ trazo, tipo = 'run', ritmo = 'normal' }) {
    this.trazo = trazo;
    this.tipo = tipo;
    this.ritmo = ritmo;
    this.sel = -1;
    this._fijos = nodosFijos(tipo, trazo.length);
    this._ultimo = null;
    this._antes = null;
    this._cerrarBotones();
    this._imanes = puntosDeIman({
      pista: this.lienzo.vista.pistaKey,
      canasta: this.canasta,
      elementos: this.elementos() || [],
      posiciones: this.posiciones,
    });
    this.lienzo.el.focus?.({ preventScroll: true });
    this.lienzo.pintar();
  }

  soltar() {
    if (!this.trazo) return;
    this.trazo = null;
    this.sel = -1;
    this._pegado = null;
    this._cerrarBotones();
    this.onSalir?.();
    this.lienzo.pintar();
  }

  /* Un cambio del trazo, en un solo sitio: así no hay ninguna rama que
     se olvide de recalcular los fijos, de avisar o de repintar. */
  _aplicar(trazo) {
    this.trazo = trazo;
    this._fijos = nodosFijos(this.tipo, trazo.length);
    this.onCambio?.(trazo);
    this.lienzo.pintar();
  }

  /* ---- los gestos -------------------------------------------- */

  _atender(intento) {
    if (!this.trazo) return null;
    this._conDedo = intento.tipoPuntero === 'touch';
    const pista = this.lienzo.vista.pistaKey;
    const tolerancia = intento.metros(intento.agarre(RADIO_NODO_PX + HOLGURA_PX));
    const punto = { x: intento.x, y: intento.y };

    /* Empezar un gesto en cualquier otro sitio quita los botoncitos
       (§5.2). Va aquí y no solo en las ramas que se quedan el gesto:
       tocar el suelo, o un nodo fijo, es «en otro sitio» igual que
       tocar otro nodo, y ahí el gesto se va a otro dueño y esta clase
       no se entera de nada más. Los botones no pasan por aquí: paran
       su propio pointerdown. */
    const fuera = () => { this._cerrarBotones(); return null; };

    const i = nodoEn(this.trazo, punto, { pista, tolerancia });
    /* Un nodo fijo deja pasar el clic a lo que haya debajo, que es la
       ficha de la que sale el trazo. Ver el comentario de la cabecera. */
    if (i >= 0 && this._fijos.has(i)) return fuera();
    if (i >= 0) return this._agarrar(i, false);

    const linea = segmentoEn(this.trazo, punto, { pista, tolerancia });
    if (!linea) return fuera();
    /* Clic en la línea: el nodo se inserta YA, curvo y tangente (§5.2),
       y el mismo gesto sigue arrastrándolo. Soltar sin mover deja el
       nodo puesto, que es el clic de la especificación; moviendo, se
       coloca de una vez en vez de pinchar y volver a cogerlo. */
    this._antes = this.trazo;
    this._aplicar(insertarEn(this.trazo, linea.seg, linea.punto));
    return this._agarrar(linea.seg + 1, true);
  }

  _agarrar(i, insertado) {
    if (!insertado) this._antes = this.trazo;
    this.sel = i;
    this._cerrarBotones();
    this.lienzo.pintar();

    const mover = (p) => {
      this._pegado = null;
      let destino = { x: p.x, y: p.y };
      if (p.shift) {
        const q = imantar(destino, this._imanes, this.lienzo.vista.pistaKey);
        if (q) { this._pegado = q; destino = { x: q.x, y: q.y }; }
      }
      this._aplicar(moverNodo(this.trazo, i, destino));
    };

    return {
      mover,
      soltar: (p) => { mover(p); this._pegado = null; this._ultimo = null; this.lienzo.pintar(); },
      tocar: () => {
        this._pegado = null;
        /* Un nodo recién insertado no puede ser además el segundo clic
           de un doble: acabaría curvando y enderezando lo que se acaba
           de poner, en el mismo gesto. */
        if (insertado) { this._ultimo = null; this._trasTocar(i); return; }
        /* EL DEDO NO HACE DOBLES CLICS. Contárselos convierte dos
           toques seguidos —que con el dedo son de lo más normal, aunque
           solo sea porque el primero se falló— en un cambio de forma
           del trazo, y encima cierra los botoncitos que el primer toque
           acababa de sacar. Con el dedo el segundo toque no hace nada
           nuevo: los botones ya están ahí, y ellos curvan y borran. */
        if (this._conDedo) { this._trasTocar(i); return; }
        const t = Date.now();
        const doble = this._ultimo && this._ultimo.i === i && t - this._ultimo.t <= DOBLE_MS;
        if (doble) { this._ultimo = null; this.alternar(i); return; }
        this._ultimo = { i, t };
        this._trasTocar(i);
      },
      abortar: () => {
        /* Apoyar el meñique a mitad de un arrastre devuelve el trazo a
           como estaba, con el nodo insertado incluido. */
        this._pegado = null;
        this._ultimo = null;
        this.sel = -1;
        if (this._antes) this._aplicar(this._antes);
      },
    };
  }

  /* Con el dedo no hay doble clic ni tecla Supr, así que el toque saca
     los dos botoncitos del §5.2. Con ratón no sale nada: ahí el doble
     clic y Supr hacen lo mismo y más rápido. */
  _trasTocar(i) {
    if (this._conDedo) this._abrirBotones(i);
    else this.lienzo.pintar();
  }

  /* ---- las tres operaciones ---------------------------------- */

  /* Las dos no guardan copia para deshacer, a diferencia de arrastrar:
     `_antes` existe para que un meñique apoyado a mitad de un gesto
     devuelva el trazo, y aquí no hay gesto vivo que se pueda abortar.
     Curvar se deshace curvando otra vez; borrar, todavía no — el
     deshacer de la Pizarra entera es de una capa posterior. */

  alternar(i = this.sel) {
    if (!this.trazo || i < 0 || this._fijos.has(i)) return;
    this._cerrarBotones();
    this._aplicar(alternarCurva(this.trazo, i));
  }

  borrar(i = this.sel) {
    if (!this.trazo || i < 0 || this._fijos.has(i)) return;
    const nuevo = borrarNodo(this.trazo, i, this.tipo);
    this._cerrarBotones();
    /* `borrarNodo` no deja nunca menos de dos nodos: si devuelve el
       mismo trazo es que se ha negado, y no hay nada que aplicar. */
    if (nuevo === this.trazo) return;
    this.sel = -1;
    this._aplicar(nuevo);
  }

  _tecla(ev) {
    if (!this.trazo) return;
    if (ev.key === 'Escape') { ev.preventDefault(); this.soltar(); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (this.sel < 0) return;
      ev.preventDefault();
      this.borrar(this.sel);
    }
  }

  /* ---- los botoncitos del dedo ------------------------------- */

  _abrirBotones(i) {
    this._cerrarBotones();
    const n = this.trazo[i];
    if (!n) return;
    const capa = h('div', { class: 'pz-nodo' });
    const boton = (texto, titulo, alHacer) => {
      const b = h('button', { class: 'pz-nodo__b', type: 'button', title: titulo }, texto);
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => { ev.stopPropagation(); alHacer(); });
      return b;
    };
    capa.append(h('div', { class: 'pz-nodo__caja' },
      boton(esCurvo(n) ? '╱' : '⌒', esCurvo(n) ? 'Enderezar' : 'Curvar', () => this.alternar(i)),
      boton('✕', 'Borrar el nodo', () => this.borrar(i))));
    this.lienzo.el.append(capa);
    this._botones = capa;
    this._botonesEn = i;
    this._colocarBotones(this.lienzo.vista);
  }

  _cerrarBotones() {
    this._botones?.remove();
    this._botones = null;
    this._botonesEn = -1;
  }

  /* Los botoncitos son DOM y el zoom vive en las coordenadas, así que
     nadie los movería solos: se recolocan con cada pintada, que es
     exactamente cuando la vista ha podido cambiar. */
  _colocarBotones(vista) {
    const n = this.trazo?.[this._botonesEn];
    if (!n) { this._cerrarBotones(); return; }
    const [px, py] = vista.toPx(n.x, n.y);
    const caja = this._botones.firstChild;
    /* Encima del nodo, y debajo si arriba no cabe: tapar el nodo que se
       acaba de tocar es lo único que no puede pasar. */
    const arriba = py - SEPARACION_BOTONES > 4;
    caja.style.left = `${px}px`;
    caja.style.top = `${arriba ? py - SEPARACION_BOTONES : py + SEPARACION_BOTONES}px`;
  }

  /* ---- dibujo ------------------------------------------------ */

  _dibujar({ ctx, R, toPx }) {
    const t = this.trazo;
    if (!t || t.length < 2) return;

    /* Aplanado y en píxeles, igual que lo pinta el motor: el trazo que
       se edita tiene que ser exactamente el que se va a animar. */
    const flat = flattenPath(t).map((p) => { const [x, y] = toPx(p.x, p.y); return { x, y }; });
    drawArrow(ctx, flat, this.tipo, R.scale);

    /* LOS NODOS VAN EN PÍXELES DE PANTALLA, SIN `R.scale`.
       El trazo sí escala con el zoom —es contenido, una línea gruesa
       vista de cerca es más gruesa—, pero un nodo es un TIRADOR, y un
       tirador mide lo que mide el dedo. Multiplicarlo por `R.scale`
       —que sale de `radii(vista.w)`, y `vista.w` crece con el zoom— lo
       hacía crecer mientras su área de acierto se quedaba en los
       mismos 11,5 px de `_atender`. Al 400 %, el nodo se veía enorme y
       pinchando dentro no se cogía. */
    for (let i = 0; i < t.length; i++) {
      const [x, y] = toPx(t[i].x, t[i].y);
      ctx.save();
      if (this._fijos.has(i)) {
        /* Un aro pequeño y discontinuo (§5.3): se ve que está, se ve
           que no se toca, y no se confunde con uno que sí. */
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255,255,255,.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y, RADIO_FIJO_PX, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      const r = RADIO_NODO_PX;
      const elegido = i === this.sel;
      ctx.fillStyle = elegido ? COLORS.accent : '#fff';
      ctx.strokeStyle = elegido ? '#fff' : COLORS.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      /* Redondo el curvo y cuadrado el recto. Es la única manera de
         saber, ANTES de hacer doble clic, qué va a pasar al hacerlo. */
      if (esCurvo(t[i])) ctx.arc(x, y, r, 0, Math.PI * 2);
      else ctx.rect(x - r, y - r, r * 2, r * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  _rotulo({ ctx, vista }) {
    const t = this.trazo;
    if (!t || t.length < 2) return;
    if (this._botones) this._colocarBotones(vista);
    if (!this._pegado) return;

    /* Mientras se mueve un nodo con Shift, lo mismo que dice el modo
       destino: a qué se está pegando, y cuánto mide ya el trazo. */
    const texto = `${rotulo(t, vista.pistaKey, this.ritmo)}  ·  ${this._pegado.nombre}`;
    const [px, py] = vista.toPx(this._pegado.x, this._pegado.y);
    ctx.save();
    ctx.font = "600 12px 'Hanken Grotesk', system-ui, sans-serif";
    const ancho = ctx.measureText(texto).width + 16;
    const x = Math.min(Math.max(px + 12, 4), Math.max(4, vista.vw - ancho - 4));
    const y = Math.min(Math.max(py - 26, 4), Math.max(4, vista.vh - 26));
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, ancho, 22, 6); else ctx.rect(x, y, ancho, 22);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(texto, x + 8, y + 11);
    ctx.strokeStyle = COLORS.ball;
    ctx.lineWidth = vista.hairline(2);
    ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  destroy() {
    this.lienzo.el.removeEventListener('keydown', this._onTecla);
    this._cerrarBotones();
    this._quitarCapas.forEach((f) => f());
    this._quitarGesto?.();
  }
}
