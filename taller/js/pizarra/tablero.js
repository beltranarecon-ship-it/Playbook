/* ============================================================
   pizarra/tablero.js — el bucle de dibujar (§4.4, §4.5, §5.4).

   Lo que ata las piezas de la capa 2: Fichas coloca, el Anillo ofrece,
   Dibujo traza, Nodos corrige y Repaso enseña. Ninguna de ellas conoce
   a las demás — se conocen aquí, y solo aquí.

   ── EL BUCLE ────────────────────────────────────────────────
     tocas una ficha        sale su anillo, contextual a lo que puede
                            hacer AHORA (§4.3)
     eliges una acción      si tiene variantes, sale el segundo anillo
     eliges el destino      se dibuja el trazo (§5.1)
     al soltar              el tramo se repasa una vez a 1,5× (§5.4) y
                            EL ANILLO REAPARECE EN LA PUNTA (§4.5), ya
                            con el estado nuevo: si acabas de pasar, ya
                            no ofrece tirar
     tocas fuera o Esc      se cierra y se guarda

   Cada elección alarga el carril de esa ficha dentro de la misma fase.
   Los carriles y las fases son de la capa 3; aquí los tramos se
   guardan en orden y con su dueño, que es lo que la capa 3 necesita.

   ── LA FICHA ACABA DONDE ACABA EL TRAZO ─────────────────────
   En cuanto se suelta. El repaso NO la mueve: solo dice dónde
   pintarla mientras dura (ver repaso.js). Así, cortar un repaso a
   mitad no deja a nadie plantado en medio de la pista, y el
   encadenado puede salir en la punta desde el primer momento.

   ── LO QUE ESTA CAPA TODAVÍA NO HACE ────────────────────────
   El §4.4 tiene cuatro filas y aquí solo está la primera, la de las
   acciones con destino. Las otras tres —el gesto que se aplica en el
   sitio, las acciones entre dos fichas y el desenlace del tiro— piden
   cosas que no existen hasta las capas 3 y 4. No se fingen: se avisa
   por `onSinSoporte` y quien nos usa lo dice en voz alta, que es mejor
   que un clic que no hace nada.
   ============================================================ */

import { Fichas } from './fichas.js';
import { Anillo } from './anillo.js';
import { Dibujo, ritmoDe, tipoFlecha } from './dibujo.js';
import { Nodos } from './nodos.js';
import { Repaso } from './repaso.js';
import { drawArrow } from '../canvas/arrows.js';
import { flattenPath } from '../canvas/geometry.js';
import {
  estadoDe, anilloDe, resto, variantesDe, tieneVariantes, necesita, ICONOS,
} from './repertorio.js';
import { segmentoEn, moverNodo, nuevoTrazo, RADIO_NODO } from './trazo.js';
import { llevaBalon, mover, asignarBalon, soltarBalon, numeroDe } from './elementos.js';
import { acierto } from './seleccion.js';
import { tieneDestinoPropio, destinoDe } from './destino.js';
import { nuevaFase, carrilesDesde, tiemposDe, posicionesFinales, recalcular } from './fases.js';

let siguiente = 1;

