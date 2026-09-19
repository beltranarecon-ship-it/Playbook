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

   ── LO QUE TODAVÍA NO SE HACE ───────────────────────────────
   Del §4.4 faltan el gesto que se aplica en el sitio y, de las acciones
   entre dos fichas, las de la defensa (el bloqueo ya está). No se
   fingen: se avisa por `onSinSoporte` y quien nos usa lo dice en voz
   alta, que es mejor que un clic que no hace nada.
   ============================================================ */

import { h } from '../ui/dom.js';
import { posicionesDe } from '../canvas/anclas.js';
import { Fichas } from './fichas.js';
import { Anillo } from './anillo.js';
import { Dibujo, ritmoDe, tipoFlecha } from './dibujo.js';
import { Nodos } from './nodos.js';
import { Companero } from './companero.js';
import { Repaso, VELOCIDAD_REPASO, duracionRepaso } from './repaso.js';
import { drawArrow, drawBloqueo } from '../canvas/arrows.js';
import { flattenPath } from '../canvas/geometry.js';
import {
  estadoDe, anilloDe, resto, variantesDe, tieneVariantes, necesita, ICONOS, porQueNoCompanero, saleEn,
} from './repertorio.js';
import { segmentoEn, moverNodo, nuevoTrazo, RADIO_NODO } from './trazo.js';
import { llevaBalon, mover, asignarBalon, soltarBalon, numeroDe, continuarIds, seguirAlPortador, anadir, quitar } from './elementos.js';
import { acierto, alPinchar } from './seleccion.js';
import { tieneDestinoPropio, destinoDe, trasElTiro, esAccionDeBloqueo, sitioDelBloqueo, frenteDelBloqueo } from './destino.js';
import { normalizarJugada, jugadaDesdeAnimacion } from './motor/jugada.js';
import { compilar } from './motor/compilar.js';
import {
  defensaPorDefecto, papelesDeJugada, tramosQueNoEncajan, normalizarDefensa, colocar, explicarRegla, REGLAS,
  ACCIONES_DEFENSOR, SENALA,
} from './motor/defensa.js';
import { COLORS } from '../canvas/colors.js';
import {
  nuevaFase, carrilesDesde, tiemposDe, posicionesFinales, recalcular, posesionAlFinal,
  tramosConFicha, balonEnJuego, conFichaNueva, sinFichas, esTiro, TRAS_EL_TIRO_MS, esBloqueo,
} from './fases.js';

let siguiente = 1;

