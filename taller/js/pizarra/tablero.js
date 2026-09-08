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
import { Dibujo, ritmoDe } from './dibujo.js';
import { Nodos } from './nodos.js';
import { Repaso } from './repaso.js';
import { drawArrow } from '../canvas/arrows.js';
import { flattenPath } from '../canvas/geometry.js';
import {
  estadoDe, anilloDe, resto, variantesDe, tieneVariantes, necesita, ICONOS,
} from './repertorio.js';
import { segmentoEn, RADIO_NODO } from './trazo.js';
import { llevaBalon, mover, asignarBalon, soltarBalon } from './elementos.js';
import { acierto } from './seleccion.js';

let siguiente = 1;

export class Tablero {
  /**
   * @param onTramos      (tramos) — se ha dibujado, cambiado o borrado uno
   * @param onAyuda       (html|null) — qué tiene que decir la barra de arriba
   * @param onSinSoporte  (accion) — se ha elegido algo que esta capa no hace
   * @param onNoPuede     (accion, motivo) — se ha elegido algo imposible
   */
  constructor(lienzo, {
    canasta = 'norte', posiciones = {}, onTramos, onAyuda, onSinSoporte, onNoPuede,
  } = {}) {
    this.lienzo = lienzo;
    this.canasta = canasta;
    this.onTramos = onTramos;
    this.onAyuda = onAyuda;
    this.onSinSoporte = onSinSoporte;
    this.onNoPuede = onNoPuede;

    this.tramos = [];
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
    this.fichas.onTocarFicha = (e) => this._tocarFicha(e);
    this.fichas.onTocarSuelo = (p) => this._tocarSuelo(p);

    this.repaso = new Repaso(lienzo, { onFin: () => this._pintarAyuda() });
    this.fichas.donde = this.repaso.donde;

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
    this.tramos = [];
    this.repaso.parar();
    this.fichas.poner(elementos);
    this.onTramos?.(this.tramos);
    this._pintarAyuda();
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

  _tocarFicha(elemento) {
    if (this.dibujo.dibujando) return;   // en mitad de un trazo no se abre nada
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

    if (!necesita(accion).destino) { this.onSinSoporte?.(accion); this._pintarAyuda(); return; }
    this._enCurso = { elemento, accion, variante };
    this.dibujo.empezar({ elemento, accion, variante });
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
  _trazoHecho({ elemento, accion, variante, trazo, tipo }) {
    const fin = trazo[trazo.length - 1];
    const ritmo = ritmoDe(accion);
    const pista = this.lienzo.vista.pistaKey;
    const vuelaElBalon = accion.familia === 'balon';

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
    }

    this.tramos = [...this.tramos, {
      id: `tr${siguiente++}`,
      elemento_id: elemento.id,
      corre_id: corre.id,
      receptor_id: receptor ? receptor.id : null,
      accion: accion.slug,
      variante,
      trazo, tipo, ritmo,
    }];
    this._enCurso = null;

    /* Ya está todo en su sitio final (§5.4); el repaso solo pinta por el
       camino a quien viaja, mientras dura. */
    this.fichas._cambio(lista);
    this.repaso.reproducir({ elemento: corre, trazo, ritmo });

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

  destroy() {
    /* Primero cortar los gestos vivos y luego desmontar. Al revés, un
       arrastre a medias seguía llamando a manejadores de piezas ya
       destruidas. */
    this.lienzo.cancelarGestos?.();
    this.cerrar();
    this.lienzo.el.removeEventListener('keydown', this._onTecla);
    this._quitarCapa?.();
    this._quitarCapaAnillo?.();
    this.repaso.destroy();
    this.nodos.destroy();
    this.dibujo.destroy();
    this.fichas.destroy?.();
  }
}