export class Tablero {
  /**
   * @param onTramos      (tramos) — se ha dibujado, cambiado o borrado uno
   * @param onAyuda       (html|null) — qué tiene que decir la barra de arriba
   * @param onSinSoporte  (accion) — se ha elegido algo que esta capa no hace
   * @param onNoPuede     (accion, motivo) — se ha elegido algo imposible
   * @param onFases       (fases, enCurso) — ha cambiado el número de fases
   */
  constructor(lienzo, {
    canasta = 'norte', posiciones = {}, onTramos, onAyuda, onSinSoporte, onNoPuede, onFases,
  } = {}) {
    this.lienzo = lienzo;
    this.canasta = canasta;
    this.onTramos = onTramos;
    this.onAyuda = onAyuda;
    this.onSinSoporte = onSinSoporte;
    this.onNoPuede = onNoPuede;
    this.onFases = onFases;

    /* TODAS las fases en una sola lista, y un índice diciendo cuál se
       está editando. La de en curso vivió un tiempo aparte, y en cuanto
       hubo que poder volver atrás (§6.5) eso dejaba dos sitios donde
       vive una fase y dos maneras de tocarla. `this.tramos` se
       mantiene, pero como ventana a la fase activa: así todo lo que
       dibuja y corrige sigue escrito igual. */
    this.fases = [{ ...nuevaFase('f1'), tramos: [], entrada: {} }];
    this.iFase = 0;
    /* NO HAY UN MAPA DE ESTADOS APARTE, y es a propósito. Lo que cada
       ficha tiene en la mano es del MOMENTO y no del jugador —la misma
       ficha ofrece tres anillos distintos a lo largo de una fase—, pero
       eso ya lo dice la pista: cada tramo deja el balón donde toca. Un
       cache en paralelo daba la misma respuesta hasta que el entrenador
       arrastraba el balón a mano, y entonces el anillo ofrecía tirar a
       quien ya no lo tenía. `trasAccion()` sigue en repertorio.js, que
       es donde la regla del §4.5 se puede probar en Node. */
    this._enCurso = null;   // { elemento, accion, variante } mientras se traza
    this._editando = null;  // el tramo que se está corrigiendo

    const comun = { canasta, posiciones, elementos: () => this.fichas.elementos };

    this.fichas = new Fichas(lienzo, { canasta, posiciones });
    this.fichas.onTocarFicha = (e, o) => this._tocarFicha(e, o);
    this.fichas.onTocarSuelo = (p) => this._tocarSuelo(p);
    /* §6.6: en una fase que no es la primera, el sitio de una ficha es
       consecuencia de la anterior y no se toca aquí. En la primera,
       moverla es colocarla y no tiene ninguna consecuencia rara. */
    this.fichas.puedeMover = (e) => (this.iFase > 0
      ? `llega aquí desde la fase ${this.iFase}, y ahí es donde hay que corregirlo`
      : null);
    this.fichas.onVeto = (e, motivo) => { this.onNoPuede?.({ nombre: this.nombreDe(e) }, motivo); this._pintarAyuda(); };

    this.repaso = new Repaso(lienzo, { onFin: () => this._finDelRepaso() });
    this.fichas.donde = this.repaso.donde;
    /* CUALQUIER COSA QUE MUEVA LA PISTA CORTA EL REPASO. El repaso dice
       dónde pintar a quien viaja, así que mientras dura tapa la posición
       de verdad: arrastrando esa ficha se veía quieta hasta que el
       repaso terminaba, y entonces aparecía de golpe donde se la había
       llevado. Un repaso es un golpe de vista de segundo y medio; en
       cuanto el entrenador hace otra cosa, sobra.

       Va antes de que nadie lo reproduzca: `_trazoHecho` cambia el
       modelo y DESPUÉS llama a `reproducir`, así que esto no se come el
       repaso que acaba de nacer. */
    this.fichas.onCambio = (elementos) => {
      this.repaso.parar();
      this._seguirALasFichas(elementos);
      this._recordarDonde(elementos);
    };
    this._donde = new Map();

    this.anillo = new Anillo(lienzo.el, {
      onElegir: (slug, datos) => this._elegir(slug, datos),
      onCerrar: () => this._pintarAyuda(),
    });

    this.dibujo = new Dibujo(lienzo, {
      ...comun,
      onTrazo: (t) => this._trazoHecho(t),
      onCancelar: () => { this._enCurso = null; this._pintarAyuda(); },
      onCambio: () => this._pintarAyuda(),
    });

    this.nodos = new Nodos(lienzo, {
      ...comun,
      onCambio: (trazo) => this._trazoCorregido(trazo),
      onSalir: () => { this._editando = null; this._pintarAyuda(); },
    });

    /* Debajo de los nodos y de la flecha fantasma, encima de las
       fichas: los trazos ya hechos son el fondo sobre el que se
       trabaja, no lo que se está tocando. */
    this._quitarCapa = lienzo.capa('tramos', (c) => this._dibujarTramos(c), { tipo: 'mundo', orden: 12 });
    /* El fantasma de la fase anterior (§6.4), por debajo de todo: se ve
       de dónde viene cada uno sin que compita con lo que se está
       dibujando ahora. */
    this._quitarCapaFantasma = lienzo.capa('fantasma', (c) => this._dibujarFantasma(c), { tipo: 'mundo', orden: 8 });
    /* El anillo vive en píxeles y la pista se mueve debajo de él: la
       rueda atraviesa el velo, que solo intercepta `pointerdown`. Se
       recoloca con cada pintada, que es justo cuando la vista ha podido
       cambiar — el mismo trato que reciben los botoncitos de nodo. */
    this._quitarCapaAnillo = lienzo.capa('anillo-sitio', ({ vista }) => {
      if (!this.anillo.abierto || !this._ancla) return;
      const [x, y] = vista.toPx(this._ancla.en.x, this._ancla.en.y);
      this.anillo.recolocar(x, y);
    }, { tipo: 'pantalla', orden: 30 });

    /* `Esc` con el anillo abierto no lo escuchaba nadie: Dibujo y Nodos
       solo atienden la tecla cuando les toca a ellos, y el Anillo no ata
       teclado. La barra prometía «Esc cierra» y no pasaba nada. */
    this._onTecla = (ev) => {
      if (!this.anillo.abierto || ev.key !== 'Escape') return;
      ev.preventDefault();
      this.cerrar();
    };
    lienzo.el.addEventListener('keydown', this._onTecla);
  }

  /* ---- estado ------------------------------------------------ */

