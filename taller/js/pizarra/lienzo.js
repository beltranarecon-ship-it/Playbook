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
import { nuevoEstado, reducir, radioAcierto } from './gestos.js';
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
    this._espacio = false;
    this._espacioUsado = false;
    /* El estado de los dedos vive en la maquina pura; aqui solo se
       guarda quien atiende cada puntero, que es lo unico que ella no
       puede saber porque son objetos con funciones. */
    this._punteros = nuevoEstado();
    this._duenos = new Map();
    this._gestos = [];

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

  /* ---- el enganche de los gestos de un dedo ------------------
     El Lienzo no sabe qué hay dibujado: no conoce fichas, ni nodos, ni
     trazos. Cuando nace un gesto de un puntero pregunta, de mayor a
     menor orden, y gana el primero que devuelva un manejador —los
     nodos antes que las fichas, y las fichas antes que el suelo—.

     El manejador puede traer cuatro cosas, y las cuatro importan:
       mover(p)    mientras arrastra
       soltar(p)   se levantó habiendo arrastrado
       tocar(p)    se levantó SIN llegar a arrastrar
       abortar()   no ha pasado: deshaz, y sin dejar rastro en el
                   historial (el segundo dedo, una cancelación del
                   navegador, Escape)

     `abortar` es la que se olvida y la que más se nota: es lo que
     hace que apoyar el meñique a mitad de un arrastre devuelva la
     ficha a su sitio en vez de dejarla donde se quedó. */

  /** Registra un candidato. Devuelve la función que lo quita. */
  gesto(nombre, atender, { orden = 0 } = {}) {
    this._gestos.push({ nombre, atender, orden });
    this._gestos.sort((a, b) => b.orden - a.orden);
    return () => this.quitarGesto(nombre);
  }

  quitarGesto(nombre) {
    this._gestos = this._gestos.filter((g) => g.nombre !== nombre);
  }

  /**
   * El radio con el que hay que acertar sobre algo dibujado, en
   * píxeles de pantalla. Con el dedo hay un suelo de 22 px (§2.6) y
   * con ratón o lápiz vale el radio de verdad. NO escala con el zoom,
   * aunque lo parezca: al 50 % una ficha tiene que seguir pinchándose.
   */
  agarre(radioDibujadoPx, tipoPuntero) { return radioAcierto(radioDibujadoPx, tipoPuntero); }

  /** Aborta todo gesto vivo. Para Escape, para cuando se abre un
   *  modal, para cuando cambia la fase. */
  cancelarGestos() {
    this._ejecutar(reducir(this._punteros, { tipo: 'purga' }).ordenes);
  }

  /** Una sola transformación: escala anclada más traslación. */
  pellizco(escala, cx, cy, dx, dy) { this.vista.pellizco(escala, cx, cy, dx, dy); }

  /* Traduce un evento ya normalizado y ejecuta lo que salga. */
  _despachar(evento, ev) {
    const { ordenes } = reducir(this._punteros, evento);
    this._ejecutar(ordenes, ev);
  }

  _ejecutar(ordenes, ev) {
    for (const o of ordenes) {
      switch (o.tipo) {
        case 'capturar':
          try { this.el.setPointerCapture(o.id); } catch { /* puntero sintético */ }
          break;
        case 'clase':
          this.el.classList.toggle(o.clase, !!o.on);
          if (o.clase === 'is-arrastrando' && o.on && this._espacio) this._espacioUsado = true;
          break;
        case 'abrir': this._abrir(o, ev); break;
        case 'mover': this._duenos.get(o.id)?.mover?.(this._conNorm(o.p)); break;
        case 'tocar': this._duenos.get(o.id)?.tocar?.(this._conNorm(o.p)); this._duenos.delete(o.id); break;
        case 'soltar': this._duenos.get(o.id)?.soltar?.(this._conNorm(o.p)); this._duenos.delete(o.id); break;
        case 'abortar': this._duenos.get(o.id)?.abortar?.(); this._duenos.delete(o.id); break;
        case 'desplazar': this.vista.desplazarPx(o.dx, o.dy); break;
        case 'pellizco': this.pellizco(o.escala, o.cx, o.cy, o.dx, o.dy); break;
        default: break;
      }
    }
  }

  /* Pregunta a la cadena quién quiere este puntero. */
  _abrir(o, ev) {
    const intento = {
      ...this._conNorm(o.p),
      agarrePx: radioAcierto(0, o.p.tipoPuntero),
      shift: !!ev?.shiftKey, alt: !!ev?.altKey, ctrl: !!ev?.ctrlKey, meta: !!ev?.metaKey,
      metros: (px) => this.metros(px),
      aPx: (m) => this.px(m),
      toPx: (x, y) => this.vista.toPx(x, y),
      toNorm: (px, py) => this.vista.toNormRaw(px, py),
      agarre: (r) => this.agarre(r, o.p.tipoPuntero),
    };
    for (const g of this._gestos) {
      const manejador = g.atender(intento);
      if (manejador) { this._duenos.set(o.id, manejador); return; }
    }
  }

  /* Al punto en píxeles se le añade siempre el normalizado SIN
     recortar: quien atiende piensa en la pista, no en el lienzo, y
     recortar convertiría «has soltado fuera» en «has soltado en el
     borde». */
  _conNorm(p) {
    const [x, y] = this.vista.toNormRaw(p.px, p.py);
    const [x0, y0] = this.vista.toNormRaw(p.px0, p.py0);
    return { ...p, x, y, x0, y0 };
  }

  /* ---- entradas de ratón y teclado --------------------------- */

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

    /* Los punteros NO se atienden aquí: se traducen a eventos y se le
       pasan a la máquina de pizarra/gestos.js, que es pura y decide
       quién manda sobre cada dedo. Este bloque es solo el adaptador —
       traduce hacia dentro y ejecuta hacia fuera—, y ese reparto es lo
       que permite probar en Node casos que con dedos costaría media
       hora reproducir. */
    const alaMaquina = (tipo, ev) => {
      const [px, py] = this.vista.pointerPx(ev);
      this._despachar({
        tipo,
        id: ev.pointerId,
        tipoPuntero: ev.pointerType || 'mouse',
        x: px, y: py,
        t: ev.timeStamp,
        boton: ev.button,
        botones: ev.buttons,
        espacio: this._espacio,
        escalaActual: this.vista.enc.escala,
      }, ev);
    };

    this._onDown = (ev) => { ev.preventDefault(); alaMaquina('down', ev); };
    this._onMove = (ev) => alaMaquina('move', ev);
    this._onUp = (ev) => alaMaquina('up', ev);
    this._onCancel = (ev) => alaMaquina('cancel', ev);
    this._onPerdida = (ev) => alaMaquina('perdida', ev);
    el.addEventListener('pointerdown', this._onDown);
    el.addEventListener('pointermove', this._onMove);
    el.addEventListener('pointerup', this._onUp);
    el.addEventListener('pointercancel', this._onCancel);
    el.addEventListener('lostpointercapture', this._onPerdida);

    /* Cuando el navegador se lleva el gesto no siempre manda
       `pointercancel`: perder el foco de la ventana con dos dedos
       apoyados, cambiar de pestaña o abrir el menú contextual dejan
       los punteros vivos para siempre, y el siguiente toque continúa
       un gesto que ya nadie recuerda haber empezado. */
    this._onPurga = () => this.cancelarGestos('purga');
    addEventListener('blur', this._onPurga);
    document.addEventListener('visibilitychange', this._onPurga);
    el.addEventListener('contextmenu', this._onPurga);

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
    el.removeEventListener('pointercancel', this._onCancel);
    el.removeEventListener('lostpointercapture', this._onPerdida);
    el.removeEventListener('contextmenu', this._onPurga);
    el.removeEventListener('keydown', this._onKeyDown);
    el.removeEventListener('keyup', this._onKeyUp);
    removeEventListener('blur', this._onPurga);
    document.removeEventListener('visibilitychange', this._onPurga);
    if (this._raf) cancelAnimationFrame(this._raf);
    clearTimeout(this._reloj);
    this._pendiente = false;
    this.vista.destroy();
    el.remove();
  }
}
