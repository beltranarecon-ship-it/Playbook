/* ============================================================
   pizarra/elementos.js — qué hay puesto en la pista (§7).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-elementos.mjs.

   La forma de cada elemento es la MISMA que venía usando el tablero
   viejo —`kind`, `equipo`, `label`, `dorsal`, `x`, `y`,
   `portador_id`— para que los símbolos, las medidas y el guardado no
   tengan que cambiar. Lo que se añade es lo que pedía la
   especificación y no existía: `en_juego`, el balón asignado de
   verdad, y ningún tope de jugadores por equipo.

   ── LAS FUNCIONES NO MUTAN ──────────────────────────────────
   Cada una devuelve una lista NUEVA. Es lo que hace que deshacer sea
   guardar la lista anterior y ya está, sin tener que clonar a mano en
   cada sitio ni acordarse de hacerlo.
   ============================================================ */

import { TAMANOS, marcoDe } from '../canvas/medidas.js';

/**
 * A qué distancia del jugador se pone su balón, EN METROS.
 *
 * Va al lado y no centrado, y el motivo no es estético: centrado, el
 * balón y el jugador están a distancia cero, y como el balón se dibuja
 * después ganaba siempre el acierto — un jugador con balón no se podía
 * arrastrar.
 *
 * 0,75 m es la distancia a la que ninguno de los dos le roba el centro
 * al otro: el jugador tiene radio 0,65 y el balón 0,35, así que
 * pinchando el centro del balón el jugador ya está fuera de alcance, y
 * al revés. Más cerca y vuelve el empate; más lejos y deja de leerse
 * como «lo lleva él».
 *
 * El motor de animación tendrá que usar ESTE mismo número cuando se
 * reescriba (hoy usa 0,012 normalizado, que son 22 cm y esconde el
 * balón dentro de la ficha). Si no, el balón saldría en un sitio en la
 * pizarra y en otro al animar.
 */
export const SEPARACION_BALON = 0.75;

/** Dónde le toca al balón de este jugador. A su derecha, como en el
 *  motor; recortado para que no se salga del lienzo. */
export function sitioDelBalon(jugador, pista = 'entera') {
  const dx = SEPARACION_BALON / marcoDe(pista).ancho;
  const x = jugador.x + dx;
  return { x: x > 1 ? jugador.x - dx : x, y: jugador.y };
}

export const EQUIPOS = ['A', 'B', 'C', 'D'];

/** Los que se pueden colocar sueltos. Las zonas van aparte: se
 *  arrastran, porque hacen falta dos puntos. */
export const COLOCABLES = ['jugador', 'balon', 'cono', 'escalera', 'pelota'];

let _n = 0;
/** Ids nuevos. El prefijo dice qué es, que ahorra un `console.log` cada
 *  vez que algo va mal. */
export const nuevoId = (prefijo) => `${prefijo}_${++_n}`;

/** Solo para los bancos: dos pruebas seguidas tienen que dar los
 *  mismos ids o no se pueden comparar. */
export const reiniciarIds = () => { _n = 0; };

/**
 * Al reabrir una jugada guardada, los ids nuevos tienen que seguir
 * DESPUÉS de los que ya hay. Empezando otra vez desde 1, la primera
 * ficha que se añadiera se llamaría igual que una de las guardadas: las
 * dos se seleccionarían y se moverían juntas, y sus trazos se
 * mezclarían. Solo sube la cuenta, nunca la baja.
 */
export function continuarIds(lista) {
  for (const e of lista || []) {
    const m = /_(\d+)$/.exec(String(e && e.id));
    if (m) _n = Math.max(_n, Number(m[1]));
  }
  return _n;
}

/* ── Crear ─────────────────────────────────────────────────── */

export function crear(spec, x = 0.5, y = 0.5) {
  const kind = spec && spec.kind;
  const base = { id: nuevoId(kind || 'elem'), kind, x, y };
  switch (kind) {
    case 'jugador':
      return {
        ...base,
        equipo: EQUIPOS.includes(spec.equipo) ? spec.equipo : 'A',
        label: '0',            // lo pone renumerar()
        dorsal: null,          // null = vale el automático
        nombre: null,
        en_juego: true,
      };
    case 'balon':
      return { ...base, portador_id: null };
    case 'cono':
      return { ...base, nombre: null, fila: null, puerta_con: null };
    case 'escalera':
      return { ...base, rot: 0 };
    default:
      return base;
  }
}

/* ── Dorsales ──────────────────────────────────────────────── */

/**
 * Numera 1..n por equipo, CONTIGUO, y solo a los que están en juego.
 *
 * Dos motivos, y los dos vienen de fallos vistos:
 *  · Sin renumerar, «añado A1 A2 A3, borro el 2, añado otro» deja dos
 *    jugadores con el número 3 y uno de los dos se vuelve inalcanzable
 *    para todo lo que los nombre por su número.
 *  · Y quien espera en una fila NO lleva dorsal (§7.1), porque el
 *    emparejamiento de la defensa se hace por dorsal: si los que
 *    esperan numeraran, el defensor 3 no sabría a qué atacante 3
 *    marcar.
 *
 * `dorsal` puesto a mano manda sobre esto y no se toca nunca.
 */
