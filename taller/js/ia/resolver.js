/* ============================================================
   ia/resolver.js — resolutor de la animación a partir de la INTENCIÓN
   base + la capa de ediciones manuales (Tramo 6.2). Función PURA y
   determinista: reconstruye la geometría §10 desde cero cada vez, así
   que "re-resolver" (la defensa reactiva vuelve a reaccionar a las
   nuevas posiciones) y "conservar los retoques" conviven sin pisarse.

   Dos capas de edición, por el orden en que se aplican:
     1) INTENCIÓN (op 'destino'): fija el `hacia` de un evento
        bote/corte/defiende ANTES de compilar → recompilar re-coloca a
        la defensa goal-side del NUEVO punto (re-reacción real).
     2) GEOMETRÍA (op 'ruta'): reemplaza el trazo ya compilado de un
        movimiento/pase (curvas y waypoints que la intención no expresa).
        Su `kind` ('mov'|'pase') direcciona el trazo cuando un jugador tiene
        ambos en una fase. Su final propaga al arranque de la fase siguiente
        SOLO si el elemento queda quieto allí (restPositions/engine usan
        restStart); si vuelve a moverse, ese arranque lo fija la INTENCIÓN
        (op 'destino', que recompila la cadena). Un 'ruta' no re-reacciona.

   Es el MISMO compilado que ia/client.js (defensaReactiva → compilar),
   para que lo editado a mano y lo generado salgan de un único camino.
   ============================================================ */

import { compilarAnimacion } from './compilador.js';
import { defensaReactiva } from './simulador.js';

const clon = (o) => JSON.parse(JSON.stringify(o));

// eventos con ranura `hacia` que un override 'destino' puede fijar (bote/corte
// avanzan a un punto; defiende — Tramo 5 — acepta destino explícito).
const CON_HACIA = new Set(['bote', 'corte', 'defiende']);

/**
 * @param base      { intent, posiciones? } — intent = el `_intent` que dejó el
 *                  compilador o el simulador; posiciones = diccionario custom
 *                  de la pista (opcional).
 * @param ediciones [ { fase, elemento, op:'destino'|'ruta', valor } ]
 * @returns animación §10 + { _ediciones:n, _descartadas:[{...op, motivo}] }.
 *          _descartadas: retoques que ya no encajan en la base actual (se
 *          avisan en vez de perderse en silencio).
 */
export function resolverAnimacion(base, ediciones = [], elementos = [], pista = 'entera', opts = {}) {
  const intent = clon((base && base.intent) || { canasta: null, fases: [] });
  const posiciones = (opts && opts.posiciones) || (base && base.posiciones) || null;
  const descartadas = [];

  // 1) capa INTENCIÓN — 'destino' fija el `hacia` del evento del elemento en
  //    esa fase (bote/corte/defiende). Recompilar re-coloca a la defensa.
  for (const e of ediciones) {
    if (!e || e.op !== 'destino' || !e.valor) continue;
    const fase = intent.fases && intent.fases[e.fase];
    const ev = fase && (fase.eventos || []).find((x) => x && x.jugador === e.elemento && CON_HACIA.has(x.tipo));
    if (ev) ev.hacia = { x: e.valor.x, y: e.valor.y };
    else descartadas.push({ ...e, motivo: 'sin evento con destino editable en esa fase' });
  }

  // 2) compilar (defensa reactiva incluida — idéntico a ia/client.js)
  const geo = compilarAnimacion(defensaReactiva(intent, elementos, pista), elementos, pista, { posiciones });

  // 3) capa GEOMETRÍA — 'ruta' reemplaza el trazo compilado del movimiento o
  //    pase de ese elemento en esa fase. El motor propaga su final aguas abajo.
  for (const e of ediciones) {
    if (!e || e.op !== 'ruta' || !Array.isArray(e.valor)) continue;
    const fase = geo.fases && geo.fases[e.fase];
    if (!fase) { descartadas.push({ ...e, motivo: 'esa fase ya no existe' }); continue; }
    // e.kind ('mov'|'pase') direcciona sin ambigüedad cuando un jugador tiene
    // movimiento Y pase en la misma fase; sin kind (ediciones antiguas) cae al
    // orden legado: movimiento primero, pase si no hay movimiento.
    let mov = null, pase = null;
    if (e.kind === 'pase') pase = (fase.pases || []).find((p) => p.de_id === e.elemento);
    else if (e.kind === 'mov') mov = (fase.movimientos || []).find((m) => m.elemento_id === e.elemento);
    else { mov = (fase.movimientos || []).find((m) => m.elemento_id === e.elemento); pase = !mov ? (fase.pases || []).find((p) => p.de_id === e.elemento) : null; }
    if (mov) mov.path = clon(e.valor);
    else if (pase) pase.path = clon(e.valor);
    else descartadas.push({ ...e, motivo: 'ese elemento ya no se mueve en esa fase' });
  }

  geo._ediciones = ediciones.length;
  geo._descartadas = descartadas;
  return geo;
}

/**
 * Inserta o reemplaza una edición en la lista (misma fase+elemento+op+kind = una
 * sola entrada; el último arrastre manda). El `kind` en la clave permite que la
 * 'ruta' del movimiento y la del pase de un mismo jugador+fase coexistan.
 * Devuelve una lista NUEVA (no muta).
 */
export function upsertEdicion(ediciones, edicion) {
  const fuera = (ediciones || []).filter((e) => !(e.fase === edicion.fase && e.elemento === edicion.elemento && e.op === edicion.op && (e.kind || null) === (edicion.kind || null)));
  return [...fuera, edicion];
}
