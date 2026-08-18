/* ============================================================
   ia/compilador.js — compilador determinista de intención→geometría
   (Fase 2a de la reforma). Recibe un Intent (qué hace cada jugador,
   fase a fase — ver forma abajo) y lo traduce al JSON de animación
   §10 completo. NO interpreta texto ni regex: solo baloncesto
   geométrico (paths, Bézier, timings, marcaje defensivo). Leer la
   descripción del paso 2 y convertirla en Intent es cosa de
   ia/frase.js, que después llama a compilarAnimacion() aquí.

   ── QUÉ RECIBE ──────────────────────────────────────────────
   Un Intent, en cualquiera de los dos dialectos que entiende
   ia/intencion.js:

     · el del PASO 2 — { jugador, accion: 'entra', args: {…} }, donde
       `accion` es un slug del catálogo (ia/acciones.js) y `args` son
       los parámetros de ESTE uso, que pisan los que fija la acción;
     · el ANTIGUO — { jugador, tipo: 'bote', hacia: 'aro', a, marca,
       cono_id, bloqueado_id, balon_id }, los nueve eventos escritos a
       fuego que traen las 204 fichas de la biblioteca.

   Los dos llegan aquí resueltos a lo mismo: { jugador, accion,
   familia, params }. Desde el Tramo 2.6 este fichero NO conoce ni un
   verbo de baloncesto — sabe resolver cinco familias:

     desplazamiento  lleva a alguien a un destino
     balon           pasa, tira, suelta o recoge
     entre_dos       coloca a uno respecto de otro y dibuja la relación
     gesto           una acción sin desplazamiento neto
     simulacion      una secuencia corta con desenlace declarado

   Añadir «puerta atrás» o «eurostep» es añadir una fila al catálogo.
   Antes era tocar este fichero, y solo podía hacerlo quien lo conocía.

   El Intent completo lleva además:
     canasta: 'norte' | 'sur' | null   — YA resuelta antes de llegar
     balones: [ { id, portador } ]     — poseedores INICIALES declarados
                                         (opcional; sin ellos manda la
                                         cadena de eventos)

   `elementos` es el array crudo del tablero (kind: 'jugador'|'balon'|
   'cono'), igual que en todo el resto del Taller — el compilador
   sintetiza de ahí a los jugadores reales de fila (sintetizarJugadores,
   exportada porque el extractor también la necesita para conocer los
   ids/posiciones disponibles antes de escribir el Intent).
   ============================================================ */

import { PISTAS, clamp01 } from '../canvas/court.js';
import { TAMANOS, pasoNorm } from '../canvas/medidas.js';
import { aroExacto } from '../canvas/anclas.js';
import { puntoADistanciaDe } from '../canvas/escala.js';
import { resolverPosicion } from './posiciones.js';
import { normalizarIntent } from './intencion.js';
import { parametroDe } from './acciones.js';
import { zonaGuardable, centroDe as centroZona } from '../canvas/zonas.js';
import { expandirRondas, entregasEntreRondas } from './rondas.js';

/* ---- geometría reutilizada (movida tal cual desde el mock viejo) --- */

// punto a fracción t (0–1) del camino entre p y la canasta.
const haciaCanasta = (p, basket, t) => ({ x: p.x + (basket[0] - p.x) * t, y: p.y + (basket[1] - p.y) * t });

// Path que sortea los conos "rodear" antes de penetrar. Con VARIOS conos:
// zigzag alternando el lado de cada uno en orden de avance (slalom de bote).
// Con UN solo cono: rodeo limpio — un arco curvo (nodos Bézier vía
// handle_in/handle_out) que deja el cono entre la línea de entrada y la de
// salida, sin pico anguloso. Devuelve null si no hay conos "rodear".
function slalomPath(carrier, basket, conos, fin) {
  const rodear = (conos || []).filter((c) => c.funcion === 'rodear');
  if (!rodear.length) return null;
  const sx = carrier.x, sy = carrier.y;
  const dx = basket[0] - sx, dy = basket[1] - sy, len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;     // unidad hacia la canasta
  const px = -uy, py = ux;                 // perpendicular (lado a lado)
  const off = 0.055;                       // separación lateral al pasar el cono

  if (rodear.length === 1) {
    // Arco de medio círculo alrededor del cono por el lado `lado`: entra por
    // detrás (c − u·off), pasa por el vértice lateral (c + p·off·lado) y sale
    // por delante (c + u·off), con handles de cuarto de círculo (k≈0.5523·r).
    const c = rodear[0], lado = 1, k = off * 0.5523;
    const P = (tx, ty) => ({ x: clamp01(tx), y: clamp01(ty) });
    const nIn = P(c.x - ux * off, c.y - uy * off);
    const nApex = P(c.x + px * off * lado, c.y + py * off * lado);
    const nOut = P(c.x + ux * off, c.y + uy * off);
    return [
      { x: sx, y: sy, tipo_nodo: 'lineal' },
      { ...nIn, tipo_nodo: 'bezier', handle_out: P(nIn.x + px * k * lado, nIn.y + py * k * lado) },
      { ...nApex, tipo_nodo: 'bezier', handle_in: P(nApex.x - ux * k, nApex.y - uy * k), handle_out: P(nApex.x + ux * k, nApex.y + uy * k) },
      { ...nOut, tipo_nodo: 'bezier', handle_in: P(nOut.x + px * k * lado, nOut.y + py * k * lado) },
      { x: fin.x, y: fin.y, tipo_nodo: 'lineal' },
    ];
  }

  const orden = rodear
    .map((c) => ({ x: c.x, y: c.y, t: (c.x - sx) * ux + (c.y - sy) * uy }))
    .sort((a, b) => a.t - b.t);
  const nodes = [{ x: sx, y: sy, tipo_nodo: 'lineal' }];
  orden.forEach((c, i) => {
    const lado = i % 2 === 0 ? 1 : -1;
    nodes.push({ x: clamp01(c.x + px * off * lado), y: clamp01(c.y + py * off * lado), tipo_nodo: 'lineal' });
  });
  nodes.push({ x: fin.x, y: fin.y, tipo_nodo: 'lineal' });
  return nodes;
}

