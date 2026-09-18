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
     · Dónde se coloca cada defensor (§8.3): la regla del ejercicio o la
       suya propia; en INFERIORIDAD retrasa el más cercano al aro que no
       marca al que tiene el balón (con uno solo, él); en SUPERIORIDAD el
       primero que sobra forma la V con el defensor del portador y los
       demás se quedan entre el balón y el aro, a 2 m del balón.

   ── TODO EN METROS ──────────────────────────────────────────
   Las distancias de las reglas son metros de pista, y la pista no mide
   lo mismo a lo ancho que a lo largo: todas las cuentas pasan a metros y
   vuelven. Un «1,2 m» calculado en [0,1] saldría más largo por un eje
   que por el otro.
   ============================================================ */

import { metrosEntre, escalaDe } from '../../canvas/escala.js';
import { fotograma } from '../../canvas/fotograma.js';
import { limitesCancha } from '../../canvas/medidas.js';
import { posicionesDe } from '../../canvas/anclas.js';
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
  /* A esto de su par, hasta el final de la fase. Es el mínimo que cabe:
     el §8.4 no deja que un defensor se acerque a menos de 1,0 m de su par
     y el §3.6 avisaría de choque, así que cerrar el rebote es ponerse
     todo lo cerca que se puede, no más. */
  cierra_rebote: 1.0,
  bloqueo: 0.7,             // a esto del defensor se planta quien bloquea
});

/**
 * Cómo sigue la defensa a su par (§8.4). Son los números de la
 * especificación, y no se tocan por ejercicio: describen a un jugador,
 * no una idea de defensa.
 */
export const SEGUIMIENTO = Object.freeze({
  muestras: 21,        // 20 tramos por fase, como pide el §8.4
  retardo_ms: 250,     // apunta a donde estaba su referencia hace 0,25 s
  velocidad: 2.5,      // m/s: su velocidad lateral, que es su tope
  apartarse: 1.0,      // nunca atraviesa a su par: se aparta a 1 m (§3.6)
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

/* ── Geometría, en metros ──────────────────────────────────── */

/** Un punto dentro de la CANCHA —no solo del marco—, con un margen en
 *  metros: lo que cae en la línea o fuera no se puede jugar. */
export function enCancha(pista, p, margen = 0.3) {
  const e = escalaDe(pista);
  const lim = limitesCancha(pista);
  const dentro = (v, [a, b], escala) => Math.min(b - margen / escala, Math.max(a + margen / escala, v));
  return { x: dentro(p.x, lim.x, e.x), y: dentro(p.y, lim.y, e.y) };
}

/* A `metros` de `a` hacia `b`, sin pasarse de `b`. */
function hacia(pista, a, b, metros) {
  const e = escalaDe(pista);
  const dx = (b.x - a.x) * e.x, dy = (b.y - a.y) * e.y;
  const largo = Math.hypot(dx, dy);
  if (largo < 1e-9 || !(metros > 0)) return { x: a.x, y: a.y };
  const k = Math.min(metros, largo) / largo;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/* A `metros` EXACTOS de `a` en la dirección de `b`, pasándose de `b` si
   hace falta: es lo que necesita apartarse de alguien que ya se tiene
   encima, donde `hacia` se quedaría corto. */
function aDistancia(pista, a, b, metros) {
  const e = escalaDe(pista);
  const dx = (b.x - a.x) * e.x, dy = (b.y - a.y) * e.y;
  const largo = Math.hypot(dx, dy);
  if (largo < 1e-9) return { x: a.x, y: a.y };
  const k = metros / largo;
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

/* El punto del segmento a–b más cercano a p. */
function alSegmento(pista, p, a, b) {
  const e = escalaDe(pista);
  const ax = a.x * e.x, ay = a.y * e.y, dx = (b.x - a.x) * e.x, dy = (b.y - a.y) * e.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x * e.x - ax) * dx + (p.y * e.y - ay) * dy) / l2)) : 0;
  return { x: (ax + dx * t) / e.x, y: (ay + dy * t) / e.y };
}