export function renumerar(lista) {
  const cuenta = {};
  return lista.map((e) => {
    if (e.kind !== 'jugador') return e;
    if (e.en_juego === false) return e.label === null ? e : { ...e, label: null };
    cuenta[e.equipo] = (cuenta[e.equipo] || 0) + 1;
    const label = String(cuenta[e.equipo]);
    return e.label === label ? e : { ...e, label };
  });
}

/** El número que se ve encima de la ficha. */
export const numeroDe = (e) => (e.dorsal ?? e.label ?? '');

/* ── Añadir y quitar ───────────────────────────────────────── */

/** Añade y renumera. SIN tope por equipo: la v2.1 lo pedía explícito
 *  (§7.1) y el tablero viejo lo tenía en cinco. */
export function anadir(lista, spec, x, y) {
  return renumerar([...lista, crear(spec, x, y)]);
}

/**
 * Quita, y con ello suelta lo que dependiera de lo quitado: un balón
 * que llevaba un jugador que ya no está se queda suelto donde estaba,
 * y un cono emparejado como puerta deja de estarlo. Si no, quedan
 * referencias a fantasmas que fallan mucho más tarde y en otro sitio.
 */
export function quitar(lista, ids) {
  const fuera = new Set(Array.isArray(ids) ? ids : [ids]);
  const quedan = lista.filter((e) => !fuera.has(e.id));
  return renumerar(quedan.map((e) => {
    if (e.kind === 'balon' && fuera.has(e.portador_id)) return { ...e, portador_id: null };
    if (e.kind === 'cono' && fuera.has(e.puerta_con)) return { ...e, puerta_con: null };
    return e;
  }));
}

/** Mueve uno o varios a la vez, respetando el desfase de cada uno. */
export function mover(lista, movimientos) {
  const m = new Map(Object.entries(movimientos || {}));
  if (!m.size) return lista;
  return lista.map((e) => {
    const p = m.get(e.id);
    return p ? { ...e, x: p.x, y: p.y } : e;
  });
}

/* ── El balón ──────────────────────────────────────────────── */

/**
 * Le da un balón a un jugador: el balón se centra en su ficha y él
 * pasa a ser jugador con balón (§7.3).
 *
 * Un jugador lleva COMO MUCHO uno. Si ya tenía otro, el anterior se
 * suelta donde está en vez de desaparecer: perder un balón de la
 * pizarra sin decirlo es peor que dejarlo en el suelo.
 */
export function asignarBalon(lista, balonId, jugadorId, pista = 'entera') {
  const jugador = lista.find((e) => e.id === jugadorId && e.kind === 'jugador');
  const balon = lista.find((e) => e.id === balonId && e.kind === 'balon');
  if (!jugador || !balon) return lista;
  const sitio = sitioDelBalon(jugador, pista);
  return lista.map((e) => {
    if (e.id === balonId) return { ...e, portador_id: jugadorId, ...sitio };
    if (e.kind === 'balon' && e.portador_id === jugadorId) return { ...e, portador_id: null };
    return e;
  });
}

/** Suelta el balón donde esté. */
export function soltarBalon(lista, balonId) {
  return lista.map((e) => (e.id === balonId ? { ...e, portador_id: null } : e));
}

/** ¿Lleva balón este jugador? */
export const llevaBalon = (lista, jugadorId) => lista.some((e) => e.kind === 'balon' && e.portador_id === jugadorId);

/**
 * Los balones asignados siguen a su portador. Se llama después de
 * mover: si no, arrastrar a un jugador con balón dejaría el balón
 * atrás y habría que acordarse de moverlo en cada sitio que mueva algo.
 */
export function seguirAlPortador(lista, pista = 'entera') {
  const donde = new Map(lista.filter((e) => e.kind === 'jugador').map((e) => [e.id, e]));
  return lista.map((e) => {
    if (e.kind !== 'balon' || !e.portador_id) return e;
    const j = donde.get(e.portador_id);
    if (!j) return e;
    const s = sitioDelBalon(j, pista);
    return (e.x === s.x && e.y === s.y) ? e : { ...e, ...s };
  });
}

/* ── En juego ──────────────────────────────────────────────── */

/** Quien no está en juego no lleva dorsal y no cuenta para la
 *  situación de ataque-defensa (§8.2). */
export function enJuego(lista, id, on) {
  return renumerar(lista.map((e) => (e.id === id ? { ...e, en_juego: !!on } : e)));
}

export const jugadoresEnJuego = (lista) => lista.filter((e) => e.kind === 'jugador' && e.en_juego !== false);

/** Cuántos hay de cada cosa, para el recuento de la barra. */
export function recuento(lista) {
  const c = { jugadores: 0, balones: 0, conos: 0, material: 0, zonas: 0 };
  for (const e of lista) {
    if (e.kind === 'jugador') { if (e.en_juego !== false) c.jugadores++; }
    else if (e.kind === 'balon') c.balones++;
    else if (e.kind === 'cono') c.conos++;
    else if (e.kind === 'escalera' || e.kind === 'pelota') c.material++;
    else if (e.kind === 'zona') c.zonas++;
  }
  return c;
}

/** Radio de cada cosa EN METROS, que es de donde sale el acierto. */
export function radioMetros(kind) {
  const d = TAMANOS[kind === 'jugador' ? 'jugador' : kind] ?? TAMANOS.jugador;
  return d / 2;
}
