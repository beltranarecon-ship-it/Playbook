/* ============================================================
   pizarra/motor/defensa.js — quién ataca, quién defiende a quién y
   en qué situación (§8.1, §8.2).

   Módulo PURO: sin DOM, sin canvas, sin red. Lo prueba en Node
   taller/tools/eval-defensa.mjs.

   ── UNA SOLA RESPUESTA PARA TODOS ───────────────────────────
   El anillo de la Pizarra, el arco del defensor, la línea de cada par,
   el compilador y (en los pasos siguientes) el panel de Ajustes y la
   defensa que se mueve sola preguntan lo mismo: ¿quién defiende a quién
   en esta fase? Si cada uno lo calculara a su manera, la Pizarra
   enseñaría una defensa y el proyector otra. Por eso hay una sola
   función que lo contesta, `papelesDeJugada`, y todo lo demás la llama.

   ── LO QUE DECIDIÓ EL ENTRENADOR ────────────────────────────
     · Ataca el equipo que tiene el balón al empezar; los demás
       defienden. Si no hay un atacante claro —nadie lo tiene, o lo
       tienen dos equipos—, nadie defiende hasta que se elija en Ajustes,
       que ofrece además «nadie defiende».
     · Los pares: primero el que se ha dicho a mano («defiende a…»),
       luego por dorsal y, sin dorsal que coincida, el atacante libre más
       cercano (§8.1). Se deciden AL EMPEZAR la jugada y se mantienen:
       los cambian las acciones (cambia con…, robo), no el sitio al que
       se mueve cada uno.
     · La situación se cuenta al empezar cada fase con los que están en
       juego, y se puede forzar (§8.2).
   ============================================================ */

import { metrosEntre } from '../../canvas/escala.js';
import { numeroDe, EQUIPOS } from '../elementos.js';

/* ── Las reglas y sus números (§8.3) ───────────────────────── */

/** Los cuatro preajustes que se pueden elegir para todo el ejercicio. La
 *  retrasa y la trampa no se eligen: las pone la situación. */
export const REGLAS = ['entre_par_y_aro', 'niega_linea', 'ayuda_y_flota', 'presion'];
export const REGLA_POR_DEFECTO = 'entre_par_y_aro';

/** Los nombres que se leen, en el orden de REGLAS. */
export const NOMBRE_REGLA = {
  entre_par_y_aro: 'Entre su par y el aro',
  niega_linea: 'Negar la línea de pase',
  ayuda_y_flota: 'Ayuda y flota',
  presion: 'Presión al balón',
};

export const SITUACIONES = ['igualdad', 'inferioridad', 'superioridad'];

/**
 * Los números de serie, en METROS salvo que el nombre diga otra cosa.
 * Los del §8.3, y los que la especificación no fijaba y aceptó el
 * entrenador (negar, retrasa, es sobrepasado, cierra el rebote). Cada
 * ejercicio puede cambiar los suyos (`defensa.parametros`); aquí están
 * los de partida, y en ningún otro sitio.
 */
export const PARAMETROS = Object.freeze({
  par_con_balon: 1.2,       // entre su par y el aro, si su par lleva balón
  par_sin_balon: 2.0,       // … y si no
  niega_hasta: 7.0,         // niega solo si su par está a menos de esto del balón
  niega_paso: 0.8,          // el paso hacia el balón al negar
  flota_hasta: 3.5,         // ayuda y flota: hasta aquí de su par
  presion: 1.0,             // presión al balón
  retrasa_zona_tiro: 6.75,  // retrasa: sale al receptor dentro de esto del aro
  trampa: 1.5,              // separación de la V de la trampa
  sobrepasado: 1.2,         // el «metro largo» de es sobrepasado
  cierra_rebote: 0.8,       // a esto de su par, hasta el final de la fase
  bloqueo: 0.7,             // a esto del defensor se planta quien bloquea
});

/** Una defensa nueva: nada decidido a mano. */
export function defensaPorDefecto() {
  return { preajuste: REGLA_POR_DEFECTO, parametros: {}, situacion: null, ataca: null };
}

/** Los números que valen en este ejercicio: los suyos encima de los de
 *  serie. */
export function parametrosDe(defensa) {
  return { ...PARAMETROS, ...((defensa && defensa.parametros) || {}) };
}