export class Tablero {
  /**
   * @param onTramos      (tramos) — se ha dibujado, cambiado o borrado uno
   * @param onAyuda       (html|null) — qué tiene que decir la barra de arriba
   * @param onSinSoporte  (accion) — se ha elegido algo que esta capa no hace
   * @param onNoPuede     (accion, motivo) — se ha elegido algo imposible
   * @param onFases       (fases, enCurso) — ha cambiado el número de fases
   * @param onEscena      (elementos) — se ha puesto, quitado o movido algo
   * @param onSeleccion   (ids) — ha cambiado lo que está seleccionado
   */
  constructor(lienzo, {
    canasta = 'norte', posiciones = {}, onTramos, onAyuda, onSinSoporte, onNoPuede, onFases, onEscena, onSeleccion,
  } = {}) {
    this.lienzo = lienzo;
    this.canasta = canasta;
    this.onTramos = onTramos;
    this.onAyuda = onAyuda;
    this.onSinSoporte = onSinSoporte;
    this.onNoPuede = onNoPuede;
    this.onFases = onFases;
    this.onEscena = onEscena;
    this.onSeleccion = onSeleccion;
    this._ultimaSeleccion = '';
    this._arrastrePareja = null;  // { defensor, punto } mientras se arrastra la línea de un par

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
    /* Los ajustes de la defensa del ejercicio (§8, §11.1). Quién defiende
       a quién NO se guarda aparte: sale de aquí y de la escena cada vez
       que se pregunta (ver `papeles`). */
    this.defensa = defensaPorDefecto();
    this._papeles = null;   // { clave, valor }: la última respuesta de `papeles`
    /* Los defensores que ha colocado el entrenador a mano: a esos no se
       les vuelve a mover (§8.1). Lo que se abre guardado cuenta como
       puesto a mano: se guardó donde se veía. */
    this._aMano = new Set();

    const comun = { canasta, posiciones, elementos: () => this.fichas.elementos };

    this.fichas = new Fichas(lienzo, { canasta, posiciones });
    this.fichas.esDefensor = (e) => this.papelesDeFase().defensores.includes(e.id);
    this.fichas.onTocarFicha = (e, o) => this._tocarFicha(e, o);
    this.fichas.onTocarSuelo = (p) => this._tocarSuelo(p);
    this.fichas.onArrastrado = (ids) => this._recolocadas(ids);
    /* §6.6: en una fase que no es la primera, el sitio de una ficha es
       consecuencia de la anterior y no se toca aquí. En la primera,
       moverla es colocarla y no tiene ninguna consecuencia rara. */
    this.fichas.puedeMover = (e) => (this.iFase > 0
      ? `llega aquí desde la fase ${this.iFase}, y ahí es donde hay que corregirlo`
      : null);
    this.fichas.onVeto = (e, motivo) => { this.onNoPuede?.({ nombre: this.nombreDe(e) }, motivo); this._pintarAyuda(); };
    /* Dar un balón soltándolo encima de alguien (§7.3) cambia quién lo
       tiene AL EMPEZAR. Si ese balón ya sale en algo dibujado, no: su
       pase seguiría saliendo de las manos de quien ya no lo tiene. */
    this.fichas.puedeAsignar = (balon) => (balonEnJuego(this.fases, balon.id)
      ? 'ya sale en lo dibujado, y dárselo a otro dejaría pases sin balón'
      : null);

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
      this.onEscena?.(elementos);
      /* Lo seleccionado decide qué enseña la pestaña «Ajustes» y qué regla
         se dibuja (§8.7): se avisa solo cuando cambia. */
      const sel = [...this.fichas.seleccion].join(',');
      if (sel !== this._ultimaSeleccion) { this._ultimaSeleccion = sel; this.onSeleccion?.([...this.fichas.seleccion]); }
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
      onSalir: () => { this._editando = null; this._cerrarDesenlace(); this._pintarAyuda(); },
      onBorrarTrazo: () => this._borrarElQueSeEdita(),
    });

    /* «Pincha a quién» (§4.4): entre elegir una acción entre dos fichas y
       señalar la otra. */
    this.companero = new Companero(lienzo, {
      elementos: () => this.fichas.elementos,
      onElegido: (ficha, datos) => this._companeroElegido(ficha, datos),
      onNoVale: (ficha, motivo, accion) => { this.onNoPuede?.(accion, `${this.nombreDe(ficha)} ${motivo}`); this._pintarAyuda(); },
      onCancelar: () => { this._enCurso = null; this._pintarAyuda(); },
    });

    /* Debajo de los nodos y de la flecha fantasma, encima de las
       fichas: los trazos ya hechos son el fondo sobre el que se
       trabaja, no lo que se está tocando. */
    this._quitarCapa = lienzo.capa('tramos', (c) => this._dibujarTramos(c), { tipo: 'mundo', orden: 12 });
    /* El fantasma de la fase anterior (§6.4), por debajo de todo: se ve
       de dónde viene cada uno sin que compita con lo que se está
       dibujando ahora. */
    this._quitarCapaFantasma = lienzo.capa('fantasma', (c) => this._dibujarFantasma(c), { tipo: 'mundo', orden: 8 });
    /* La línea fina discontinua de cada par (§8.1), debajo de las fichas:
       se lee quién defiende a quién sin tapar a nadie. */
    this._quitarCapaParejas = lienzo.capa('parejas', (c) => this._dibujarParejas(c), { tipo: 'mundo', orden: 9 });
    /* La regla del defensor seleccionado (§8.7), por debajo de las líneas
       de los pares: explica, no manda. */
    this._quitarCapaRegla = lienzo.capa('regla', (c) => this._dibujarRegla(c), { tipo: 'mundo', orden: 7 });
    /* Arrastrar la línea de un par a otro atacante cambia el par (§8.1).
       Por encima de las fichas —que cogen el suelo para el marco de
       selección— y por debajo de nodos y trazos. Nunca coge si hay una
       ficha debajo, y un toque sin arrastre es tocar el suelo. */
    this._quitarGestoPareja = lienzo.gesto('pareja', (i) => this._atenderPareja(i), { orden: 10 });
    /* El anillo vive en píxeles y la pista se mueve debajo de él: la
       rueda atraviesa el velo, que solo intercepta `pointerdown`. Se
       recoloca con cada pintada, que es justo cuando la vista ha podido
       cambiar — el mismo trato que reciben los botoncitos de nodo. */
    this._quitarCapaAnillo = lienzo.capa('anillo-sitio', ({ vista }) => {
      if (!this.anillo.abierto || !this._ancla) return;
      const [x, y] = vista.toPx(this._ancla.en.x, this._ancla.en.y);
      this.anillo.recolocar(x, y);
    }, { tipo: 'pantalla', orden: 30 });
    /* Los botones «Entra / Falla» de un tiro que se corrige van junto al
       aro, y el aro se mueve con el zoom: se recolocan en cada pintada. */
    this._quitarCapaDesenlace = lienzo.capa('desenlace-sitio', ({ vista }) => this._colocarDesenlace(vista), { tipo: 'pantalla', orden: 31 });

    /* `Esc` con el anillo abierto no lo escuchaba nadie: Dibujo y Nodos
       solo atienden la tecla cuando les toca a ellos, y el Anillo no ata
       teclado. La barra prometía «Esc cierra» y no pasaba nada. */
    this._onTecla = (ev) => {
      if (ev.defaultPrevented) return;
      if (ev.key === 'Escape' && this.anillo.abierto) { ev.preventDefault(); this.cerrar(); return; }
      /* Supr quita lo seleccionado (§2.2), también con su anillo abierto:
         tocar una ficha la selecciona y abre el anillo a la vez, y es
         justo entonces cuando se quiere quitar. No mientras se dibuja o
         se corrige un trazo: ahí Supr es de Nodos, que borra el nodo o el
         trazo y deja la tecla marcada como atendida. */
      if ((ev.key === 'Delete' || ev.key === 'Backspace')
        && !this.dibujo.dibujando && !this.nodos.editando && !this.companero.eligiendo && this.fichas.seleccion.size) {
        ev.preventDefault();
        this.quitarSeleccion();
      }
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
    this.defensa = defensaPorDefecto();
    this.fases = [{
      ...nuevaFase('f1'),
      tramos: [],
      entrada: Object.fromEntries(elementos.map((e) => [e.id, { x: e.x, y: e.y }])),
      /* Quién tiene cada balón AL EMPEZAR la jugada. Va aparte de las
         posiciones y no dentro de ellas: el modelo lo cambia en cuanto
         se dibuja un pase, y es justo lo que el compilador necesita
         saber de antes. */
      posesion: Object.fromEntries(elementos.filter((e) => e.kind === 'balon').map((e) => [e.id, e.portador_id ?? null])),
    }];
    this.iFase = 0;
    this.fichas.poner(elementos);
    this._aMano = new Set(elementos.filter((e) => e.kind === 'jugador').map((e) => e.id));
    this._recordarDonde(elementos);
    this._avisarDeFases();
    this.onTramos?.(this.tramos);
    this._pintarAyuda();
  }

  /**
   * EN LA FASE 1, RECOLOCAR ES CAMBIAR DÓNDE EMPIEZA LA JUGADA (§6.6).
   *
   * Si la ficha no participa todavía en la fase, su sitio nuevo es su
   * arranque. Sin esto, el arranque se quedaba en donde se puso al
   * principio y, al pasar de fase o al volver a la 1, la ficha saltaba
   * de golpe a su sitio viejo.
   *
   * La que SÍ participa no se toca: arrastrarla estira el final de su
   * trazo (§5.5) y su arranque sigue siendo el mismo. Lo mismo el
   * balón de alguien que participa: va con él. Y después, las fases
   * siguientes se recalculan desde el sitio nuevo (§6.5).
   */
  _recolocadas(ids) {
    if (this.iFase !== 0 || !ids || !ids.length) return;
    const participa = new Set(this.tramos.flatMap((t) => [t.elemento_id, t.corre_id, t.balon_id]).filter(Boolean));
    const movidas = new Set(ids);
    const entrada = { ...this.fases[0].entrada };
    const posesion = { ...(this.fases[0].posesion || {}) };
    let toco = false;
    for (const e of this.fichas.elementos) {
      const suyo = movidas.has(e.id) || (e.kind === 'balon' && movidas.has(e.portador_id));
      if (!suyo) continue;
      /* Y DE QUIÉN ES EL BALÓN AL EMPEZAR, si lo que se ha arrastrado es
         un balón: soltado encima de alguien pasa a ser suyo (§7.3), y
         sacado de sus manos se queda suelto. Sin apuntarlo aquí, la pista
         decía una cosa y la jugada que se guarda, otra. Si el balón ya
         sale en algo dibujado no se toca: ver `puedeAsignar`. */
      if (e.kind === 'balon' && movidas.has(e.id) && !balonEnJuego(this.fases, e.id)
        && (posesion[e.id] ?? null) !== (e.portador_id ?? null)) {
        posesion[e.id] = e.portador_id ?? null;
        toco = true;
      }
      if (participa.has(e.id) || (e.portador_id && participa.has(e.portador_id))) continue;
      entrada[e.id] = { x: e.x, y: e.y };
      toco = true;
    }
    if (!toco) return;
    for (const id of ids) if (this.fichas.elementos.some((e) => e.id === id && e.kind === 'jugador')) this._aMano.add(id);
    this.fases = this.fases.map((f, i) => (i === 0 ? { ...f, entrada, posesion } : f));
    this._recalcularSiguientes();
    /* Y se avisa DESPUÉS: el cambio de la pista ya se avisó, pero con la
       posesión vieja, y quién tiene el balón decide quién ataca. Con una
       sola fase no llegaba ningún aviso más, y lo que dependía de eso —el
       «defiende y tiene trazos de ataque», el autoguardado— se enteraba
       tarde. */
    this.onEscena?.(this.fichas.elementos);
  }

  /**
   * PONER UNA FICHA NUEVA (§2.3). Solo en la fase 1, que es donde empieza
   * la jugada: una ficha puesta en la fase 3 existiría desde el principio
   * sin haberse visto en las dos primeras, que es lo mismo que el §6.6
   * no deja hacer arrastrando.
   *
   * Un balón que cae encima de un jugador sin balón es suyo desde el
   * principio (§7.3). La ficha nueva queda seleccionada: si no iba ahí,
   * Supr la quita sin tener que buscarla.
   *
   * @returns la ficha puesta, o null
   */
  anadirFicha(spec, { x, y }) {
    if (this.iFase !== 0) {
      this.onNoPuede?.({ nombre: 'Poner una ficha' }, 'las fichas se ponen en la fase 1, que es donde empieza la jugada');
      return null;
    }
    this.cerrar();
    this.repaso.parar();
    const pista = this.lienzo.vista.pistaKey;
    let lista = anadir(this.fichas.elementos, spec, x, y);
    const nueva = lista[lista.length - 1];
    if (nueva.kind === 'balon') {
      const jugador = acierto(lista.filter((e) => e.kind === 'jugador'), nueva, { pista });
      if (jugador && !llevaBalon(lista, jugador.id)) lista = asignarBalon(lista, nueva.id, jugador.id, pista);
    }
    this.fichas.seleccion = new Set([nueva.id]);
    this.fichas._cambio(lista);
    const puesta = this.fichas.elementos.find((e) => e.id === nueva.id);
    this.fases = conFichaNueva(this.fases, puesta);
    this._recalcularSiguientes();
    /* Un defensor puesto desde el panel se coloca solo donde le toca
       (§8.1), y con él se recolocan los demás defensores que nadie haya
       movido a mano: al entrar uno nuevo, los papeles cambian —quién
       retrasa, quién hace la V— y, si no, dos acababan en el mismo punto.
       Arrastrado después, se queda donde se deje. */
    const colocada = puesta.kind === 'jugador' ? this._recolocarDefensa(puesta.id) : null;
    // lo mismo que al recolocar: avisar con la escena ya apuntada
    this.onEscena?.(this.fichas.elementos);
    this._pintarAyuda();
    return colocada || puesta;
  }

  /**
   * Coloca a los defensores donde dice su regla (§8.1, §8.3), con la
   * escena que se está viendo. Se recolocan todos MENOS los que el
   * entrenador haya arrastrado a mano: esos se quedan donde los dejó.
   *
   * @param nuevo  la ficha recién puesta, que siempre se coloca
   * @returns la ficha nueva, ya colocada, o null
   */
  _recolocarDefensa(nuevo = null) {
    const papeles = this.papelesDeFase();
    if (!papeles.defensores.length) return null;
    const quienes = papeles.defensores.filter((d) => d === nuevo || !this._aMano.has(d));
    if (!quienes.length) return null;
    const sitios = colocar({
      pista: this.lienzo.vista.pistaKey, canasta: this.canastaEnCurso,
      elementos: this.fichas.elementos, papeles, defensa: this.defensa, solo: quienes,
    });
    const movidos = {};
    for (const [id, s] of Object.entries(sitios)) movidos[id] = { x: s.x, y: s.y };
    if (!Object.keys(movidos).length) return null;
    /* En la fase 1 el sitio es además su arranque. En otra fase la defensa
       llega desde la anterior, así que ahí solo se mueve lo que se ve. */
    if (this.iFase === 0) {
      this.fases = this.fases.map((f, i) => (i === 0 ? { ...f, entrada: { ...(f.entrada || {}), ...movidos } } : f));
    }
    this.fichas._cambio(mover(this.fichas.elementos, movidos));
    this._recalcularSiguientes();
    return nuevo ? (this.fichas.elementos.find((e) => e.id === nuevo) || null) : null;
  }

  /**
   * QUITAR LO SELECCIONADO (§2.2, Supr). Una ficha con trazos NO se
   * quita: se dice quién y cómo, y todo se queda como estaba. Quitarla se
   * llevaría por delante sus trazos —y los pases que recibe— sin que
   * nadie lo haya pedido, y todavía no hay deshacer que los devuelva.
   * Primero se borran sus trazos (pincharlos y Supr), y luego ella.
   *
   * Sin trazos, se quita de TODAS las fases: nunca se ha movido, así que
   * no hay ninguna en la que no esté.
   *
   * @returns true si se ha quitado algo
   */
  quitarSeleccion() {
    const ids = [...this.fichas.seleccion].filter((id) => this.fichas.elementos.some((e) => e.id === id));
    if (!ids.length) return false;
    const conTrazos = ids
      .filter((id) => tramosConFicha(this.fases, id).length)
      .map((id) => this.nombreDe(this.fichas.elementos.find((e) => e.id === id)));
    if (conTrazos.length) {
      this.onNoPuede?.({ nombre: 'Quitar' },
        /* «Aparece» y no «tiene trazos»: también cuenta quien recibe un pase
           o a quien se le pone un bloqueo, que no han dibujado nada. */
        `${conTrazos.join(', ')} ${conTrazos.length > 1 ? 'aparecen' : 'aparece'} en lo dibujado; borra antes esos trazos (pincha el trazo y pulsa Supr)`);
      return false;
    }
    this.cerrar();
    this.repaso.parar();
    this.fases = sinFichas(this.fases, ids);
    this.fichas.seleccion = new Set();
    this.fichas._cambio(quitar(this.fichas.elementos, ids));
    this._pintarAyuda();
    return true;
  }

  /**
   * BORRAR UN TRAMO (§2.2: Supr con el trazo en edición y ningún nodo
   * elegido). Quien lo recorría vuelve a donde estaba al empezarlo, y el
   * balón a quien lo tuviera entonces: es volver a entrar en esta fase,
   * que ya sabe colocar a todos a partir de lo que queda dibujado. Las
   * fases siguientes se recalculan desde ahí (§6.5).
   */
  borrarTramo(id) {
    if (!this.tramos.some((t) => t.id === id)) return false;
    this.cerrar();
    this.repaso.parar();
    this.tramos = this.tramos.filter((t) => t.id !== id);
    this._recalcularSiguientes();
    this.irAFase(this.iFase);
    return true;
  }

  _borrarElQueSeEdita() {
    const t = this._editando;
    if (t) this.borrarTramo(t.id);
  }

  /**
   * Cambia el aro al que se ataca. Lo ya dibujado no se toca —se guarda
   * el trazo exacto (§0)—; lo nuevo, el imán y los destinos automáticos
   * («entra», «recoge») ya miran al aro nuevo.
   */
  setCanasta(canasta) {
    if (!canasta || canasta === this.canasta) return;
    this.canasta = canasta;
    this._ponerCanastaDeTrabajo();
    this.lienzo.pintar();
  }

  /**
   * La jugada tal y como se guarda (§11.1): la escena AL EMPEZAR la fase
   * 1 —posiciones de arranque y quién tiene cada balón— y por cada fase
   * sus tramos. Es lo que se compila y lo que hay que reabrir.
   */
  jugada() {
    const inicio = this.fases[0].entrada || {};
    const posesion = this.fases[0].posesion || {};
    return {
      version: 3,
      pista: this.lienzo.vista.pistaKey,
      canasta: this.canasta,
      elementos: this.fichas.elementos.map((e) => ({
        ...e,
        ...(inicio[e.id] || {}),
        ...(e.kind === 'balon' ? { portador_id: posesion[e.id] ?? null } : {}),
      })),
      fases: this.fases.map((f) => ({
        id: f.id,
        nombre: f.nombre ?? null,
        duracion_ms: f.duracion_ms ?? null,
        pausa_post_ms: f.pausa_post_ms ?? null,
        tramos: f.tramos,
        // lo que algún defensor hace distinto en esa fase (§8.5)
        defensa: f.defensa || {},
      })),
      defensa: this.defensa,
    };
  }

  /* ---- los papeles (§8.1, §8.2) ---------------------------- */

  /**
   * Quién ataca, quién defiende a quién y en qué situación, al empezar y
   * en cada fase. Lo contesta motor/defensa.js con la jugada tal y como se
   * guarda: es la misma respuesta que usa el compilador, así que la
   * Pizarra y el proyector no pueden enseñar defensas distintas.
   *
   * Se pregunta en cada pintada —el arco de cada defensor, las líneas de
   * los pares—, así que se recuerda la última respuesta mientras no cambie
   * nada de lo que la decide: los jugadores, dónde empiezan, quién tiene
   * el balón y los ajustes.
   */
  papeles() {
    const entrada = this.fases[0].entrada || {};
    const clave = JSON.stringify([
      this.lienzo.vista.pistaKey, this.defensa, this.fases.length, this.fases[0].posesion || {},
      /* Lo declarado cambia los pares (§8.5), así que la respuesta de
         antes ya no vale. Y lo que mueve el balón cambia quién ataca en
         la fase siguiente (§8.6): pases, tiros y recogidas. */
      this.fases.map((f) => f.defensa || null),
      this.fases.map((f) => (f.tramos || []).map((t) => [t.id, t.elemento_id, t.corre_id, t.receptor_id ?? null, t.balon_id ?? null, t.desenlace ?? null])),
      this.fichas.elementos.filter((e) => e.kind === 'jugador').map((e) => [
        e.id, e.equipo, e.label, e.dorsal, e.en_juego, e.defiende_a ?? null,
        entrada[e.id] ? entrada[e.id].x : e.x, entrada[e.id] ? entrada[e.id].y : e.y,
      ]),
    ]);
    if (!this._papeles || this._papeles.clave !== clave) {
      this._papeles = { clave, valor: papelesDeJugada(this.jugada()) };
    }
    return this._papeles.valor;
  }

  /** Los papeles de la fase que se está editando. */
  papelesDeFase() {
    const p = this.papeles();
    return p.fases[this.iFase] || p.inicio;
  }

  /* ---- los ajustes de la defensa (§2.4, §8) ---------------- */

  /**
   * Cambia los ajustes de la defensa del ejercicio: la regla, quién
   * ataca, la situación forzada o los números. Lo que no valga se queda
   * como estaba (pasa por `normalizarDefensa`).
   */
  setDefensa(parcial = {}) {
    const nueva = normalizarDefensa({ ...this.defensa, ...parcial }).defensa;
    for (const k of ['preajuste', 'situacion', 'ataca']) {
      if (k in parcial && nueva[k] !== parcial[k]) nueva[k] = this.defensa[k];
    }
    /* Y un número que no valga no se lleva por delante los que ya estaban
       cambiados: se queda el de antes. */
    if (parcial.parametros) {
      for (const [k, v] of Object.entries(this.defensa.parametros || {})) {
        if (!(k in nueva.parametros) && (!(k in parcial.parametros) || parcial.parametros[k] === v)) nueva.parametros[k] = v;
      }
    }
    this.defensa = nueva;
    this.onEscena?.(this.fichas.elementos);
    this.lienzo.pintar();
    return this.defensa;
  }

  /**
   * «Defiende a…» (§8.1): cambia el par de un defensor DESDE EL PRINCIPIO.
   * Si ese atacante ya tenía defensor, se intercambian: el otro pasa a
   * defender al que tenía este. `null` vuelve a emparejarlo solo.
   * @returns true si se ha cambiado
   */
  setParDe(defensor, atacante = null) {
    const { pares, defensores, atacantes } = this.papeles().inicio;
    if (!defensores.includes(defensor)) return false;
    if (atacante != null && !atacantes.includes(atacante)) return false;
    const antes = pares[defensor] ?? null;
    const otro = atacante == null ? null : defensores.find((d) => d !== defensor && pares[d] === atacante);
    this.fichas._cambio(this.fichas.elementos.map((e) => {
      if (e.id === defensor) return { ...e, defiende_a: atacante };
      if (otro && e.id === otro) return { ...e, defiende_a: antes };
      return e;
    }));
    this.lienzo.pintar();
    return true;
  }

  /** La regla propia de un defensor (§8.3), o `null` para la del ejercicio. */
  setReglaDe(defensor, regla = null) {
    if (regla != null && !REGLAS.includes(regla)) return false;
    if (!this.papeles().inicio.defensores.includes(defensor)) return false;
    this.fichas._cambio(this.fichas.elementos.map((e) => (e.id === defensor ? { ...e, regla_defensa: regla } : e)));
    this.lienzo.pintar();
    return true;
  }

  /** Por qué está ahí el defensor seleccionado (§8.7), o null si lo
   *  seleccionado no es un solo defensor. */
  explicarSeleccion() {
    const ids = [...this.fichas.seleccion];
    if (ids.length !== 1) return null;
    const papeles = this.papelesDeFase();
    if (!papeles.defensores.includes(ids[0])) return null;
    return explicarRegla({
      pista: this.lienzo.vista.pistaKey, canasta: this.canastaEnCurso,
      elementos: this.fichas.elementos, papeles, defensa: this.defensa, defensor: ids[0],
    });
  }

  /* Arrastrar la línea de un par a otro atacante (§8.1). */
  _atenderPareja(intento) {
    const pista = this.lienzo.vista.pistaKey;
    const m = this.lienzo.metros(intento.agarrePx);
    const minimoM = Number.isFinite(m) ? m : 0;
    if (acierto(this.fichas.elementos, intento, { pista, minimoM })) return null;
    const { pares, atacantes } = this.papelesDeFase();
    const px = this.lienzo.metros(this.lienzo.agarre(8, intento.tipoPuntero));
    const tolerancia = Number.isFinite(px) && px > 0 ? px : RADIO_NODO;
    const donde = (id) => this.fichas.elementos.find((e) => e.id === id);
    /* La MÁS CERCANA al dedo, no la primera que caiga dentro: con dos
       líneas juntas se arrastraba la que no era. */
    let pareja = null;
    for (const [d, a] of Object.entries(pares)) {
      const pd = a && donde(d);
      const pa = a && donde(a);
      if (!pd || !pa) continue;
      const c = segmentoEn(nuevoTrazo(pd, pa), intento, { pista, tolerancia });
      if (c && (!pareja || c.metros < pareja.metros - 1e-9)) pareja = { d, metros: c.metros };
    }
    if (!pareja) return null;
    const defensor = pareja.d;
    return {
      mover: (p) => { this._arrastrePareja = { defensor, punto: { x: p.x, y: p.y } }; this.lienzo.pintar(); },
      soltar: (p) => {
        this._arrastrePareja = null;
        const quien = acierto(this.fichas.elementos.filter((e) => atacantes.includes(e.id)), p, { pista, minimoM });
        if (quien) this.setParDe(defensor, quien.id);
        else this.onNoPuede?.({ nombre: 'Cambiar el par' }, 'suelta la línea encima de un atacante');
        this.lienzo.pintar();
      },
      tocar: (p) => {
        /* Un toque en la línea es un toque en el suelo: deselecciona —con
           Mayús no, igual que el marco de las fichas— y puede pinchar un
           trazo. */
        this.fichas.seleccionar(alPinchar(this.fichas.seleccion, null, { shift: intento.shift }));
        this._tocarSuelo({ x: p.x, y: p.y, tipoPuntero: p.tipoPuntero });
      },
      abortar: () => { this._arrastrePareja = null; this.lienzo.pintar(); },
    };
  }

  /** Los trazos de quien defiende que no son cosa de la defensa (ver
   *  motor/defensa.js, `tramosQueNoEncajan`). */
  tramosQueNoEncajan() {
    return tramosQueNoEncajan(this.jugada(), this.papeles(), (slug) => {
      const a = this._accionDe(slug);
      return !a || saleEn(a, 'defensor');
    });
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
      /* UN BALÓN QUE LLEVA ALGUIEN NO ESTIRA SU PASE si ese alguien ya ha
         hecho algo después: el balón se ha movido con él, no lo ha
         arrastrado nadie, y el pase acabó donde lo recibió. Sin esto, al
         botar el receptor el final del pase se iba hasta donde acababa el
         bote, y en el proyector el balón volaba al sitio equivocado. */
      if (e.kind === 'balon' && e.portador_id) {
        const i = tramos.indexOf(ultimo);
        if (tramos.some((t, k) => k > i && t.corre_id === e.portador_id)) continue;
      }
      /* UN TIRO NO SE ESTIRA: su final es el aro (§5.3), y el balón queda
         donde cae, no en la punta. Sin esto, al soltar el tiro el final se
         iba del aro al rebote. */
      if (esTiro(ultimo)) continue;
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

       Y quién defiende sale de los papeles de ESTA fase (§8.1), que se
       calculan cada vez: tampoco se guarda en la ficha. */
    return {
      llevaBalon: llevaBalon(this.fichas.elementos, elemento.id),
      esDefensor: this.papelesDeFase().defensores.includes(elemento.id),
    };
  }

  /** Los tramos de la fase que se está editando. */
  get tramos() { return this.fases[this.iFase].tramos; }
  set tramos(v) {
    this.fases = this.fases.map((f, i) => (i === this.iFase ? { ...f, tramos: v } : f));
  }

  /** Dónde está cada ficha al EMPEZAR la fase que se edita. */
  get entrada() { return this.fases[this.iFase].entrada; }

  /**
   * REABRIR UNA JUGADA GUARDADA PARA SEGUIR EDITÁNDOLA (§11.1).
   *
   * Lo que llega de la base de datos no se da por bueno: pasa antes por
   * `normalizarJugada`, que deja fuera lo que no entiende y lo dice. Si
   * no hay jugada pero sí la animación de un ejercicio de antes de la
   * Pizarra, se abre con sus posiciones iniciales y una fase vacía, para
   * rehacerla desde ahí (§11.4).
   *
   * Las entradas de las fases siguientes no se guardan: se DEDUCEN
   * recalculando desde la escena del principio. Guardarlas sería guardar
   * dos veces lo mismo, y la segunda copia es la que acaba vieja.
   *
   * @param guardada  la jugada tal y como sale de la columna `jugada`
   * @param animacion la animación, por si la jugada no está
   * @returns { ok, avisos }
   */
  cargar(guardada, { animacion = null } = {}) {
    let r = normalizarJugada(guardada);
    const avisos = [];
    if (!r.jugada && animacion) {
      r = normalizarJugada(jugadaDesdeAnimacion(animacion));
      if (r.jugada) avisos.push('Este ejercicio es de antes de la Pizarra: se abre con sus posiciones iniciales para rehacerlo.');
    }
    avisos.push(...r.avisos);
    if (!r.jugada) return { ok: false, avisos };
    const j = r.jugada;
    const pista = this.lienzo.vista.pistaKey;
    /* La defensa se adopta TAL CUAL, sin recolocar a nadie: lo guardado
       es lo que se dibujó. */
    this.defensa = j.defensa || defensaPorDefecto();
    if (j.pista !== pista) avisos.push(`La jugada es de pista «${j.pista}» y la pizarra está en «${pista}»: hay que abrirla en su pista.`);
    /* La canasta, en cambio, SÍ se adopta: es un dato de la jugada y no
       de la pizarra, y se puede cambiar en caliente. Solo avisando, al
       reabrir un ejercicio que atacaba la canasta 2 la pizarra seguía
       mirando a la 1, y al guardar se cambiaba de aro sin que nadie lo
       hubiera pedido. */
    if (j.canasta !== this.canasta) this.setCanasta(j.canasta);

    this.cerrar();
    this.repaso.parar();
    /* Los nombres nuevos siguen DESPUÉS de los guardados: empezando otra
       vez desde 1, la primera ficha o el primer tramo que se añadiera se
       llamaría igual que uno de los que ya hay, y se moverían juntos. */
    continuarIds(j.elementos);
    siguiente = Math.max(siguiente, r.siguienteTramo);

    const entrada = Object.fromEntries(j.elementos.map((e) => [e.id, { x: e.x, y: e.y }]));
    const posesion = Object.fromEntries(j.elementos.filter((e) => e.kind === 'balon').map((e) => [e.id, e.portador_id ?? null]));
    const papelesCargados = papelesDeJugada(j);
    const rc = recalcular(j.fases.map((f) => ({ ...f, carriles: carrilesDesde(f.tramos) })), entrada, pista, {
      canasta: this.canasta,
      canastaDe: (i) => (papelesCargados.fases[i] || {}).canasta,
    });
    this.fases = j.fases.map((f, i) => ({
      ...nuevaFase(f.id),
      ...f,
      entrada: rc.entradas[i] || entrada,
      ...(i === 0 ? { posesion } : {}),
    }));
    this._huerfanos = rc.huerfanos;
    /* La escena tal y como empezaba, y después a la fase 1 como si se
       hubiera ido a ella: así las fichas quedan en la punta de sus
       trazos y el balón en las manos de quien lo tiene al acabarla, que
       es exactamente lo que se ve al dibujar. */
    this.iFase = 0;
    this.fichas.poner(j.elementos.map((e) => ({ ...e })));
    this._aMano = new Set(j.elementos.filter((e) => e.kind === 'jugador').map((e) => e.id));
    this.irAFase(0);
    return { ok: true, avisos };
  }

  /** En qué fase se está dibujando, contando desde uno. */
  get numeroDeFase() { return this.iFase + 1; }

  nombreDe(e) {
    if (!e) return 'esa ficha';
    if (e.kind === 'balon') return 'el balón';
    if (e.kind === 'jugador') return `${e.equipo || ''}${numeroDe(e) || ''}`.trim() || 'ese jugador';
    return e.nombre || 'eso';
  }

  /**
   * LA CANASTA A LA QUE SE ATACA EN LA FASE QUE SE EDITA (§8.6).
   *
   * `this.canasta` es la de la jugada —la que se guarda y la que elige el
   * entrenador arriba—; esta es la de AHORA: si en una fase anterior
   * robaron, cogieron un rebote defensivo o anotaron, se ataca al otro
   * aro desde la siguiente.
   */
  get canastaEnCurso() {
    return (this.papeles().fases[this.iFase] || {}).canasta || this.canasta;
  }

  /* La canasta con la que trabajan los gestos: dónde va «entra», dónde
     cae un tiro, hacia dónde se coloca la defensa. */
  _ponerCanastaDeTrabajo() {
    const k = this.canastaEnCurso;
    this.fichas.canasta = k;
    this.dibujo.canasta = k;
    this.nodos.canasta = k;
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
    const defensa = this._defensaDeLasFases();
    this.repaso.reproducirFase({ tramos: this._paraRepaso(this.tramos, tiempos, 0, defensa[this.iFase]) });
    this._cerrarFaseAlAcabar = true;
    return true;
  }

  /** Reproduce la fase que se está editando, sin cerrarla: el botón de
   *  la línea de tiempo, para verla las veces que haga falta. */
  reproducirFase() {
    if (!this.tramos.length) return false;
    this.cerrar();
    const { tiempos } = this.faseEnCurso();
    const defensa = this._defensaDeLasFases();
    this.repaso.reproducirFase({ tramos: this._paraRepaso(this.tramos, tiempos, 0, defensa[this.iFase]) });
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
    const defensa = this._defensaDeLasFases();
    let desfase = 0;
    for (let i = 0; i < this.fases.length; i++) {
      const f = this.fases[i];
      const fase = { ...f, carriles: carrilesDesde(f.tramos) };
      const tiempos = tiemposDe(fase, { pista });
      todos.push(...this._paraRepaso(f.tramos, tiempos, desfase, defensa[i]));
      desfase += tiempos.duracion_ms;
    }
    if (!todos.length) return false;
    this.repaso.reproducirFase({ tramos: todos });
    return true;
  }

  /**
   * LA DEFENSA QUE SE MUEVE SOLA (§8.4), fase a fase.
   *
   * No se calcula aquí: se le pregunta al compilador, que es quien la
   * calcula para el proyector. Con dos cuentas, la Pizarra enseñaría una
   * defensa y la animación otra, que es justo lo que el principio 4 no
   * permite. Es una cuenta cara, así que se pide cuando hace falta —al
   * reproducir y al cambiar de fase—, no en cada pintada.
   *
   * @returns { [fase]: { [ficha]: { muestras: [{ t, x, y }], fin } } }
   */
  _defensaDeLasFases() {
    if (!this.papeles().inicio.defensores.length) return {};
    /* Compilar no es gratis y esto se pregunta en cada refresco de la
       línea de tiempo: se recuerda la última respuesta mientras la
       jugada sea la misma, igual que los papeles. */
    const clave = JSON.stringify(this.jugada());
    if (this._defensaCache && this._defensaCache.clave === clave) return this._defensaCache.valor;
    let anim = null;
    try { anim = compilar(this.jugada()); } catch { return {}; }
    /* El compilador habla por nombres (A1, B2) y aquí se habla por
       fichas: se deshace el cambio con su misma cuenta. */
    const ficha = new Map();
    for (const e of this.fichas.elementos) {
      if (e.kind === 'jugador') ficha.set(`${e.equipo || 'A'}${e.label || '0'}`, e.id);
    }
    const porFase = {};
    for (const f of (anim.fases || [])) {
      const r = {};
      for (const m of (f.movimientos || [])) {
        if (!m.automatico || !Array.isArray(m.muestras) || m.muestras.length < 2) continue;
        const id = ficha.get(m.elemento_id);
        if (!id) continue;
        const u = m.muestras[m.muestras.length - 1];
        r[id] = { muestras: m.muestras, fin: { x: u.x, y: u.y } };
      }
      /* Por el índice de la jugada, no por el sitio en la lista: las
         fases vacías no se compilan. */
      if (Object.keys(r).length) porFase[f.indice] = r;
    }
    this._defensaCache = { clave, valor: porFase };
    return porFase;
  }

  /** Donde deja a cada defensor el seguimiento de esta fase. */
  _finDeLaDefensa(iFase, defensa = null) {
    const d = (defensa || this._defensaDeLasFases())[iFase] || {};
    const fin = {};
    for (const [id, s] of Object.entries(d)) fin[id] = { x: s.fin.x, y: s.fin.y };
    return fin;
  }

  /**
   * Lo que el repaso tiene que recorrer de unos tramos: cada uno con su
   * arranque, y después de cada tiro, el balón hasta donde cae. Sin ese
   * último trozo el balón saltaba del aro al rebote de golpe, y en el
   * proyector se le ve caer (principio 4).
   *
   * Y con ellos, la defensa de esa fase: no tiene trazo —nadie lo ha
   * dibujado— sino las muestras del seguimiento (§8.4).
   */
  _paraRepaso(tramos, tiempos, desfase = 0, defensa = null) {
    const lista = [];
    for (const [id, s] of Object.entries(defensa || {})) {
      lista.push({ corre_id: id, muestras: s.muestras, inicio_ms: desfase, duracion_ms: tiempos.duracion_ms });
    }
    for (const t of tramos) {
      const m = tiempos.tramos[t.id];
      if (!m) continue;
      lista.push({ corre_id: t.corre_id, trazo: t.trazo, inicio_ms: desfase + m.inicio_ms, duracion_ms: m.duracion_ms });
      if (esTiro(t)) {
        const tras = this._trasElTiro(t);
        if (tras) lista.push({ corre_id: t.corre_id, trazo: tras, inicio_ms: desfase + m.fin_ms, duracion_ms: TRAS_EL_TIRO_MS });
      }
    }
    return lista;
  }

  /** El viaje del balón después de un tiro: del aro a donde cae. */
  _trasElTiro(t) {
    const fin = t.trazo[t.trazo.length - 1];
    const cae = trasElTiro({ pista: this.lienzo.vista.pistaKey, canasta: this.canastaEnCurso, desde: t.trazo[0], desenlace: t.desenlace });
    return cae ? [{ x: fin.x, y: fin.y, tipo_nodo: 'lineal' }, { x: cae.x, y: cae.y, tipo_nodo: 'lineal' }] : null;
  }

  /** La pista y la canasta con las que se calcula dónde acaba cada cosa. */
  _opcionesFase() { return { pista: this.lienzo.vista.pistaKey, canasta: this.canastaEnCurso }; }

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
        entrada: { ...posicionesFinales(fase, this.entrada, this._opcionesFase()), ...this._finDeLaDefensa(this.iFase) },
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
    this._ponerCanastaDeTrabajo();
    const { fase } = this.faseEnCurso();
    /* Los defensores no tienen trazo, pero se han movido: acaban donde
       les deja su seguimiento (§8.4), que es donde los va a dejar el
       proyector. */
    const finales = { ...posicionesFinales(fase, this.entrada, this._opcionesFase()), ...this._finDeLaDefensa(n) };
    /* Y de quién es cada balón AL ACABAR ESA FASE, repasando lo dibujado
       desde el principio: el modelo solo sabe de quién es ahora, que es
       lo último que se dibujó, y al volver a una fase anterior eso ya no
       vale. El balón que lleva alguien va con él, esté donde esté: si no,
       el de alguien que botó se quedaba donde empezó el bote. */
    const duenos = posesionAlFinal(this.fases, n, this.fases[0].posesion || {});
    const colocadas = this.fichas.elementos.map((e) => {
      const f = finales[e.id] ? { ...e, ...finales[e.id] } : e;
      return e.kind === 'balon' && e.id in duenos ? { ...f, portador_id: duenos[e.id] } : f;
    });
    this.fichas.poner(seguirAlPortador(colocadas, this.lienzo.vista.pistaKey));
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
    const papeles = this.papeles();
    const r = recalcular(conCarriles, this.fases[0].entrada, pista, {
      canasta: this.canasta,
      canastaDe: (i) => (papeles.fases[i] || {}).canasta,
    });
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
    this._cerrarDesenlace();
    this.anillo.cerrar();
    this.dibujo.cancelar();
    this.companero.cancelar();
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
    opciones = null, nivel = 'interior', centro = null, accion = null, conMas = null, variante = null,
  } = {}) {
    const estado = estadoDe(this.estadoDe(elemento));
    const lista = opciones || anilloDe(estado);
    const [cx, cy] = this.lienzo.vista.toPx(en.x, en.y);
    this._ancla = { elemento, en, estado };
    this.anillo.abrir({
      cx, cy, opciones: lista, nivel, centro, accion, variante,
      conMas: conMas === null ? resto(estado).length > 0 : conMas,
    });
    /* Y el foco vuelve al lienzo, como hacen Dibujo y Nodos al entrar.
       Al abrir el segundo anillo se quita la capa con el botón recién
       pulsado dentro, y el foco se cae a `document.body`: sin esto, la
       tecla de arriba no llegaría nunca a quién la escucha. */
    this.lienzo.el.focus?.({ preventScroll: true });
    this._pintarAyuda();
  }

  _elegir(slug, { variante = null, opcion = null, desenlace = null } = {}) {
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

    const pide = necesita(accion);
    /* UN TIRO PREGUNTA SI ENTRA O FALLA (§4.4), con dos botones grandes
       junto al aro: es lo que decide dónde acaba el balón. Va después del
       «cómo» y antes de dibujar nada. */
    if (pide.desenlace && !desenlace) {
      const aro = posicionesDe(this.lienzo.vista.pistaKey, this.canastaEnCurso)?.aro;
      this._abrirAnillo(elemento, aro ? { x: aro[0], y: aro[1] } : en, {
        opciones: [
          { slug: 'entra', nombre: 'Entra', icono: '✓', descripcion: 'Entra: el balón cae bajo el aro' },
          { slug: 'falla', nombre: 'Falla', icono: '✗', descripcion: 'Falla: el balón rebota y queda suelto' },
        ],
        nivel: 'desenlace', centro: `${accion.nombre}: ¿entra?`, accion: slug, variante, conMas: false,
      });
      return;
    }

    this.anillo.cerrar();

    /* LO QUE UN DEFENSOR HACE DISTINTO (§8.5). No dibuja un trazo: se
       declara para esa fase y la defensa que se mueve sola (§8.4) le
       lleva. «Defiende» es volver a lo de siempre: marcar a quien se le
       señale, sin nada declarado. */
    if (ACCIONES_DEFENSOR.includes(accion.slug) || accion.slug === 'defiende') {
      if (!this.papelesDeFase().defensores.includes(elemento.id)) {
        this.onNoPuede?.(accion, 'ahora mismo no está defendiendo');
        this._pintarAyuda();
        return;
      }
      if (!pide.companero) { this._declarar(elemento, accion, null); return; }
      this._enCurso = { elemento, accion, variante };
      this.companero.empezar({
        elemento, accion, variante, conDedo: this._conDedo,
        vale: (ficha) => porQueNoCompanero(accion, elemento, ficha) || this._porQueNoObjetivo(accion, ficha),
      });
      this._pintarAyuda();
      return;
    }

    /* «PINCHA A QUIÉN» (§4.4). De las acciones entre dos, el bloqueo se
       dibuja: se señala al compañero y el bloqueador va solo a su sitio. */
    if (pide.companero) {
      if (!esAccionDeBloqueo(accion)) { this.onSinSoporte?.(accion); this._pintarAyuda(); return; }
      this._enCurso = { elemento, accion, variante };
      this.companero.empezar({
        elemento, accion, variante, conDedo: this._conDedo,
        vale: (ficha) => porQueNoCompanero(accion, elemento, ficha),
      });
      this._pintarAyuda();
      return;
    }

    /* LO QUE YA SABE A DÓNDE VA, NO SE PREGUNTA. «Entra» va al aro y
       «recoge» va a por el balón suelto: el catálogo lo dice, así que se
       calcula el trazo y se dibuja hecho. Si no gusta, se pincha y se
       mueven sus nodos, que es lo que ya funciona — la decisión tomada
       es automático y ajustable. */
    if (tieneDestinoPropio(accion)) {
      const d = destinoDe(accion, elemento, {
        pista: this.lienzo.vista.pistaKey,
        canasta: this.canastaEnCurso,
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
        desenlace,
      });
      return;
    }

    if (!pide.destino) { this.onSinSoporte?.(accion); this._pintarAyuda(); return; }
    this._enCurso = { elemento, accion, variante };
    this.dibujo.empezar({ elemento, accion, variante, conDedo: this._conDedo });
  }

  /**
   * El compañero de un bloqueo ya está señalado: el bloqueador va solo a
   * su sitio (§4.4) y el trazo se dibuja hecho, como el de «entra». Si el
   * sitio no gusta, se pincha el trazo y se mueve su final.
   */
  _companeroElegido(ficha, { elemento, accion, variante }) {
    this._enCurso = null;
    const lista = this.fichas.elementos;
    const desde = lista.find((e) => e.id === elemento.id) || elemento;
    /* Lo de la defensa no dibuja trazo: se declara (§8.5). */
    if (!esAccionDeBloqueo(accion)) { this._declarar(desde, accion, ficha.id); return; }
    /* A quién se bloquea de verdad: al defensor de su compañero, si lo
       hay. Sin defensa en la pista se sigue usando el supuesto. */
    const { pares } = this.papelesDeFase();
    const defensorId = Object.keys(pares).find((d) => pares[d] === ficha.id) || null;
    const defensor = defensorId ? (lista.find((e) => e.id === defensorId) || null) : null;
    const sitio = sitioDelBloqueo({
      pista: this.lienzo.vista.pistaKey,
      canasta: this.canastaEnCurso,
      desde,
      companero: ficha,
      conBalon: llevaBalon(lista, ficha.id),
      defensor,
    });
    if (!sitio) { this.onNoPuede?.(accion, 'en esta pista no hay un aro desde el que saber dónde ponerlo'); this._pintarAyuda(); return; }
    this._trazoHecho({
      elemento: desde, accion, variante,
      trazo: nuevoTrazo({ x: desde.x, y: desde.y }, sitio),
      /* La marca de bloqueo va en el DATO: es lo que leen los arranques,
         el compilador y el dibujo, y no depende del símbolo que traiga
         una acción del club. */
      tipo: 'bloqueo',
      companero: ficha.id,
      defensor: defensor ? defensor.id : null,
    });
  }

  /* Un objetivo que no vale para lo que se está declarando: ayudar es a
     un ATACANTE y cambiarse el par, con otro DEFENSOR. El equipo no
     basta: en una pista puede haber cuatro colores y solo dos papeles. */
  _porQueNoObjetivo(accion, ficha) {
    const { atacantes, defensores } = this.papelesDeFase();
    const pide = accion.slug === 'defiende' ? 'atacante' : SENALA[accion.slug];
    if (pide === 'atacante' && !atacantes.includes(ficha.id)) return 'no está atacando';
    if (pide === 'defensor' && !defensores.includes(ficha.id)) return 'no está defendiendo';
    return null;
  }

  /**
   * UN DEFENSOR HACE ALGO DISTINTO EN ESTA FASE (§8.5).
   *
   * No se dibuja nada: se declara, y el seguimiento (§8.4) le lleva. Se
   * guarda en la fase y no en un carril porque no es un camino (§11.1).
   *
   * «Defiende» es lo contrario: marca a quien se le señale y deja de
   * hacer lo que hubiera declarado, que es como se quita.
   */
  _declarar(defensor, accion, objetivoId) {
    const slug = accion.slug;
    if (slug === 'defiende') {
      if (objetivoId) this.setParDe(defensor.id, objetivoId);
      this.declararDefensa(defensor.id, null);
    } else {
      this.declararDefensa(defensor.id, { accion: slug, objetivo_id: objetivoId || null });
    }
    /* Y el anillo vuelve a salir sobre la ficha, como después de un
       trazo (§4.5): lo normal es encadenar. */
    this._pintarAyuda();
  }

  /**
   * Guarda (o quita, con `null`) lo que un defensor hace distinto en la
   * fase que se está editando.
   */
  declararDefensa(defensor, valor = null) {
    if (valor && !ACCIONES_DEFENSOR.includes(valor.accion)) return false;
    if (!this.papelesDeFase().defensores.includes(defensor)) return false;
    const defensa = { ...(this.fases[this.iFase].defensa || {}) };
    if (valor) defensa[defensor] = { accion: valor.accion, objetivo_id: valor.objetivo_id || null };
    else if (!(defensor in defensa)) return false;
    else delete defensa[defensor];
    this.fases = this.fases.map((f, i) => (i === this.iFase ? { ...f, defensa } : f));
    /* Las respuestas guardadas —los papeles y el seguimiento— se sueltan
       solas: lo declarado entra en las dos claves, y con una clave nueva
       se vuelve a calcular. Borrarlas aquí a mano no haría nada. */
    this._avisarDeFases();
    this.onTramos?.(this.tramos);
    this.lienzo.pintar();
    return true;
  }

  /** Lo que hace cada defensor en la fase que se edita (§8.5). */
  declaradas() { return this.fases[this.iFase].defensa || {}; }

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
  _trazoHecho({ elemento, accion, variante, trazo, tipo, balon = null, desenlace = null, companero = null, defensor = null }) {
    const fin = trazo[trazo.length - 1];
    const ritmo = ritmoDe(accion);
    const pista = this.lienzo.vista.pistaKey;
    /* «Recoge» es familia balón pero NO vuela el balón: el que va es el
       jugador, a por él. Metido en el mismo saco que el pase, la ficha
       se quedaba quieta y lo que se movía era el balón —al revés de lo
       que dice la acción. */
    const modo = accion.parametros && accion.parametros.modo;
    const recogiendo = modo === 'recoge';
    const tirando = modo === 'tiro';
    const vuelaElBalon = accion.familia === 'balon' && !recogiendo;

    let lista = this.fichas.elementos;
    let corre = elemento;
    let receptor = null;

    if (vuelaElBalon) {
      const balon = lista.find((e) => e.kind === 'balon' && e.portador_id === elemento.id);
      if (balon) {
        corre = balon;
        if (tirando) {
          /* UN TIRO NO TIENE RECEPTOR: va al aro. Buscándolo en la punta,
             un jugador debajo del aro convertía el tiro en un pase. El
             balón acaba donde lo deja el desenlace, suelto (§4.4). */
          const cae = trasElTiro({ pista, canasta: this.canastaEnCurso, desde: trazo[0], desenlace });
          lista = mover(soltarBalon(lista, balon.id), { [balon.id]: cae || { x: fin.x, y: fin.y } });
        } else {
          receptor = acierto(lista, fin, { pista, excluir: [elemento.id, balon.id] });
          if (receptor && receptor.kind !== 'jugador') receptor = null;
          lista = receptor
            ? asignarBalon(soltarBalon(lista, balon.id), balon.id, receptor.id, pista)
            : mover(soltarBalon(lista, balon.id), { [balon.id]: { x: fin.x, y: fin.y } });
        }
      }
    } else {
      lista = mover(lista, { [elemento.id]: { x: fin.x, y: fin.y } });
      /* Y si iba a por un balón, al llegar se lo queda: si no, el trazo
         acabaría a su lado y el balón seguiría suelto para siempre. */
      if (recogiendo && balon) lista = asignarBalon(lista, balon, elemento.id, pista);
    }

    const nuevo = {
      id: `tr${siguiente++}`,
      elemento_id: elemento.id,
      corre_id: corre.id,
      receptor_id: receptor ? receptor.id : null,
      /* Qué balón se va a recoger. Lo necesitan los arranques del §6.3:
         ir a por un balón suelto no puede empezar antes de que esté
         suelto, y para saber cuándo lo está hay que saber cuál es. */
      balon_id: recogiendo ? balon : null,
      /* Y dónde estaba ese balón, que después ya no se sabe: al llegar el
         jugador se lo queda y el balón pasa a ir con él. El compilador lo
         necesita para que viaje a sus manos desde el suelo y no aparezca
         en ellas de golpe. */
      balon_desde: (() => {
        const b = recogiendo && balon ? this.fichas.elementos.find((e) => e.id === balon) : null;
        return b ? { x: b.x, y: b.y } : null;
      })(),
      accion: accion.slug,
      variante,
      trazo, tipo, ritmo,
      // si entra o falla: solo los tiros, y es lo que dice dónde cae el balón
      ...(tirando ? { desenlace: desenlace === 'falla' ? 'falla' : 'entra' } : {}),
      // para quién es: solo los bloqueos, y es de quien sale cuando llega
      ...(companero ? { companero_id: companero } : {}),
      // y a quién se le pone: el defensor de verdad, si lo había
      ...(defensor ? { defensor_id: defensor } : {}),
    };
    this.tramos = [...this.tramos, nuevo];
    this._enCurso = null;

    /* Ya está todo en su sitio final (§5.4); el repaso solo pinta por el
       camino a quien viaja, mientras dura. */
    this.fichas._cambio(lista);
    if (tirando && corre !== elemento) {
      /* Un tiro se repasa entero: al aro, y el balón hasta donde cae. */
      const d = duracionRepaso(trazo, pista, ritmo) * 1000;
      const tras = this._trasElTiro(nuevo);
      this.repaso.reproducirFase({ tramos: [
        { corre_id: corre.id, trazo, inicio_ms: 0, duracion_ms: d },
        ...(tras ? [{ corre_id: corre.id, trazo: tras, inicio_ms: d, duracion_ms: TRAS_EL_TIRO_MS / VELOCIDAD_REPASO }] : []),
      ] });
    } else {
      this.repaso.reproducir({ elemento: corre, trazo, ritmo });
    }

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
    if (esTiro(tramo)) this._abrirDesenlace(tramo); else this._cerrarDesenlace();
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
      if (esTiro(mio)) {
        /* Un tiro corregido deja el balón donde cae, no en su punta. */
        const cae = trasElTiro({ pista, canasta: this.canasta, desde: trazo[0], desenlace: mio.desenlace });
        lista = mover(soltarBalon(this.fichas.elementos, mio.corre_id), { [mio.corre_id]: cae || { x: fin.x, y: fin.y } });
      } else if (mio.corre_id !== mio.elemento_id) {
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

  /* ---- el desenlace de un tiro ------------------------------ */

  /**
   * Cambia si un tiro entra o falla, sin borrarlo. Si es lo último que le
   * pasa a ese balón en la fase, el balón se va a su sitio nuevo; y las
   * fases de después se recalculan desde ahí.
   */
  cambiarDesenlace(id, desenlace) {
    if (desenlace !== 'entra' && desenlace !== 'falla') return false;
    const t = this.tramos.find((x) => x.id === id);
    if (!t || !esTiro(t) || t.desenlace === desenlace) return false;
    this.tramos = this.tramos.map((x) => (x.id === id ? { ...x, desenlace } : x));
    const actual = this.tramos.find((x) => x.id === id);
    if (this._editando && this._editando.id === id) this._editando = actual;
    const ultimo = [...this.tramos].reverse().find((x) => x.corre_id === t.corre_id);
    if (ultimo && ultimo.id === id) {
      const cae = trasElTiro({ pista: this.lienzo.vista.pistaKey, canasta: this.canasta, desde: t.trazo[0], desenlace });
      if (cae) this.fichas._cambio(mover(this.fichas.elementos, { [t.corre_id]: cae }));
    }
    this._recalcularSiguientes();
    this.onTramos?.(this.tramos);
    if (this._desenlace && this._desenlace.id === id) this._abrirDesenlace(actual);
    this.lienzo.pintar();
    return true;
  }

  /* Dos botones junto al aro mientras se corrige un tiro. Sin velo: la
     pista sigue siendo de los nodos, y esto solo añade dos pulsadores. */
  _abrirDesenlace(tramo) {
    this._cerrarDesenlace();
    const capa = h('div', { class: 'pz-nodo pz-desenlace' });
    const boton = (valor, texto) => {
      const b = h('button', {
        class: 'pz-nodo__b' + (tramo.desenlace === valor ? ' is-activo' : ''),
        type: 'button',
        title: valor === 'entra' ? 'El tiro entra' : 'El tiro falla',
        'aria-pressed': tramo.desenlace === valor ? 'true' : 'false',
      }, texto);
      b.addEventListener('pointerdown', (ev) => ev.stopPropagation());
      b.addEventListener('click', (ev) => { ev.stopPropagation(); this.cambiarDesenlace(tramo.id, valor); });
      return b;
    };
    capa.append(h('div', { class: 'pz-nodo__caja' }, boton('entra', '✓ Entra'), boton('falla', '✗ Falla')));
    this.lienzo.el.append(capa);
    this._desenlace = { capa, id: tramo.id };
    this._colocarDesenlace(this.lienzo.vista);
  }

  _cerrarDesenlace() {
    this._desenlace?.capa.remove();
    this._desenlace = null;
  }

  _colocarDesenlace(vista) {
    if (!this._desenlace || !vista || !vista.vw) return;
    const aro = posicionesDe(vista.pistaKey, this.canasta)?.aro;
    if (!aro) return;
    const [px, py] = vista.toPx(aro[0], aro[1]);
    const caja = this._desenlace.capa.firstChild;
    // debajo del aro, que es donde queda sitio; recortado al lienzo
    const limitar = (v, min, max) => (v < min ? min : v > max ? max : v);
    caja.style.left = `${limitar(px, 90, Math.max(90, vista.vw - 90))}px`;
    caja.style.top = `${limitar(py + 56, 30, Math.max(30, vista.vh - 30))}px`;
  }

  /* ---- la barra de arriba ------------------------------------ */

  ayuda() {
    if (this.dibujo.dibujando) return this.dibujo.ayuda();
    if (this.companero.eligiendo) return this.companero.ayuda();
    if (this.nodos.editando) return (this._desenlace ? '<b>Entra</b> o <b>Falla</b>, junto al aro, cambia el tiro · ' : '') + this.nodos.ayuda();
    if (this.anillo.abierto) return 'Elige qué hace esta ficha · pincha en la pista para saltarte el «cómo» · <b>Esc</b> cierra';
    if (this.fichas.seleccion.size) return 'Arrástrala para colocarla · tócala para ver qué puede hacer · <b>Supr</b> la quita · <b>Mayús</b> la pega a un sitio de la pista';
    return 'Arrastra una ficha del panel a la pista, o toca una de la pista para ver lo que puede hacer · pincha un trazo para corregirlo';
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
      this._pintarTramo(ctx, R, toPx, t);
    }
  }

  /* Un tramo con su flecha; y si es un bloqueo, con su barra al final,
     mirando al defensor al que se le pone —y si no se sabe cuál es,
     hacia donde llega—. Es lo mismo que pinta el motor al reproducirlo
     (engine.js, bloqueosEn). */
  _pintarTramo(ctx, R, toPx, t) {
    const flat = flattenPath(t.trazo).map((p) => { const [x, y] = toPx(p.x, p.y); return { x, y }; });
    drawArrow(ctx, flat, t.tipo, R.scale);
    if (!esBloqueo(t) || !flat.length) return;
    const suyo = t.defensor_id ? this.fichas.elementos.find((e) => e.id === t.defensor_id) : null;
    const frente = (suyo && (this.fichas.donde?.(suyo) || suyo))
      || frenteDelBloqueo(t.trazo) || this.fichas.elementos.find((e) => e.id === t.companero_id);
    if (!frente) return;
    const [x, y] = toPx(frente.x, frente.y);
    drawBloqueo(ctx, flat[flat.length - 1], { x, y }, R.scale, R.jugador);
  }

  /* La línea de cada par, entre defensor y atacante, donde se les ve
     ahora: si el repaso está moviendo a uno, la línea va con él. */
  _dibujarParejas({ ctx, toPx, hairline }) {
    const { pares } = this.papelesDeFase();
    const donde = (id) => {
      const e = this.fichas.elementos.find((x) => x.id === id);
      return e ? (this.fichas.donde?.(e) || e) : null;
    };
    ctx.save();
    ctx.strokeStyle = COLORS.ink;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = hairline(1.5);
    ctx.setLineDash([5, 5]);
    for (const [d, a] of Object.entries(pares)) {
      if (this._arrastrePareja && this._arrastrePareja.defensor === d) continue;
      const pd = a && donde(d);
      const pa = a && donde(a);
      if (!pd || !pa) continue;
      const [x1, y1] = toPx(pd.x, pd.y);
      const [x2, y2] = toPx(pa.x, pa.y);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    ctx.restore();
    /* La que se está arrastrando, del defensor al dedo. */
    const arr = this._arrastrePareja;
    const pd = arr && donde(arr.defensor);
    if (pd) {
      const [x1, y1] = toPx(pd.x, pd.y);
      const [x2, y2] = toPx(arr.punto.x, arr.punto.y);
      ctx.save();
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = hairline(2.5);
      ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.restore();
    }
  }

  /* La regla del defensor seleccionado: sus líneas, su círculo y su sitio. */
  _dibujarRegla({ ctx, toPx, hairline, metro }) {
    const x = this.explicarSeleccion();
    if (!x) return;
    ctx.save();
    ctx.strokeStyle = COLORS.accent;
    ctx.fillStyle = COLORS.accent;
    ctx.lineWidth = hairline(2);
    for (const q of x.primitivas) {
      if (q.tipo === 'linea' && q.a && q.b) {
        const [x1, y1] = toPx(q.a.x, q.a.y);
        const [x2, y2] = toPx(q.b.x, q.b.y);
        ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      } else if (q.tipo === 'circulo' && q.centro && Number.isFinite(metro)) {
        const [cx, cy] = toPx(q.centro.x, q.centro.y);
        ctx.setLineDash([3, 5]);
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.arc(cx, cy, q.metros * metro, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (q.tipo === 'punto' && q.p) {
        const [px, py] = toPx(q.p.x, q.p.y);
        ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(px, py, 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* El fantasma de la fase anterior: sus trazos, apagados. Se ve de
     dónde viene cada uno sin que compita con lo que se dibuja ahora. */
  _dibujarFantasma({ ctx, R, toPx }) {
    const previa = this.iFase > 0 ? this.fases[this.iFase - 1] : null;
    if (!previa) return;
    ctx.save();
    ctx.globalAlpha = 0.28;
    for (const t of previa.tramos) this._pintarTramo(ctx, R, toPx, t);
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
    this._quitarCapaParejas?.();
    this._quitarCapaRegla?.();
    this._quitarGestoPareja?.();
    this._quitarCapaAnillo?.();
    this._quitarCapaDesenlace?.();
    this._cerrarDesenlace();
    this.repaso.destroy();
    this.nodos.destroy();
    this.companero.destroy();
    this.dibujo.destroy();
    this.fichas.destroy?.();
  }
}