  poner(elementos) {
    /* Una escena nueva se lleva por delante lo dibujado sobre la
       anterior. Dejándolo, los trazos apuntarían a fichas que ya no
       existen: se seguirían pintando, se podrían pinchar para
       corregirlos, y al mover su último nodo se buscaría un dueño que
       no está. */
    this.cerrar();
    this.repaso.parar();
    this.fases = [{
      ...nuevaFase('f1'),
      tramos: [],
      entrada: Object.fromEntries(elementos.map((e) => [e.id, { x: e.x, y: e.y }])),
    }];
    this.iFase = 0;
    this.fichas.poner(elementos);
    this._recordarDonde(elementos);
    this._avisarDeFases();
    this.onTramos?.(this.tramos);
    this._pintarAyuda();
  }

  _recordarDonde(elementos) {
    this._donde = new Map((elementos || []).map((e) => [e.id, { x: e.x, y: e.y }]));
  }

  /**
   * EL TRAZO SIGUE A SU FICHA, ESTIRÁNDOSE.
   *
   * Arrastrar una ficha que ya tiene trazos los dejaba huérfanos:
   * apuntando desde donde estaba a donde estaba, mientras ella se iba
   * sola por la pista.
   *
   * Lo que se mueve es el FINAL del último tramo, no el arranque, y no
   * es un capricho: la ficha se dibuja en la punta de su trazo —ahí la
   * dejó—, así que lo que hay debajo del dedo cuando la arrastras es
   * ese final. El arranque se queda clavado donde empezó la jugada, que
   * es la mitad que importa conservar. Corregir el arranque es mover su
   * nodo, y para eso está el editor.
   *
   * Solo los tramos que ESTA ficha recorre: un pase lo recorre el balón,
   * así que mover al pasador no toca su pase.
   */
  _seguirALasFichas(elementos) {
    if (!this.tramos.length || !this._donde.size) return;
    let tramos = this.tramos;
    let toco = false;
    for (const e of elementos || []) {
      const antes = this._donde.get(e.id);
      if (!antes || (antes.x === e.x && antes.y === e.y)) continue;
      const mios = tramos.filter((t) => t.corre_id === e.id);
      if (!mios.length) continue;
      const ultimo = mios[mios.length - 1];
      const fin = ultimo.trazo.length - 1;
      if (ultimo.trazo[fin].x === e.x && ultimo.trazo[fin].y === e.y) continue;
      const trazo = moverNodo(ultimo.trazo, fin, { x: e.x, y: e.y });
      tramos = tramos.map((t) => (t.id === ultimo.id ? { ...t, trazo } : t));
      toco = true;
      if (this._editando && this._editando.id === ultimo.id) this.nodos.refrescar(trazo);
    }
    if (!toco) return;
    this.tramos = tramos;
    if (this._editando) this._editando = tramos.find((t) => t.id === this._editando.id) || null;
    this.onTramos?.(this.tramos);
    this.lienzo.pintar();
  }

  /** Lo que la ficha puede hacer AHORA: lo que haya ido encadenando
   *  esta fase, y si no, lo que diga la pista. */
  estadoDe(elemento) {
    if (!elemento) return { llevaBalon: false, esDefensor: false };
    /* MANDA EL MODELO, NO LO GUARDADO. Cada tramo deja el balón donde
       toca —`asignarBalon`, `soltarBalon`—, así que preguntar a la pista
       da la misma respuesta que `trasAccion` y además no se queda
       vieja. Con la respuesta cacheada, arrastrar el balón fuera de un
       jugador que ya había actuado dejaba su anillo ofreciéndole tirar
       con las manos vacías.

       `esDefensor` se queda en false a propósito y no por olvido: el
       modelo de elementos.js no tiene rol —un jugador es equipo A o B,
       y eso no dice quién defiende—, y quien lo va a decir es el
       reparto de marcas del §8, que es de la capa 5. */
    return {
      llevaBalon: llevaBalon(this.fichas.elementos, elemento.id),
      esDefensor: false,
    };
  }

  /** Los tramos de la fase que se está editando. */
  get tramos() { return this.fases[this.iFase].tramos; }
  set tramos(v) {
    this.fases = this.fases.map((f, i) => (i === this.iFase ? { ...f, tramos: v } : f));
  }

  /** Dónde está cada ficha al EMPEZAR la fase que se edita. */
  get entrada() { return this.fases[this.iFase].entrada; }

  /** En qué fase se está dibujando, contando desde uno. */
  get numeroDeFase() { return this.iFase + 1; }

  nombreDe(e) {
    if (!e) return 'esa ficha';
    if (e.kind === 'balon') return 'el balón';
    if (e.kind === 'jugador') return `${e.equipo || ''}${numeroDe(e) || ''}`.trim() || 'ese jugador';
    return e.nombre || 'eso';
  }

  /** La fase en curso, con sus carriles y sus tiempos ya calculados. */
  faseEnCurso() {
    const fase = { ...this.fases[this.iFase], carriles: carrilesDesde(this.tramos) };
    return { fase, tiempos: tiemposDe(fase, { pista: this.lienzo.vista.pistaKey }) };
  }