/* ---- síntesis de jugadores ------------------------------------------
   Jugadores reales del tablero + el PRIMERO de cada fila con gente (sale
   a trabajar; la cola visible baja en 1 — ver compilarAnimacion). _tail =
   sitio al final de su cola, para el evento 'vuelve_a_fila'. Pura función
   de `elementos` (determinista, sin texto): la usan tanto el diccionario
   de sujetos del paso 2 —para saber qué ids existen y con qué nombre se
   pinchan— como este compilador, así que vive aquí una sola vez.

   ROTACIÓN de filas (Tramo 3c): los SIGUIENTES de cada cola también
   existen como ids — 'fila1_2', 'fila1_3'… hasta el 5º (SALIDAS_MAX_FILA)
   — para que una serie ("sale el 1º; vuelve y sale el 2º…") sea
   direccionable por el intent. Van marcados con _extraFila: en la SALIDA
   de compilarAnimacion solo aparecen si el intent los usa (si no,
   siguen siendo fichas anónimas de la cola dibujada). Arrancan EN el
   cono, como fila1: cuando les toca salir, el de delante ya se fue y
   ellos encabezan la cola. */
/* Separación entre dos de la cola, EN METROS (medidas.js). Era 0.06 en
   unidades normalizadas, que en la pista entera vieja salían 1,75 m y en
   la media, 1,55: el mismo número significaba distancias distintas según
   la pista y según el eje. Peor: la cola se DIBUJA en píxeles (symbols.js
   #drawFila) y su final se CALCULABA en normalizado, así que el sitio al
   que volvía el jugador no era el final de la cola que veía. Con los dos
   en metros coinciden exactamente. */
export const SALIDAS_MAX_FILA = 5;
export function sintetizarJugadores(elementos = [], pista = 'entera') {
  const jugadores = elementos.filter((e) => e.kind === 'jugador');
  const conos = elementos.filter((e) => e.kind === 'cono');
  const filasConJugadores = conos.filter((c) => c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0);
  const idDe = (e) => `${e.equipo}${e.label}`;
  const boardJ = jugadores.map((e) => ({ id: idDe(e), equipo: e.equipo, x: e.x, y: e.y, dorsal: e.dorsal, nombre: e.nombre }));
  const filaFront = [];
  const filaExtras = [];
  const filaSeSale = new Set();   // colas que no caben enteras en el dibujo
  filasConJugadores.forEach((c, i) => {
    const fc = c.fila_config;
    const unPaso = pasoNorm(pista, fc.direccion_grados || 0, TAMANOS.pasoFila);
    const paso = pasoNorm(pista, fc.direccion_grados || 0, TAMANOS.pasoFila * fc.n_jugadores);
    const tail = { x: clamp01(c.x + paso.dx), y: clamp01(c.y + paso.dy) };
    const rol = fc.rol === 'defensor' ? 'defensor' : null;
    filaFront.push({ id: `fila${i + 1}`, equipo: fc.equipo || 'A', x: c.x, y: c.y, dorsal: null, nombre: null, _tail: tail, _rolFila: rol, _filaIdx: i + 1 });

    /* Con RONDAS (Tramo 2.8) sale TODA la cola: cada uno es un jugador
       de verdad y arranca EN SU SITIO de la fila, no encima del cono.
       Así se ven los seis esperando y saliendo de uno en uno, que es el
       ejercicio. Sin rondas se mantiene lo de antes —arrancan en el cono
       y solo los cinco primeros son direccionables— porque es lo que
       esperan las 204 fichas de la biblioteca. */
    const conRondas = Boolean(fc.rondas);
    const hasta = conRondas ? fc.n_jugadores : Math.min(fc.n_jugadores, SALIDAS_MAX_FILA);
    for (let k = 2; k <= hasta; k++) {
      const desplaza = conRondas ? (k - 1) : 0;
      const px = c.x + unPaso.dx * desplaza;
      const py = c.y + unPaso.dy * desplaza;
      // Una cola de seis mide casi ocho metros: apuntando al sitio
      // equivocado, los últimos se salen del dibujo y se amontonan en el
      // borde. Se recorta —no hay dónde ponerlos— pero se APUNTA, porque
      // tres fichas superpuestas en pantalla parecen un ejercicio raro,
      // no un fallo de colocación.
      if (px !== clamp01(px) || py !== clamp01(py)) filaSeSale.add(i + 1);
      filaExtras.push({
        id: `fila${i + 1}_${k}`, equipo: fc.equipo || 'A',
        x: clamp01(px), y: clamp01(py),
        dorsal: null, nombre: null, _tail: tail, _extraFila: true, _filaIdx: i + 1,
        _rolFila: rol, _ronda: conRondas ? k : null,
      });
    }
  });
  const salida = [...boardJ, ...filaFront, ...filaExtras];
  salida._filasQueSeSalen = [...filaSeSale];
  return salida;
}

/** Índice 1..n de una fila entre las que tienen gente (el que da 'fila1', 'fila2'…). */
function filasConRondasIndice(conos, cono) {
  const conGente = conos.filter((c) => c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0);
  return conGente.indexOf(cono) + 1;
}