/**
 * Deja una defensa guardada en condiciones. Lo que no se entiende se
 * quita y SE DICE; lo que falta se rellena sin decir nada, porque una
 * jugada sin defensa es simplemente una en la que no se ha tocado.
 *
 * @returns { defensa, avisos }
 */
export function normalizarDefensa(bruta) {
  const defensa = defensaPorDefecto();
  const avisos = [];
  if (bruta == null) return { defensa, avisos };
  if (typeof bruta !== 'object' || Array.isArray(bruta)) {
    avisos.push('Los ajustes de la defensa estaban rotos: se abren los de serie.');
    return { defensa, avisos };
  }
  if (bruta.preajuste != null) {
    if (REGLAS.includes(bruta.preajuste)) defensa.preajuste = bruta.preajuste;
    else avisos.push(`La regla de la defensa «${bruta.preajuste}» no se conoce: se usa «${NOMBRE_REGLA[REGLA_POR_DEFECTO]}».`);
  }
  if (bruta.parametros != null && typeof bruta.parametros === 'object' && !Array.isArray(bruta.parametros)) {
    for (const [k, v] of Object.entries(bruta.parametros)) {
      /* Con `in` valdrían también las claves que todo objeto hereda
         (toString, constructor…): solo las propias. */
      if (Object.prototype.hasOwnProperty.call(PARAMETROS, k) && Number.isFinite(v) && v > 0) defensa.parametros[k] = v;
      else avisos.push(`Un número de la defensa («${k}») no valía y se usa el de serie.`);
    }
  } else if (bruta.parametros != null) {
    avisos.push('Los números de la defensa estaban rotos: se usan los de serie.');
  }
  if (bruta.situacion != null) {
    if (SITUACIONES.includes(bruta.situacion)) defensa.situacion = bruta.situacion;
    else avisos.push('La situación forzada de la defensa no se conoce: se calcula sola.');
  }
  if (bruta.ataca != null) {
    if (bruta.ataca === 'nadie' || EQUIPOS.includes(bruta.ataca)) defensa.ataca = bruta.ataca;
    else avisos.push('El equipo que ataca no se conoce: se decide por quién tiene el balón.');
  }
  return { defensa, avisos };
}

/* ── Quién ataca ───────────────────────────────────────────── */

const jugadores = (elementos) => (elementos || []).filter((e) => e && e.kind === 'jugador');
const enJuego = (e) => e.en_juego !== false;

/**
 * El equipo que ataca, o `null` si no ataca nadie.
 *
 * @param elementos  la escena AL EMPEZAR, con quién tiene cada balón
 *                   (`portador_id` de los balones)
 * @param defensa    `ataca`: null = el del balón, 'nadie', o un equipo
 */
export function quienAtaca({ elementos = [], defensa = null } = {}) {
  const forzado = defensa && defensa.ataca;
  const suyos = jugadores(elementos);
  if (forzado === 'nadie') return null;
  if (forzado) return suyos.some((j) => j.equipo === forzado) ? forzado : null;
  const porId = new Map(suyos.map((j) => [j.id, j]));
  const equipos = new Set();
  for (const b of elementos || []) {
    if (!b || b.kind !== 'balon' || !b.portador_id) continue;
    const j = porId.get(b.portador_id);
    if (j) equipos.add(j.equipo || 'A');
  }
  return equipos.size === 1 ? [...equipos][0] : null;
}

/* ── Los pares (§8.1) ──────────────────────────────────────── */

/**
 * Quién defiende a quién.
 *
 * Un atacante tiene como mucho un defensor, y un defensor como mucho un
 * par. Quien no está en juego no cuenta ni para atacar ni para defender.
 *
 *   1. «defiende a…» puesto a mano (`defiende_a`), si apunta a un
 *      atacante libre;
 *   2. el mismo dorsal;
 *   3. el atacante libre más cercano, de dos en dos: siempre la pareja
 *      más corta que quede. En empate exacto, el orden de la escena.
 *
 * @returns { ataca, atacantes: [ids], defensores: [ids], pares: { defensor: atacante|null } }
 */