  /**
   * «SIGUIENTE FASE» (§6.4).
   *
   * Reproduce lo dibujado a 1× —a su ritmo de verdad, no al 1,5× de la
   * confirmación de un tramo—, y al terminar cierra la fase y abre la
   * siguiente. Las fichas ya están en su sitio final desde que se
   * dibujó cada tramo, así que no hay nada que recolocar: lo único que
   * hace el paso de fase es dejar de poder editar lo anterior y empezar
   * a contar de cero.
   *
   * El repaso va ANTES de cerrar y no después porque es la última
   * oportunidad de ver la fase entera mientras todavía se puede
   * corregir sin volver atrás.
   */
  siguienteFase() {
    if (!this.tramos.length) { this.onNoPuede?.({ nombre: 'Siguiente fase' }, 'no has dibujado nada en esta fase'); return false; }
    this.cerrar();
    const { tiempos } = this.faseEnCurso();
    this.repaso.reproducirFase({
      tramos: this.tramos.map((t) => ({
        corre_id: t.corre_id,
        trazo: t.trazo,
        inicio_ms: tiempos.tramos[t.id].inicio_ms,
        duracion_ms: tiempos.tramos[t.id].duracion_ms,
      })),
    });
    this._cerrarFaseAlAcabar = true;
    return true;
  }

  /** Reproduce la fase que se está editando, sin cerrarla: el botón de
   *  la línea de tiempo, para verla las veces que haga falta. */
  reproducirFase() {
    if (!this.tramos.length) return false;
    this.cerrar();
    const { tiempos } = this.faseEnCurso();
    this.repaso.reproducirFase({
      tramos: this.tramos.map((t) => ({
        corre_id: t.corre_id, trazo: t.trazo,
        inicio_ms: tiempos.tramos[t.id].inicio_ms,
        duracion_ms: tiempos.tramos[t.id].duracion_ms,
      })),
    });
    return true;
  }

  /**
   * La jugada entera desde el principio (§6.4).
   *
   * Las fases van una detrás de otra, así que cada tramo se corre en el
   * tiempo lo que sumen las fases anteriores. Y funciona aunque se esté
   * editando la fase 3: el repaso coloca a cada ficha en el arranque de
   * su primer tramo, que es donde estaba al empezar la jugada.
   */
  reproducirJugada() {
    this.cerrar();
    const pista = this.lienzo.vista.pistaKey;
    const todos = [];
    let desfase = 0;
    for (const f of this.fases) {
      const fase = { ...f, carriles: carrilesDesde(f.tramos) };
      const tiempos = tiemposDe(fase, { pista });
      for (const t of f.tramos) {
        const m = tiempos.tramos[t.id];
        todos.push({
          corre_id: t.corre_id, trazo: t.trazo,
          inicio_ms: desfase + m.inicio_ms, duracion_ms: m.duracion_ms,
        });
      }
      desfase += tiempos.duracion_ms;
    }
    if (!todos.length) return false;
    this.repaso.reproducirFase({ tramos: todos });
    return true;
  }

  /**
   * Adelanta o retrasa un tramo dentro de su fase (§2.5), y lo marca
   * como puesto A MANO (§6.3): a partir de ahí deja de recalcularse.
   *
   * Sin la marca, el siguiente cambio en la fase lo devolvería a su
   * arranque automático y el entrenador vería deshacerse lo que acaba
   * de ajustar, sin tocarlo.
   */
  moverArranque(tramoId, ms) {
    const inicio = Math.max(0, Math.round(ms));
    this.tramos = this.tramos.map((t) => (t.id === tramoId ? { ...t, inicio_ms: inicio, manual: true } : t));
    this._recalcularSiguientes();
    this.onTramos?.(this.tramos);
    this.lienzo.pintar();
  }

  /* Se llama al terminar el repaso. Cerrar la fase AQUÍ y no al pulsar
     el botón es lo que hace que se vea entera antes de dejar de poder
     tocarla. */
  _finDelRepaso() {
    if (this._cerrarFaseAlAcabar) {
      this._cerrarFaseAlAcabar = false;
      this._cerrarFase();
    }
    this._pintarAyuda();
  }

  /* Cerrar la fase = pasar a la siguiente. Si no hay siguiente, se crea
     vacía; si ya la había —porque se volvió atrás a corregir— se va a
     ella sin tocar lo que tuviera dibujado. */
  _cerrarFase() {
    const { fase } = this.faseEnCurso();
    if (this.iFase === this.fases.length - 1) {
      this.fases = [...this.fases, {
        ...nuevaFase(`f${this.fases.length + 1}`),
        tramos: [],
        entrada: posicionesFinales(fase, this.entrada),
      }];
    }
    this.irAFase(this.iFase + 1);
  }

