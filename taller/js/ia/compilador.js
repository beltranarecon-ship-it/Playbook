/* ============================================================
   ia/compilador.js — compilador determinista de intención→geometría
   (Fase 2a de la reforma). Recibe un Intent (qué hace cada jugador,
   fase a fase — ver forma abajo) y lo traduce al JSON de animación
   §10 completo. NO interpreta texto ni regex: solo baloncesto
   geométrico (paths, Bézier, timings, marcaje defensivo). La
   interpretación de texto vive en ia/client.js (extraerIntentoLocal),
   que construye el Intent y llama a compilarAnimacion() aquí.

   Intent = {
     canasta: 'norte' | 'sur' | null,   // YA resuelta antes de llegar aquí
     balones: [ { id, portador } ] | ausente, // Tramo 3a: poseedores INICIALES
                                        // declarados por el modelo (opcional;
                                        // el validador ya los saneó). Sin
                                        // declaración manda la cadena de
                                        // eventos (regla ownerInicial).
     fases: [
       { eventos: [
         { jugador, tipo: 'bote'|'corte'|'pase'|'tiro'|'bloqueo'|'defiende'|'rodea_cono'|'vuelve_a_fila',
           hacia: 'canasta' | {x,y} | null,   // bote/corte: destino
           a: string|null,                     // pase: receptor
           cono_id: string|null,                // rodea_cono: qué cono
           marca: string|null,                  // defiende: a quién marca (null = cuenta como defensor pero no se mueve)
           bloqueado_id: string|null,           // bloqueo: a quién bloquea
         }, ... ]
       }, ...
     ]
   }

   `elementos` es el array crudo del tablero (kind: 'jugador'|'balon'|
   'cono'), igual que en todo el resto del Taller — el compilador
   sintetiza de ahí a los jugadores reales de fila (sintetizarJugadores,
   exportada porque el extractor también la necesita para conocer los
   ids/posiciones disponibles antes de escribir el Intent).
   ============================================================ */

import { PISTAS, clamp01 } from '../canvas/court.js';
import { aroExacto } from '../canvas/anclas.js';
import { resolverPosicion } from './posiciones.js';

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
   de `elementos` (determinista, sin texto): tanto el extractor
   (ia/client.js, para saber qué ids existen y elegir protagonista) como
   este compilador la usan, así que vive aquí una sola vez.

   ROTACIÓN de filas (Tramo 3c): los SIGUIENTES de cada cola también
   existen como ids — 'fila1_2', 'fila1_3'… hasta el 5º (SALIDAS_MAX_FILA)
   — para que una serie ("sale el 1º; vuelve y sale el 2º…") sea
   direccionable por el intent. Van marcados con _extraFila: en la SALIDA
   de compilarAnimacion solo aparecen si el intent los usa (si no,
   siguen siendo fichas anónimas de la cola dibujada), y el extractor
   local (regex) los ignora. Arrancan EN el cono, como fila1: cuando les
   toca salir, el de delante ya se fue y ellos encabezan la cola.
   OJO paridad con jugadoresDe() de netlify/functions/generar-animacion.js
   (ids y tope idénticos). */