/* ---- balones del tablero --------------------------------------------
   Lista normalizada de balones (id con el MISMO fallback 'balon_<i+1>'
   que el resto del sistema). Sin balón en el tablero se sintetiza uno
   ('balon_1', sin posición: acabará en manos de quien primero lo toque).
   La comparten compilador y validador (nº de balones y sus ids). */
export function balonesDelTablero(elementos = []) {
  const bs = elementos.filter((e) => e.kind === 'balon');
  if (!bs.length) return [{ id: 'balon_1', x: null, y: null, _sintetico: true }];
  return bs.map((b, i) => ({ id: b.id || `balon_${i + 1}`, x: b.x, y: b.y }));
}

/* ---- distancias, ahora en el catálogo ------------------------------
   Las fracciones de avance —cuánto progresa hacia el aro un bote (0,55),
   un corte (0,3) o una recolocación defensiva (0,25)— eran una tabla
   escrita aquí, indexada por el nombre del evento. Desde el Tramo 2.5
   son el parámetro `avance` de cada acción del catálogo: la misma
   distancia, pero configurable sin tocar el compilador y visible para
   quien crea una acción nueva.

   Estos dos se quedan como RED DE SEGURIDAD, para un uso que llegue sin
   `separacion`. Son las dos distancias que decidieron el arreglo de
   agosto: dónde muere una finalización y dónde se para quien va a por
   el balón. Ni encima del aro (la ficha taparía la canasta) ni a tres
   metros. */
const METROS_FINALIZACION = 1.1;
const METROS_RECOGIDA = 0.9;

/* ---- timings por tipo de fase (constantes de siempre) --------------- */
const TIEMPOS = {
  tiro: { duracion_ms: 1000, pausa_post_ms: 600 },
  pase: { duracion_ms: 1100, pausa_post_ms: 500 },
  vuelve: { duracion_ms: 1200, pausa_post_ms: 200 },
  movimiento: { duracion_ms: 1500, pausa_post_ms: 400 },
};

/**
 * Compila un Intent (§ arriba) + el tablero crudo en el JSON §10 completo.
 * @param opts.posiciones diccionario custom { slug: [x,y] } de ESTA pista
 *        (Supabase, Tramo 2.3) — red de seguridad para `hacia` con nombre
 *        que llegue sin resolver (el validador ya resuelve en el camino IA).
 * @returns { pista, jugadores, balones, conos, fases, warnings:[], _mock:true }
 */