  /**
   * Volver a cualquier fase para cambiarla (§6.5).
   *
   * Al llegar, las fichas se colocan donde las deja ESA fase: es lo que
   * hay que ver para seguir dibujándola, y es coherente con que la
   * ficha viva siempre en la punta de su trazo.
   */
  irAFase(i) {
    const n = Math.max(0, Math.min(this.fases.length - 1, i | 0));
    this.cerrar();
    this.repaso.parar();
    this.iFase = n;
    const { fase } = this.faseEnCurso();
    const finales = posicionesFinales(fase, this.entrada);
    this.fichas.poner(this.fichas.elementos.map((e) => (finales[e.id] ? { ...e, ...finales[e.id] } : e)));
    this._recordarDonde(this.fichas.elementos);
    this._avisarDeFases();
    this.onTramos?.(this.tramos);
    this._pintarAyuda();
    this.lienzo.pintar();
  }

  /**
   * Lo que hay que hacer después de tocar una fase que no es la última
   * (§6.5): las siguientes se recalculan y sus trazos se reanclan
   * manteniendo su destino. Sin esto, corregir la fase 1 deja la 2
   * dibujada desde un sitio donde ya no hay nadie.
   */
  _recalcularSiguientes() {
    if (this.iFase >= this.fases.length - 1) return;
    const pista = this.lienzo.vista.pistaKey;
    const conCarriles = this.fases.map((f) => ({ ...f, carriles: carrilesDesde(f.tramos) }));
    const r = recalcular(conCarriles, this.fases[0].entrada, pista);
    this.fases = this.fases.map((f, i) => (i <= this.iFase ? f : {
      ...f,
      entrada: r.entradas[i] || f.entrada,
      /* Los carriles vuelven a lista plana: es como se editan, y así
         solo hay una forma de guardar un tramo. */
      tramos: r.fases[i].carriles.flatMap((c) => c.tramos).sort((a, b) => a.orden - b.orden),
    }));
    this._huerfanos = r.huerfanos;
    this._avisarDeFases();
  }

  _avisarDeFases() {
    this.onFases?.(this.fases, this.numeroDeFase, this._huerfanos || []);
  }

  /** Cierra lo que haya abierto y guarda. Es lo que hace «tocar
   *  fuera» y lo que hace `Esc`. */
  cerrar() {
    this.anillo.cerrar();
    this.dibujo.cancelar();
    this.nodos.soltar();
    this._enCurso = null;
    this._editando = null;
    this._pintarAyuda();
  }

  /* ---- el bucle ---------------------------------------------- */

  _tocarFicha(elemento, { tipoPuntero } = {}) {
    if (this.dibujo.dibujando) return;   // en mitad de un trazo no se abre nada
    /* Con qué se ha abierto el anillo viaja hasta el modo destino: la
       barra de ayuda tiene que nombrar Alt o «mantén pulsado» desde el
       primer momento, no a partir del primer gesto. */
    this._conDedo = tipoPuntero === 'touch';
    this.nodos.soltar();
    this._abrirAnillo(elemento, elemento);
  }

  _tocarSuelo(punto) {
    /* Tocar el suelo puede ser dos cosas: pinchar un trazo para
       corregirlo, o cerrar. Se mira primero lo primero, porque un
       trazo pinchado es una intención y el suelo vacío no. */
    const tramo = this._tramoEn(punto);
    if (tramo) { this._editar(tramo, punto.tipoPuntero === 'touch'); return; }
    this.cerrar();
  }

  _abrirAnillo(elemento, en, {
    opciones = null, nivel = 'interior', centro = null, accion = null, conMas = null,
  } = {}) {
    const estado = estadoDe(this.estadoDe(elemento));
    const lista = opciones || anilloDe(estado);
    const [cx, cy] = this.lienzo.vista.toPx(en.x, en.y);
    this._ancla = { elemento, en, estado };
    this.anillo.abrir({
      cx, cy, opciones: lista, nivel, centro, accion,
      conMas: conMas === null ? resto(estado).length > 0 : conMas,
    });
    /* Y el foco vuelve al lienzo, como hacen Dibujo y Nodos al entrar.
       Al abrir el segundo anillo se quita la capa con el botón recién
       pulsado dentro, y el foco se cae a `document.body`: sin esto, la
       tecla de arriba no llegaría nunca a quién la escucha. */
    this.lienzo.el.focus?.({ preventScroll: true });
    this._pintarAyuda();
  }

