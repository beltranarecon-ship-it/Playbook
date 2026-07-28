/* ============================================================
   ia/simulador.js — Tramo 5: simulación ataque/defensa reactiva.

   DOS capas (decisión de producto):
   (a) defensaReactiva(intent, elementos, pista): en ejercicios
       normales, los defensores YA declarados (evento 'defiende' con
       marca en alguna fase) SIGUEN a su par en las fases siguientes
       cuando este se mueve (bote/corte) y ellos no tienen evento —
       inyecta `defiende { marca }` al final de la fase y la fórmula
       goal-side del compilador hace el resto. Jugadores nunca
       declarados defensores NO se mueven solos (se preserva la
       semántica de "movimiento parcial" del banco).
   (b) simularJugada({elementos, pista, canasta, semilla}): genera la
       jugada COMPLETA — los atacantes botan/pasan/cortan buscando
       tiro y la defensa individual (presión / línea de pase / ayuda
       de lado débil) reacciona fase a fase. Determinista: misma
       colocación + misma semilla ⇒ mismo JSON (PRNG mulberry32); el
       botón "Otra variante" incrementa la semilla.

   Arquitectura: la simulación es un GENERADOR DE INTENT — produce
   eventos existentes (bote|corte|pase|tiro|defiende con hacia {x,y}
   explícito), pasa por validarIntent (cinturón) y compila con
   compilarAnimacion. Cero geometría nueva en el engine: la vista
   previa, los chips, el anillo del portador y el aro exacto del tiro
   salen del flujo de siempre.

   Todo destino que emite este módulo es {x,y} EXPLÍCITO: el espejo
   interno de posiciones coincide 1:1 con lo que hará el compilador
   (no se duplica haciaCanasta/FRACCION). Los `defiende` van SIEMPRE
   al final del array de eventos de su fase (el compilador procesa en
   orden y así el defensor "deniega" contra el punto de LLEGADA).
   ============================================================ */

import { PISTAS, clamp01 } from '../canvas/court.js';
import { aroExacto, posicionesDe } from '../canvas/anclas.js';
import { balonesDelTablero, compilarAnimacion } from './compilador.js';
import { validarIntent } from './validador.js';

/* ---- constantes de la simulación (unidades normalizadas [0,1]) ----
   Exportadas para que el banco aserte fórmulas sin re-derivarlas. */
export const SIM = {
  MAX_FASES: 6,           // tope duro; la última fase SIEMPRE es tiro
  RADIO_CAPTURA: 0.05,    // balón "en manos de" el jugador más cercano
  R_TIRO_CERCA: 0.24,     // rango cómodo de tiro (dist al aro medido)
  R_TIRO_MAX: 0.45,       // rango máximo (triple abierto)
  APERTURA_CERCA: 0.07,   // separación del defensor para tiro cercano
  APERTURA_LEJOS: 0.09,   // separación exigida para tiro lejano
  P_TIRO_CERCA: 0.85, P_TIRO_LEJOS: 0.35, P_PENETRA: 0.5,
  D_FIN_PENETRACION: 0.16, // la penetración muere a esta distancia del aro
  CARRIL: 0.07,           // anchura del carril libre para penetrar
  P_CORTE_RECEPTOR: 0.35, // el receptor corta a recibir
  P_PUERTA_ATRAS: 0.6,    // pasar-y-cortar: puerta atrás vs aclarado
  D_FIN_CORTE_ARO: 0.09,  // el corte al aro se queda a esto del aro
  D_AYUDA_CIERRA: 0.06,   // ayuda que cierra la penetración → descarga
  PASE_PELIGRO: 0.05,     // defensor a menos de esto del carril de pase
  W_APERTURA: 1.2, W_CERCANIA: 0.5, W_PELIGRO: 0.8, W_DEVOLUCION: 0.25, W_JITTER: 0.15,
  D_PRESION: 0.045,       // presión: a un brazo, en la línea balón-aro
  DENY_T: 0.75, DENY_OFF: 0.03, // negación: 3/4 hacia el par + medio cuerpo al aro
  D_UN_PASE: 0.35,        // "a un pase" del balón → negación; más lejos → ayuda
  AYUDA_T: 0.55,          // ayuda: fracción hacia el punto medio par–balón
  D_CLOSEOUT: 0.035,      // salto al tirador en la fase de tiro
  UMBRAL_MOV: 0.02,       // histéresis: por debajo, rol sin movimiento
  D_MAX_DEF: 0.28,        // desplazamiento defensivo máx. por fase (anti-teleport)
  SPOT_LIBRE: 0.08,       // radio de ocupación de un spot
  D_CORTE_SPOT_MAX: 0.35, // corte máximo hacia un spot
};

