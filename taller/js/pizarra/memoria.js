/* ============================================================
   pizarra/memoria.js — dónde estabas mirando (§3.1, §11.1).

   Guarda el encuadre —zoom y desplazamiento— de cada ejercicio, para
   que volver a abrirlo te devuelva donde lo dejaste en vez de a la
   pista entera. Todo lo que decide es PURO y lo prueba en Node
   taller/tools/eval-memoria.mjs; de tocar `localStorage` se encargan
   los primitivos que ya existen en js/borradores.js.

   ── DÓNDE NO VA, QUE ES LO IMPORTANTE ───────────────────────
   NO va en el JSON de la jugada. El zoom es de quien mira, no del
   ejercicio: uno dibujado al 300 % tiene que proyectarse igual que uno
   dibujado al 100 %, y el §11.1 no tiene campo para él a propósito. Si
   entrara ahí, dos entrenadores con el mismo ejercicio se pelearían
   por el encuadre a cada guardado.

   ── POR QUÉ UNA SOLA ENTRADA Y NO UNA POR EJERCICIO ─────────
   Porque `localStorage` es un cajón compartido de unos pocos megas, y
   ahí dentro viven también los BORRADORES: el ejercicio a medio hacer,
   con su tablero y su animación. Si la Pizarra fuera dejando una clave
   por cada ejercicio abierto, un día el cajón se llena y lo que falla
   es guardar un borrador — o sea, se pierde media ficha escrita por
   haber recordado un zoom. Eso no puede pasar.

   Así que todo cabe en UNA clave: un mapa pequeño, con tope de
   entradas y poda de las más viejas. Cada entrada son tres números y
   una fecha; treinta entradas ocupan menos de dos kilobytes.

   ── Y POR QUÉ SE RESTAURA SOLO, AL CONTRARIO QUE UN BORRADOR ─
   Un borrador se OFRECE y no se restaura, porque puede sobrescribir
   trabajo bueno. Un encuadre no: no es contenido, no se puede perder
   nada por reponerlo, y preguntar «¿te devuelvo el zoom?» sería un
   cartel que nadie quiere leer. Se repone y punto.
   ============================================================ */

import { guardar, leer } from '../borradores.js';

/** Una sola clave para todos los encuadres. Prefijo `cbp_`, como el
 *  resto de lo que esta app deja en el navegador. */
export const CLAVE = 'cbp_pizarra_encuadre';

/** Cuántos ejercicios se recuerdan. Treinta cubre de sobra una
 *  temporada de trabajo seguido y mantiene la entrada en dos kB. */
export const MAX_RECUERDOS = 30;

/**
 * La clave de un ejercicio, que incluye la PISTA.
 *
 * Sin la pista, cambiar de entera a media reaplicaría un zoom pensado
 * para otra forma y el ejercicio abriría torcido. Con ella, cada pista
 * tiene su recuerdo y cambiar de una a otra encaja limpio.
 *
 * Sin id —un ejercicio que aún no se ha guardado— se usa 'nuevo': hay
 * uno solo a la vez, así que no se pisan entre ellos.
 */
export function claveDe(idEjercicio, pista) {
  return `${idEjercicio || 'nuevo'}::${pista || 'entera'}`;
}

const numero = (v) => (Number.isFinite(v) ? v : null);

/**
 * Deja el mapa en algo utilizable venga como venga. Lo que hay en
 * `localStorage` puede ser de una versión anterior, puede haberlo
 * tocado alguien a mano y puede estar a medio escribir si se cerró la
 * pestaña en mitad de un `setItem`: nada de eso puede impedir abrir la
 * Pizarra.
 */
export function sanear(crudo) {
  if (!crudo || typeof crudo !== 'object') return {};
  const salida = {};
  for (const [clave, v] of Object.entries(crudo)) {
    if (!v || typeof v !== 'object') continue;
    const e = numero(v.e), ox = numero(v.ox), oy = numero(v.oy);
    if (e === null || ox === null || oy === null) continue;
    salida[clave] = { e, ox, oy, t: numero(v.t) ?? 0 };
  }
  return salida;
}

/** Se queda con los `max` más recientes. Fuera, los más viejos. */
export function podar(mapa, max = MAX_RECUERDOS) {
  const claves = Object.keys(mapa);
  if (claves.length <= max) return mapa;
  const vivos = claves
    .sort((a, b) => (mapa[b].t || 0) - (mapa[a].t || 0))
    .slice(0, max);
  return Object.fromEntries(vivos.map((k) => [k, mapa[k]]));
}

/**
 * Apunta un encuadre. Devuelve un mapa NUEVO, ya podado.
 * `enc` es lo que da `encuadre.js#guardable`: { escala, ox, oy }.
 */
export function recordar(mapa, clave, enc, ahora = 0, max = MAX_RECUERDOS) {
  if (!clave || !enc) return mapa;
  const e = numero(enc.escala), ox = numero(enc.ox), oy = numero(enc.oy);
  if (e === null || ox === null || oy === null) return mapa;
  return podar({ ...mapa, [clave]: { e, ox, oy, t: ahora } }, max);
}

/** Lo apuntado para ese ejercicio, en la forma que espera
 *  `CourtView#ponerEncuadre`. `null` si no hay nada. */
export function recuperar(mapa, clave) {
  const v = mapa && mapa[clave];
  return v ? { escala: v.e, ox: v.ox, oy: v.oy } : null;
}

/* ── Lo que sí toca el navegador ───────────────────────────── */

/** Todo lo recordado, saneado. Nunca lanza. */
export function leerTodo() {
  const guardado = leer(CLAVE);
  return sanear(guardado && guardado.entradas);
}

/**
 * Apunta y escribe. Si el almacenamiento está lleno o el navegador va
 * en modo privado, `guardar` devuelve false y aquí no pasa nada: se
 * pierde un zoom, que es exactamente lo que puede perderse sin que
 * nadie se entere.
 */
export function apuntar(clave, enc, ahora = Date.now()) {
  const mapa = recordar(leerTodo(), clave, enc, ahora);
  guardar(CLAVE, { entradas: mapa });
  return mapa;
}

/** El encuadre recordado de un ejercicio, o null. */
export function recordado(clave) {
  return recuperar(leerTodo(), clave);
}