  _elegir(slug, { variante = null, opcion = null } = {}) {
    const { elemento, en, estado } = this._ancla || {};
    if (!elemento) return;

    if (slug === '__mas__') {
      /* «⋯ más» reabre el mismo anillo con lo que no cabía. Sin
         variantes ni «más» otra vez: es el final del camino. */
      /* Va como anillo INTERIOR aunque sea el segundo que sale, y no
         es un descuido: en el exterior, cada casilla que se pulsa es
         una VARIANTE de la acción del centro, y aquí cada casilla es
         una acción entera. El nivel no dice cuándo sale el anillo,
         dice qué significa pulsarlo. */
      this._abrirAnillo(elemento, en, {
        opciones: resto(estado).map((a) => ({
          slug: a.slug, nombre: a.nombre, icono: ICONOS[a.slug] || '•',
          descripcion: a.descripcion, accion: a,
        })),
        centro: 'Más acciones',
        conMas: false,
      });
      return;
    }

    const accion = opcion?.accion || this._accionDe(slug);
    if (!accion) return;

    /* NO SE PUEDE, Y SE AVISA — ANTES DE PREGUNTAR EL «CÓMO». El
       «⋯ más» ofrece el catálogo entero, así que desde ahí se puede
       elegir «Pasa» con las manos vacías. Sin esta guarda quedaba
       grabado un pase fantasma: no había balón que volara, así que el
       repaso mandaba al JUGADOR por el trazo del pase y luego lo
       devolvía de golpe a su sitio, porque el modelo no se había
       movido. Va delante del anillo de variantes porque preguntar
       «cómo» algo que no se puede hacer es hacer perder dos toques.
       Sale de la familia y del modo del catálogo, no de una lista de
       slugs. */
    const motivo = this._porQueNo(accion, elemento);
    if (motivo) { this.anillo.cerrar(); this.onNoPuede?.(accion, motivo); this._pintarAyuda(); return; }

    /* Si tiene variantes y todavía no se ha elegido una, sale el
       segundo anillo (§4.3). Se puede saltar pinchando ya en la
       pista: eso lo resuelve el velo del anillo, que cierra sin
       elegir, y entonces se queda la variante por defecto. */
    if (!variante && tieneVariantes(slug)) {
      this._abrirAnillo(elemento, en, {
        opciones: variantesDe(slug).map((v) => ({ slug: v.slug, nombre: v.nombre, icono: v.icono })),
        nivel: 'exterior',
        centro: accion.nombre,
        accion: slug,
      });
      return;
    }

    this.anillo.cerrar();

    /* Lo que pide algo que esta capa no sabe preguntar —el desenlace de
       un tiro, el compañero de un bloqueo— se declara y se para aquí. */
    const pide = necesita(accion);
    if (pide.desenlace || pide.companero) { this.onSinSoporte?.(accion); this._pintarAyuda(); return; }

    /* LO QUE YA SABE A DÓNDE VA, NO SE PREGUNTA. «Entra» va al aro y
       «recoge» va a por el balón suelto: el catálogo lo dice, así que se
       calcula el trazo y se dibuja hecho. Si no gusta, se pincha y se
       mueven sus nodos, que es lo que ya funciona — la decisión tomada
       es automático y ajustable. */
    if (tieneDestinoPropio(accion)) {
      const d = destinoDe(accion, elemento, {
        pista: this.lienzo.vista.pistaKey,
        canasta: this.canasta,
        elementos: this.fichas.elementos,
      });
      if (!d.punto) { this.onNoPuede?.(accion, d.motivo); this._pintarAyuda(); return; }
      this._trazoHecho({
        elemento, accion, variante,
        trazo: nuevoTrazo({ x: elemento.x, y: elemento.y }, d.punto),
        tipo: tipoFlecha(accion),
        /* Cuál era el balón, si iba a por uno. Viene de `destinoDe`, que
           es quien lo eligió: buscarlo otra vez en la punta del trazo no
           vale, porque la ficha se para NOVENTA CENTÍMETROS antes de
           llegar —para no taparlo— y a esa distancia el acierto ya no
           lo alcanza. */
        balon: d.balon || null,
      });
      return;
    }

    if (!pide.destino) { this.onSinSoporte?.(accion); this._pintarAyuda(); return; }
    this._enCurso = { elemento, accion, variante };
    this.dibujo.empezar({ elemento, accion, variante, conDedo: this._conDedo });
  }

  /** El motivo por el que esta ficha no puede hacer esto ahora, o
   *  `null` si sí puede. */
  _porQueNo(accion, elemento) {
    const modo = accion.parametros && accion.parametros.modo;
    if (accion.familia === 'balon' && modo !== 'recoge' && !this._balonDe(elemento)) {
      return 'no lleva balón';
    }
    return null;
  }

  _balonDe(elemento) {
    return this.fichas.elementos.find((e) => e.kind === 'balon' && e.portador_id === elemento.id) || null;
  }