/* `p` girado `angulo` radianes alrededor de `centro`. */
function girar(pista, centro, p, angulo) {
  const e = escalaDe(pista);
  const vx = (p.x - centro.x) * e.x, vy = (p.y - centro.y) * e.y;
  const c = Math.cos(angulo), s = Math.sin(angulo);
  return { x: centro.x + (vx * c - vy * s) / e.x, y: centro.y + (vx * s + vy * c) / e.y };
}

/* `p` desplazado `metros` en perpendicular a la línea a→b. */
function alLado(pista, p, a, b, metros) {
  const e = escalaDe(pista);
  const dx = (b.x - a.x) * e.x, dy = (b.y - a.y) * e.y;
  const largo = Math.hypot(dx, dy) || 1;
  return { x: p.x + (-dy / largo) * metros / e.x, y: p.y + (dx / largo) * metros / e.y };
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
 * Quién RETRASA en inferioridad (§8.2, §8.3): el defensor más cercano al
 * aro que no marca al que tiene el balón; con uno solo, él.
 *
 * Se decide aquí, con la escena AL EMPEZAR, y no al colocar: el sitio de
 * cada uno es justo lo que `colocar` cambia, así que decidirlo allí haría
 * que los papeles se intercambiaran en cada consulta, y el §8.2 dice que
 * dentro de una fase nadie cambia de comportamiento.
 */
function quienRetrasa({ elementos = [], papeles = null, pista = 'entera', canasta = 'norte' } = {}) {
  if (!papeles || papeles.situacion !== 'inferioridad') return null;
  const pos = posicionesDe(pista, canasta);
  if (!pos || !pos.aro) return null;
  const aro = { x: pos.aro[0], y: pos.aro[1] };
  const porId = new Map((elementos || []).filter(Boolean).map((e) => [e.id, e]));
  const en = (id) => { const e = porId.get(id); return e && Number.isFinite(e.x) && Number.isFinite(e.y) ? { x: e.x, y: e.y } : null; };
  const lleva = (id) => (elementos || []).some((b) => b && b.kind === 'balon' && b.portador_id === id);
  const conSitio = (papeles.defensores || []).filter((d) => en(d));
  const libres = conSitio.filter((d) => !(papeles.pares[d] && lleva(papeles.pares[d])));
  const elegido = (libres.length ? libres : conSitio)
    .reduce((m, d) => { const x = metrosEntre(pista, en(d), aro); return !m || x < m.x - 1e-6 ? { d, x } : m; }, null);
  return elegido ? elegido.d : null;
}

/**
 * Los papeles de una jugada (§11.1): al empezar y en cada fase.
 *
 * Hoy son los mismos en todas las fases: lo que los cambia —robar,
 * cambiar de par— llega en los pasos 5.6 y 5.7, y entrará aquí, que es
 * donde todos lo van a leer.
 *
 * @param jugada { pista, elementos (la escena al empezar), fases, defensa }
 * @returns { inicio, fases: [papeles] } con
 *          papeles = { ataca, atacantes, defensores, pares, situacion, retrasa }
 */
export function papelesDeJugada(jugada) {
  const j = jugada || {};
  const base = emparejar({ elementos: j.elementos || [], defensa: j.defensa, pista: j.pista || 'entera' });
  const conSituacion = { ...base, situacion: situacionDe({ ...base, defensa: j.defensa }) };
  const papeles = {
    ...conSituacion,
    retrasa: quienRetrasa({
      elementos: j.elementos || [], papeles: conSituacion, pista: j.pista || 'entera', canasta: j.canasta || 'norte',
    }),
  };
  return { inicio: papeles, fases: (j.fases || []).map(() => papeles) };
}

/* ── La defensa se mueve sola (§8.4) ───────────────────────── */

/**
 * Por dónde pasa cada defensor durante una fase: veinte tramos, con el
 * retardo natural y su tope de velocidad.
 *
 * Sigue a donde estaba su referencia HACE 0,25 s —no a donde está—, y no
 * se mueve más rápido que su velocidad lateral: así no teletransporta ni
 * corta por dentro en las curvas (§8.4). Y nunca atraviesa a su par: si
 * fueran a coincidir, se aparta a un metro (§3.6).
 *
 * Se calcula al compilar, con el MISMO fotograma que reproduce el motor
 * (canvas/fotograma.js): la defensa sigue al atacante por donde se le ve.
 *
 * @param meta        lo que pasa en la fase, de `metaDeFase`
 * @param inicio      la escena al EMPEZAR la fase
 * @param jugadores   los de la animación (con su equipo)
 * @param balones     los de la animación
 * @param reglas      { [jugador]: regla propia } para colocar
 * @param tiros       los de la fase: tras uno fallado, se cierra el rebote
 * @returns { [defensor]: { muestras: [{ t, x, y }], fin: { x, y } } }
 */
export function seguirDefensa({
  pista = 'entera', canasta = 'norte', defensa = null, papeles = null,
  jugadores = [], balones = [], reglas = {}, meta = null, inicio = null,
  duracion_ms = 0, tiros = [], cuantas = SEGUIMIENTO.muestras,
} = {}) {
  const salida = {};
  const defensores = (papeles && papeles.defensores) || [];
  if (!inicio || !defensores.length || !(duracion_ms > 0)) return salida;
  const p = parametrosDe(defensa);
  const n = Math.max(2, cuantas | 0);
  const dt = duracion_ms / (n - 1);
  const paso = SEGUIMIENTO.velocidad * (dt / 1000);   // lo que puede avanzar entre muestra y muestra

  /* Cuándo queda el balón suelto tras un tiro que falla: desde ahí, todos
     cierran el rebote. */
  const falla = (tiros || [])
    .filter((t) => t && t.desenlace === 'falla')
    .reduce((m, t) => {
      const fin = (Number.isFinite(t.inicio_ms) ? t.inicio_ms : 0) + (Number.isFinite(t.duracion_ms) ? t.duracion_ms : 0);
      return m == null || fin < m ? fin : m;
    }, null);

  const donde = {};
  for (const d of defensores) donde[d] = inicio.P[d] ? { ...inicio.P[d] } : null;
  const muestras = {};
  for (const d of defensores) if (donde[d]) muestras[d] = [{ t: 0, x: donde[d].x, y: donde[d].y }];

  const escenaEn = (t) => {
    const f = fotograma({ meta, inicio, jugadores, balones, t });
    return {
      f,
      elementos: [
        ...jugadores.map((j) => ({
          id: j.id, kind: 'jugador', equipo: j.equipo || 'A', en_juego: true,
          x: (f.players[j.id] || {}).x, y: (f.players[j.id] || {}).y,
          defiende_a: null, regla_defensa: reglas[j.id] || null,
        })),
        ...balones.map((b) => ({
          id: b.id, kind: 'balon',
          x: (f.balls[b.id] || {}).x, y: (f.balls[b.id] || {}).y,
          portador_id: f.duenos[b.id] || null,
        })),
      ],
    };
  };

  let previo = escenaEn(0);
  for (let k = 1; k < n; k++) {
    const t = k * dt;
    /* Apunta a donde estaba su referencia hace 0,25 s. */
    const visto = escenaEn(Math.max(0, t - SEGUIMIENTO.retardo_ms));
    const ahora = escenaEn(t);
    const objetivos = colocar({
      pista, canasta, elementos: visto.elementos, papeles, defensa,
      cerrandoRebote: falla != null && t >= falla,
    });
    for (const d of defensores) {
      if (!donde[d]) continue;
      const meta_ = objetivos[d];
      let siguiente = donde[d];
      if (meta_) {
        const falta = metrosEntre(pista, donde[d], meta_);
        siguiente = falta <= paso ? { x: meta_.x, y: meta_.y } : hacia(pista, donde[d], meta_, paso);
      }
      /* NUNCA ATRAVIESA A SU PAR: si se le echa encima, se aparta a un
         metro, por el lado por el que venía.

         Apartarse no es correr: cuando su par le pasa por encima a más
         velocidad de la suya, se lo lleva por delante. Por eso aquí el
         tope no es solo su paso, sino su paso MÁS lo que se ha movido su
         par: así nunca hay un salto que no venga de un empujón. */
      const par = papeles.pares[d];
      const suPar = par ? ahora.f.players[par] : null;
      if (suPar && metrosEntre(pista, siguiente, suPar) < SEGUIMIENTO.apartarse) {
        const desde = metrosEntre(pista, donde[d], suPar) > 1e-6 ? donde[d] : { x: suPar.x, y: suPar.y - 0.01 };
        const fuera = aDistancia(pista, suPar, desde, SEGUIMIENTO.apartarse);
        const antes = par ? previo.f.players[par] : null;
        const tope = paso + (antes ? metrosEntre(pista, suPar, antes) : 0);
        siguiente = metrosEntre(pista, donde[d], fuera) <= tope ? fuera : hacia(pista, donde[d], fuera, tope);
      }
      donde[d] = enCancha(pista, siguiente);
      muestras[d].push({ t, x: donde[d].x, y: donde[d].y });
    }
    previo = ahora;
  }
  for (const d of defensores) {
    if (!muestras[d]) continue;
    salida[d] = { muestras: muestras[d], fin: { ...donde[d] } };
  }
  return salida;
}

/* ── Dónde se coloca cada defensor (§8.3) ──────────────────── */

/**
 * El sitio de cada defensor en UN INSTANTE: con los atacantes y los
 * balones donde están, y quién lleva cada balón.
 *
 * Se usa al soltar un defensor en la pista (§8.1) y para explicar la
 * regla (§8.7); la defensa que se mueve sola (§8.4) lo pregunta en cada
 * instante con los mismos números.
 *
 * @param elementos  con sus posiciones y el `portador_id` de cada balón
 * @param papeles    los de esa fase (`papelesDeJugada`)
 * @param solo       si se pasa, solo esos defensores
 * @param cerrandoRebote  tras un tiro fallado: todos cierran el rebote
 * @returns { [defensor]: { x, y, regla, aplica, balon, portador, trampa } }
 *   regla    la que tiene (la suya o la del ejercicio)
 *   aplica   la que cumple de verdad: si niega pero su par está lejos del
 *            balón, aplica «entre su par y el aro»; y la situación puede
 *            mandar retrasar, hacer la trampa o proteger el aro
 *   balon    el sitio del balón que mira, si mira alguno
 */
export function colocar({ pista = 'entera', canasta = 'norte', elementos = [], papeles = null, defensa = null, solo = null, cerrandoRebote = false } = {}) {
  const r = {};
  const pos = posicionesDe(pista, canasta);
  if (!pos || !pos.aro || !papeles || !papeles.ataca || !(papeles.defensores || []).length) return r;
  const aro = { x: pos.aro[0], y: pos.aro[1] };
  const p = parametrosDe(defensa);
  const porId = new Map((elementos || []).filter(Boolean).map((e) => [e.id, e]));
  const en = (id) => { const e = porId.get(id); return e && Number.isFinite(e.x) && Number.isFinite(e.y) ? { x: e.x, y: e.y } : null; };
  /* Un balón que lleva alguien está donde está quien lo lleva. Y solo
     cuentan los que se pueden jugar: los que lleva un ATACANTE en juego y
     los que están sueltos. El balón de quien espera en una fila, o el que
     tiene un defensor, no mueve a la defensa. */
  const atacan = new Set(papeles.atacantes || []);
  const balones = (elementos || [])
    .filter((b) => b && b.kind === 'balon')
    .map((b) => { const dueno = b.portador_id && en(b.portador_id) ? b.portador_id : null; return { dueno, sitio: dueno ? en(dueno) : en(b.id) }; })
    .filter((b) => b.sitio && (!b.dueno || atacan.has(b.dueno)));
  const lleva = (id) => balones.some((b) => b.dueno === id);
  const masCerca = (lista, a) => lista.reduce((m, b) => { const d = metrosEntre(pista, a, b.sitio); return !m || d < m.d - 1e-9 ? { b, d } : m; }, null);
  /* Con varios balones, cada defensor mira el de su par: el que lleva, o
     el que tiene más cerca. */
  const balonDe = (par) => balones.find((b) => b.dueno === par) || (masCerca(balones, en(par)) || {}).b || null;
  const reglaDe = (id) => {
    const x = porId.get(id);
    if (x && REGLAS.includes(x.regla_defensa)) return x.regla_defensa;
    return defensa && REGLAS.includes(defensa.preajuste) ? defensa.preajuste : REGLA_POR_DEFECTO;
  };
  const pon = (id, sitio, aplica, extra = {}) => {
    if (!sitio || (solo && !solo.includes(id))) return;
    r[id] = { ...enCancha(pista, sitio), regla: reglaDe(id), aplica, balon: null, portador: null, trampa: null, ...extra };
  };
  const { defensores, pares, situacion } = papeles;
  const hechos = new Set();

  /* TRAS UN TIRO QUE FALLA, TODOS CIERRAN EL REBOTE (§8.3): entre su par
     y el aro, pegados, hasta el final de la fase. Manda sobre la regla y
     sobre la situación: lo que hay que hacer es que nadie coja el rebote
     por delante. */
  if (cerrandoRebote) {
    for (const d of defensores) {
      const par = pares[d];
      if (!par || !en(par)) continue;
      pon(d, hacia(pista, en(par), aro, p.cierra_rebote), 'cierra_rebote', { balon: null });
      hechos.add(d);
    }
  }

  /* INFERIORIDAD: retrasa el más cercano al aro que no marca al que tiene
     el balón (con uno solo, él). Mira el balón más cercano al aro: se
     queda sobre la línea balón→aro, en el borde de la zona de tiro, y
     sale al que lo tiene en cuanto entra en ella. */
  if (situacion === 'inferioridad') {
    /* Quién retrasa viene decidido con la escena del principio (papeles);
       si no viene, se decide aquí con lo que hay. */
    const elegido = papeles.retrasa && defensores.includes(papeles.retrasa) && en(papeles.retrasa)
      ? papeles.retrasa
      : quienRetrasa({ elementos, papeles, pista, canasta });
    const enJuego = balones.filter((b) => b.dueno);
    const mira = (enJuego.length ? enJuego : balones)
      .reduce((m, b) => { const x = metrosEntre(pista, b.sitio, aro); return !m || x < m.x - 1e-9 ? { b, x } : m; }, null);
    if (elegido && mira) {
      /* Sale al que tiene el balón cuando entra en zona de tiro, pero SOLO
         si no le marca nadie: si ya tiene defensor, los dos acabarían en el
         mismo punto, y lo que hace falta es proteger el aro. */
      const suyo = mira.b.dueno ? defensores.find((d) => d !== elegido && pares[d] === mira.b.dueno) : null;
      const sale = mira.x <= p.retrasa_zona_tiro && !suyo;
      /* Lejos del aro se queda en el borde de la zona de tiro; y si al que
         lleva el balón ya le marca otro, un paso POR DETRÁS de él, que si no
         los dos acaban en el mismo punto. */
      let cuanto = Math.min(Math.max(mira.x - p.par_con_balon, 0), p.retrasa_zona_tiro);
      if (suyo) cuanto = Math.min(cuanto, Math.max(mira.x - 2 * p.par_con_balon, 0.5));
      const sitio = sale ? hacia(pista, mira.b.sitio, aro, p.par_con_balon) : hacia(pista, aro, mira.b.sitio, cuanto);
      pon(elegido, sitio, 'retrasa', { balon: mira.b.sitio });
      hechos.add(elegido);
    }
  }

  /* SUPERIORIDAD: el defensor del portador corta la línea al aro, el
     primero que sobra tapa la salida hacia el medio formando la V, y los
     demás que sobran protegen entre el balón y el aro. */
  if (situacion === 'superioridad') {
    const portador = balones
      .filter((b) => b.dueno && (papeles.atacantes || []).includes(b.dueno))
      .reduce((m, b) => { const x = metrosEntre(pista, b.sitio, aro); return !m || x < m.x - 1e-9 ? { b, x } : m; }, null);
    if (portador) {
      const C = portador.b.sitio;
      const suDefensor = defensores.find((d) => pares[d] === portador.b.dueno && en(d));
      const sobran = defensores.filter((d) => !pares[d] && en(d))
        .map((d, i) => ({ d, i, x: metrosEntre(pista, en(d), C) }))
        .sort((a, z) => (a.x - z.x) || (a.i - z.i))
        .map((o) => o.d);
      const trampa = [...(suDefensor ? [suDefensor] : []), ...sobran];
      const ids = trampa.slice(0, 2);
      const linea = hacia(pista, C, aro, p.presion);
      const lim = limitesCancha(pista);
      const medio = { x: (lim.x[0] + lim.x[1]) / 2, y: (lim.y[0] + lim.y[1]) / 2 };
      /* La V es de DOS: uno corta el camino al aro y el otro tapa la salida
         hacia el medio. Con uno solo no hay trampa que hacer, y se queda
         con su regla. */
      if (trampa.length >= 2) {
        pon(trampa[0], linea, 'trampa', { balon: C, portador: C, trampa: ids });
        hechos.add(trampa[0]);
        /* Los dos a `presion` del portador, separados `trampa`. Si esa
           separación no cabe en ese círculo, el segundo se aleja lo justo
           para que la separación sea la pedida. */
        const cabe = p.trampa < 2 * p.presion;
        const angulo = cabe ? 2 * Math.asin(p.trampa / (2 * p.presion)) : Math.PI;
        const radio = cabe ? p.presion : p.trampa - p.presion;
        const desde = hacia(pista, C, aro, radio);
        const a = girar(pista, C, desde, angulo);
        const b = girar(pista, C, desde, -angulo);
        const lado = metrosEntre(pista, a, medio) <= metrosEntre(pista, b, medio) ? a : b;
        pon(trampa[1], lado, 'trampa', { balon: C, portador: C, trampa: ids });
        hechos.add(trampa[1]);
      }
      /* Los que sobran después: entre el balón y el aro, a `par_sin_balon`
         del balón —eso es lo decidido, y por eso van sobre ESE arco— y
         repartidos a los lados para no taparse. */
      trampa.slice(2).forEach((d, k) => {
        const abre = (k % 2 === 0 ? 1 : -1) * Math.ceil((k + 1) / 2) * 0.5;
        pon(d, girar(pista, C, hacia(pista, C, aro, p.par_sin_balon), abre), 'protege', { balon: C });
        hechos.add(d);
      });
    }
  }

  /* Los demás, con su regla. */
  for (const d of defensores) {
    const par = pares[d];
    if (hechos.has(d) || !par || !en(par)) continue;
    const regla = reglaDe(d);
    const P = en(par);
    const conBalon = lleva(par);
    const entre = hacia(pista, P, aro, conBalon ? p.par_con_balon : p.par_sin_balon);
    if (regla === 'presion' && conBalon) { pon(d, hacia(pista, P, aro, p.presion), 'presion', { balon: P }); continue; }
    if (regla === 'niega_linea' && !conBalon) {
      const b = balonDe(par);
      if (b && metrosEntre(pista, P, b.sitio) < p.niega_hasta) {
        pon(d, hacia(pista, P, b.sitio, p.niega_paso), 'niega_linea', { balon: b.sitio });
        continue;
      }
    }
    if (regla === 'ayuda_y_flota' && !conBalon) {
      const b = balonDe(par);
      if (b) {
        /* Se hunde desde su sitio de siempre hacia la línea balón→aro, y
           se para donde se alejaría demasiado de su par. */
        /* Se sale del sitio de siempre, pero sin pasarse ya de su límite:
           con un «hasta» menor que los 2 m de «entre su par y el aro», el
           punto de partida estaría fuera del círculo. */
        const salida = hacia(pista, P, aro, Math.min(conBalon ? p.par_con_balon : p.par_sin_balon, p.flota_hasta));
        const T = alSegmento(pista, salida, b.sitio, aro);
        const lejos = (q) => metrosEntre(pista, q, P);
        const en_ = (k) => ({ x: salida.x + (T.x - salida.x) * k, y: salida.y + (T.y - salida.y) * k });
        let k = 1;
        if (lejos(T) > p.flota_hasta) {
          let a = 0, z = 1;
          for (let i = 0; i < 40; i++) { const m = (a + z) / 2; if (lejos(en_(m)) <= p.flota_hasta) a = m; else z = m; }
          k = a;
        }
        pon(d, en_(k), 'ayuda_y_flota', { balon: b.sitio });
        continue;
      }
    }
    pon(d, entre, 'entre_par_y_aro', { balon: conBalon ? P : null });
  }
  return r;
}

const metros = (v) => `${String(Math.round(v * 100) / 100).replace('.', ',')} m`;

/**
 * Por qué está ahí (§8.7): lo que dibuja la pizarra al seleccionar a un
 * defensor, y la frase que lo explica.
 *
 * @returns { aplica, texto, primitivas } o null si no tiene sitio
 *   primitivas: { tipo: 'linea', a, b } · { tipo: 'circulo', centro, metros }
 *               · { tipo: 'punto', p }
 */
export function explicarRegla({ pista = 'entera', canasta = 'norte', elementos = [], papeles = null, defensa = null, defensor = null } = {}) {
  const sitios = colocar({ pista, canasta, elementos, papeles, defensa });
  const s = sitios[defensor];
  if (!s) return null;
  const p = parametrosDe(defensa);
  const aro = (() => { const a = posicionesDe(pista, canasta).aro; return { x: a[0], y: a[1] }; })();
  const porId = new Map((elementos || []).filter(Boolean).map((e) => [e.id, e]));
  const par = papeles.pares[defensor] ? porId.get(papeles.pares[defensor]) : null;
  const P = par ? { x: par.x, y: par.y } : null;
  const aqui = { tipo: 'punto', p: { x: s.x, y: s.y } };
  const linea = (a, b) => ({ tipo: 'linea', a, b });
  switch (s.aplica) {
    case 'presion':
      return { aplica: s.aplica, texto: `Presión al balón: pegado a su par, a ${metros(p.presion)}, cortando el camino al aro.`, primitivas: [linea(P, aro), aqui] };
    case 'niega_linea':
      return { aplica: s.aplica, texto: `Niega la línea de pase: un paso (${metros(p.niega_paso)}) desde su par hacia el balón.`, primitivas: [linea(s.balon, P), aqui] };
    case 'ayuda_y_flota':
      return { aplica: s.aplica, texto: `Ayuda y flota: se hunde hacia la línea del balón al aro sin alejarse más de ${metros(p.flota_hasta)} de su par.`, primitivas: [{ tipo: 'circulo', centro: P, metros: p.flota_hasta }, linea(s.balon, aro), aqui] };
    case 'retrasa':
      return { aplica: s.aplica, texto: `Retrasa y protege el aro (inferioridad): sale al que tiene el balón cuando entra a ${metros(p.retrasa_zona_tiro)} del aro.`, primitivas: [{ tipo: 'circulo', centro: aro, metros: p.retrasa_zona_tiro }, linea(s.balon, aro), aqui] };
    case 'trampa': {
      const dos = (s.trampa || []).filter((id) => sitios[id]);
      const separacion = dos.length === 2
        ? metrosEntre(pista, sitios[dos[0]], sitios[dos[1]])
        : p.trampa;
      return {
        aplica: s.aplica,
        texto: `Trampa sobre el balón (superioridad): uno corta el camino al aro y el otro la salida hacia el medio, a ${metros(separacion)} entre ellos.`,
        primitivas: [...dos.map((id) => linea(s.portador, { x: sitios[id].x, y: sitios[id].y })), aqui],
      };
    }
    case 'protege':
      return { aplica: s.aplica, texto: `Sobra en superioridad: protege entre el balón y el aro, a ${metros(p.par_sin_balon)} del balón.`, primitivas: [linea(s.balon, aro), aqui] };
    case 'cierra_rebote':
      return { aplica: s.aplica, texto: `El tiro ha fallado: cierra el rebote entre su par y el aro, a ${metros(p.cierra_rebote)}, hasta el final de la fase.`, primitivas: [linea(P, aro), aqui] };
    default: {
      const conBalon = !!s.balon;
      const texto = s.regla === 'entre_par_y_aro'
        ? `Entre su par y el aro, a ${metros(conBalon ? p.par_con_balon : p.par_sin_balon)} de su par${conBalon ? ', que lleva el balón' : ''}.`
        : `Entre su par y el aro, a ${metros(conBalon ? p.par_con_balon : p.par_sin_balon)}: su regla (${NOMBRE_REGLA[s.regla]}) no se aplica ahora mismo.`;
      return { aplica: s.aplica, texto, primitivas: [linea(P, aro), aqui] };
    }
  }
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