const FILA_STEP = 0.06;
export const SALIDAS_MAX_FILA = 5;
export function sintetizarJugadores(elementos = []) {
  const jugadores = elementos.filter((e) => e.kind === 'jugador');
  const conos = elementos.filter((e) => e.kind === 'cono');
  const filasConJugadores = conos.filter((c) => c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0);
  const idDe = (e) => `${e.equipo}${e.label}`;
  const boardJ = jugadores.map((e) => ({ id: idDe(e), equipo: e.equipo, x: e.x, y: e.y, dorsal: e.dorsal, nombre: e.nombre }));
  const filaFront = [];
  const filaExtras = [];
  filasConJugadores.forEach((c, i) => {
    const fc = c.fila_config, rad = (fc.direccion_grados || 0) * Math.PI / 180;
    const tail = { x: clamp01(c.x + Math.cos(rad) * FILA_STEP * fc.n_jugadores), y: clamp01(c.y + Math.sin(rad) * FILA_STEP * fc.n_jugadores) };
    filaFront.push({ id: `fila${i + 1}`, equipo: fc.equipo || 'A', x: c.x, y: c.y, dorsal: null, nombre: null, _tail: tail });
    for (let k = 2; k <= Math.min(fc.n_jugadores, SALIDAS_MAX_FILA); k++) {
      filaExtras.push({ id: `fila${i + 1}_${k}`, equipo: fc.equipo || 'A', x: c.x, y: c.y, dorsal: null, nombre: null, _tail: tail, _extraFila: true, _filaIdx: i + 1 });
    }
  });
  return [...boardJ, ...filaFront, ...filaExtras];
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

/* ---- fracciones de avance hacia la canasta (constantes de siempre) -- */
const FRACCION = { bote: 0.55, corte: 0.3, defiende: 0.25 };

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
  const J = sintetizarJugadores(elementos);
  const byId = new Map(J.map((j) => [j.id, j]));
  const conos = elementos.filter((e) => e.kind === 'cono');
  // mismo fallback de id (`cono_${i+1}`) que usan la function, el validador y
  // la salida de conos de abajo: un cono sin id sigue siendo direccionable
  // desde un rodea_cono (antes la clave cruda `undefined` no casaba y el
  // rodeo degradaba a recta en silencio).
  const conosById = new Map(conos.map((c, i) => [c.id || `cono_${i + 1}`, c]));
  const fasesIntent = (intent && intent.fases) || [];

  const bsPista = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  // Clave de canasta REALMENTE usada: si la del intent no existe en esta pista
  // se cae al primer aro, y la decisión se expone en la salida (data.canasta)
  // para que la vista previa (§Tramo 1) resalte el aro correcto y los tiros
  // nunca referencien un aro fantasma.
  const canastaKey = (intent && intent.canasta && bsPista[intent.canasta]) ? intent.canasta : (Object.keys(bsPista)[0] || 'norte');
  const basket = bsPista[canastaKey] || [0.5, 0.1];
  // Endpoint EXACTO del tiro: el centro del aro MEDIDO sobre el render real
  // (canvas/anclas.js). Decisión Tramo 2.1: court.js `baskets` sigue mandando
  // en la lógica de lado/orientación (canastaKey, haciaCanasta del bote,
  // marcaje goal-side, resaltado del aro en la vista previa); `aroExacto`
  // se usa SOLO como destino final del balón en el tiro y para las
  // posiciones con nombre. En las medias difieren (x≈0.172 medido vs
  // x≈0.143 en court.js, que cae entre tablero y aro).
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

  const defTeamJugadores = new Set(); // cualquiera que defienda en ALGUNA fase -> tipo:'defensor' en la salida
  const fases = [];

  // ids que el intent usa en cualquier papel: decide qué SIGUIENTES de fila
  // (fila1_2, fila1_3… — _extraFila) se materializan como jugadores en la
  // salida. Los no usados siguen siendo fichas anónimas de la cola dibujada
  // (si salieran todos siempre, se duplicarían con drawFila).
  const participa = new Set();
  for (const f of fasesIntent) {
    for (const ev of f.eventos || []) {
      if (!ev) continue;
      for (const id of [ev.jugador, ev.a, ev.marca, ev.bloqueado_id]) if (id) participa.add(id);
    }
  }

  fasesIntent.forEach((faseIntent, i) => {
    const eventos = faseIntent.eventos || [];
    const movimientos = [];
    const pases = [];
    const tiros = [];
    const bloqueos = [];
    const defensoresFase = [];

    // 1) movimiento: bote/corte (+ rodea_cono tejido en el path) y defiende
    //    (solo si trae marca — ver más abajo) y vuelve_a_fila. Este paso va
    //    PRIMERO para que las 'defiende' de este mismo bucle, que leen la
    //    posición de su `marca`, vean la posición YA actualizada si esa
    //    marca también se mueve en esta fase (coincide con cómo lo hacía el
    //    mock viejo: el defensor "deniega" contra el punto de LLEGADA del
    //    atacante, no su posición de salida).
    for (const ev of eventos) {
      const jp = pos.get(ev.jugador);
      if (!jp) continue;
      if (ev.tipo === 'bote' || ev.tipo === 'corte') {
        // botar exige balón: si aún no tiene, toma el libre más cercano
        // (posesión inicial por cadena de eventos — ver arriba).
        if (ev.tipo === 'bote' && !balonDe.has(ev.jugador)) tomarBalonLibre(ev.jugador);
        // destino: {x,y} explícito > posición con nombre (Tramo 2.2: custom
        // de Supabase primero, luego ANCLAS) > avance hacia canasta. Un
        // nombre irreconocible degrada a canasta — la PREGUNTA por nombres
        // desconocidos es cosa del validador, antes de llegar aquí.
        let destino;
        if (ev.hacia && typeof ev.hacia === 'object') {
          destino = ev.hacia;
        } else if (typeof ev.hacia === 'string' && ev.hacia !== 'canasta') {
          const xy = resolverPosicion(pista, ev.hacia, canastaKey, opts.posiciones || null);
          destino = xy ? { x: clamp01(xy[0]), y: clamp01(xy[1]) } : haciaCanasta(jp, basket, FRACCION[ev.tipo]);
        } else {
          destino = haciaCanasta(jp, basket, FRACCION[ev.tipo]);
        }
        const conoIds = eventos.filter((e2) => e2.jugador === ev.jugador && e2.tipo === 'rodea_cono').map((e2) => e2.cono_id);
        let path;
        if (conoIds.length) {
          const conosARodear = conoIds.map((id) => conosById.get(id)).filter(Boolean);
          path = slalomPath(jp, basket, conosARodear, destino) || [{ x: jp.x, y: jp.y, tipo_nodo: 'lineal' }, { x: destino.x, y: destino.y, tipo_nodo: 'lineal' }];
        } else {
          path = [{ x: jp.x, y: jp.y, tipo_nodo: 'lineal' }, { x: destino.x, y: destino.y, tipo_nodo: 'lineal' }];
        }
        movimientos.push({ elemento_id: ev.jugador, tipo_elemento: 'jugador', tipo_movimiento: ev.tipo === 'bote' ? 'carrera_con_balon' : 'corte', path });
        pos.set(ev.jugador, { x: destino.x, y: destino.y });
      } else if (ev.tipo === 'defiende') {
        // cuenta SIEMPRE para fase.defensores (rol), pero solo se mueve si
        // trae `marca` (el extractor la deja a null cuando el atacante
        // marcado no hace nada esta fase — así el defensor no se mueve).
        defensoresFase.push(ev.jugador);
        if (ev.marca) {
          const marcaPos = pos.get(ev.marca);
          if (marcaPos) {
            let objetivo;
            if (ev.hacia && typeof ev.hacia === 'object' && Number.isFinite(ev.hacia.x) && Number.isFinite(ev.hacia.y)) {
              // Tramo 5: destino EXPLÍCITO calculado por la simulación
              // (presión/negación de línea de pase/ayuda de lado débil,
              // ia/simulador.js): el defensor va DIRECTO a ese punto — el
              // 0.7 de abajo es parte de la fórmula legada, no se aplica
              // dos veces. Sin `hacia` (todos los intents previos a este
              // tramo) el comportamiento es EXACTAMENTE el de siempre.
              objetivo = { x: clamp01(ev.hacia.x), y: clamp01(ev.hacia.y) };
            } else {
              const denegar = haciaCanasta(marcaPos, basket, FRACCION.defiende);
              objetivo = { x: jp.x + (denegar.x - jp.x) * 0.7, y: jp.y + (denegar.y - jp.y) * 0.7 };
            }
            movimientos.push({ elemento_id: ev.jugador, tipo_elemento: 'jugador', tipo_movimiento: 'carrera_sin_balon', path: [{ x: jp.x, y: jp.y, tipo_nodo: 'lineal' }, { x: objetivo.x, y: objetivo.y, tipo_nodo: 'lineal' }] });
            pos.set(ev.jugador, objetivo);
          }
        }
      } else if (ev.tipo === 'vuelve_a_fila') {
        const j = byId.get(ev.jugador);
        if (j && j._tail) {
          movimientos.push({ elemento_id: ev.jugador, tipo_elemento: 'jugador', tipo_movimiento: 'carrera_sin_balon', path: [{ x: jp.x, y: jp.y, tipo_nodo: 'lineal' }, { x: j._tail.x, y: j._tail.y, tipo_nodo: 'lineal' }] });
          pos.set(ev.jugador, j._tail);
        }
      }
    }

    // 2) pases (usan la posición YA actualizada por el paso 1, si aplica).
    //    Cada pase viaja con el balón de SU pasador (multi-balón: pases en
    //    paralelo en la misma fase usan balones distintos) y la posesión
    //    pasa al receptor.
    for (const ev of eventos) {
      if (ev.tipo !== 'pase') continue;
      const de = pos.get(ev.jugador), a = pos.get(ev.a);
      if (!de || !a) continue;
      const bId = balonEfectivo(ev.jugador);
      pases.push({ id: `pase_${i + 1}_${pases.length + 1}`, de_id: ev.jugador, balon_id: bId, a_id: ev.a, duracion_ms: 450, path: [{ x: de.x, y: de.y }, { x: a.x, y: a.y }] });
      if (balonDe.get(ev.jugador) === bId) balonDe.delete(ev.jugador);
      balonDe.set(ev.a, bId);
    }

    // 3) tiros. Path EXPLÍCITO (Tramo 2.1): desde la posición actual del
    //    tirador hasta el centro MEDIDO del aro (aroTiro). engine.js usa el
    //    path si trae ≥2 nodos; sin él interpolaría hasta court.js baskets,
    //    que en las medias no es el centro real del aro. Se usa la clave
    //    RESUELTA (canastaKey), nunca la cruda del intent. (Si el tirador no
    //    tiene el balón — tiro sin posesión, ya avisado por el validador —
    //    el balón salta a sus manos al arrancar la fase; la cadena real de
    //    posesión es del Tramo 3.)
    for (const ev of eventos) {
      if (ev.tipo !== 'tiro') continue;
      const jp = pos.get(ev.jugador);
      const desde = jp ? { x: jp.x, y: jp.y } : { x: 0.5, y: 0.5 };
      const bId = balonEfectivo(ev.jugador);
      tiros.push({
        jugador_id: ev.jugador, balon_id: bId, canasta: canastaKey,
        path: [{ x: desde.x, y: desde.y }, { x: aroTiro[0], y: aroTiro[1] }],
      });
      if (balonDe.get(ev.jugador) === bId) balonDe.delete(ev.jugador); // el balón vuela al aro: nadie lo lleva ya
    }

    // 4) bloqueos (el `jugador` del evento ES el bloqueador)
    for (const ev of eventos) {
      if (ev.tipo !== 'bloqueo') continue;
      bloqueos.push({ bloqueador_id: ev.jugador, bloqueado_id: ev.bloqueado_id });
    }

    for (const id of defensoresFase) defTeamJugadores.add(id);

    // timing por prioridad: tiro > pase > vuelve_a_fila > movimiento genérico
    const t = tiros.length ? TIEMPOS.tiro
      : pases.length ? TIEMPOS.pase
      : eventos.some((e) => e.tipo === 'vuelve_a_fila') ? TIEMPOS.vuelve
      : TIEMPOS.movimiento;

    fases.push({ id: `fase_${i + 1}`, duracion_ms: t.duracion_ms, pausa_post_ms: t.pausa_post_ms, movimientos, pases, bloqueos, tiros, defensores: defensoresFase });
  });

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
      tipo: defTeamJugadores.has(j.id) ? 'defensor' : 'atacante',
      posicion_inicial: [j.x, j.y],
      tiene_balon: conBalonInicial.has(j.id),
      dorsal: j.dorsal ?? null, nombre: j.nombre ?? null,
    })),
    balones: balones.map((b) => {
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
    fases,
    canasta: canastaKey, // aro objetivo resuelto: la vista previa lo resalta y el chip lo edita (§Tramo 1)
    // Intent con la canasta ya resuelta: permite RECOMPILAR cambiando solo la
    // canasta (chip editable, ia/client.js#recompilarConCanasta) sin volver a
    // interpretar el texto.
    _intent: {
      canasta: canastaKey, fases: fasesIntent,
      // la declaración de poseedores viaja con el intent: recompilar (p.ej.
      // cambiar de canasta con el chip) no debe perder quién tenía cada balón.
      ...(intent && Array.isArray(intent.balones) && intent.balones.length ? { balones: intent.balones } : {}),
    },
    warnings: [],
    _mock: true,
  };
}