  /**
   * QUIÉN RECORRE EL TRAZO NO ES SIEMPRE QUIEN ACTÚA.
   *
   * En un desplazamiento —botar, cortar— el trazo es el camino de la
   * ficha, y la ficha acaba en la punta. En un PASE el trazo es el
   * vuelo del balón: el que pasa se queda donde estaba y lo que viaja
   * es el balón. Moviendo siempre a quien actúa, el pasador se iba
   * detrás de su propio pase.
   *
   * Y si la flecha termina encima de una ficha, esa ficha es el
   * receptor (§4.4): se queda el balón, y con él el anillo de
   * «conBalón» la próxima vez que se la toque. Si termina en el suelo,
   * es un pase a un sitio y el balón se queda ahí.
   */
  _trazoHecho({ elemento, accion, variante, trazo, tipo, balon = null }) {
    const fin = trazo[trazo.length - 1];
    const ritmo = ritmoDe(accion);
    const pista = this.lienzo.vista.pistaKey;
    /* «Recoge» es familia balón pero NO vuela el balón: el que va es el
       jugador, a por él. Metido en el mismo saco que el pase, la ficha
       se quedaba quieta y lo que se movía era el balón —al revés de lo
       que dice la acción. */
    const recogiendo = (accion.parametros && accion.parametros.modo) === 'recoge';
    const vuelaElBalon = accion.familia === 'balon' && !recogiendo;

    let lista = this.fichas.elementos;
    let corre = elemento;
    let receptor = null;

    if (vuelaElBalon) {
      const balon = lista.find((e) => e.kind === 'balon' && e.portador_id === elemento.id);
      if (balon) {
        corre = balon;
        receptor = acierto(lista, fin, { pista, excluir: [elemento.id, balon.id] });
        if (receptor && receptor.kind !== 'jugador') receptor = null;
        lista = receptor
          ? asignarBalon(soltarBalon(lista, balon.id), balon.id, receptor.id, pista)
          : mover(soltarBalon(lista, balon.id), { [balon.id]: { x: fin.x, y: fin.y } });
      }
    } else {
      lista = mover(lista, { [elemento.id]: { x: fin.x, y: fin.y } });
      /* Y si iba a por un balón, al llegar se lo queda: si no, el trazo
         acabaría a su lado y el balón seguiría suelto para siempre. */
      if (recogiendo && balon) lista = asignarBalon(lista, balon, elemento.id, pista);
    }

    this.tramos = [...this.tramos, {
      id: `tr${siguiente++}`,
      elemento_id: elemento.id,
      corre_id: corre.id,
      receptor_id: receptor ? receptor.id : null,
      /* Qué balón se va a recoger. Lo necesitan los arranques del §6.3:
         ir a por un balón suelto no puede empezar antes de que esté
         suelto, y para saber cuándo lo está hay que saber cuál es. */
      balon_id: recogiendo ? balon : null,
      accion: accion.slug,
      variante,
      trazo, tipo, ritmo,
    }];
    this._enCurso = null;

    /* Ya está todo en su sitio final (§5.4); el repaso solo pinta por el
       camino a quien viaja, mientras dura. */
    this.fichas._cambio(lista);
    this.repaso.reproducir({ elemento: corre, trazo, ritmo });

    this._recalcularSiguientes();
    this.onTramos?.(this.tramos);

    /* Y el anillo vuelve a salir en la punta, ya contextual (§4.5). Se
       busca la ficha otra vez en la lista: la de antes es la de antes
       de moverla, y el anillo tiene que salir donde está ahora. */
    const ahora = this.fichas.elementos.find((e) => e.id === elemento.id) || elemento;
    this._abrirAnillo(ahora, vuelaElBalon ? ahora : fin);
  }

  /* ---- corregir un trazo ------------------------------------- */

  _tramoEn(punto) {
    if (!punto) return null;
    const pista = this.lienzo.vista.pistaKey;
    /* CON EL PUNTERO QUE DE VERDAD HA TOCADO. Esto fijaba 'mouse', así
       que con el dedo se perdía el suelo de 22 px del §2.6 y había que
       acertar una línea de tres píxeles con la yema. */
    const tipoPuntero = punto.tipoPuntero || 'mouse';
    /* La tolerancia sale de píxeles y del zoom de ahora. Si la vista
       todavía no se ha medido —el lienzo dentro de un panel que aún no
       tiene tamaño— eso da NaN, y con NaN `segmentoEn` no acierta nunca
       y sin dar ningún error: pinchar un trazo dejaría de funcionar en
       silencio. Mejor el radio de reserva, en metros, que es una
       tolerancia razonable en cualquier pista. */
    const px = this.lienzo.metros(this.lienzo.agarre(10, tipoPuntero));
    const tolerancia = Number.isFinite(px) && px > 0 ? px : RADIO_NODO;
    /* Del último al primero: si dos trazos se cruzan, gana el de
       encima, que es el último dibujado. */
    for (let i = this.tramos.length - 1; i >= 0; i--) {
      if (segmentoEn(this.tramos[i].trazo, punto, { pista, tolerancia })) return this.tramos[i];
    }
    return null;
  }

  _editar(tramo, conDedo = false) {
    this.anillo.cerrar();
    this._editando = tramo;
    this.nodos.editar({
      trazo: tramo.trazo, tipo: tramo.tipo, ritmo: tramo.ritmo, conDedo,
      /* Quien recorre este trazo está en su punta, porque ahí lo dejó
         el trazo. Sin excluirlo, el último nodo se imanta a sí mismo. */
      excluir: [tramo.corre_id],
    });
    this._pintarAyuda();
  }