// Spots de ocupación (anclas comunes a las 4 pistas; las medias no tienen
// poste_alto_* — prohibido usarlas aquí).
const SPOTS_PERIMETRO = ['esquina_izq', 'alero_izq', 'escolta_izq', 'base', 'escolta_der', 'alero_der', 'esquina_der'];
const SPOTS_INTERIOR = ['poste_bajo_izq', 'poste_bajo_der', 'codo_izq', 'codo_der'];

/* ---- PRNG determinista (mulberry32, implementación canónica) ---- */
export function mulberry32(semilla) {
  let a = (semilla >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- geometría auxiliar (guardas anti-NaN: len||1) ---- */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const unit = (v) => { const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; };
const haciaA = (desde, hasta, d) => { // punto a distancia d de `hasta` sobre la línea desde→hasta
  const u = unit({ x: desde.x - hasta.x, y: desde.y - hasta.y });
  return { x: hasta.x + u.x * d, y: hasta.y + u.y * d };
};
const clampP = (p) => ({ x: clamp01(p.x), y: clamp01(p.y) });
// distancia de P al segmento A→B (para carriles de pase/penetración)
function distSeg(P, A, B) {
  const vx = B.x - A.x, vy = B.y - A.y;
  const l2 = vx * vx + vy * vy;
  if (!l2) return dist(P, A);
  let t = ((P.x - A.x) * vx + (P.y - A.y) * vy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(P.x - (A.x + vx * t), P.y - (A.y + vy * t));
}

// Evento de intent con todos los campos (misma forma que el extractor local).
const evento = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });

/* ============================================================
   prepararSimulacion — precondiciones + contexto. Pura.
   Tolerante con el tablero: tercer equipo y balones extra son
   DECORADO (con warning §8.4), no error; solo lo irresoluble
   (sin portador, un solo equipo) corta con { error } accionable.
   ============================================================ */
export function prepararSimulacion(elementos = [], pista = 'entera', canasta = null) {
  const board = (elementos || []).filter((e) => e && e.kind === 'jugador');
  const jugadores = board.map((e) => ({ id: `${e.equipo}${e.label}`, equipo: e.equipo, x: e.x, y: e.y }));
  if (!jugadores.length) return { error: 'Coloca jugadores en la pista antes de simular.' };
  const warnings = [];

  // Balón de juego: el primero que resuelva portador (portador_id del tablero
  // o jugador a ≤ RADIO_CAPTURA). El equipo del portador ATACA.
  const balones = balonesDelTablero(elementos).filter((b) => !b._sintetico);
  if (!balones.length) return { error: 'Añade un balón y colócalo sobre el jugador que inicia el ataque: su equipo ataca y el otro defiende.' };
  let balonId = null, portador = null;
  for (const b of balones) {
    let owner = null;
    if (b.x != null) {
      let best = Infinity;
      for (const j of [...jugadores].sort((p, q) => (p.id < q.id ? -1 : 1))) {
        const d = dist(j, b);
        if (d <= SIM.RADIO_CAPTURA && d < best) { best = d; owner = j; }
      }
    }
    if (owner && !portador) { balonId = b.id; portador = owner; }
    else if (owner && portador && owner.equipo !== portador.equipo) {
      return { error: 'Hay balones en manos de dos equipos distintos: deja un solo balón con portador para saber quién ataca.' };
    } else if (!portador || b.id !== balonId) {
      // balón extra sin conflicto: decorado estático
      if (portador && b.id !== balonId) warnings.push({ texto_original: `balón ${b.id}`, interpretacion: 'no participa en la simulación (se juega con un solo balón)', campo: 'balon' });
    }
  }
  if (!portador) return { error: 'El balón está suelto. Arrástralo sobre el jugador que inicia el ataque: su equipo ataca y el otro defiende.' };

  const atacantes = jugadores.filter((j) => j.equipo === portador.equipo);
  const otros = jugadores.filter((j) => j.equipo !== portador.equipo);
  if (!otros.length) return { error: 'Solo hay un equipo en la pista. Añade al menos un jugador de otro equipo para que defienda.' };
  // equipo defensor = el rival con MÁS jugadores (empate → orden alfabético);
  // equipos de sobra quedan de decorado, con aviso.
  const porEquipo = {};
  for (const j of otros) (porEquipo[j.equipo] = porEquipo[j.equipo] || []).push(j);
  const eqDef = Object.keys(porEquipo).sort((a, b) => porEquipo[b].length - porEquipo[a].length || (a < b ? -1 : 1))[0];
  const defensores = porEquipo[eqDef];
  for (const eq of Object.keys(porEquipo)) {
    if (eq !== eqDef) warnings.push({ texto_original: `equipo ${eq}`, interpretacion: 'no participa en la simulación (solo atacan y defienden dos equipos)', campo: 'equipo' });
  }

  // Canasta: parámetro > único aro de la pista > el aro más cercano al
  // portador (determinista; el chip de canasta de la vista previa permite
  // cambiarla re-simulando, así que no hace falta preguntar).
  const bs = (PISTAS[pista] && PISTAS[pista].baskets) || { norte: [0.5, 0.1] };
  let canastaKey = (canasta && bs[canasta]) ? canasta : null;
  if (!canastaKey) {
    let best = Infinity;
    for (const k of Object.keys(bs)) {
      const d = Math.hypot(bs[k][0] - portador.x, bs[k][1] - portador.y);
      if (d < best) { best = d; canastaKey = k; }
    }
  }
  const aroXY = aroExacto(pista, canastaKey) || bs[canastaKey];
  const aro = { x: aroXY[0], y: aroXY[1] };

  return { canastaKey, aro, balonId, portadorId: portador.id, atacantes, defensores, parejas: emparejar(defensores, atacantes), warnings };
}

/* ---- emparejamiento hombre a hombre (fijo toda la jugada) ----
   Greedy global sobre pares (defensor, atacante) por distancia asc;
   empates por id. Defensores sobrantes → par null (doblan al portador
   en cada fase). Atacantes sobrantes quedan sin marcador. */
export function emparejar(defensores = [], atacantes = []) {
  const triples = [];
  for (const d of defensores) for (const a of atacantes) triples.push([dist(d, a), d.id, a.id]);
  triples.sort((p, q) => p[0] - q[0] || (p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0) || (p[2] < q[2] ? -1 : p[2] > q[2] ? 1 : 0));
  const pares = new Map();
  const libresA = new Set(atacantes.map((a) => a.id));
  for (const [, dId, aId] of triples) {
    if (pares.has(dId) || !libresA.has(aId)) continue;
    pares.set(dId, aId); libresA.delete(aId);
  }
  for (const d of [...defensores].sort((p, q) => (p.id < q.id ? -1 : 1))) if (!pares.has(d.id)) pares.set(d.id, null);
  return pares;
}

/* ---- kernel defensivo (PURO, sin rng): eventos defiende de UNA fase ----
   Recibe las posiciones FINALES del ataque en la fase y el estado
   defensivo; devuelve { eventos, posD } (posD nuevo, sin mutar). Reglas:
   presión al portador / negación a un pase / ayuda de lado débil, con
   tope anti-teleport (D_MAX_DEF) e histéresis (UMBRAL_MOV). En la fase
   de tiro solo el par del tirador hace closeout (tiro limpio). */
function defensaFase({ finA, posD, parejas, portadorFinal, esTiro, aro }) {
  const eventos = [];
  const nuevo = new Map(posD);
  const b = finA.get(portadorFinal);
  for (const dId of [...parejas.keys()].sort()) {
    const par = parejas.get(dId) ?? portadorFinal; // sobrantes doblan al balón
    const pd = posD.get(dId);
    const pm = finA.get(par);
    if (!pd || !pm || !b) { eventos.push(evento(dId, 'defiende', { marca: null })); continue; }
    let objetivo = null;
    if (esTiro) {
      // closeout: SOLO el par del tirador salta; el resto mantiene rol quieto
      objetivo = (par === portadorFinal) ? { x: b.x + (pd.x - b.x) / (dist(pd, b) || 1) * SIM.D_CLOSEOUT, y: b.y + (pd.y - b.y) / (dist(pd, b) || 1) * SIM.D_CLOSEOUT } : null;
    } else if (par === portadorFinal) {
      objetivo = { x: b.x + (aro.x - b.x) / (dist(b, aro) || 1) * SIM.D_PRESION, y: b.y + (aro.y - b.y) / (dist(b, aro) || 1) * SIM.D_PRESION };
    } else if (dist(pm, b) <= SIM.D_UN_PASE) {
      const m = lerp(b, pm, SIM.DENY_T);           // en el carril de pase
      const u = unit({ x: aro.x - m.x, y: aro.y - m.y });
      objetivo = { x: m.x + u.x * SIM.DENY_OFF, y: m.y + u.y * SIM.DENY_OFF };
    } else {
      const medio = lerp(pm, b, 0.5);              // ayuda: se cierra dentro
      objetivo = lerp(aro, medio, SIM.AYUDA_T);
    }
    if (objetivo) {
      const v = { x: objetivo.x - pd.x, y: objetivo.y - pd.y };
      const l = Math.hypot(v.x, v.y);
      if (l > SIM.D_MAX_DEF) objetivo = { x: pd.x + v.x / l * SIM.D_MAX_DEF, y: pd.y + v.y / l * SIM.D_MAX_DEF };
      if (dist(pd, objetivo) < SIM.UMBRAL_MOV) objetivo = null; // histéresis
    }
    if (objetivo) {
      objetivo = clampP(objetivo);
      eventos.push(evento(dId, 'defiende', { marca: par, hacia: { x: objetivo.x, y: objetivo.y } }));
      nuevo.set(dId, objetivo);
    } else {
      eventos.push(evento(dId, 'defiende', { marca: null })); // rol sin movimiento
    }
  }
  return { eventos, posD: nuevo };
}

/* ============================================================
   simularJugada — capa (b): la jugada completa.
   ============================================================ */
export function simularJugada({ elementos = [], pista = 'entera', canasta = null, semilla = 1 } = {}) {
  const prep = prepararSimulacion(elementos, pista, canasta);
  if (prep.error) return prep;
  const { canastaKey, aro, balonId, atacantes, defensores, parejas } = prep;
  const rng = mulberry32(semilla);

  const posA = new Map(atacantes.map((a) => [a.id, { x: a.x, y: a.y }]));
  let posD = new Map(defensores.map((d) => [d.id, { x: d.x, y: d.y }]));
  const porId = new Map(atacantes.map((a) => [a.id, a]));
  let portador = prep.portadorId;
  let ultimoPasador = null;
  let penetro = false;

  // spots de ocupación por nombre (anclas medidas de ESTA pista/canasta)
  const anclas = posicionesDe(pista, canastaKey) || {};
  const spot = (n) => (anclas[n] ? { x: anclas[n][0], y: anclas[n][1] } : null);
  const spotLibre = (nombres, desde, maxDist, destinosFase) => {
    // spot sin atacante cerca (posición actual o destino ya asignado esta fase)
    let mejor = null, mejorD = Infinity;
    for (const n of nombres) {
      const s = spot(n);
      if (!s) continue;
      let ocupado = false;
      for (const [id, p] of posA) { if (id !== desde.id && dist(p, s) < SIM.SPOT_LIBRE) { ocupado = true; break; } }
      for (const p of destinosFase) { if (dist(p, s) < SIM.SPOT_LIBRE) { ocupado = true; break; } }
      if (ocupado) continue;
      const d = dist(posA.get(desde.id), s);
      if (d < SIM.UMBRAL_MOV || d > maxDist) continue;
      if (d < mejorD) { mejorD = d; mejor = s; }
    }
    return mejor;
  };
  const apertura = (id) => {
    let best = Infinity;
    const p = posA.get(id);
    for (const [, pd] of posD) best = Math.min(best, dist(p, pd));
    return best;
  };

  const fases = [];
  for (let k = 1; k <= SIM.MAX_FASES; k++) {
    const eventos = [];
    const destinosFase = []; // destinos ya asignados esta fase (spots ocupados)
    const movidosFase = new Set(); // atacantes con bote/corte YA emitido esta fase (≤1 por jugador)
    const p = posA.get(portador);
    const d = dist(p, aro);

    // ---- decisión del portador (gates en orden; rng solo si su
    //      precondición geométrica se cumple — determinista igualmente) ----
    let accion = null, receptor = null;
    if (k === SIM.MAX_FASES) accion = 'tiro';
    else if (penetro) {
      // tras penetrar: bandeja, salvo que la ayuda haya cerrado → descarga
      const cerro = [...parejas.entries()].some(([dId, par]) => (parejas.get(dId) ?? portador) !== portador && dist(posD.get(dId) || { x: 9, y: 9 }, p) < SIM.D_AYUDA_CIERRA);
      if (cerro && atacantes.length > 1) {
        accion = 'pase';
        let best = -Infinity;
        for (const a of atacantes) {
          if (a.id === portador) continue;
          const ap = apertura(a.id);
          if (ap > best) { best = ap; receptor = a.id; }
        }
      } else accion = 'tiro';
    } else if (d <= SIM.R_TIRO_CERCA && apertura(portador) >= SIM.APERTURA_CERCA && rng() < SIM.P_TIRO_CERCA) accion = 'tiro';
    else if (d <= SIM.R_TIRO_MAX && apertura(portador) >= SIM.APERTURA_LEJOS && rng() < SIM.P_TIRO_LEJOS) accion = 'tiro';
    else if (k === SIM.MAX_FASES - 1) accion = 'bote_aproximacion'; // garantiza tiro en rango
    else {
      // ¿carril de penetración libre? (el propio par no cuenta: ganarle es penetrar)
      const fin = haciaA(p, aro, SIM.D_FIN_PENETRACION);
      let libre = true;
      for (const [dId, par] of parejas) {
        if ((par ?? portador) === portador) continue;
        if (distSeg(posD.get(dId) || { x: 9, y: 9 }, p, fin) < SIM.CARRIL) { libre = false; break; }
      }
      if (libre && rng() < SIM.P_PENETRA) accion = 'bote_penetracion';
      else accion = 'pase';
    }

    // ---- movimiento sin balón de acompañamiento (pasar-y-cortar):
    //      nunca en la fase de tiro (fase limpia). ----
    if (accion !== 'tiro' && ultimoPasador && ultimoPasador !== portador) {
      const cortador = porId.get(ultimoPasador);
      const r = rng();
      let destino = null;
      if (r < SIM.P_PUERTA_ATRAS) destino = clampP(haciaA(posA.get(cortador.id), aro, SIM.D_FIN_CORTE_ARO)); // puerta atrás
      else destino = spotLibre(SPOTS_PERIMETRO, cortador, SIM.D_CORTE_SPOT_MAX, destinosFase);                 // aclarado
      if (destino && dist(posA.get(cortador.id), destino) >= SIM.UMBRAL_MOV) {
        eventos.push(evento(cortador.id, 'corte', { hacia: destino }));
        posA.set(cortador.id, destino);
        destinosFase.push(destino);
        movidosFase.add(cortador.id);
      }
      ultimoPasador = null;
    }

    // ---- ejecutar la acción del portador ----
    if (accion === 'tiro') {
      fases.push({ eventos: [...eventos, evento(portador, 'tiro', { hacia: 'canasta' })] });
      const def = defensaFase({ finA: posA, posD, parejas, portadorFinal: portador, esTiro: true, aro });
      fases[fases.length - 1].eventos.push(...def.eventos);
      posD = def.posD;
      break;
    }
    if (accion === 'bote_penetracion' || accion === 'bote_aproximacion') {
      const objetivo = accion === 'bote_penetracion'
        ? clampP(haciaA(p, aro, SIM.D_FIN_PENETRACION))
        : clampP(haciaA(p, aro, SIM.R_TIRO_CERCA * 0.8)); // aproximación: entra en rango
      eventos.push(evento(portador, 'bote', { hacia: objetivo }));
      posA.set(portador, objetivo);
      penetro = accion === 'bote_penetracion';
    } else {
      // ---- pase: puntuar receptores (apertura, cercanía al aro, carril
      //      limpio, no devolver al último pasador, jitter de la semilla) ----
      if (!receptor) {
        let best = -Infinity;
        for (const a of atacantes) {
          if (a.id === portador) continue;
          const pa = posA.get(a.id);
          const peligro = [...posD.values()].some((pd) => distSeg(pd, p, pa) < SIM.PASE_PELIGRO) ? 1 : 0;
          const score = SIM.W_APERTURA * apertura(a.id)
            + SIM.W_CERCANIA * Math.max(0, 1 - dist(pa, aro) / 0.6)
            - SIM.W_PELIGRO * peligro
            - SIM.W_DEVOLUCION * (a.id === ultimoPasador ? 1 : 0)
            + SIM.W_JITTER * rng();
          if (score > best) { best = score; receptor = a.id; }
        }
      }
      if (!receptor) {
        // 1v1 (o sin receptores): bote de avance hacia el aro
        const objetivo = clampP(lerp(p, aro, 0.3));
        eventos.push(evento(portador, 'bote', { hacia: objetivo }));
        posA.set(portador, objetivo);
        penetro = false;
      } else {
        // corte de recepción opcional: el receptor va a buscar el pase
        // (nunca un segundo corte del mismo jugador en la fase: ≤1 movimiento)
        if (rng() < SIM.P_CORTE_RECEPTOR && !movidosFase.has(receptor)) {
          const rec = porId.get(receptor);
          const s = spotLibre(SPOTS_INTERIOR, rec, SIM.D_CORTE_SPOT_MAX, destinosFase);
          if (s && dist(s, aro) < dist(posA.get(receptor), aro)) {
            eventos.push(evento(receptor, 'corte', { hacia: s }));
            posA.set(receptor, s);
            destinosFase.push(s);
          }
        }
        eventos.push(evento(portador, 'pase', { a: receptor }));
        ultimoPasador = portador;
        portador = receptor;
        penetro = false;
      }
    }

    // ---- defensa de la fase (contra las posiciones de LLEGADA) ----
    const def = defensaFase({ finA: posA, posD, parejas, portadorFinal: portador, esTiro: false, aro });
    posD = def.posD;
    fases.push({ eventos: [...eventos, ...def.eventos] });
  }

  const intent = { canasta: canastaKey, balones: [{ id: balonId, portador: prep.portadorId }], fases };
  // Cinturón: la MISMA tubería que la IA (validar → compilar). Un intent
  // generado aquí debe salir limpio; si no, error honesto en vez de jugada rota.
  const v = validarIntent(intent, elementos, pista);
  if (v.error || v.preguntas) return { error: 'La simulación no pudo generar una jugada válida con esta colocación. Recoloca los jugadores y vuelve a intentarlo.' };
  const data = compilarAnimacion(v.intent, elementos, pista);
  data.warnings = [...(v.warnings || []), ...prep.warnings];
  data._sim = { semilla: (semilla >>> 0) || 1, canasta: canastaKey };
  return data;
}

/* ============================================================
   defensaReactiva — capa (a): ejercicios normales.
   Solo actúa sobre defensores YA declarados (defiende con marca en
   alguna fase previa o actual); inyecta `defiende { marca }` (sin
   hacia: la fórmula goal-side del compilador manda) al FINAL de la
   fase cuando el par se mueve (bote/corte) y el defensor no tiene
   ningún evento propio. Nunca inventa defensores, nunca pisa un
   evento existente, no toca fases anteriores a la primera
   declaración. Idempotente y sin rng.
   ============================================================ */
export function defensaReactiva(intent, elementos = [], pista = 'entera') {
  if (!intent || !Array.isArray(intent.fases)) return intent;
  const pares = new Map(); // defensorId -> última marca no nula declarada
  const fases = intent.fases.map((f) => {
    const eventos = Array.isArray(f && f.eventos) ? f.eventos : [];
    const conEvento = new Set();   // jugadores con evento propio esta fase
    const movidos = new Set();     // atacantes con bote/corte esta fase
    for (const ev of eventos) {
      if (!ev || !ev.jugador) continue;
      conEvento.add(ev.jugador);
      if (ev.tipo === 'bote' || ev.tipo === 'corte') movidos.add(ev.jugador);
      if (ev.tipo === 'defiende' && ev.marca) pares.set(ev.jugador, ev.marca);
    }
    const inyectados = [];
    for (const dId of [...pares.keys()].sort()) {
      if (conEvento.has(dId)) continue;          // su evento (o su quietud declarada) manda
      if (!movidos.has(pares.get(dId))) continue; // par quieto → defensor quieto
      // _reactiva: marca de "inyectado por esta capa" (no declarado por el
      // entrenador). El editor (paso2.js#derivarOps) la lee para NO emitir un
      // override 'destino' al arrastrar un defensor reactivo: se conserva como
      // trazo ('ruta') y sigue re-reaccionando en cada re-resolución.
      inyectados.push({ ...evento(dId, 'defiende', { marca: pares.get(dId) }), _reactiva: true });
    }
    return inyectados.length ? { ...f, eventos: [...eventos, ...inyectados] } : f;
  });
  return { ...intent, fases };
}