export function compilarAnimacion(intent, elementos = [], pista = 'entera', opts = {}) {
  const J = sintetizarJugadores(elementos, pista);
  const byId = new Map(J.map((j) => [j.id, j]));
  const conos = elementos.filter((e) => e.kind === 'cono');
  // mismo fallback de id (`cono_${i+1}`) que usan la function, el validador y
  // la salida de conos de abajo: un cono sin id sigue siendo direccionable
  // desde un rodea_cono (antes la clave cruda `undefined` no casaba y el
  // rodeo degradaba a recta en silencio).
  const conosById = new Map(conos.map((c, i) => [c.id || `cono_${i + 1}`, c]));
  /* Cualquier cosa del suelo a la que se pueda MANDAR a alguien: conos,
     escaleras y pelotas de tenis. Desde el Tramo 2.9 «corre hasta el
     Cono 2» es una frase que el paso 2 sabe escribir, así que el
     compilador tiene que saber a dónde apunta. Mismos ids que la salida
     (`cono_i`, `mat_i`) para que la referencia sea la misma en los dos
     sitios. Ninguna de las 204 fichas apunta a un elemento —todas usan
     'canasta', 'aro' o un nombre de posición—, así que esto no cambia
     nada de lo que ya estaba. */
  const elementosById = new Map(conosById);
  elementos.filter((e) => e.kind === 'escalera' || e.kind === 'pelota')
    .forEach((e, i) => elementosById.set(e.id || `mat_${i + 1}`, e));
  const zonas = elementos.filter((e) => e.kind === 'zona').map((z, i) => zonaGuardable(z, i));
  // Una zona es también un SITIO con nombre: «corta a la zona de tiro»
  // resuelve a su centro. Se indexa por nombre normalizado para que
  // escribirlo con mayúsculas o con tilde dé igual.
  const zonaPorNombre = new Map(elementos
    .filter((e) => e.kind === 'zona' && e.nombre)
    .map((z) => [String(z.nombre).trim().toLowerCase(), z]));
  const materiales = elementos
    .filter((e) => e.kind === 'escalera' || e.kind === 'pelota')
    .map((e, i) => ({
      id: e.id || `mat_${i + 1}`, tipo: e.kind, posicion: [e.x, e.y],
      ...(e.kind === 'escalera' ? { rot: e.rot ?? 0 } : {}),
    }));
  /* Aquí es donde el compilador deja de conocer verbos (Tramo 2.6).
     `normalizarIntent` resuelve cada evento contra el CATÁLOGO y
     devuelve su familia y sus parámetros ya fusionados; a partir de
     esta línea el código de abajo solo sabe resolver cinco familias.
     Acepta los dos dialectos —el nuevo del paso 2 y los nueve eventos
     de siempre—, y por eso las 204 fichas de la biblioteca compilan sin
     tocarlas: es lo que permite comprobar que la traducción es exacta. */
  const fasesIntent = (intent && intent.fases) || [];
  const normalizado = normalizarIntent(intent, { catalogo: opts.catalogo });
  const fasesResueltas = normalizado.fases;

  const bsPista = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  // Clave de canasta REALMENTE usada: si la del intent no existe en esta pista
  // se cae al primer aro, y la decisión se expone en la salida (data.canasta)
  // para que la vista previa (§Tramo 1) resalte el aro correcto y los tiros
  // nunca referencien un aro fantasma.
  const canastaKey = (intent && intent.canasta && bsPista[intent.canasta]) ? intent.canasta : (Object.keys(bsPista)[0] || 'norte');
  const basket = bsPista[canastaKey] || [0.5, 0.1];
  // Endpoint exacto del tiro: el centro del aro (canvas/anclas.js).
  // Los dos valores —`baskets` de court.js y `aroExacto` de anclas.js—
  // salen desde el Tramo 2.1 de la misma tabla (canvas/medidas.js) y
  // coinciden al decimal. Se mantienen los dos caminos porque significan
  // cosas distintas: `basket` es la CANASTA (lado, orientación, marcaje
  // goal-side, resaltado en la vista previa) y `aroTiro` es el PUNTO al
  // que muere el balón. Antes además diferían: cada uno se había medido
  // por su cuenta sobre el dibujo, y en las medias court.js apuntaba a
  // x≈0.143, que caía entre el tablero y el aro.
  const aroTiro = aroExacto(pista, canastaKey) || basket;

  // balones (Tramo 3a): los del tablero (conservan su id) o uno sintetizado.
  // Posesión INICIAL por balón, en dos pasos deterministas:
  //   1) declaración del intent (intent.balones: [{id, portador}]) — el
  //      modelo ahora VE el balón y puede asignarlo; el validador ya la
  //      saneó (portador/balón inválidos → warning y se descarta, así que
  //      aquí solo llega lo respetable). Prioridad máxima.
  //   2) cadena de eventos (la regla `ownerInicial` de siempre,
  //      generalizada a N balones): el primer 'bote'/'pase'/'tiro' de un
  //      jugador SIN balón le asigna el balón LIBRE más cercano (a su
  //      posición actual), que salta a sus manos; un 'pase' lo transfiere
  //      al receptor; un 'tiro' lo suelta (vuela al aro). Con UN solo
  //      balón esto es exactamente el comportamiento de siempre.
  const balones = balonesDelTablero(elementos);
  const ownerDe = new Map();   // balonId -> jugador dueño INICIAL
  const balonDe = new Map();   // jugadorId -> balonId que tiene AHORA (al compilar)
  for (const d of (intent && Array.isArray(intent.balones)) ? intent.balones : []) {
    if (!d || typeof d !== 'object') continue;
    if (!byId.has(d.portador) || balonDe.has(d.portador)) continue;
    if (!balones.some((b) => b.id === d.id) || ownerDe.has(d.id)) continue;
    ownerDe.set(d.id, d.portador);
    balonDe.set(d.portador, d.id);
  }
  // balón libre más cercano al punto (x,y); los sintéticos (sin posición)
  // se consideran a distancia 0 — están "en manos de quien los necesite".
  const tomarBalonLibre = (jugadorId) => {
    const jp = pos.get(jugadorId) || byId.get(jugadorId);
    let mejor = null, mejorD = Infinity;
    for (const b of balones) {
      if (ownerDe.has(b.id)) continue;
      const d = (b.x == null || !jp) ? 0 : Math.hypot(b.x - jp.x, b.y - jp.y);
      if (d < mejorD) { mejorD = d; mejor = b; }
    }
    if (!mejor) return null;
    ownerDe.set(mejor.id, jugadorId);
    balonDe.set(jugadorId, mejor.id);
    return mejor.id;
  };
  // balón EFECTIVO de un evento con balón: el que tiene el jugador, o el
  // libre más cercano (lo toma), o —sin ninguno disponible— el primero
  // (tiro sin posesión: geometría intacta, el validador ya avisó §8.4).
  const balonEfectivo = (jugadorId) => balonDe.get(jugadorId) ?? tomarBalonLibre(jugadorId) ?? balones[0].id;

  // posición ACTUAL de cada jugador mientras se compila fase a fase (se va
  // actualizando con cada movimiento, igual que restStart en engine.js, para
  // que una fase posterior — p.ej. un pase — arranque donde el jugador
  // terminó la fase anterior).
  const pos = new Map(J.map((j) => [j.id, { x: j.x, y: j.y }]));

  // dónde está cada BALÓN, con la misma lógica: en manos de quien lo
  // lleve, o suelto donde lo dejaron. Hace falta para 'recoge': después
  // de un tiro el balón está en el aro, y quien va a por el rebote tiene
  // que ir HASTA ahí, no a donde estaba el balón al empezar el ejercicio.
  const posBalon = new Map(balones.map((b) => {
    const oj = ownerDe.has(b.id) && byId.get(ownerDe.get(b.id));
    return [b.id, oj ? { x: oj.x, y: oj.y } : (b.x != null ? { x: b.x, y: b.y } : { x: 0.5, y: 0.5 })];
  }));

  const defTeamJugadores = new Set(); // cualquiera que defienda en ALGUNA fase -> tipo:'defensor' en la salida
  const fases = [];

  // ids que el intent usa en cualquier papel: decide qué SIGUIENTES de fila
  // (fila1_2, fila1_3… — _extraFila) se materializan como jugadores en la
  // salida. Los no usados siguen siendo fichas anónimas de la cola dibujada
  // (si salieran todos siempre, se duplicarían con drawFila).
  const participa = new Set();
  for (const f of fasesResueltas) {
    for (const ev of f.eventos) {
      participa.add(ev.jugador);
      // los parámetros que apuntan a OTRO jugador: el receptor de un
      // pase, el bloqueado, el par al que se marca. Antes eran cuatro
      // campos con nombre fijo; ahora son los que la familia declara.
      for (const clave of ['destino', 'companero']) {
        const v = ev.params[clave];
        if (typeof v === 'string' && byId.has(v)) participa.add(v);
      }
    }
  }

  fasesResueltas.forEach((faseIntent, i) => {
    const eventos = faseIntent.eventos;
    const movimientos = [];
    const pases = [];
    const tiros = [];
    const bloqueos = [];
    const recogidas = [];
    const defensoresFase = [];

    const recta = (desde, hasta) => [
      { x: desde.x, y: desde.y, tipo_nodo: 'lineal' },
      { x: hasta.x, y: hasta.y, tipo_nodo: 'lineal' },
    ];

    /**
     * A dónde lleva un desplazamiento. Es el corazón del Tramo 2.6: lo
     * que antes era una escalera de ifs sobre el campo `hacia` ahora sale
     * de DOS parámetros que significan cosas distintas —`destino` (a
     * dónde) y `alcance` (cuánto se acerca)—, que es justo la confusión
     * que costó trece fichas soltando el balón lejos del aro.
     *
     * Devuelve null cuando no hay a dónde ir (p. ej. volver a una fila de
     * la que ese jugador no salió): entonces no se mueve nadie, en vez de
     * dibujar un viaje inventado.
     */
    const destinoDe = (ev, jp) => {
      const p = ev.params;
      const d = p.destino;
      const avance = Number.isFinite(p.avance) ? p.avance : 0.5;

      // un punto concreto de ESTA pista (el catálogo no admite
      // coordenadas; un uso suyo sí — ver intencion.js)
      if (d && typeof d === 'object' && Number.isFinite(d.x) && Number.isFinite(d.y)) {
        return { x: clamp01(d.x), y: clamp01(d.y) };
      }

      if (d === 'fila_propia') {
        const j = byId.get(ev.jugador);
        return j && j._tail ? { x: j._tail.x, y: j._tail.y } : null;
      }

      if (d === 'aro') {
        // Se para donde se apoya para subir: ni encima del aro (la ficha
        // taparía la canasta) ni a media distancia.
        if (p.alcance === 'pegado') {
          const q = puntoADistanciaDe(pista, jp, aroTiro, Number.isFinite(p.separacion) ? p.separacion : METROS_FINALIZACION);
          return { x: clamp01(q.x), y: clamp01(q.y) };
        }
        // Avance PARCIAL: una penetración que aún no termina.
        if (p.alcance === 'parcial') return haciaCanasta(jp, basket, avance);
        return { x: aroTiro[0], y: aroTiro[1] };
      }

      if (typeof d === 'string' && d) {
        // ¿es el nombre de una zona? Va PRIMERO: una zona la ha puesto el
        // entrenador en ESTE ejercicio, así que si le pone «Zona de tiro»
        // manda sobre cualquier ancla que se llamara parecido.
        const z = zonaPorNombre.get(d.trim().toLowerCase());
        if (z) { const c = centroZona(pista, z); return { x: clamp01(c.x), y: clamp01(c.y) }; }
        // posición con nombre: custom del entrenador primero, luego anclas
        const xy = resolverPosicion(pista, d, canastaKey, opts.posiciones || null);
        if (xy) return { x: clamp01(xy[0]), y: clamp01(xy[1]) };
        /* «Vuelve a la Fila 2»: el final de ESA cola, no encima del que
           la encabeza. Solo cuenta para una acción que de suyo vuelve a
           la fila propia (§5.3, destino de vuelta como parámetro); para
           cualquier otra, «hacia fila2» sigue significando ir hacia ese
           jugador, que es lo que dice literalmente. */
        if (parametroDe(ev.accion, 'destino') === 'fila_propia') {
          const cola = byId.get(d);
          if (cola && cola._tail) return { x: cola._tail.x, y: cola._tail.y };
        }
        // ¿era otro jugador? ("corta hacia A2")
        const otro = pos.get(d);
        if (otro) return { x: otro.x, y: otro.y };
        // ¿un cono, una escalera, una pelota? ("corre hasta el Cono 2")
        const cosa = elementosById.get(d);
        if (cosa) return { x: clamp01(cosa.x), y: clamp01(cosa.y) };
        // Nombre que nadie reconoce: avance parcial de siempre. Preguntar
        // por los nombres desconocidos es cosa del validador, antes de
        // llegar aquí; el compilador no se planta, dibuja algo razonable.
        return haciaCanasta(jp, basket, avance);
      }

      return haciaCanasta(jp, basket, avance);
    };

    /* 1) Lo que MUEVE gente: desplazamientos, colocaciones entre dos
       jugadores y el que va a por un balón. Este paso va PRIMERO para que
       las colocaciones de este mismo bucle, que leen la posición de su
       par, la vean YA actualizada si ese par también se mueve en esta
       fase: el defensor deniega contra el punto de LLEGADA del atacante,
       no contra su salida. */
    for (const ev of eventos) {
      const jp = pos.get(ev.jugador);
      if (!jp) continue;
      const p = ev.params;

      if (ev.familia === 'desplazamiento') {
        // Quien se desplaza CON el balón lo coge si no lo lleva: botar
        // exige balón. Antes era un `if (ev.tipo === 'bote')`; ahora sale
        // del símbolo que declara la acción, así que una acción nueva del
        // club hereda la regla sin tocar el compilador.
        if (ev.accion.simbolo === 'carrera_con_balon' && !balonDe.has(ev.jugador)) tomarBalonLibre(ev.jugador);

        const destino = destinoDe(ev, jp);
        if (!destino) continue;

        const sorteando = Array.isArray(p.sorteando) ? p.sorteando : [];
        let path;
        if (p.trayectoria === 'rodeo' && sorteando.length) {
          const conosARodear = sorteando.map((id) => conosById.get(id)).filter(Boolean);
          path = slalomPath(jp, basket, conosARodear, destino) || recta(jp, destino);
        } else {
          path = recta(jp, destino);
        }
        movimientos.push({ elemento_id: ev.jugador, tipo_elemento: 'jugador', tipo_movimiento: ev.accion.simbolo, path });
        pos.set(ev.jugador, { x: destino.x, y: destino.y });

      } else if (ev.familia === 'entre_dos') {
        // El ROL cuenta siempre, se mueva o no: un defensor que no se
        // mueve esta fase sigue siendo defensor.
        if (p.rol === 'defensor') defensoresFase.push(ev.jugador);

        // Para MOVERSE hay dos vías, y hasta el Tramo 2.6 solo funcionaba
        // una de verdad:
        //   · destino EXPLÍCITO — va derecho a ese punto. Es como se
        //     escribe una AYUDA: el defensor no va contra su par, va a
        //     tapar un hueco.
        //   · par + colocación — se recoloca entre él y el aro.
        // Sin ninguna de las dos se queda quieto a propósito (su atacante
        // no hace nada esa fase, o es un bloqueador que ya está puesto).
        const dest = p.destino;
        const destinoExplicito = (dest && typeof dest === 'object' && Number.isFinite(dest.x) && Number.isFinite(dest.y))
          ? { x: clamp01(dest.x), y: clamp01(dest.y) } : null;
        const parPos = p.companero ? pos.get(p.companero) : null;
        let objetivo = destinoExplicito;
        if (!objetivo && parPos && p.colocacion === 'goal_side') {
          const denegar = haciaCanasta(parPos, basket, Number.isFinite(p.avance) ? p.avance : 0.25);
          // no se planta en el sitio exacto: recorre el 70 % del camino,
          // que es lo que se lee como "presiona" y no como "teletransporte"
          objetivo = { x: jp.x + (denegar.x - jp.x) * 0.7, y: jp.y + (denegar.y - jp.y) * 0.7 };
        }
        if (objetivo) {
          movimientos.push({ elemento_id: ev.jugador, tipo_elemento: 'jugador', tipo_movimiento: ev.accion.simbolo, path: recta(jp, objetivo) });
          pos.set(ev.jugador, objetivo);
        }

      } else if (ev.familia === 'balon' && p.modo === 'recoge') {
        // El jugador va A POR el balón y se lo queda. Es lo que cierra un
        // ejercicio de fila: sin esto, tras un tiro el balón se queda en
        // el aro para siempre — `ownerDe` es la posesión INICIAL y no se
        // libera nunca — y el ejercicio termina con el jugador plantado
        // bajo la canasta mirando cómo se reinicia el bucle.
        const sostenidos = new Set(balonDe.values());
        let bId = (p.balon && balones.some((b) => b.id === p.balon)) ? p.balon : null;
        if (!bId) {
          // por defecto, el balón SUELTO más cercano: en la práctica, el
          // que ese mismo jugador acaba de tirar.
          let mejorD = Infinity;
          for (const b of balones) {
            if (sostenidos.has(b.id)) continue;
            const bp0 = posBalon.get(b.id); if (!bp0) continue;
            const d = Math.hypot(bp0.x - jp.x, bp0.y - jp.y);
            if (d < mejorD) { mejorD = d; bId = b.id; }
          }
        }
        const bp = bId && posBalon.get(bId);
        if (bp) {
          // se para AL LADO del balón, no encima: bajo el aro la ficha
          // taparía la canasta entera.
          const q = puntoADistanciaDe(pista, jp, bp, Number.isFinite(p.separacion) ? p.separacion : METROS_RECOGIDA);
          const destino = { x: clamp01(q.x), y: clamp01(q.y) };
          movimientos.push({ elemento_id: ev.jugador, tipo_elemento: 'jugador', tipo_movimiento: ev.accion.simbolo, path: recta(jp, destino) });
          // el balón hace el último tramo hasta sus manos; sin esto
          // saltaría del aro al jugador de un fotograma al siguiente.
          movimientos.push({ elemento_id: bId, tipo_elemento: 'balon', tipo_movimiento: 'recogida', path: recta(bp, destino) });
          recogidas.push({ jugador_id: ev.jugador, balon_id: bId });
          pos.set(ev.jugador, destino);
          posBalon.set(bId, destino);
          balonDe.set(ev.jugador, bId);
        }
      }
    }

    // 2) pases (usan la posición YA actualizada por el paso 1, si aplica).
    //    Cada pase viaja con el balón de SU pasador (multi-balón: pases en
    //    paralelo en la misma fase usan balones distintos) y la posesión
    //    pasa al receptor.
    for (const ev of eventos) {
      if (ev.familia !== 'balon' || ev.params.modo !== 'pase') continue;
      const receptor = ev.params.destino;
      const de = pos.get(ev.jugador), a = pos.get(receptor);
      if (!de || !a) continue;
      const bId = balonEfectivo(ev.jugador);
      pases.push({ id: `pase_${i + 1}_${pases.length + 1}`, de_id: ev.jugador, balon_id: bId, a_id: receptor, duracion_ms: 450, path: [{ x: de.x, y: de.y }, { x: a.x, y: a.y }] });
      if (balonDe.get(ev.jugador) === bId) balonDe.delete(ev.jugador);
      balonDe.set(receptor, bId);
      posBalon.set(bId, { x: a.x, y: a.y });
    }

    // 3) tiros. Path EXPLÍCITO: desde la posición actual del tirador hasta
    //    el centro del aro (aroTiro). engine.js usa el path si trae ≥2
    //    nodos; sin él interpolaría hasta court.js baskets. Se usa la clave
    //    RESUELTA (canastaKey), nunca la cruda del intent. (Si el tirador
    //    no tiene el balón — tiro sin posesión, ya avisado por el
    //    validador — el balón salta a sus manos al arrancar la fase.)
    for (const ev of eventos) {
      if (ev.familia !== 'balon' || ev.params.modo !== 'tiro') continue;
      const jp = pos.get(ev.jugador);
      const desde = jp ? { x: jp.x, y: jp.y } : { x: 0.5, y: 0.5 };
      const bId = balonEfectivo(ev.jugador);
      tiros.push({
        jugador_id: ev.jugador, balon_id: bId, canasta: canastaKey,
        path: [{ x: desde.x, y: desde.y }, { x: aroTiro[0], y: aroTiro[1] }],
      });
      if (balonDe.get(ev.jugador) === bId) balonDe.delete(ev.jugador); // el balón vuela al aro: nadie lo lleva ya
      posBalon.set(bId, { x: aroTiro[0], y: aroTiro[1] });             // y se queda ahí hasta que alguien lo recoja
    }

    // 4) el símbolo de la relación entre dos jugadores (el `jugador` del
    //    evento ES el bloqueador). Va aparte del movimiento a propósito:
    //    dibujar la relación y recolocar a alguien son cosas distintas, y
    //    una acción nueva puede querer una sin la otra.
    for (const ev of eventos) {
      if (ev.familia !== 'entre_dos' || ev.params.simbolo_relacion !== 'bloqueo') continue;
      bloqueos.push({ bloqueador_id: ev.jugador, bloqueado_id: ev.params.companero });
    }

    for (const id of defensoresFase) defTeamJugadores.add(id);

    // el balón que alguien lleva y que no ha viajado esta fase va donde
    // haya acabado su portador (misma regla que engine.js#_build).
    for (const [jug, bId] of balonDe) {
      const jpFin = pos.get(jug);
      const viajo = pases.some((p) => p.balon_id === bId) || tiros.some((t2) => t2.balon_id === bId)
        || movimientos.some((m) => m.tipo_elemento === 'balon' && m.elemento_id === bId);
      if (jpFin && !viajo) posBalon.set(bId, { x: jpFin.x, y: jpFin.y });
    }

    // timing por prioridad: tiro > pase > vuelve a la fila > movimiento genérico
    const t = tiros.length ? TIEMPOS.tiro
      : pases.length ? TIEMPOS.pase
      : eventos.some((e) => e.accion.slug === 'vuelve_a_fila') ? TIEMPOS.vuelve
      : TIEMPOS.movimiento;
    /* La cabecera de cada fase del paso 2 (Tramo 2.9) puede fijar su
       duración y su pausa. Si no lo hace —y no lo hace ninguna de las
       204 fichas—, manda el criterio de siempre: un tiro dura lo que
       dura un tiro y una fase de paso lo que se tarda en andarla. */
    const duracion = Number.isFinite(faseIntent.duracion_ms) ? faseIntent.duracion_ms : t.duracion_ms;
    const pausa = Number.isFinite(faseIntent.pausa_post_ms) ? faseIntent.pausa_post_ms : t.pausa_post_ms;

    /* QUÉ acción se está haciendo en esta fase (Tramo 2.14). El
       compilador es el único sitio donde eso se sabe sin adivinar:
       aquí están los eventos ya resueltos contra el catálogo, y de
       aquí para abajo solo queda geometría.

       Lo necesita el proyector para parar la animación en la fase de
       «entra» y enseñar el vídeo del doble ritmo. Deducirlo después
       —desde `_intent`— no vale: las rondas de fila (2.8) reordenan y
       FUNDEN fases, así que la fase 14 de la animación no tiene por
       qué corresponderse con ninguna del intent.

       Se guardan los slugs y no los nombres: el nombre de una acción
       del club se puede cambiar, y entonces el vídeo dejaría de
       encontrarse. */
    const accionesFase = [...new Set(eventos.map((e) => e.accion?.slug).filter(Boolean))];

    fases.push({ id: `fase_${i + 1}`, duracion_ms: duracion, pausa_post_ms: pausa, movimientos, pases, bloqueos, tiros, recogidas, defensores: defensoresFase, acciones: accionesFase });
  });

  /* ---- RONDAS DE FILA (Tramo 2.8) -------------------------------
     Lo compilado hasta aquí es UNA ronda: lo que hace el primero de la
     cola. Si esa fila pide rondas, se repite con el siguiente hasta que
     han salido todos, y cada fase se queda con su número de ronda —que
     es lo que deja al proyector decir «2 de 6».

     Se hace DESPUÉS de compilar y no dentro del bucle a propósito: la
     ronda 2 hace lo mismo que la 1 desde el mismo sitio, así que su
     geometría es la de la 1 con otro actor. Ver ia/rondas.js.

     Solo se expande la PRIMERA fila con rondas. Dos filas girando a la
     vez, cada una a su ritmo, es un ejercicio distinto y un problema
     distinto; hacerlo a medias sería peor que no hacerlo. */
  const avisos = [];
  for (const idx of J._filasQueSeSalen || []) {
    avisos.push({
      texto_original: `fila ${idx}`,
      interpretacion: 'no cabe entera: los últimos de la cola se amontonan en el borde. Gírala o muévela hacia dentro.',
      campo: 'fila',
    });
  }

  let rondasTotales = 1;
  const filaConRondas = conos.find((c) => c.funcion === 'fila' && c.fila_config?.rondas && (c.fila_config.n_jugadores || 0) > 1);
  if (filaConRondas && fases.length) {
    const idx = filasConRondasIndice(conos, filaConRondas);
    const actor = `fila${idx}`;
    const siguientes = J.filter((j) => j._filaIdx === idx && j._extraFila).map((j) => j.id);
    if (siguientes.length) {
      for (const id of siguientes) participa.add(id);
      const exp = expandirRondas(fases, {
        actor, siguientes,
        cadencia_s: Number.isFinite(filaConRondas.fila_config.cadencia_s) ? filaConRondas.fila_config.cadencia_s : null,
      });
      // el balón no salta de un lado a otro entre rondas: hace el último
      // tramo hasta las manos del que sale
      const porRonda = [actor, ...siguientes];
      const entregas = entregasEntreRondas(exp.fases, {
        inicioDe: (r) => {
          const j = byId.get(porRonda[r - 1]);
          return j ? { x: j.x, y: j.y } : null;
        },
      });
      for (const e of entregas) exp.fases[e.fase]?.movimientos.unshift(e.movimiento);
      fases.length = 0;
      fases.push(...exp.fases);
      rondasTotales = exp.rondas;
    }
  }

  // dueños iniciales ya resueltos (declaración + cadena): tiene_balon y
  // portador_id salen del MISMO cálculo.
  const conBalonInicial = new Set(ownerDe.values());
  // salidos de cada fila (índice 1..n sobre las filas con gente): el primero
  // siempre (se sintetiza como jugador en el cono) + los siguientes que el
  // intent haya usado. La cola dibujada baja exactamente en esa cantidad.
  const salidosDeFila = (idx) => 1 + J.filter((j) => j._extraFila && j._filaIdx === idx && participa.has(j.id)).length;
  let idxFila = 0;

  return {
    pista,
    // los SIGUIENTES de fila no usados por el intent no se materializan
    // (quedan como fichas anónimas de la cola dibujada).
    jugadores: J.filter((j) => !j._extraFila || participa.has(j.id)).map((j) => ({
      id: j.id, equipo: j.equipo,
      // Una FILA DE DEFENSORES (Tramo 2.8) marca a los suyos como
      // defensores aunque en su ronda no lleguen a defender a nadie:
      // el rol lo da de qué cola salen, no lo que hagan ese turno.
      tipo: (defTeamJugadores.has(j.id) || j._rolFila === 'defensor') ? 'defensor' : 'atacante',
      posicion_inicial: [j.x, j.y],
      tiene_balon: conBalonInicial.has(j.id),
      dorsal: j.dorsal ?? null, nombre: j.nombre ?? null,
    })),
    // El balón sintetizado solo existe si alguien LLEGA a tocarlo. Se
    // inventa uno cuando el tablero no trae ninguno porque el camino IA
    // suele describir un ejercicio con balón y olvidarse de dibujarlo;
    // pero hay ejercicios que de verdad no llevan balón —el espejo
    // defensivo es puro juego de pies— y ahí aparecía una pelota
    // fantasma en el centro de la pista, en la ficha que dice
    // literalmente "sin balón". Los balones DIBUJADOS no se filtran
    // nunca: si el entrenador lo puso, se ve.
    balones: balones.filter((b) => !b._sintetico || ownerDe.has(b.id)).map((b) => {
      const owner = ownerDe.get(b.id) || null;
      const oj = owner && byId.get(owner);
      // en manos de su dueño inicial; suelto, donde estaba en el tablero.
      const posIni = oj ? [oj.x, oj.y] : (b.x != null ? [b.x, b.y] : [0.5, 0.5]);
      return { id: b.id, posicion_inicial: posIni, portador_id: owner };
    }),
    conos: conos.map((c, i) => {
      const base = { id: c.id || `cono_${i + 1}`, posicion: [c.x, c.y], funcion: c.funcion || 'decorativo', fila_config: c.fila_config || null };
      // salieron a trabajar el primero de la fila (+ los siguientes que use
      // el intent): la cola visible baja en esa cantidad.
      if (c.funcion === 'fila' && c.fila_config) {
        const n = c.fila_config.n_jugadores || 0;
        const salidos = n > 0 ? salidosDeFila(++idxFila) : 1;
        base.fila_config = { ...c.fila_config, n_jugadores: Math.max(0, n - salidos) };
      }
      return base;
    }),
    // Material del suelo (escaleras, pelotas de tenis). No participa en
    // ninguna acción —nadie lo pasa, lo rodea ni lo recoge—, así que no
    // entra en la síntesis de jugadores ni en el validador: se copia tal
    // cual para que la animación lo dibuje donde el entrenador lo puso.
    // La clave solo aparece si hay algo, para no ensuciar las 204 fichas
    // que no llevan material.
    ...(zonas.length ? { zonas } : {}),
    ...(materiales.length ? { materiales } : {}),
    fases,
    // Cuántas veces se repite la ronda. Solo aparece si de verdad hay
    // más de una: el proyector la usa para el contador «2 de 6» y para
    // saltar a la siguiente, y la miniatura y el guion para quedarse
    // solo con la primera.
    ...(rondasTotales > 1 ? { rondas: rondasTotales } : {}),
    canasta: canastaKey, // aro objetivo resuelto: la vista previa lo resalta y el chip lo edita (§Tramo 1)
    // Intent con la canasta ya resuelta: permite RECOMPILAR cambiando solo la
    // canasta (el chip del paso 2) sin volver a leer la descripción.
    _intent: {
      canasta: canastaKey, fases: fasesIntent,
      // la declaración de poseedores viaja con el intent: recompilar (p.ej.
      // cambiar de canasta con el chip) no debe perder quién tenía cada balón.
      ...(intent && Array.isArray(intent.balones) && intent.balones.length ? { balones: intent.balones } : {}),
    },
    warnings: avisos,
    _mock: true,
  };
}