export function emparejar({ elementos = [], defensa = null, pista = 'entera' } = {}) {
  const ataca = quienAtaca({ elementos, defensa });
  const enPista = jugadores(elementos).filter(enJuego);
  if (!ataca) return { ataca: null, atacantes: [], defensores: [], pares: {} };
  const atacantes = enPista.filter((j) => (j.equipo || 'A') === ataca);
  const defensores = enPista.filter((j) => (j.equipo || 'A') !== ataca);
  const pares = {};
  const libre = new Set(atacantes.map((a) => a.id));
  const sinPar = [];

  // 1 · a mano
  for (const d of defensores) {
    if (d.defiende_a && libre.has(d.defiende_a)) { pares[d.id] = d.defiende_a; libre.delete(d.defiende_a); }
  }
  // 2 · por dorsal
  for (const d of defensores) {
    if (d.id in pares) continue;
    const n = String(numeroDe(d));
    const a = n !== '' ? atacantes.find((x) => libre.has(x.id) && String(numeroDe(x)) === n) : null;
    if (a) { pares[d.id] = a.id; libre.delete(a.id); } else sinPar.push(d);
  }
  // 3 · el libre más cercano, siempre la pareja más corta que quede
  const quedan = new Set(sinPar.map((d) => d.id));
  while (quedan.size && libre.size) {
    let mejor = null;
    sinPar.forEach((d, i) => {
      if (!quedan.has(d.id)) return;
      atacantes.forEach((a, k) => {
        if (!libre.has(a.id)) return;
        const m = metrosEntre(pista, d, a);
        /* Con margen: dos sitios simétricos de la pista pueden quedar a
           distancias que se diferencian en el último decimal, y eso no es
           estar más cerca; en empate decide el orden de la escena. */
        if (!mejor || m < mejor.m - 1e-6) mejor = { d: d.id, a: a.id, m, i, k };
      });
    });
    pares[mejor.d] = mejor.a;
    quedan.delete(mejor.d);
    libre.delete(mejor.a);
  }
  for (const id of quedan) pares[id] = null;

  return { ataca, atacantes: atacantes.map((a) => a.id), defensores: defensores.map((d) => d.id), pares };
}

/* ── La situación (§8.2) ───────────────────────────────────── */

/** Igualdad, inferioridad (menos defensores) o superioridad (más), o la
 *  que se haya forzado. Sin nadie que defienda no hay situación. */
export function situacionDe({ atacantes = [], defensores = [], defensa = null } = {}) {
  if (!defensores.length) return null;
  if (defensa && SITUACIONES.includes(defensa.situacion)) return defensa.situacion;
  if (defensores.length < atacantes.length) return 'inferioridad';
  if (defensores.length > atacantes.length) return 'superioridad';
  return 'igualdad';
}

/* ── Todo junto, fase a fase ───────────────────────────────── */

/**
 * Los papeles de una jugada (§11.1): al empezar y en cada fase.
 *
 * Hoy son los mismos en todas las fases: lo que los cambia —robar,
 * cambiar de par— llega en los pasos 5.6 y 5.7, y entrará aquí, que es
 * donde todos lo van a leer.
 *
 * @param jugada { pista, elementos (la escena al empezar), fases, defensa }
 * @returns { inicio, fases: [papeles] } con
 *          papeles = { ataca, atacantes, defensores, pares, situacion }
 */
export function papelesDeJugada(jugada) {
  const j = jugada || {};
  const base = emparejar({ elementos: j.elementos || [], defensa: j.defensa, pista: j.pista || 'entera' });
  const papeles = { ...base, situacion: situacionDe({ ...base, defensa: j.defensa }) };
  return { inicio: papeles, fases: (j.fases || []).map(() => papeles) };
}

/**
 * Los tramos dibujados de quien DEFIENDE que no son cosa de la defensa
 * —un corte, un bote—. Salen cuando se cambia quién ataca con trazos ya
 * dibujados: la defensa no dibuja trazos de ataque («romper la regla»,
 * §8.8, no entra), así que se dice, y el entrenador decide.
 *
 * @param esDeDefensa (slug) => true si la acción vale para un defensor
 * @returns [{ fase, tramo }]
 */
export function tramosQueNoEncajan(jugada, papeles, esDeDefensa) {
  const r = [];
  ((jugada && jugada.fases) || []).forEach((f, i) => {
    const def = new Set(((papeles && papeles.fases[i]) || { defensores: [] }).defensores);
    for (const t of (f && f.tramos) || []) {
      if (t && def.has(t.elemento_id) && !esDeDefensa(t.accion)) r.push({ fase: i, tramo: t });
    }
  });
  return r;
}