  _trazoCorregido(trazo) {
    if (!this._editando) return;
    const id = this._editando.id;
    this.tramos = this.tramos.map((t) => (t.id === id ? { ...t, trazo } : t));
    this._editando = this.tramos.find((t) => t.id === id);
    /* Corregir el ÚLTIMO tramo deja a quien lo recorre en otro sitio,
       así que va detrás. Quien lo recorre y no quien actúa: corriendo
       un pase se mueve el balón. Los tramos de en medio no mueven a
       nadie: eso es recolocar la fase entera, y es de la capa 3. */
    const mio = this._editando;
    const ultimo = [...this.tramos].reverse().find((t) => t.corre_id === mio.corre_id);
    if (ultimo && ultimo.id === id) {
      const fin = trazo[trazo.length - 1];
      const pista = this.lienzo.vista.pistaKey;
      let lista = mover(this.fichas.elementos, { [mio.corre_id]: { x: fin.x, y: fin.y } });

      /* SI ES UN PASE, EL RECEPTOR SE VUELVE A CALCULAR. Moviendo solo
         el balón, arrastrar la punta a otro sitio dejaba la flecha
         apuntando a uno y el balón en poder de otro: el anillo le
         ofrecía tirar a quien ya no lo tenía. */
      if (mio.corre_id !== mio.elemento_id) {
        const balon = lista.find((e) => e.id === mio.corre_id);
        let receptor = acierto(lista, fin, { pista, excluir: [mio.elemento_id, mio.corre_id] });
        if (receptor && receptor.kind !== 'jugador') receptor = null;
        lista = receptor
          ? asignarBalon(soltarBalon(lista, balon.id), balon.id, receptor.id, pista)
          : soltarBalon(lista, balon.id);
        this.tramos = this.tramos.map((t) => (t.id === id ? { ...t, receptor_id: receptor ? receptor.id : null } : t));
        this._editando = this.tramos.find((t) => t.id === id);
      }
      this.fichas._cambio(lista);
    }
    this._recalcularSiguientes();
    this.onTramos?.(this.tramos);
  }

  /* ---- la barra de arriba ------------------------------------ */

  ayuda() {
    if (this.dibujo.dibujando) return this.dibujo.ayuda();
    if (this.nodos.editando) return this.nodos.ayuda();
    if (this.anillo.abierto) return 'Elige qué hace esta ficha · pincha en la pista para saltarte el «cómo» · <b>Esc</b> cierra';
    if (this.fichas.seleccion.size) return 'Arrástrala para colocarla · tócala para ver qué puede hacer · <b>Mayús</b> la pega a un sitio de la pista';
    return 'Toca una ficha para ver qué puede hacer · arrastra para colocar · pincha un trazo para corregirlo';
  }

  _pintarAyuda() { this.onAyuda?.(this.ayuda()); }

  _accionDe(slug) {
    for (const e of ['conBalon', 'sinBalon', 'defensor']) {
      const c = anilloDe(e).find((o) => o.slug === slug);
      if (c?.accion) return c.accion;
      const r = resto(e).find((a) => a.slug === slug);
      if (r) return r;
    }
    return null;
  }

  /* ---- dibujo ------------------------------------------------ */

  _dibujarTramos({ ctx, R, toPx }) {
    for (const t of this.tramos) {
      /* El que se está corrigiendo lo pinta Nodos, con sus nodos
         encima: pintarlo dos veces lo dejaría más grueso que los
         demás y parecería otro tipo de trazo. */
      if (this._editando && this._editando.id === t.id) continue;
      const flat = flattenPath(t.trazo).map((p) => { const [x, y] = toPx(p.x, p.y); return { x, y }; });
      drawArrow(ctx, flat, t.tipo, R.scale);
    }
  }

  /* El fantasma de la fase anterior: sus trazos, apagados. Se ve de
     dónde viene cada uno sin que compita con lo que se dibuja ahora. */
  _dibujarFantasma({ ctx, R, toPx }) {
    const previa = this.iFase > 0 ? this.fases[this.iFase - 1] : null;
    if (!previa) return;
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (const t of previa.tramos) {
      const flat = flattenPath(t.trazo).map((p) => { const [x, y] = toPx(p.x, p.y); return { x, y }; });
      drawArrow(ctx, flat, t.tipo, R.scale);
    }
    ctx.restore();
  }

  destroy() {
    /* Primero cortar los gestos vivos y luego desmontar. Al revés, un
       arrastre a medias seguía llamando a manejadores de piezas ya
       destruidas. */
    this.lienzo.cancelarGestos?.();
    this.cerrar();
    this.lienzo.el.removeEventListener('keydown', this._onTecla);
    this._quitarCapa?.();
    this._quitarCapaFantasma?.();
    this._quitarCapaAnillo?.();
    this.repaso.destroy();
    this.nodos.destroy();
    this.dibujo.destroy();
    this.fichas.destroy?.();
  }
}
