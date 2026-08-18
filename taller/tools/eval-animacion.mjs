/* ============================================================
   eval-animacion.mjs — banco de pruebas (eval harness) del motor
   de generación de animaciones del Taller.

   Ejecutar:  node taller/tools/eval-animacion.mjs
   (funciona desde cualquier cwd: los imports son relativos a este
   archivo; no requiere servidor ni red)

   Qué mide: compila intents contra tableros reales y valida el JSON
   §10 devuelto contra el comportamiento DESEADO — dónde muere un
   tiro, quién se mueve y quién no, qué arrastra una edición manual.
   Los casos marcados con `falloEsperadoHoy: true` codifican bugs
   conocidos: el check exige lo correcto y hoy falla a propósito.

   Salida: PASS/FAIL por caso + resumen X/Y. Exit code 0 solo si
   pasan todos.

   ── CÓMO ENTRA CADA CASO ────────────────────────────────────
     esCompiladorDirecto  intent escrito a mano → compilarAnimacion
     esIntentIA           intent AJENO (una ficha guardada, el
                          simulador) → validador → compilador
     run()                caso a medida (motor, editor, resolver…)

   ── LO QUE YA NO MIDE (Tramo 2.11) ──────────────────────────
   Este banco nació midiendo la calidad de un modelo de pago que leía
   el texto del paso 2, con un lector por regex de respaldo. Los dos
   se han retirado: el paso 2 lee la jugada él solo contra dos listas
   cerradas de palabras, y de eso se ocupa eval-frase.mjs.

   Con ellos se fueron los casos que probaban la resolución de la
   canasta desde el texto, el equipo que defiende por regex, el flujo
   de preguntas y el payload que viajaba a Anthropic. Lo que medían
   del COMPILADOR —el arco alrededor de un cono, el eslalon, que un
   jugador al que nadie ha nombrado no se mueva— se ha reescrito con
   el intent puesto a mano y sigue aquí.
   ============================================================ */

import { compilarAnimacion } from '../js/ia/compilador.js';
import { validarIntent } from '../js/ia/validador.js';
import { defensaReactiva } from '../js/ia/simulador.js';
import { PISTAS } from '../js/canvas/court.js';
import { metrosEntre } from '../js/canvas/escala.js';
import { posicionesDe } from '../js/canvas/anclas.js';

/**
 * Coordenada de un ancla, por NOMBRE. Varios casos comprobaban el
 * destino contra el par de números literal («debía terminar en (0.206,
 * 0.893)»), y al redibujar las pistas a escala real (Tramo 2.1) los
 * cuatro se cayeron a la vez sin que el motor hiciera nada mal: lo que
 * cambió fue dónde está el codo, no si el jugador va al codo. Preguntar
 * por el nombre comprueba lo que de verdad interesa y no vuelve a
 * caducar cuando cambie la geometría.
 */
const ancla = (pista, nombre, canasta = 'norte') => posicionesDe(pista, canasta)[nombre];

// ---- punto de extensión: generador bajo prueba --------------------
// Todo caso dice CÓMO se genera: con el intent puesto a mano
// (esCompiladorDirecto), pasando antes por el validador (esIntentIA) o
// con su propia función (run). No hay camino por texto: leerlo es cosa
// de ia/frase.js y lo mide eval-frase.mjs.
/**
 * Compila un intent AJENO —uno que no ha escrito este banco: el que
 * traen las 204 fichas, el que devuelve el simulador, el que llega de
 * un `_intent` guardado— pasándolo primero por el validador.
 *
 * Era `compilarIntentIA` de `ia/client.js`, la puerta por la que
 * entraba lo que devolvía el modelo de pago. Al retirarlo (Tramo 2.11)
 * la composición se ha quedado aquí, que es donde vive su único
 * llamador: validar y compilar es exactamente lo que estos casos
 * comprueban, y sacarlo a un módulo de producción sin nadie que lo
 * usase sería dejar código vivo solo para las pruebas.
 */
function compilarIntentValidado(dataIA, elementos, pista, posicionesCustom = null) {
  const v = validarIntent(dataIA && dataIA.intent, elementos, pista, { posiciones: posicionesCustom });
  if (v.error) return v;
  if (v.preguntas) return { preguntas: v.preguntas };
  const anim = compilarAnimacion(defensaReactiva(v.intent, elementos, pista), elementos, pista, { posiciones: posicionesCustom });
  const warningsIA = (Array.isArray(dataIA.warnings) ? dataIA.warnings : [])
    .filter((w) => w && typeof w === 'object' && typeof w.texto_original === 'string' && typeof w.interpretacion === 'string');
  anim.warnings = [...v.warnings, ...warningsIA];
  anim._mock = false;
  return anim;
}

async function runGenerator(caso) {
  if (caso.run) return caso.run(); // caso a medida (p.ej. lógica de Board sin DOM)
  if (caso.esCompiladorDirecto) return compilarAnimacion(caso.intent, caso.elementos, caso.pista);
  // Los marcados `esIntentIA` entran por el validador, como cualquier
  // intent que no haya escrito el paso 2. `posicionesCustom` (Tramo 2):
  // stub del diccionario de Supabase — el banco NUNCA toca la red.
  if (caso.esIntentIA) return compilarIntentValidado(caso.dataIA, caso.elementos, caso.pista, caso.posicionesCustom ?? null);
  throw new Error(`el caso «${caso.nombre}» no dice cómo generarse (run / esCompiladorDirecto / esIntentIA)`);
}

/* ---- constructores de elementos del tablero ---------------------- */
let _seq = 0;
const jugador = (equipo, label, x, y, extra = {}) =>
  ({ id: `el_${++_seq}`, kind: 'jugador', equipo, label: String(label), dorsal: null, nombre: null, x, y, ...extra });
const balon = (x, y, id = null) =>
  ({ id: id || `el_balon_${++_seq}`, kind: 'balon', x, y, portador_id: null });
const cono = (x, y, funcion = 'decorativo', fila_config = null, id = null) =>
  ({ id: id || `el_cono_${++_seq}`, kind: 'cono', x, y, funcion, fila_config });

/* ---- utilidades para los checks ----------------------------------- */
const ok = (motivo = 'ok') => ({ pass: true, motivo });
const ko = (motivo) => ({ pass: false, motivo });

const esExito = (r) => !!r && Array.isArray(r.fases) && !r.error && !r.preguntas;
const esPreguntas = (r) => !!r && Array.isArray(r.preguntas) && r.preguntas.length > 0;
const esError = (r) => !!r && typeof r.error === 'string' && r.error.length > 0;
const forma = (r) => (esExito(r) ? 'éxito(fases)' : esPreguntas(r) ? 'preguntas' : esError(r) ? 'error' : `desconocido: ${JSON.stringify(r).slice(0, 120)}`);

const todosTiros = (r) => (r.fases || []).flatMap((f) => f.tiros || []);
const todosPases = (r) => (r.fases || []).flatMap((f) => f.pases || []);
const jugadorPorId = (r, id) => (r.jugadores || []).find((j) => j.id === id);
const dxy = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

/* Un evento del dialecto de siempre (los nueve del motor anterior), con
   todos sus campos a null salvo los que se den. */
const evIA = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });

// nº de veces que un id participa activamente en cualquier fase
// (movimientos, pases, tiros o bloqueos). 0 => queda quieto/inerte.
function apariciones(res, id) {
  let n = 0;
  for (const f of res.fases || []) {
    n += (f.movimientos || []).filter((m) => m.elemento_id === id).length;
    n += (f.pases || []).filter((p) => p.de_id === id || p.a_id === id).length;
    n += (f.tiros || []).filter((t) => t.jugador_id === id).length;
    n += (f.bloqueos || []).filter((b) => b.bloqueador_id === id || b.bloqueado_id === id).length;
  }
  return n;
}

const mismoConjunto = (arr, esperado) => {
  const a = new Set(arr), b = new Set(esperado);
  return a.size === b.size && [...b].every((x) => a.has(x));
};

/* ---- validación GENÉRICA (se aplica a TODO resultado de éxito) ----
   Reglas que cualquier animación válida debe cumplir, venga del mock
   o del modelo real:
   1. `fases` no vacío (y jugadores presentes).
   2. Todo id referenciado en fases (elemento_id, de_id, a_id,
      jugador_id, bloqueador_id, bloqueado_id, fase.defensores) existe
      en `jugadores` (o en `balones` para balon_id / movimientos de balón).
   3. Toda coordenada (posicion_inicial, posicion, nodos de path) está en [0,1].
   4. Toda `canasta` usada en tiros es una clave válida de PISTAS[pista].baskets.
   Devuelve una lista de motivos de fallo (vacía = todo correcto).      */
function validacionGenerica(res, pistaCaso) {
  if (!res || typeof res !== 'object') return ['el resultado no es un objeto'];
  if (esError(res) || esPreguntas(res)) return []; // no aplica a error/preguntas
  const motivos = [];
  const jIds = new Set((res.jugadores || []).map((j) => j.id));
  const bIds = new Set((res.balones || []).map((b) => b.id));

  const enRango = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
  const punto = (x, y, donde) => {
    if (!enRango(x) || !enRango(y)) motivos.push(`coordenada fuera de [0,1] en ${donde}: (${x}, ${y})`);
  };

  if (!Array.isArray(res.jugadores) || !res.jugadores.length) motivos.push('resultado de éxito sin jugadores');
  if (!Array.isArray(res.fases) || !res.fases.length) motivos.push('fases vacío o ausente');

  for (const j of res.jugadores || []) punto(j.posicion_inicial?.[0], j.posicion_inicial?.[1], `jugador ${j.id}`);
  for (const b of res.balones || []) punto(b.posicion_inicial?.[0], b.posicion_inicial?.[1], `balón ${b.id}`);
  for (const c of res.conos || []) punto(c.posicion?.[0], c.posicion?.[1], `cono ${c.id}`);

  const pista = res.pista ?? pistaCaso;
  const baskets = (PISTAS[pista] && PISTAS[pista].baskets) || null;
  if (!baskets) motivos.push(`pista desconocida en el resultado: '${pista}'`);

  for (const f of res.fases || []) {
    const fid = f.id || '(fase sin id)';
    for (const m of f.movimientos || []) {
      const pool = m.tipo_elemento === 'balon' ? bIds : jIds;
      if (!pool.has(m.elemento_id)) motivos.push(`${fid}: movimiento referencia id inexistente '${m.elemento_id}'`);
      for (const n of m.path || []) punto(n.x, n.y, `${fid} path de ${m.elemento_id}`);
    }
    for (const p of f.pases || []) {
      if (!jIds.has(p.de_id)) motivos.push(`${fid}: pase con de_id inexistente '${p.de_id}'`);
      if (!jIds.has(p.a_id)) motivos.push(`${fid}: pase con a_id inexistente '${p.a_id}'`);
      if (!bIds.has(p.balon_id)) motivos.push(`${fid}: pase con balon_id inexistente '${p.balon_id}'`);
      for (const n of p.path || []) punto(n.x, n.y, `${fid} path de pase ${p.id || ''}`);
    }
    for (const t of f.tiros || []) {
      if (!jIds.has(t.jugador_id)) motivos.push(`${fid}: tiro con jugador_id inexistente '${t.jugador_id}'`);
      if (!bIds.has(t.balon_id)) motivos.push(`${fid}: tiro con balon_id inexistente '${t.balon_id}'`);
      if (baskets && !(t.canasta in baskets)) motivos.push(`${fid}: tiro a canasta '${t.canasta}', que no existe en la pista '${pista}' (válidas: ${Object.keys(baskets).join('/')})`);
      for (const n of t.path || []) punto(n.x, n.y, `${fid} path de tiro`);
    }
    for (const b of f.bloqueos || []) {
      if (!jIds.has(b.bloqueador_id)) motivos.push(`${fid}: bloqueo con bloqueador_id inexistente '${b.bloqueador_id}'`);
      if (!jIds.has(b.bloqueado_id)) motivos.push(`${fid}: bloqueo con bloqueado_id inexistente '${b.bloqueado_id}'`);
    }
    for (const d of f.defensores || []) {
      if (!jIds.has(d)) motivos.push(`${fid}: defensores referencia id inexistente '${d}'`);
    }
  }
  const unicos = [...new Set(motivos)];
  return unicos.length > 6 ? [...unicos.slice(0, 6), `(+${unicos.length - 6} motivos más)`] : unicos;
}

/* ====================================================================
   CASOS DE PRUEBA
   Nota sobre ids: el generador identifica a los jugadores como
   `${equipo}${label}` (p.ej. 'A1'), y a los salidos de una fila como
   'fila1', 'fila2'… Los checks usan esos ids.
   Nota sobre el orden de `elementos`: el mock elige receptor como el
   PRIMER atacante distinto del portador en orden de tablero — los
   casos colocan al receptor deseado en segunda posición a propósito.
   ==================================================================== */
const casos = [];

/* ------------------------- 1. CANASTA ----------------------------- */





















/* ---------------------- 2. ROLES Y DEFENSA ------------------------ */













/* ---------------------------- 3. FILA ------------------------------ */









/* ------------------------ 4. RODEAR CONOS -------------------------- */





/* --------------------- 5. MOVIMIENTO PARCIAL ----------------------- */





/* --------------------------- 6. COMPILADOR -------------------------- */

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_roles_variables_por_fase',
  // Prueba compilarAnimacion() DIRECTAMENTE con un Intent escrito a mano (sin
  // pasar por texto ni regex): B1 defiende a A1 en fase 1; en fase 2 los
  // roles se invierten (B1 ataca con un corte, B2 pasa a defender a A1).
  // Demuestra que el COMPILADOR ya soporta roles distintos por fase de forma
  // natural (fase.defensores sale de los eventos 'defiende' de CADA fase) —
  // esa flexibilidad existe aunque el extractor regex de hoy no la explote
  // todavía (siempre asigna el mismo equipo defensor en toda la animación;
  // eso es una limitación del extractor, no del compilador — ver Fase 2b).
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.6, 0.5), jugador('B', 1, 0.5, 0.45), jugador('B', 2, 0.45, 0.4),
    balon(0.61, 0.5),
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [
        { jugador: 'A1', tipo: 'bote', hacia: 'canasta', a: null, cono_id: null, marca: null, bloqueado_id: null },
        { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
        { jugador: 'B2', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null },
      ] },
      { eventos: [
        { jugador: 'B1', tipo: 'corte', hacia: 'canasta', a: null, cono_id: null, marca: null, bloqueado_id: null },
        { jugador: 'B2', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
      ] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!mismoConjunto(res.fases[0].defensores || [], ['B1', 'B2'])) return ko(`fase 1: defensores debería ser {B1,B2} (ambos tienen evento 'defiende' esa fase, aunque B2 sin marca); es ${JSON.stringify(res.fases[0].defensores)}`);
    if (!mismoConjunto(res.fases[1].defensores || [], ['B2'])) return ko(`fase 2: defensores debería ser {B2} (B1 ataca esta fase, no tiene evento 'defiende'); es ${JSON.stringify(res.fases[1].defensores)}`);
    if (!(res.fases[0].movimientos || []).some((m) => m.elemento_id === 'B1')) return ko('B1 marca a A1 (con marca) en fase 1: debería moverse goal-side');
    if ((res.fases[0].movimientos || []).some((m) => m.elemento_id === 'B2')) return ko('B2 defiende sin marca en fase 1: NO debería moverse');
    if (!(res.fases[1].movimientos || []).some((m) => m.elemento_id === 'B1')) return ko('B1 tiene un evento "corte" en fase 2: debería moverse (ataca)');
    if (!(res.fases[1].movimientos || []).some((m) => m.elemento_id === 'B2')) return ko('B2 marca a A1 (con marca) en fase 2: debería moverse goal-side');
    return ok();
  },
});

/* -------------------------- 7. PREGUNTAS --------------------------- */









/* ----------------------- 8. LÍMITES Y VARIOS ----------------------- */











/* -------------- 8. IA (camino de red, Fase 2b) ---------------------
   Simulan la respuesta { intent } de la Netlify Function y prueban el
   pipeline real del navegador: validador (repara/descarta) → canasta
   del cliente (manda sobre el modelo) → compilador. Sin red. */

casos.push({
  categoria: 'Intent ajeno (validado)',
  nombre: 'intent_ajeno_valido_se_compila',
  // Un intent que no ha escrito el paso 2 —el de una ficha guardada, el
  // del simulador— pasa por el validador y compila entero: bote → pase →
  // tiro.
  esIntentIA: true,
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), jugador('A', 2, 0.45, 0.3), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    },
    warnings: [],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!todosPases(res).some((p) => p.de_id === 'A1' && p.a_id === 'A2')) return ko('no hay pase de A1 a A2');
    if (!todosTiros(res).some((t) => t.jugador_id === 'A2' && t.canasta === 'norte')) return ko('A2 no tira a la canasta norte');
    const a1 = jugadorPorId(res, 'A1');
    if (!a1 || a1.tiene_balon !== true) return ko('A1 (primer botador) debería salir con el balón');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_intent_ids_fantasma_se_reparan',
  // El modelo alucina ids (Z9, B9) y una coordenada fuera de rango: los
  // eventos con ids fantasma se DESCARTAN con warning, la coordenada se
  // recorta a [0,1], y el resto de la jugada sobrevive intacto.
  esIntentIA: true,
  texto: 'A1 penetra, A2 corta a la esquina y recibe para el tiro.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), jugador('A', 2, 0.45, 0.3), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('Z9', 'bote', { hacia: 'canasta' }), evIA('A1', 'bote', { hacia: 'canasta' }), evIA('A2', 'corte', { hacia: { x: 1.7, y: -0.3 } })] },
        { eventos: [evIA('A1', 'pase', { a: 'A2' }), evIA('B9', 'defiende', { marca: 'A1' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación reparada, llegó ${forma(res)}`);
    const descartes = (res.warnings || []).filter((w) => /descartado/.test(w.interpretacion || ''));
    if (descartes.length < 2) return ko(`se esperaban ≥2 warnings de evento descartado (Z9, B9); hay ${descartes.length}`);
    const idsUsados = new Set();
    for (const f of res.fases) {
      for (const m of f.movimientos || []) idsUsados.add(m.elemento_id);
      for (const p of f.pases || []) { idsUsados.add(p.de_id); idsUsados.add(p.a_id); }
      for (const d of f.defensores || []) idsUsados.add(d);
    }
    if (idsUsados.has('Z9') || idsUsados.has('B9')) return ko('un id fantasma sobrevivió a la reparación');
    if (!todosPases(res).some((p) => p.de_id === 'A1' && p.a_id === 'A2')) return ko('el pase válido A1→A2 no sobrevivió a la reparación');
    const corte = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A2');
    if (!corte) return ko('el corte válido de A2 no sobrevivió');
    const fin = corte.path[corte.path.length - 1];
    if (fin.x !== 1 || fin.y !== 0) return ko(`la coordenada fuera de rango debía recortarse a (1, 0); quedó (${fin.x}, ${fin.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_intent_canasta_invalida_se_corrige',
  // El modelo dice canasta "sur" en una pista que solo tiene "norte": se
  // corrige al aro existente con warning, nunca un tiro a un aro fantasma.
  esIntentIA: true,
  texto: 'A1 entra a canasta y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'sur',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación corregida, llegó ${forma(res)}`);
    if (!todosTiros(res).length) return ko('no hay tiro'); // .every() con lista vacía es true: sin esto el caso pasaría sin tiros
    if (!todosTiros(res).every((t) => t.canasta === 'norte')) return ko(`el tiro debía corregirse a 'norte' (única canasta de la pista media); va a '${todosTiros(res)[0]?.canasta}'`);
    if (!(res.warnings || []).some((w) => w.campo === 'canasta')) return ko('falta el warning de canasta corregida');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_intent_inutilizable_error',
  // TODOS los eventos referencian jugadores fantasma: tras sanear no queda
  // nada → error claro, no una animación vacía ni un crash.
  esIntentIA: true,
  texto: 'Jugada de equipo.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('X1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('X2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esError(res)) return ko(`con todos los eventos inválidos se esperaba { error }; llegó ${forma(res)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Intent ajeno (validado)',
  nombre: 'intent_ajeno_ataca_la_canasta_que_declara',
  // En una pista de dos aros, el intent dice a cuál se ataca y el
  // compilador lo respeta: aquí el jugador está más cerca del norte y el
  // tiro tiene que ir igualmente al sur, que es lo declarado. Sin esto,
  // una ficha guardada con la canasta 2 se animaría hacia la 1 en cuanto
  // alguien moviera las fichas.
  esIntentIA: true,
  pista: 'entera',
  elementos: [jugador('A', 1, 0.5, 0.6), balon(0.51, 0.6)],
  dataIA: {
    intent: {
      canasta: 'sur',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!todosTiros(res).length) return ko('no hay tiro'); // .every() con lista vacía es true: sin esto el caso pasaría sin tiros
    if (!todosTiros(res).every((t) => t.canasta === 'sur')) return ko(`el intent declara la canasta 'sur' y el tiro va a '${todosTiros(res)[0]?.canasta}'`);
    return ok();
  },
});

/* ------------ 9. Blindaje (Tramo 0): robustez del pipeline ----------
   Cada caso de este bloque HABRÍA fallado (crash o animación rota en
   silencio) antes de los arreglos del Tramo 0. */

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_eventos_no_iterable_no_crashea',
  // `eventos` truthy pero no-array ({}) en una fase: antes el for-of lanzaba
  // TypeError (y en el navegador el crash caía en silencio al mock). Ahora la
  // fase malformada se descarta con warning y el resto de la jugada sobrevive.
  esIntentIA: true,
  texto: 'A1 entra y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: {} },
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: 'hola' }, // string: tampoco debe iterar sus caracteres
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`eventos no-iterable debía degradarse, no romper: llegó ${forma(res)}`);
    if (res.fases.length !== 2) return ko(`deberían quedar 2 fases útiles; hay ${res.fases.length}`);
    if (!(res.warnings || []).some((w) => /fase/.test(w.campo || ''))) return ko('falta el warning de fase malformada descartada');
    if (!todosTiros(res).length) return ko('el tiro válido no sobrevivió');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_todas_las_fases_malformadas_error_claro',
  // TODAS las fases con eventos no-iterables: error honesto, nunca crash.
  esIntentIA: true,
  texto: 'Jugada.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: { intent: { canasta: 'norte', fases: [{ eventos: 42 }, { eventos: true }] } },
  check(res) {
    if (!esError(res)) return ko(`sin ningún evento utilizable se esperaba { error }; llegó ${forma(res)}`);
    return ok();
  },
});



casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_auto_eventos_se_descartan',
  // Autopase, automarca y autobloqueo: se descartan con warning; la jugada
  // válida (bote + tiro) sobrevive.
  esIntentIA: true,
  texto: 'A1 entra y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), jugador('A', 2, 0.5, 0.4), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          evIA('A1', 'bote', { hacia: 'canasta' }),
          evIA('A1', 'pase', { a: 'A1' }),
          evIA('A2', 'defiende', { marca: 'A2' }),
          evIA('A2', 'bloqueo', { bloqueado_id: 'A2' }),
        ] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (todosPases(res).length) return ko('el autopase A1→A1 no se descartó');
    if (res.fases.some((f) => (f.bloqueos || []).length)) return ko('el autobloqueo no se descartó');
    if (res.fases.some((f) => (f.defensores || []).includes('A2'))) return ko('la automarca no se descartó');
    const descartes = (res.warnings || []).filter((w) => /descartado/.test(w.interpretacion || ''));
    if (descartes.length < 3) return ko(`se esperaban ≥3 warnings de descarte (autopase, automarca, autobloqueo); hay ${descartes.length}`);
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_doble_movimiento_misma_fase_se_deduplica',
  // Dos botes de A1 en la misma fase: el motor indexa por elemento y el
  // segundo machacaba al primero (flecha fantasma + teletransporte). Se
  // conserva el PRIMERO y el segundo se descarta con warning.
  esIntentIA: true,
  texto: 'A1 bota y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          evIA('A1', 'bote', { hacia: { x: 0.5, y: 0.4 } }),
          evIA('A1', 'corte', { hacia: { x: 0.2, y: 0.2 } }),
        ] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const movs = (res.fases[0].movimientos || []).filter((m) => m.elemento_id === 'A1');
    if (movs.length !== 1) return ko(`A1 debería tener UN movimiento en la fase 1; tiene ${movs.length}`);
    const fin = movs[0].path[movs[0].path.length - 1];
    if (dxy(fin.x, fin.y, 0.5, 0.4) > 0.01) return ko(`debía conservarse el PRIMER movimiento (bote a 0.5,0.4); termina en (${fin.x}, ${fin.y})`);
    if (!(res.warnings || []).some((w) => /descartado/.test(w.interpretacion || ''))) return ko('falta el warning del movimiento duplicado descartado');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_rodea_cono_no_rodear_se_descarta',
  // rodea_cono apuntando a un cono decorativo: antes pasaba limpio y
  // slalomPath lo ignoraba en silencio. Ahora se descarta con warning.
  esIntentIA: true,
  texto: 'A1 rodea el cono y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5), cono(0.5, 0.5, 'decorativo', null, 'cono_deco')],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' }), evIA('A1', 'rodea_cono', { cono_id: 'cono_deco' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!(res.warnings || []).some((w) => /descartado/.test(w.interpretacion || '') && /rodear/.test(w.interpretacion || ''))) {
      return ko('falta el warning de rodea_cono descartado por cono no-"rodear"');
    }
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_fase_muerta_se_elimina',
  // Fase intermedia cuyos únicos eventos no producen geometría (defiende con
  // marca null + rodea_cono huérfano): antes sobrevivía como ~2 s de nada.
  esIntentIA: true,
  texto: 'A1 entra y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), jugador('B', 1, 0.5, 0.4), balon(0.71, 0.55), cono(0.4, 0.4, 'rodear', null, 'cono_r1')],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('B1', 'defiende', { marca: null }), evIA('A1', 'rodea_cono', { cono_id: 'cono_r1' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (res.fases.length !== 2) return ko(`la fase muerta debía eliminarse (quedan 2); hay ${res.fases.length}`);
    if (!(res.warnings || []).some((w) => /fase/.test(w.campo || ''))) return ko('falta el warning de fase descartada');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_fase_solo_defensa_activa_sobrevive',
  // Control: una fase de SOLO defensa con marca no-null SÍ produce movimiento
  // y no debe caer en la limpieza de fases muertas.
  esIntentIA: true,
  texto: 'B1 salta a defender a A1, que después tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), jugador('B', 1, 0.5, 0.4), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('B1', 'defiende', { marca: 'A1' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (res.fases.length !== 3) return ko(`la fase de defensa activa NO debía eliminarse; quedan ${res.fases.length} fases`);
    if (!(res.fases[1].movimientos || []).some((m) => m.elemento_id === 'B1')) return ko('B1 (defensa con marca) debería moverse en la fase 2');
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_cono_sin_id_rodeable',
  // Cono SIN id en el tablero: el resto del sistema lo referencia con el
  // fallback 'cono_1', pero el compilador indexaba por el id crudo (undefined)
  // y el rodeo degradaba a recta en silencio. Ahora la clave coincide.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5),
    { id: null, kind: 'cono', x: 0.5, y: 0.5, funcion: 'rodear', fila_config: null },
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('A1', 'bote', { hacia: 'canasta' }), evIA('A1', 'rodea_cono', { cono_id: 'cono_1' })] },
      { eventos: [evIA('A1', 'tiro')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    if (!mv) return ko('A1 no tiene movimiento en la fase 1');
    const path = mv.path || [];
    const intermedios = path.slice(1, -1).filter((n) => dxy(n.x, n.y, 0.5, 0.5) <= 0.12).length;
    const hayCurva = path.some((n) => n.tipo_nodo && n.tipo_nodo !== 'lineal');
    if (intermedios >= 2 || hayCurva) return ok();
    return ko(`el cono sin id no se rodeó (path de ${path.length} nodos, recto): la clave 'cono_1' no casó en conosById`);
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_los_dos_dialectos_dan_la_misma_animacion',
  // La garantía que necesita el paso 2 nuevo (Tramo 2.9): puede dejar de
  // escribir los nueve eventos de siempre y empezar a escribir acciones
  // del catálogo sin que nada cambie por debajo. Se compila la MISMA
  // jugada en los dos dialectos y se comparan las dos animaciones
  // enteras, no una muestra.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.75, 0.42), jugador('A', 2, 0.62, 0.72),
    jugador('B', 1, 0.68, 0.45), balon(0.76, 0.42, 'balon_1'),
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('A1', 'bote', { hacia: 'canasta' }), evIA('B1', 'defiende', { marca: 'A1' })] },
      { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
      { eventos: [evIA('A2', 'bote', { hacia: 'aro' })] },
      { eventos: [evIA('A2', 'tiro')] },
      { eventos: [evIA('A2', 'recoge')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const nuevo = compilarAnimacion({
      canasta: 'norte',
      fases: [
        { eventos: [
          { jugador: 'A1', accion: 'bota' },
          { jugador: 'B1', accion: 'defiende', args: { companero: 'A1' } },
        ] },
        { eventos: [{ jugador: 'A1', accion: 'pasa', args: { destino: 'A2' } }] },
        { eventos: [{ jugador: 'A2', accion: 'entra' }] },
        { eventos: [{ jugador: 'A2', accion: 'tira' }] },
        { eventos: [{ jugador: 'A2', accion: 'recoge' }] },
      ],
    }, this.elementos, 'media');

    // `_intent` guarda el dialecto con el que se escribió, así que se
    // compara todo lo demás: es la geometría lo que tiene que coincidir.
    const sinIntent = (a) => { const { _intent, ...resto } = a; return JSON.stringify(resto); };
    if (sinIntent(res) !== sinIntent(nuevo)) {
      const A = JSON.parse(sinIntent(res)), B = JSON.parse(sinIntent(nuevo));
      for (const k of Object.keys(A)) {
        if (JSON.stringify(A[k]) !== JSON.stringify(B[k])) {
          return ko(`los dos dialectos difieren en "${k}"`);
        }
      }
      return ko('los dos dialectos dan animaciones distintas');
    }
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_seis_en_fila_dan_seis_rondas',
  // El criterio de aceptación del Tramo 2.8, tal cual: «un ejercicio de
  // 6 en fila enseña las 6 rondas con contador». Se describe UNA salida
  // y el motor la repite hasta que han salido los seis.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    // la cola apunta hacia la izquierda: seis a paso de 1,27 m son casi
    // ocho metros, y hacia la derecha no cabrían
    { id: 'cf', kind: 'cono', x: 0.85, y: 0.30, funcion: 'fila',
      fila_config: { n_jugadores: 6, direccion_grados: 180, equipo: 'A', rondas: true, cadencia_s: null } },
    balon(0.86, 0.30, 'balon_1'),
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('fila1', 'bote', { hacia: 'aro' })] },
      { eventos: [evIA('fila1', 'tiro')] },
      { eventos: [evIA('fila1', 'recoge')] },
      { eventos: [evIA('fila1', 'vuelve_a_fila')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (res.rondas !== 6) return ko(`se esperaban 6 rondas; hay ${res.rondas}`);
    if (res.fases.length !== 24) return ko(`6 rondas × 4 fases = 24; hay ${res.fases.length}`);

    // cada ronda la corre quien le toca
    const esperado = ['fila1', 'fila1_2', 'fila1_3', 'fila1_4', 'fila1_5', 'fila1_6'];
    for (const f of res.fases) {
      const suyos = new Set([
        ...f.movimientos.filter((m) => m.tipo_elemento === 'jugador').map((m) => m.elemento_id),
        ...f.tiros.map((t) => t.jugador_id),
      ]);
      for (const a of suyos) {
        if (a !== esperado[f.ronda - 1]) return ko(`en la ronda ${f.ronda} debería correr ${esperado[f.ronda - 1]}, y corre ${a}`);
      }
    }

    // los seis existen como jugadores de verdad, cada uno en su sitio
    if (res.jugadores.length !== 6) return ko(`la cola debería dar 6 jugadores; da ${res.jugadores.length}`);
    const ys = res.jugadores.map((j) => j.posicion_inicial[0]);
    if (new Set(ys.map((v) => v.toFixed(4))).size !== 6) {
      return ko(`los seis deberían empezar en sitios distintos de la cola: ${JSON.stringify(ys)}`);
    }

    // y la cola dibujada se queda vacía: ya no hay fichas anónimas
    const cono = res.conos.find((c) => c.funcion === 'fila');
    if (cono.fila_config.n_jugadores !== 0) {
      return ko(`la cola dibujada debería estar vacía (todos son jugadores); quedan ${cono.fila_config.n_jugadores}`);
    }
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_cadencia_solapa_las_rondas',
  // Con cadencia, el siguiente sale antes de que termine el anterior:
  // la animación se acorta y hay dos en pista a la vez.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    { id: 'cf', kind: 'cono', x: 0.80, y: 0.30, funcion: 'fila',
      fila_config: { n_jugadores: 4, direccion_grados: 0, equipo: 'A', rondas: true, cadencia_s: 1.5 } },
    balon(0.81, 0.30, 'balon_1'),
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('fila1', 'bote', { hacia: 'aro' })] },
      { eventos: [evIA('fila1', 'tiro')] },
      { eventos: [evIA('fila1', 'vuelve_a_fila')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (res.rondas !== 4) return ko(`se esperaban 4 rondas; hay ${res.rondas}`);
    if (res.fases.length >= 12) return ko(`con cadencia la animación se acorta; sigue con ${res.fases.length} fases`);
    const conDos = res.fases.some((f) => {
      const actores = new Set(f.movimientos.filter((m) => m.tipo_elemento === 'jugador').map((m) => m.elemento_id));
      return actores.size > 1;
    });
    if (!conDos) return ko('con cadencia tiene que haber alguna fase con dos jugadores dentro');
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_fila_de_defensores',
  // El rol lo da de qué cola sale, no lo que haga ese turno: un
  // defensor que en su ronda no llega a marcar a nadie sigue siendo
  // defensor y se dibuja con su arco.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    { id: 'cf', kind: 'cono', x: 0.80, y: 0.30, funcion: 'fila',
      fila_config: { n_jugadores: 3, direccion_grados: 0, equipo: 'B', rondas: true, rol: 'defensor' } },
  ],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('fila1', 'corte', { hacia: 'canasta' })] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const noDefensores = res.jugadores.filter((j) => j.tipo !== 'defensor').map((j) => j.id);
    if (noDefensores.length) return ko(`salen de una fila de defensores y no lo son: ${noDefensores.join(', ')}`);
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_sin_rondas_todo_sigue_igual',
  // Las 204 fichas de la biblioteca no piden rondas. Sin la marca, la
  // cola se comporta exactamente como siempre: sale el primero, los
  // demás siguen siendo fichas anónimas dibujadas.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    { id: 'cf', kind: 'cono', x: 0.80, y: 0.30, funcion: 'fila',
      fila_config: { n_jugadores: 6, direccion_grados: 0, equipo: 'A' } },
    balon(0.81, 0.30, 'balon_1'),
  ],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('fila1', 'bote', { hacia: 'aro' })] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if ('rondas' in res) return ko('sin la marca de rondas, la clave no debe existir');
    if (res.fases.length !== 1) return ko(`debería haber 1 fase; hay ${res.fases.length}`);
    if (res.jugadores.length !== 1) return ko(`solo sale el primero; hay ${res.jugadores.length} jugadores`);
    const cono = res.conos.find((c) => c.funcion === 'fila');
    if (cono.fila_config.n_jugadores !== 5) return ko(`la cola dibujada debería bajar a 5; está en ${cono.fila_config.n_jugadores}`);
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_una_zona_es_un_sitio_con_nombre',
  // Lo que hace que una zona valga para algo más que decorar: su nombre es
  // un destino, igual que «el codo derecho». Y va ANTES que las anclas: si
  // el entrenador ha dibujado una zona y la ha llamado así en ESTE
  // ejercicio, manda sobre cualquier ancla que se llamara parecido.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.75, 0.30), balon(0.76, 0.30),
    { id: 'z1', kind: 'zona', tipo: 'rect', nombre: 'Zona de tiro', visible: true, x: 0.40, y: 0.60, x2: 0.60, y2: 0.80 },
  ],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('A1', 'corte', { hacia: 'Zona de tiro' })] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const z = (res.zonas || [])[0];
    if (!z) return ko('la zona no ha llegado a la animación');
    if (z.nombre !== 'Zona de tiro' || z.tipo !== 'rect') return ko(`zona mal guardada: ${JSON.stringify(z)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    if (!mv) return ko('A1 no se mueve');
    const fin = mv.path[mv.path.length - 1];
    // el centro del rectángulo (0.40,0.60)-(0.60,0.80)
    if (dxy(fin.x, fin.y, 0.5, 0.7) > 1e-9) return ko(`el corte debía morir en el centro de la zona (0.5, 0.7); murió en (${fin.x}, ${fin.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_zona_invisible_sigue_siendo_un_sitio',
  // El interruptor de invisible apaga el DIBUJO, no la zona. Se sigue
  // pudiendo mandar gente a ella: es lo que se usa para las zonas que son
  // una regla del ejercicio y no un decorado.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.75, 0.30), balon(0.76, 0.30),
    { id: 'z1', kind: 'zona', tipo: 'circulo', nombre: 'El refugio', visible: false, x: 0.45, y: 0.65, x2: 0.55, y2: 0.65 },
  ],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('A1', 'corte', { hacia: 'el refugio' })] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const z = (res.zonas || [])[0];
    if (!z || z.visible !== false) return ko('la zona invisible tiene que guardarse, con su marca de invisible');
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    const fin = mv.path[mv.path.length - 1];
    // mayúsculas y artículos dan igual: resuelve al centro del círculo
    if (dxy(fin.x, fin.y, 0.45, 0.65) > 1e-9) return ko(`no resolvió el nombre de la zona invisible; murió en (${fin.x}, ${fin.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_sin_zonas_no_anade_la_clave',
  // Igual que con el material: las 204 fichas de la biblioteca no llevan
  // zonas, y emitir `zonas: []` en todas haría que el diff de la
  // reconstrucción dijera que han cambiado las 204.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5)],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('A1', 'tiro')] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if ('zonas' in res) return ko('sin zonas, la clave `zonas` no debe existir');
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_material_de_suelo_pasa_intacto',
  // Escaleras y pelotas de tenis (Tramo 2.4) son material: ocupan sitio y se
  // dibujan a su medida real, pero NO son direccionables —nadie las pasa, las
  // rodea ni las recoge—. El compilador tiene que copiarlas tal cual sin
  // meterlas en la síntesis de jugadores: una escalera contada como ficha
  // rompería los ids y el reparto de roles.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5),
    { id: 'esc_1', kind: 'escalera', x: 0.45, y: 0.7, rot: 90 },
    { id: 'pel_1', kind: 'pelota', x: 0.6, y: 0.3 },
  ],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('A1', 'bote', { hacia: 'aro' })] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const m = res.materiales || [];
    if (m.length !== 2) return ko(`se esperaban 2 materiales; hay ${m.length}`);
    const esc = m.find((x) => x.tipo === 'escalera');
    const pel = m.find((x) => x.tipo === 'pelota');
    if (!esc || !pel) return ko(`falta escalera o pelota: ${JSON.stringify(m)}`);
    if (esc.rot !== 90) return ko(`la escalera perdió su orientación: rot=${esc.rot}`);
    if (dxy(esc.posicion[0], esc.posicion[1], 0.45, 0.7) > 1e-9) return ko('la escalera se movió de sitio');
    if ('rot' in pel) return ko('una pelota no tiene orientación: sobra el campo rot');
    // y sobre todo: no se ha colado entre los jugadores
    const ids = (res.jugadores || []).map((j) => j.id);
    if (ids.length !== 1 || ids[0] !== 'A1') return ko(`el material se coló en los jugadores: ${ids.join(', ')}`);
    return ok();
  },
});

casos.push({
  categoria: 'Compilador',
  nombre: 'compilador_sin_material_no_añade_la_clave',
  // Las 204 fichas de la biblioteca no llevan material. Si el compilador
  // emitiera `materiales: []` en todas, el diff de la reconstrucción diría
  // que han cambiado las 204 y no habría forma de ver qué cambió de verdad.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5)],
  intent: { canasta: 'norte', fases: [{ eventos: [evIA('A1', 'bote', { hacia: 'aro' })] }] },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if ('materiales' in res) return ko('sin material, la clave `materiales` no debe existir');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_tiro_sin_posesion_avisa',
  // A1 bota, A2 tira sin ningún pase entre medias: geometría intacta (el
  // arreglo real de la cadena de posesión es del Tramo 3) pero CON warning.
  esIntentIA: true,
  texto: 'A1 sube el balón y A2 tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), jugador('A', 2, 0.45, 0.3), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!todosTiros(res).some((t) => t.jugador_id === 'A2')) return ko('el tiro de A2 debe conservarse (solo se avisa, no se corrige)');
    if (!(res.warnings || []).some((w) => /sin haber recibido/.test(w.interpretacion || ''))) return ko('falta el warning de tiro sin posesión previa');
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_hacia_string_posicion_resuelve_con_aviso_de_lado',
  // hacia: 'la esquina' (Tramo 2): ya NO degrada a canasta — resuelve contra
  // las ANCLAS medidas. Sin lado especificado se usa la DERECHA, y esa
  // interpretación se avisa (§8.4). El bote debe TERMINAR en el ancla.
  esIntentIA: true,
  texto: 'A1 bota a la esquina y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'la esquina' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!(res.warnings || []).some((w) => w.campo === 'posicion' && /sin lado/.test(w.interpretacion || ''))) return ko('falta el warning de lado elegido por defecto (esquina sin lado → derecha)');
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    if (!mv) return ko('A1 no tiene movimiento en la fase 1');
    const fin = mv.path[mv.path.length - 1];
    const esq = ancla('media', 'esquina_der');
    if (dxy(fin.x, fin.y, esq[0], esq[1]) > 1e-9) return ko(`el bote debía terminar en el ancla esquina_der (${esq.join(', ')}); termina en (${fin.x}, ${fin.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_warnings_malformados_se_filtran',
  // La function puede devolver warnings basura ([{}, 'x', null]): al banner
  // de paso2.js solo deben llegar los bien formados (texto_original +
  // interpretacion), nunca `"undefined" — undefined`.
  esIntentIA: true,
  texto: 'A1 entra y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
    warnings: [{}, 'suelto', null, { texto_original: 'en el poste', interpretacion: 'poste bajo derecho', campo: 'posicion' }],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mal = (res.warnings || []).filter((w) => !w || typeof w !== 'object' || typeof w.texto_original !== 'string' || typeof w.interpretacion !== 'string');
    if (mal.length) return ko(`llegan warnings malformados a la UI: ${JSON.stringify(mal)}`);
    if (!(res.warnings || []).some((w) => w.texto_original === 'en el poste')) return ko('el warning bien formado del modelo no sobrevivió al filtro');
    return ok();
  },
});

casos.push({
  categoria: 'Límites y varios',
  nombre: 'board_renumera_labels_sin_duplicados',
  // Bug de board.js: añadir A1,A2,A3, borrar el 2 y añadir otro A producía
  // dos jugadores con label '3' (id derivado 'A3' duplicado; uno quedaba
  // inerte para la IA). Ahora las etiquetas se renumeran 1..n tras cada
  // alta/baja. Se prueba la lógica de Board en Node con una vista stub
  // (readonly evita listeners de DOM; render sale temprano con w=0).
  sinGenerica: true,
  async run() {
    globalThis.requestAnimationFrame ??= (fn) => { fn(); return 0; };
    const { Board } = await import('../js/canvas/board.js');
    const view = { root: {}, canvas: null, w: 0, h: 0, pistaKey: 'media' };
    const board = new Board({ view, readonly: true });
    const a1 = board.add({ kind: 'jugador', equipo: 'A' }, 0.3, 0.3);
    const a2 = board.add({ kind: 'jugador', equipo: 'A' }, 0.4, 0.4);
    const a3 = board.add({ kind: 'jugador', equipo: 'A' }, 0.5, 0.5);
    board.add({ kind: 'jugador', equipo: 'B' }, 0.6, 0.6); // otro equipo: numeración independiente
    board.remove(a2.id);
    const a4 = board.add({ kind: 'jugador', equipo: 'A' }, 0.7, 0.7);
    return { elementos: board.getElementos(), nuevos: [a1, a3, a4] };
  },
  check(res) {
    const jugA = res.elementos.filter((e) => e.kind === 'jugador' && e.equipo === 'A');
    const labels = jugA.map((j) => j.label).sort();
    if (labels.join(',') !== '1,2,3') return ko(`las etiquetas del equipo A deberían ser 1..3 únicas y contiguas; son [${labels.join(',')}]`);
    const ids = jugA.map((j) => `${j.equipo}${j.label}`);
    if (new Set(ids).size !== ids.length) return ko(`ids derivados duplicados: ${ids.join(',')}`);
    const jugB = res.elementos.filter((e) => e.kind === 'jugador' && e.equipo === 'B');
    if (jugB.length !== 1 || jugB[0].label !== '1') return ko(`la numeración del equipo B debe ser independiente; label='${jugB[0] && jugB[0].label}'`);
    return ok();
  },
});

/* ------------- 10. Tramo 1: confirmación visual y chips -------------
   La UI (tarjeta, botones) no se puede simular aquí sin DOM: estos casos
   prueban la LÓGICA subyacente — el fotograma 0 del motor real, la
   recompilación por cambio de canasta (chip editable) y el filtro de
   preguntas del modelo contra la lista fija de ambigüedades reales. */

casos.push({
  categoria: 'Tramo 1 (confirmación visual)',
  nombre: 'preview_frame0_posiciones_correctas',
  // El fotograma 0 de la vista previa coloca a cada jugador en su posición
  // inicial del intent (ANTES de moverse) y el balón con su portador; además
  // el compilador expone data.canasta (resaltado del aro) y data._intent
  // (recompilación de chips). Se usa el AnimationEngine REAL con una vista
  // stub sin DOM (w=0: render sale temprano, igual que un canvas sin medir;
  // autoplay:false + paused: el reloj nunca arranca, no hace falta rAF).
  sinGenerica: true, // `res` es un objeto compuesto; la genérica se aplica a mano abajo
  async run() {
    const { AnimationEngine } = await import('../js/canvas/engine.js');
    const elementos = [jugador('A', 1, 0.7, 0.55), jugador('A', 2, 0.45, 0.3), balon(0.71, 0.55)];
    const data = compilarAnimacion({
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    }, elementos, 'media');
    const view = { w: 0, basket: (k) => PISTAS.media.baskets[k] || PISTAS.media.baskets.norte };
    const engine = new AnimationEngine(view, data, { autoplay: false, loop: false, paused: true });
    return { data, frame0: engine._computePositions(), generica: validacionGenerica(data, 'media') };
  },
  check({ data, frame0, generica }) {
    if (!esExito(data)) return ko(`se esperaba animación, llegó ${forma(data)}`);
    if (generica.length) return ko(`[genérica] ${generica.join(' | ')}`);
    if (data.canasta !== 'norte') return ko(`data.canasta debería exponer el aro objetivo resuelto ('norte'); es '${data.canasta}'`);
    if (!data._intent || data._intent.canasta !== 'norte') return ko('data._intent (con canasta resuelta) no viene en el resultado — sin él los chips no pueden recompilar');
    const esperado = { A1: [0.7, 0.55], A2: [0.45, 0.3] };
    for (const id in esperado) {
      const p = frame0.players[id];
      if (!p) return ko(`falta ${id} en el fotograma 0`);
      if (dxy(p.x, p.y, esperado[id][0], esperado[id][1]) > 1e-9) return ko(`${id} debería estar en (${esperado[id].join(', ')}) en el fotograma 0 (antes de moverse); está en (${p.x}, ${p.y})`);
    }
    const b = Object.values(frame0.balls)[0];
    if (!b || dxy(b.x, b.y, 0.7, 0.55) > 0.05) return ko(`el balón debería arrancar en manos de A1 (0.70, 0.55); está en (${b && b.x}, ${b && b.y})`);
    return ok();
  },
});





/* ------------- 11. Tramo 2: posiciones con nombre -------------------
   Anclas medidas (canvas/anclas.js), diccionario de nombres
   (ia/posiciones.js), fallback con pregunta tipo A y diccionario custom
   inyectado (stub del de Supabase — el banco NUNCA toca la red). */

casos.push({
  categoria: 'Tramo 2 (posiciones con nombre)',
  nombre: 'tiro_va_al_centro_exacto_del_aro',
  // El endpoint del tiro es el centro del aro (anclas.js), por pista y por
  // canasta. Desde el Tramo 2.1 anclas.js y court.js baskets salen los dos
  // de medidas.js y coinciden al decimal; antes diferían porque cada uno se
  // había medido por su cuenta sobre el dibujo (en las medias, 0.172 frente
  // a 0.143, que caía entre el tablero y el aro). El compilador emite el
  // path explícito; el último nodo debe clavar el ancla en las 5
  // combinaciones pista/canasta.
  sinGenerica: true, // varios resultados: la genérica se aplica a cada uno a mano
  async run() {
    const { ANCLAS } = await import('../js/canvas/anclas.js');
    const combos = [['entera', 'norte'], ['entera', 'sur'], ['entera_fiba', 'sur'], ['media', 'norte'], ['media_fiba', 'norte']];
    return combos.map(([pista, canasta]) => {
      const elementos = [jugador('A', 1, 0.6, 0.6), balon(0.61, 0.6)];
      const res = compilarAnimacion({
        canasta,
        fases: [
          { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
          { eventos: [evIA('A1', 'tiro')] },
        ],
      }, elementos, pista);
      return { pista, canasta, res, aro: ANCLAS[pista].pos[canasta].aro, generica: validacionGenerica(res, pista) };
    });
  },
  check(items) {
    for (const it of items) {
      const donde = `${it.pista}/${it.canasta}`;
      if (!esExito(it.res)) return ko(`${donde}: se esperaba animación, llegó ${forma(it.res)}`);
      if (it.generica.length) return ko(`${donde}: [genérica] ${it.generica.join(' | ')}`);
      const t = todosTiros(it.res)[0];
      if (!t || !Array.isArray(t.path) || t.path.length < 2) return ko(`${donde}: el tiro no trae path explícito (el motor caería al aro de court.js)`);
      const fin = t.path[t.path.length - 1];
      if (dxy(fin.x, fin.y, it.aro[0], it.aro[1]) > 1e-9) return ko(`${donde}: el tiro termina en (${fin.x}, ${fin.y}), no en el aro medido (${it.aro.join(', ')})`);
    }
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 2 (posiciones con nombre)',
  nombre: 'posicion_estandar_se_resuelve_sin_preguntar',
  // "al poste bajo izquierdo" es vocabulario estándar (ANCLAS): el corte
  // resuelve a las coordenadas medidas SIN pregunta y sin warning de lado
  // (el lado viene explícito). Camino de red real (validador→compilador).
  esIntentIA: true,
  texto: 'A2 corta al poste bajo izquierdo, recibe de A1 y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.6, 0.55), jugador('A', 2, 0.5, 0.25), balon(0.61, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A2', 'corte', { hacia: 'al poste bajo izquierdo' })] },
        { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (esPreguntas(res)) return ko(`posición estándar: no debía preguntar (llegó ${JSON.stringify(res.preguntas.map((q) => q.id))})`);
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A2');
    if (!mv) return ko('A2 no tiene movimiento en la fase 1');
    const fin = mv.path[mv.path.length - 1];
    const pb = ancla('media', 'poste_bajo_izq');
    if (dxy(fin.x, fin.y, pb[0], pb[1]) > 1e-9) return ko(`el corte debía terminar en poste_bajo_izq (${pb.join(', ')}); termina en (${fin.x}, ${fin.y})`);
    if ((res.warnings || []).some((w) => /sin lado/.test(w.interpretacion || ''))) return ko('con el lado explícito no debe avisarse de lado por defecto');
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 2 (posiciones con nombre)',
  nombre: 'posicion_desconocida_dispara_pregunta_A',
  // "el refugio" no está en ANCLAS ni en el custom: el gancho del Tramo 1
  // se activa de verdad — pregunta TIPO A ("Marca la posición…"), id
  // estable q_pos_refugio, NUNCA degradación silenciosa a canasta.
  esIntentIA: true,
  texto: 'A1 bota hasta el refugio y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'el refugio' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esPreguntas(res)) return ko(`posición desconocida: se esperaba pregunta tipo A, llegó ${forma(res)}`);
    const q = res.preguntas.find((p) => p.id === 'q_pos_refugio');
    if (!q) return ko(`ninguna pregunta tiene id 'q_pos_refugio': ${JSON.stringify(res.preguntas.map((p) => p.id))}`);
    if (q.tipo !== 'A') return ko(`la pregunta de posición debe ser tipo 'A' (clic en pista); es '${q.tipo}'`);
    if (q.nombre !== 'refugio') return ko(`la pregunta debe llevar el slug en 'nombre' (para guardarPosicion); trae '${q.nombre}'`);
    if (!/refugio/i.test(q.texto || '')) return ko(`el texto de la pregunta no menciona la posición: "${q.texto}"`);
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 2 (posiciones con nombre)',
  nombre: 'posicion_desconocida_respondida_se_usa_y_no_repregunta',
  // Una posición marcada por el entrenador (el clic en la pista del paso
  // 2, que se guarda en el diccionario de la pista) resuelve el nombre
  // sin preguntar nada: el bote termina EXACTAMENTE en ese punto.
  esIntentIA: true,
  pista: 'media',
  posicionesCustom: { refugio: [0.25, 0.4] },
  elementos: [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'el refugio' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (esPreguntas(res)) return ko('«el refugio» está en el diccionario de la pista: no debía preguntar por él');
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    if (!mv) return ko('A1 no tiene movimiento en la fase 1');
    const fin = mv.path[mv.path.length - 1];
    if (dxy(fin.x, fin.y, 0.25, 0.4) > 1e-9) return ko(`el bote debía terminar en el punto marcado (0.25, 0.4); termina en (${fin.x}, ${fin.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 2 (posiciones con nombre)',
  nombre: 'posicion_no_se_comparte_entre_pistas',
  // La misma clave de nombre debe dar coordenadas DISTINTAS según la pista:
  // (a) estándar — el poste bajo izquierdo de la entera no es el de la
  // media (marcos normalizados distintos); (b) custom — dos diccionarios
  // por pista (stub de posiciones_pista, que guarda por `pista` con
  // UNIQUE(pista,nombre,created_by)) devuelven cada uno su punto, y el
  // nombre definido solo en una pista NO existe en la otra.
  sinGenerica: true,
  async run() {
    const { resolverPosicion } = await import('../js/ia/posiciones.js');
    const customEntera = { refugio: [0.2, 0.2] };  // fila de posiciones_pista con pista='entera'
    const customMedia = { refugio: [0.7, 0.7] };   // fila con pista='media' — otra fila, otras coords
    return {
      estandarEntera: resolverPosicion('entera', 'poste bajo izquierdo', 'norte'),
      estandarMedia: resolverPosicion('media', 'poste bajo izquierdo', 'norte'),
      customEnPistaEntera: resolverPosicion('entera', 'el refugio', 'norte', customEntera),
      customEnPistaMedia: resolverPosicion('media', 'el refugio', 'norte', customMedia),
      sinDatoEnOtraPista: resolverPosicion('media_fiba', 'el refugio', 'norte', null),
    };
  },
  check(r) {
    if (!r.estandarEntera || !r.estandarMedia) return ko('la posición estándar debe resolver en ambas pistas');
    if (dxy(r.estandarEntera[0], r.estandarEntera[1], r.estandarMedia[0], r.estandarMedia[1]) < 0.05) {
      return ko(`el poste bajo izq de 'entera' (${r.estandarEntera.join(', ')}) y el de 'media' (${r.estandarMedia.join(', ')}) no pueden (casi) coincidir: cada pista tiene su marco`);
    }
    if (!r.customEnPistaEntera || dxy(r.customEnPistaEntera[0], r.customEnPistaEntera[1], 0.2, 0.2) > 1e-9) return ko(`el custom de 'entera' debía dar (0.2, 0.2); dio (${r.customEnPistaEntera})`);
    if (!r.customEnPistaMedia || dxy(r.customEnPistaMedia[0], r.customEnPistaMedia[1], 0.7, 0.7) > 1e-9) return ko(`el custom de 'media' debía dar (0.7, 0.7); dio (${r.customEnPistaMedia})`);
    if (r.sinDatoEnOtraPista !== null) return ko(`'el refugio' no está definido en 'media_fiba': debía ser null (nada de heredar de otra pista); dio (${r.sinDatoEnOtraPista})`);
    return ok();
  },
});



/* ------------- 12. Tramo 3: vista del modelo -------------------------
   (a) El payload hacia Claude incluye balón(es) con su poseedor y los
   dorsales/nombres visibles; (b) balones múltiples con posesión en
   paralelo; (c) truncado por max_tokens → error accionable, nunca un JSON
   a medias; (d) bloqueo directo como eventos encadenados (aproximación +
   bloqueo + roll/pop); (e) rotación de filas en serie.

   Los dos casos que ejercitaban la Netlify Function real —el payload que
   viajaba a Anthropic y el JSON truncado por max_tokens— se han ido con
   ella (Tramo 2.11). */










casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'balones_multiples_se_compilan',
  // Dos balones, dos poseedores, dos pases EN PARALELO en la misma fase:
  // cada pase viaja con el balón de su pasador y cada receptor tira el suyo.
  esIntentIA: true,
  texto: 'A1 pasa a A3 y A2 pasa a A4 a la vez; los receptores tiran.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.2, 0.3), jugador('A', 2, 0.7, 0.3),
    jugador('A', 3, 0.3, 0.6), jugador('A', 4, 0.8, 0.6),
    balon(0.21, 0.3, 'balon_a'), balon(0.71, 0.3, 'balon_b'),
  ],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'pase', { a: 'A3' }), evIA('A2', 'pase', { a: 'A4' })] },
        { eventos: [evIA('A3', 'tiro'), evIA('A4', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if ((res.balones || []).length !== 2) return ko(`deberían salir 2 balones; salen ${(res.balones || []).length}`);
    const porId = new Map(res.balones.map((b) => [b.id, b]));
    if (porId.get('balon_a')?.portador_id !== 'A1') return ko(`balon_a debería empezar con A1 (el más cercano); portador '${porId.get('balon_a')?.portador_id}'`);
    if (porId.get('balon_b')?.portador_id !== 'A2') return ko(`balon_b debería empezar con A2; portador '${porId.get('balon_b')?.portador_id}'`);
    const pases = res.fases[0].pases || [];
    if (pases.length !== 2) return ko(`la fase 1 debería tener 2 pases en paralelo; tiene ${pases.length}`);
    const paseDe = (id) => pases.find((p) => p.de_id === id);
    if (paseDe('A1')?.balon_id !== 'balon_a') return ko(`el pase de A1 debería viajar con balon_a; viaja con '${paseDe('A1')?.balon_id}'`);
    if (paseDe('A2')?.balon_id !== 'balon_b') return ko(`el pase de A2 debería viajar con balon_b; viaja con '${paseDe('A2')?.balon_id}'`);
    const tiros = todosTiros(res);
    const tiroDe = (id) => tiros.find((t) => t.jugador_id === id);
    if (tiroDe('A3')?.balon_id !== 'balon_a') return ko(`A3 debería tirar el balon_a que recibió; tira '${tiroDe('A3')?.balon_id}'`);
    if (tiroDe('A4')?.balon_id !== 'balon_b') return ko(`A4 debería tirar el balon_b que recibió; tira '${tiroDe('A4')?.balon_id}'`);
    const conBalon = (res.jugadores || []).filter((j) => j.tiene_balon).map((j) => j.id);
    if (!mismoConjunto(conBalon, ['A1', 'A2'])) return ko(`tiene_balon debería ser {A1,A2}; es ${JSON.stringify(conBalon)}`);
    if ((res.warnings || []).some((w) => w.campo === 'posesion')) return ko('la posesión en paralelo es legal: no debería avisar de tiro sin recibir');
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'poseedor_declarado_se_respeta_o_avisa',
  // Un intent puede DECLARAR el poseedor inicial (intent.balones): si es
  // válido, manda sobre la cadena de eventos; si es inválido, warning y
  // la inferencia determinista de siempre decide.
  sinGenerica: true,
  async run() {
    const elementos = [jugador('A', 1, 0.7, 0.55), jugador('A', 2, 0.45, 0.3), balon(0.5, 0.5, 'balon_1')];
    const fases = [
      // A1 hace el PRIMER evento con balón: sin declaración, la cadena le
      // daría el balón a él — la declaración a favor de A2 debe mandar.
      { eventos: [evIA('A1', 'bote', { hacia: { x: 0.6, y: 0.5 } }), evIA('A2', 'bote', { hacia: 'canasta' })] },
      { eventos: [evIA('A2', 'tiro')] },
    ];
    const conDecl = compilarIntentValidado(
      { intent: { canasta: 'norte', balones: [{ id: 'balon_1', portador: 'A2' }], fases } }, elementos, 'media');
    const invalida = compilarIntentValidado(
      { intent: { canasta: 'norte', balones: [{ id: 'balon_1', portador: 'Z9' }], fases } }, elementos, 'media');
    return { conDecl, invalida, generica: [...validacionGenerica(conDecl, 'media'), ...validacionGenerica(invalida, 'media')] };
  },
  check({ conDecl, invalida, generica }) {
    if (!esExito(conDecl)) return ko(`(declaración válida) se esperaba animación, llegó ${forma(conDecl)}`);
    if (generica.length) return ko(`[genérica] ${generica.join(' | ')}`);
    if (conDecl.balones[0].portador_id !== 'A2') return ko(`el poseedor declarado (A2) debía respetarse; el balón sale con '${conDecl.balones[0].portador_id}'`);
    if (jugadorPorId(conDecl, 'A2')?.tiene_balon !== true) return ko('A2 (poseedor declarado) debería salir con tiene_balon');
    if (jugadorPorId(conDecl, 'A1')?.tiene_balon) return ko('A1 no debería salir con el balón: la declaración manda sobre la cadena');
    if (!esExito(invalida)) return ko(`(declaración inválida) se esperaba animación, llegó ${forma(invalida)}`);
    if (invalida.balones[0].portador_id !== 'A1') return ko(`con la declaración inválida manda la inferencia (A1, primer bote); el balón sale con '${invalida.balones[0].portador_id}'`);
    if (!(invalida.warnings || []).some((w) => w.campo === 'balon')) return ko('falta el warning del poseedor declarado inválido');
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'bloqueo_directo_aproximacion_y_continuacion',
  // Pick & roll con eventos encadenados: fase 1 aproximación (corte junto
  // al portador + bloqueo), fase 2 uso (bote del portador) y CONTINUACIÓN
  // al aro (roll: corte hacia 'aro' que clava el centro medido del aro),
  // fases 3-4 pase al que rueda y tiro.
  esIntentIA: true,
  texto: 'B1 defiende a A1. A2 pone un bloqueo directo, A1 penetra usándolo y A2 continúa al aro, recibe y tira.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.45, 0.5), jugador('A', 2, 0.3, 0.68),
    jugador('B', 1, 0.4, 0.47), balon(0.46, 0.5, 'balon_1'),
  ],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          evIA('A2', 'corte', { hacia: { x: 0.42, y: 0.54 } }),
          evIA('A2', 'bloqueo', { bloqueado_id: 'B1' }),
          evIA('B1', 'defiende', { marca: 'A1' }),
        ] },
        { eventos: [
          evIA('A1', 'bote', { hacia: 'canasta' }),
          evIA('A2', 'corte', { hacia: 'aro' }),
          evIA('B1', 'defiende', { marca: 'A1' }),
        ] },
        { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    // fase 1: aproximación + pantalla
    const bloqueos = res.fases[0].bloqueos || [];
    if (!bloqueos.some((b) => b.bloqueador_id === 'A2' && b.bloqueado_id === 'B1')) return ko(`la fase 1 debería llevar el bloqueo A2→B1; lleva ${JSON.stringify(bloqueos)}`);
    const aprox = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A2');
    if (!aprox) return ko('A2 no se aproxima en la fase 1');
    const finAprox = aprox.path[aprox.path.length - 1];
    if (dxy(finAprox.x, finAprox.y, 0.42, 0.54) > 1e-9) return ko(`la aproximación debía terminar junto al portador (0.42, 0.54); termina en (${finAprox.x}, ${finAprox.y})`);
    // fase 2: el portador usa el bloqueo (bote) y el bloqueador rueda al aro
    const uso = (res.fases[1].movimientos || []).find((m) => m.elemento_id === 'A1');
    if (!uso || uso.tipo_movimiento !== 'carrera_con_balon') return ko('A1 debería botar (carrera_con_balon) usando el bloqueo en la fase 2');
    const roll = (res.fases[1].movimientos || []).find((m) => m.elemento_id === 'A2');
    if (!roll) return ko('A2 no continúa en la fase 2');
    const finRoll = roll.path[roll.path.length - 1];
    /* El roll termina PEGADO al aro, no encima. Este caso exigía antes el
       centro exacto del aro porque 'aro' se resolvía como
       ancla con nombre; desde la auditoría de agosto de 2026 'aro' es una
       INTENCIÓN de finalización y el compilador para al jugador a poco
       más de un metro (canvas/escala.js#puntoADistanciaDe). Dos motivos:
       clavar el centro dibuja la ficha encima de la canasta y la tapa, y
       la misma palabra tiene que significar lo mismo en un roll que en
       una entrada. Se comprueba la distancia real, no la coordenada. */
    const mRoll = metrosEntre('media', finRoll, ancla('media', 'aro'));
    if (mRoll > 1.6) return ko(`el roll debía terminar pegado al aro (≤1,6 m); termina a ${mRoll.toFixed(2)} m`);
    // continuación completa: pase al que rueda y su tiro
    if (!todosPases(res).some((p) => p.de_id === 'A1' && p.a_id === 'A2')) return ko('falta el pase de A1 al que rueda');
    if (!todosTiros(res).some((t) => t.jugador_id === 'A2')) return ko('el que rueda no llega a tirar');
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'pick_and_roll_pop_a_posicion',
  // Variante POP: la continuación del bloqueador va a una posición NOMBRADA
  // ("el codo derecho") en vez de al aro, y clava su ancla medida.
  esIntentIA: true,
  texto: 'A2 bloquea para A1, que penetra; A2 se abre al codo derecho, recibe y tira.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.45, 0.5), jugador('A', 2, 0.3, 0.68),
    jugador('B', 1, 0.4, 0.47), balon(0.46, 0.5, 'balon_1'),
  ],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [
          evIA('A2', 'corte', { hacia: { x: 0.42, y: 0.54 } }),
          evIA('A2', 'bloqueo', { bloqueado_id: 'B1' }),
        ] },
        { eventos: [
          evIA('A1', 'bote', { hacia: 'canasta' }),
          evIA('A2', 'corte', { hacia: 'el codo derecho' }),
        ] },
        { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
        { eventos: [evIA('A2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (esPreguntas(res)) return ko(`"el codo derecho" es vocabulario estándar: no debía preguntar (${JSON.stringify(res.preguntas?.map((q) => q.id))})`);
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const pop = (res.fases[1].movimientos || []).find((m) => m.elemento_id === 'A2');
    if (!pop) return ko('A2 no hace el pop en la fase 2');
    const fin = pop.path[pop.path.length - 1];
    const codo = ancla('media', 'codo_der');
    if (dxy(fin.x, fin.y, codo[0], codo[1]) > 1e-9) return ko(`el pop debía terminar en codo_der (${codo.join(', ')}); termina en (${fin.x}, ${fin.y})`);
    if ((res.warnings || []).some((w) => /sin lado/.test(w.interpretacion || ''))) return ko('el lado venía explícito: no debe avisarse de lado por defecto');
    if (!todosTiros(res).some((t) => t.jugador_id === 'A2')) return ko('A2 no llega a tirar tras el pop');
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'rotacion_de_fila_serie_de_tiro',
  // Serie de tiro con DOS balones en una fila de 4: sale el 1º (fila1) y
  // tira; vuelve a la cola y en esa misma fase sale el 2º (fila1_2), que
  // tira el segundo balón. La cola visible baja de 4 a 2.
  esIntentIA: true,
  texto: 'Serie de tiro: sale el primero, tira y vuelve a la fila; entonces sale el segundo y tira.',
  pista: 'media',
  elementos: [
    balon(0.71, 0.31, 'b1'), balon(0.73, 0.33, 'b2'),
    cono(0.7, 0.3, 'fila', { n_jugadores: 4, direccion_grados: 90, equipo: 'A' }, 'cono_fila'),
  ],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('fila1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('fila1', 'tiro')] },
        { eventos: [evIA('fila1', 'vuelve_a_fila'), evIA('fila1_2', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('fila1_2', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const idsFila = (res.jugadores || []).filter((j) => /^fila/.test(j.id)).map((j) => j.id);
    if (!mismoConjunto(idsFila, ['fila1', 'fila1_2'])) return ko(`deberían materializarse SOLO fila1 y fila1_2 (los que trabajan); salen ${JSON.stringify(idsFila)}`);
    // el 2º sale DESDE el cono (encabeza la cola cuando le toca)
    const salida2 = (res.fases[2].movimientos || []).find((m) => m.elemento_id === 'fila1_2');
    if (!salida2 || salida2.tipo_movimiento !== 'carrera_con_balon') return ko('fila1_2 debería salir botando en la fase 3');
    if (dxy(salida2.path[0].x, salida2.path[0].y, 0.7, 0.3) > 1e-9) return ko(`fila1_2 debería salir desde el cono (0.7, 0.3); sale de (${salida2.path[0].x}, ${salida2.path[0].y})`);
    // y el 1º vuelve a la cola en esa misma fase
    const vuelta = (res.fases[2].movimientos || []).find((m) => m.elemento_id === 'fila1' && m.tipo_movimiento === 'carrera_sin_balon');
    if (!vuelta) return ko('falta la vuelta a la fila de fila1 en la fase 3');
    // cada uno tira SU balón
    const tiros = todosTiros(res);
    const tiroDe = (id) => tiros.find((t) => t.jugador_id === id);
    if (tiroDe('fila1')?.balon_id !== 'b1') return ko(`fila1 debería tirar b1 (el más cercano al cono); tira '${tiroDe('fila1')?.balon_id}'`);
    if (tiroDe('fila1_2')?.balon_id !== 'b2') return ko(`fila1_2 debería tirar b2; tira '${tiroDe('fila1_2')?.balon_id}'`);
    if ((res.warnings || []).some((w) => w.campo === 'posesion')) return ko('la serie con dos balones es legal: no debería avisar de tiro sin recibir');
    // la cola dibujada baja según los que salen (4 - 2 = 2)
    const conoFila = (res.conos || []).find((c) => c.id === 'cono_fila');
    if (conoFila?.fila_config?.n_jugadores !== 2) return ko(`la cola debería bajar de 4 a 2 (salen dos); queda en ${conoFila?.fila_config?.n_jugadores}`);
    return ok();
  },
});

/* ====================================================================
   14. Simulación ataque-defensa (Tramo 5b) — simularJugada es un
   generador de intent determinista (PRNG sembrado) que compila por la
   tubería de siempre. Tablero base 2v2 en media pista (aro medido en
   el centro del aro); portador por cercanía al balón (≤ RADIO_CAPTURA).
   ==================================================================== */

// tablero 2v2 estándar de los casos de simulación (portador: A1). El id del
// balón va FIJO ('b_sim'): el id autoincremental del helper haría que dos
// tableros "iguales" difirieran en el JSON por el id, no por la jugada — y
// los checks de determinismo/variantes comparan JSON completo.
function tablero2v2() {
  return [
    jugador('A', 1, 0.62, 0.40), jugador('A', 2, 0.45, 0.72),
    jugador('B', 1, 0.55, 0.44), jugador('B', 2, 0.42, 0.65),
    balon(0.63, 0.41, 'b_sim'),
  ];
}

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_error_balon_suelto',
  pista: 'media',
  // el balón lejos de todos: no hay portador → error accionable, nunca
  // una simulación a medias adivinando quién ataca.
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const elementos = [jugador('A', 1, 0.62, 0.40), jugador('B', 1, 0.55, 0.44), balon(0.78, 0.88)];
    return simularJugada({ elementos, pista: 'media', semilla: 1 });
  },
  check(res) {
    if (!esError(res)) return ko(`se esperaba error accionable, llegó ${forma(res)}`);
    if (!/bal[oó]n/i.test(res.error)) return ko(`el error debería explicar qué hacer con el balón; dice: ${res.error}`);
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_error_un_solo_equipo',
  pista: 'media',
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const elementos = [jugador('A', 1, 0.62, 0.40), jugador('A', 2, 0.45, 0.72), balon(0.63, 0.41)];
    return simularJugada({ elementos, pista: 'media', semilla: 1 });
  },
  check(res) {
    if (!esError(res)) return ko(`sin rival no hay simulación: se esperaba error, llegó ${forma(res)}`);
    if (!/equipo/i.test(res.error)) return ko(`el error debería pedir otro equipo; dice: ${res.error}`);
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_determinismo_misma_semilla',
  pista: 'media',
  sinGenerica: true,
  // misma colocación + misma semilla ⇒ el MISMO JSON byte a byte (decisión
  // de producto: reproducible y testeable).
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const a = simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 42 });
    const b = simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 42 });
    return { a, b, generica: [...validacionGenerica(a, 'media'), ...validacionGenerica(b, 'media')] };
  },
  check({ a, b, generica }) {
    if (!esExito(a)) return ko(`se esperaba animación, llegó ${forma(a)}`);
    if (generica.length) return ko(`genérica: ${generica.join(' · ')}`);
    if (JSON.stringify(a) !== JSON.stringify(b)) return ko('misma semilla produjo jugadas distintas (no determinista)');
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_variante_cambia_con_semilla',
  pista: 'media',
  sinGenerica: true,
  // "Otra variante" = otra semilla: alguna semilla cercana debe producir
  // una jugada DISTINTA (se busca en un rango fijo — determinista).
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const base = simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 1 });
    let distinta = null;
    for (let s = 2; s <= 12 && !distinta; s++) {
      const v = simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: s });
      if (JSON.stringify(v) !== JSON.stringify(base)) distinta = v;
    }
    return { base, distinta, generica: [...validacionGenerica(base, 'media'), ...(distinta ? validacionGenerica(distinta, 'media') : [])] };
  },
  check({ base, distinta, generica }) {
    if (!esExito(base)) return ko(`se esperaba animación, llegó ${forma(base)}`);
    if (generica.length) return ko(`genérica: ${generica.join(' · ')}`);
    if (!distinta) return ko('las semillas 2..12 producen exactamente la misma jugada que la 1: sin variantes reales');
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_termina_en_tiro_en_aro_exacto',
  pista: 'media',
  // convergencia garantizada: ≤ MAX_FASES, exactamente UN tiro, en la
  // ÚLTIMA fase, y el balón muere en el centro MEDIDO del aro (anclas).
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    return simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 7 });
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (res.fases.length > 6) return ko(`la posesión no puede superar 6 fases; tiene ${res.fases.length}`);
    const tiros = todosTiros(res);
    if (tiros.length !== 1) return ko(`debería haber exactamente 1 tiro; hay ${tiros.length}`);
    if (!(res.fases[res.fases.length - 1].tiros || []).length) return ko('el tiro debería cerrar la jugada (última fase)');
    const fin = tiros[0].path[tiros[0].path.length - 1];
    const aro = ancla('media', 'aro');
    if (dxy(fin.x, fin.y, aro[0], aro[1]) > 1e-9) return ko(`el tiro debería morir en el centro del aro (${aro.join(', ')}); muere en (${fin.x}, ${fin.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_ataca_equipo_del_portador',
  pista: 'media',
  // el balón sobre B1 → ataca el equipo B y defiende TODO el equipo A en
  // todas las fases (roles por fase + tipo en la salida).
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const elementos = [
      jugador('A', 1, 0.62, 0.40), jugador('A', 2, 0.45, 0.72),
      jugador('B', 1, 0.55, 0.44), jugador('B', 2, 0.42, 0.65),
      balon(0.56, 0.45),
    ];
    return simularJugada({ elementos, pista: 'media', semilla: 3 });
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiro = todosTiros(res)[0];
    if (!tiro || !/^B/.test(tiro.jugador_id)) return ko(`debería tirar un jugador del equipo B (el del portador); tira ${tiro && tiro.jugador_id}`);
    if (!res.fases.every((f) => mismoConjunto(f.defensores || [], ['A1', 'A2']))) return ko(`fase.defensores debería ser {A1,A2} en todas las fases; es ${JSON.stringify(res.fases.map((f) => f.defensores))}`);
    for (const id of ['A1', 'A2']) if (jugadorPorId(res, id)?.tipo !== 'defensor') return ko(`${id} debería salir con tipo 'defensor'`);
    for (const id of ['B1', 'B2']) if (jugadorPorId(res, id)?.tipo !== 'atacante') return ko(`${id} debería salir con tipo 'atacante'`);
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_un_movimiento_por_jugador_y_fase',
  pista: 'media',
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    return simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 9 });
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    for (let i = 0; i < res.fases.length; i++) {
      const ids = (res.fases[i].movimientos || []).map((m) => m.elemento_id);
      if (new Set(ids).size !== ids.length) return ko(`fase ${i + 1}: un jugador tiene DOS movimientos (el motor machacaría el primero): ${JSON.stringify(ids)}`);
    }
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_sin_teleports',
  pista: 'media',
  // continuidad total: cada movimiento arranca EXACTAMENTE donde el elemento
  // terminó la fase anterior; los pases salen de la posición final del
  // pasador; ningún defensor se desplaza más del tope anti-teleport.
  async run() {
    const { simularJugada, SIM } = await import('../js/ia/simulador.js');
    return { res: simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 5 }), SIM };
  },
  sinGenerica: true,
  check({ res, SIM }) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const generica = validacionGenerica(res, 'media');
    if (generica.length) return ko(`genérica: ${generica.join(' · ')}`);
    const pos = new Map((res.jugadores || []).map((j) => [j.id, { x: j.posicion_inicial[0], y: j.posicion_inicial[1] }]));
    for (let i = 0; i < res.fases.length; i++) {
      const f = res.fases[i];
      for (const m of f.movimientos || []) {
        const p = pos.get(m.elemento_id);
        const ini = m.path[0], fin = m.path[m.path.length - 1];
        if (p && dxy(ini.x, ini.y, p.x, p.y) > 1e-9) return ko(`fase ${i + 1}: ${m.elemento_id} se teletransporta (arranca en (${ini.x},${ini.y}) pero estaba en (${p.x},${p.y}))`);
        if (m.tipo_movimiento === 'carrera_sin_balon' && dxy(ini.x, ini.y, fin.x, fin.y) > SIM.D_MAX_DEF + 1e-6) return ko(`fase ${i + 1}: el defensor ${m.elemento_id} cruza más del tope anti-teleport (${dxy(ini.x, ini.y, fin.x, fin.y).toFixed(3)} > ${SIM.D_MAX_DEF})`);
        pos.set(m.elemento_id, { x: fin.x, y: fin.y });
      }
      for (const pse of f.pases || []) {
        const p = pos.get(pse.de_id);
        if (p && dxy(pse.path[0].x, pse.path[0].y, p.x, p.y) > 1e-9) return ko(`fase ${i + 1}: el pase de ${pse.de_id} no sale de su posición final`);
      }
    }
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_presion_goal_side',
  pista: 'media',
  // en una fase de bote del portador, su par acaba pegado a él (presión,
  // D_PRESION) y del lado del aro (goal-side). Se busca la primera semilla
  // (rango fijo → determinista) cuya fase 1 sea de bote.
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    for (let s = 1; s <= 30; s++) {
      const res = simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: s });
      if (!esExito(res)) continue;
      const bote = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1' && m.tipo_movimiento === 'carrera_con_balon');
      if (bote) return { res, bote };
    }
    return { res: null };
  },
  sinGenerica: true,
  check({ res, bote }) {
    if (!res) return ko('ninguna semilla 1..30 produce una fase 1 de bote del portador: revisa los gates del ataque');
    const finA1 = bote.path[bote.path.length - 1];
    const movB1 = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'B1');
    if (!movB1) return ko('el par del portador (B1) debería recolocarse en la fase 1');
    const finB1 = movB1.path[movB1.path.length - 1];
    if (dxy(finB1.x, finB1.y, finA1.x, finA1.y) > 0.075) return ko(`B1 debería acabar pegado al portador (presión); queda a ${dxy(finB1.x, finB1.y, finA1.x, finA1.y).toFixed(3)}`);
    const aroM = ancla('media', 'aro');
    if (dxy(finB1.x, finB1.y, aroM[0], aroM[1]) >= dxy(finA1.x, finA1.y, aroM[0], aroM[1])) return ko('B1 debería quedar entre el portador y el aro (goal-side)');
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_1v1_penetra_y_tira',
  pista: 'media',
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const elementos = [jugador('A', 1, 0.62, 0.40), jugador('B', 1, 0.55, 0.44), balon(0.63, 0.41)];
    return simularJugada({ elementos, pista: 'media', semilla: 4 });
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (todosPases(res).length) return ko('en un 1v1 no hay a quién pasar: cero pases');
    if (todosTiros(res).length !== 1) return ko('el 1v1 debería acabar en un tiro');
    if (res.fases.length > 6) return ko(`≤ 6 fases; tiene ${res.fases.length}`);
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_tercer_equipo_decorado',
  pista: 'media',
  // un tercer equipo en pista no rompe: queda de decorado (quieto, aviso
  // §8.4) y jamás aparece como defensor.
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const elementos = [...tablero2v2(), jugador('C', 1, 0.75, 0.20)];
    return simularJugada({ elementos, pista: 'media', semilla: 2 });
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (apariciones(res, 'C1') !== 0) return ko('C1 (equipo de sobra) debería quedarse quieto');
    if (res.fases.some((f) => (f.defensores || []).includes('C1'))) return ko('C1 no debería contar como defensor');
    if (!(res.warnings || []).some((w) => w.campo === 'equipo')) return ko('debería avisarse de que el equipo C no participa');
    return ok();
  },
});

casos.push({
  categoria: 'Simulación (Tramo 5)',
  nombre: 'sim_posesion_declarada',
  pista: 'media',
  // el portador inicial sale declarado: anillo naranja correcto en el
  // fotograma 0 de la vista previa (tiene_balon + portador_id).
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    return simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 6 });
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (jugadorPorId(res, 'A1')?.tiene_balon !== true) return ko('A1 (portador) debería salir con tiene_balon');
    if (!(res.balones || []).some((b) => b.portador_id === 'A1')) return ko('el balón debería declarar portador_id A1');
    if (res._sim?.semilla !== 6) return ko('data._sim.semilla debería reflejar la semilla usada');
    return ok();
  },
});

/* ====================================================================
   15. Defensa reactiva (Tramo 5a) — defensaReactiva(intent) inyecta
   `defiende { marca }` cuando el par declarado se mueve y el defensor
   no tiene evento; nunca inventa defensores ni pisa eventos propios.
   ==================================================================== */

casos.push({
  categoria: 'Defensa reactiva (Tramo 5)',
  nombre: 'reactiva_sigue_al_par_en_fase_posterior',
  pista: 'media',
  async run() {
    const { defensaReactiva } = await import('../js/ia/simulador.js');
    const { compilarAnimacion } = await import('../js/ia/compilador.js');
    const elementos = [jugador('A', 1, 0.6, 0.4), jugador('B', 1, 0.5, 0.45), balon(0.61, 0.41)];
    const intent = { canasta: 'norte', fases: [
      { eventos: [
        { jugador: 'A1', tipo: 'bote', hacia: { x: 0.45, y: 0.45 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
        { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
      ] },
      { eventos: [
        { jugador: 'A1', tipo: 'corte', hacia: { x: 0.3, y: 0.5 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
      ] },
    ] };
    return compilarAnimacion(defensaReactiva(intent, elementos, 'media'), elementos, 'media');
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const movB1f2 = (res.fases[1].movimientos || []).filter((m) => m.elemento_id === 'B1');
    if (movB1f2.length !== 1) return ko(`B1 debería seguir a su par (A1 se mueve en fase 2 y B1 no tenía evento); movimientos: ${movB1f2.length}`);
    if (!(res.fases[1].defensores || []).includes('B1')) return ko('B1 debería contar como defensor en la fase 2');
    return ok();
  },
});

casos.push({
  categoria: 'Defensa reactiva (Tramo 5)',
  nombre: 'reactiva_no_inventa_defensores',
  pista: 'media',
  async run() {
    const { defensaReactiva } = await import('../js/ia/simulador.js');
    const { compilarAnimacion } = await import('../js/ia/compilador.js');
    const elementos = [jugador('A', 1, 0.6, 0.4), jugador('B', 1, 0.5, 0.45), balon(0.61, 0.41)];
    const intent = { canasta: 'norte', fases: [
      { eventos: [{ jugador: 'A1', tipo: 'bote', hacia: { x: 0.4, y: 0.45 }, a: null, cono_id: null, marca: null, bloqueado_id: null }] },
      { eventos: [{ jugador: 'A1', tipo: 'tiro', hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null }] },
    ] };
    return compilarAnimacion(defensaReactiva(intent, elementos, 'media'), elementos, 'media');
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (apariciones(res, 'B1') !== 0) return ko('sin defensa declarada, B1 debería quedarse quieto (no se inventan defensores)');
    if (res.fases.some((f) => (f.defensores || []).length)) return ko('fase.defensores debería quedar vacío en todas las fases');
    return ok();
  },
});

casos.push({
  categoria: 'Defensa reactiva (Tramo 5)',
  nombre: 'reactiva_par_quieto_sigue_quieto',
  pista: 'media',
  async run() {
    const { defensaReactiva } = await import('../js/ia/simulador.js');
    const { compilarAnimacion } = await import('../js/ia/compilador.js');
    const elementos = [jugador('A', 1, 0.6, 0.4), jugador('A', 2, 0.5, 0.7), jugador('B', 1, 0.5, 0.45), balon(0.61, 0.41)];
    const intent = { canasta: 'norte', fases: [
      { eventos: [
        { jugador: 'A1', tipo: 'bote', hacia: { x: 0.45, y: 0.45 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
        { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
      ] },
      { eventos: [
        { jugador: 'A2', tipo: 'corte', hacia: { x: 0.35, y: 0.6 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
      ] },
    ] };
    return compilarAnimacion(defensaReactiva(intent, elementos, 'media'), elementos, 'media');
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const movB1f2 = (res.fases[1].movimientos || []).filter((m) => m.elemento_id === 'B1');
    if (movB1f2.length !== 0) return ko('el par de B1 (A1) está quieto en fase 2: B1 no debería recolocarse');
    return ok();
  },
});

casos.push({
  categoria: 'Defensa reactiva (Tramo 5)',
  nombre: 'reactiva_no_pisa_evento_propio',
  pista: 'media',
  async run() {
    const { defensaReactiva } = await import('../js/ia/simulador.js');
    const { compilarAnimacion } = await import('../js/ia/compilador.js');
    const elementos = [jugador('A', 1, 0.6, 0.4), jugador('B', 1, 0.5, 0.45), balon(0.61, 0.41)];
    const intent = { canasta: 'norte', fases: [
      { eventos: [
        { jugador: 'A1', tipo: 'bote', hacia: { x: 0.45, y: 0.45 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
        { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
      ] },
      { eventos: [
        { jugador: 'A1', tipo: 'corte', hacia: { x: 0.3, y: 0.5 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
        { jugador: 'B1', tipo: 'corte', hacia: { x: 0.35, y: 0.55 }, a: null, cono_id: null, marca: null, bloqueado_id: null },
      ] },
    ] };
    return compilarAnimacion(defensaReactiva(intent, elementos, 'media'), elementos, 'media');
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const movB1f2 = (res.fases[1].movimientos || []).filter((m) => m.elemento_id === 'B1');
    if (movB1f2.length !== 1) return ko(`B1 ya tiene su propio corte en fase 2: no debería inyectarse nada más (movimientos: ${movB1f2.length})`);
    if (movB1f2[0].tipo_movimiento !== 'corte') return ko('el movimiento de B1 debería seguir siendo su corte declarado');
    return ok();
  },
});

casos.push({
  categoria: 'Defensa reactiva (Tramo 5)',
  nombre: 'compilador_defiende_hacia_explicito',
  pista: 'media',
  esCompiladorDirecto: true,
  intent: { canasta: 'norte', fases: [
    { eventos: [
      { jugador: 'B1', tipo: 'defiende', hacia: { x: 0.3, y: 0.4 }, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
    ] },
    { eventos: [
      { jugador: 'B1', tipo: 'defiende', hacia: null, a: null, cono_id: null, marca: 'A1', bloqueado_id: null },
    ] },
  ] },
  elementos: [jugador('A', 1, 0.5, 0.3), jugador('B', 1, 0.45, 0.25), balon(0.51, 0.31)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    // fase 1: destino explícito EXACTO (Tramo 5: el simulador calcula el
    // punto final; el compilador no lo amortigua con el 0.7 legado).
    const m1 = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'B1');
    if (!m1) return ko('B1 debería moverse en fase 1 (defiende con marca y hacia)');
    const f1 = m1.path[m1.path.length - 1];
    if (dxy(f1.x, f1.y, 0.3, 0.4) > 1e-9) return ko(`con hacia explícito B1 debería acabar EXACTO en (0.3, 0.4); acaba en (${f1.x}, ${f1.y})`);
    // fase 2: sin hacia → fórmula goal-side legada intacta, desde (0.3, 0.4)
    const basket = PISTAS.media.baskets.norte;
    const denegar = { x: 0.5 + (basket[0] - 0.5) * 0.25, y: 0.3 + (basket[1] - 0.3) * 0.25 };
    const esperado = { x: 0.3 + (denegar.x - 0.3) * 0.7, y: 0.4 + (denegar.y - 0.4) * 0.7 };
    const m2 = (res.fases[1].movimientos || []).find((m) => m.elemento_id === 'B1');
    if (!m2) return ko('B1 debería moverse en fase 2 (defiende legado con marca)');
    const f2 = m2.path[m2.path.length - 1];
    if (dxy(f2.x, f2.y, esperado.x, esperado.y) > 1e-9) return ko(`la fórmula goal-side legada cambió: esperado (${esperado.x}, ${esperado.y}), obtuvo (${f2.x}, ${f2.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_propaga_inicio_fase_siguiente',
  pista: 'entera',
  sinGenerica: true,
  // Tramo 6.1: al editar el final de una fase, restPositions recoloca el
  // ARRANQUE de las fases siguientes. Es la garantía nuclear ("cambio una
  // cosa de sitio y lo de después se actualiza a partir de esa posición"),
  // verificable sin DOM sobre la función pura que usa el editor.
  async run() {
    const { restPositions } = await import('../js/canvas/rest-positions.js');
    const anim = {
      pista: 'entera',
      jugadores: [{ id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.5, 0.8], tiene_balon: false }],
      balones: [], conos: [],
      fases: [
        { id: 'f1', movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: [{ x: 0.5, y: 0.8 }, { x: 0.5, y: 0.5 }] }], pases: [], tiros: [], bloqueos: [] },
        { id: 'f2', movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.2 }] }], pases: [], tiros: [], bloqueos: [] },
      ],
    };
    const antes = restPositions(anim)[1].P.A1;
    // "arrastre" del nodo final de la fase 1 a otro sitio
    const pathF1 = anim.fases[0].movimientos[0].path;
    pathF1[pathF1.length - 1] = { x: 0.7, y: 0.4 };
    const despues = restPositions(anim)[1].P.A1;
    return { antes, despues };
  },
  check({ antes, despues }) {
    if (dxy(antes.x, antes.y, 0.5, 0.5) > 1e-9) return ko(`la fase 2 debía arrancar en el final original (0.5,0.5); arrancaba en (${antes.x}, ${antes.y})`);
    if (dxy(despues.x, despues.y, 0.7, 0.4) > 1e-9) return ko(`tras editar el final de la fase 1, la fase 2 debía arrancar en (0.7,0.4); arranca en (${despues.x}, ${despues.y})`);
    return ok();
  },
});

/* ---- Tramo 2.10: los nodos salen EN LA DIRECCIÓN DE LA FLECHA ----
   Antes salían siempre en horizontal, así que en una flecha que bajaba
   salían atravesados: curvar un nodo pegaba un tirón lateral que nadie
   había pedido. Tangentes, curvar no cambia el trazo. */

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'nodo_curva_en_la_direccion_de_la_flecha',
  pista: 'entera',
  sinGenerica: true,
  async run() {
    const { manejadoresTangentes } = await import('../js/canvas/geometry.js');
    // flecha que BAJA en vertical: los manejadores tienen que bajar con ella
    const vertical = [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.8 }];
    // y una en diagonal, para que no valga con acertar en un eje
    const diagonal = [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.8 }];
    return {
      v: manejadoresTangentes(vertical, 1, 0.02),
      d: manejadoresTangentes(diagonal, 1, 0.02),
      extremo: manejadoresTangentes(vertical, 2, 0.02),
    };
  },
  check({ v, d, extremo }) {
    if (Math.abs(v.handle_in.x - 0.5) > 1e-9 || Math.abs(v.handle_out.x - 0.5) > 1e-9) {
      return ko(`en una flecha vertical los manejadores no deben salirse de la vertical: ${JSON.stringify(v)}`);
    }
    if (!(v.handle_in.y < 0.5 && v.handle_out.y > 0.5)) return ko('uno tiene que ir hacia atrás y el otro hacia delante');
    if (Math.abs(v.handle_out.y - 0.6) > 1e-9) return ko(`el largo es un tercio del segmento (0,1): ${v.handle_out.y}`);
    // diagonal: la tangente mantiene la pendiente 1
    const dx = d.handle_out.x - 0.5, dy = d.handle_out.y - 0.5;
    if (Math.abs(dx - dy) > 1e-9) return ko(`en diagonal la tangente debe conservar la pendiente: ${JSON.stringify(d)}`);
    // último nodo: solo hay segmento por detrás, y sigue en su dirección
    if (Math.abs(extremo.handle_out.x - 0.5) > 1e-9) return ko('en el extremo la dirección la da el único segmento que hay');
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'nodo_curvado_no_mueve_el_trazo',
  pista: 'entera',
  sinGenerica: true,
  // La prueba de que salen tangentes: curvar un nodo y aplanar el path
  // tiene que dar (casi) la misma polilínea. Con los manejadores en
  // horizontal, el trazo se iba de sitio al curvar.
  async run() {
    const { manejadoresTangentes, flattenPath } = await import('../js/canvas/geometry.js');
    // recta en diagonal: todos sus puntos cumplen x = y
    const curvo = [{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.8 }];
    Object.assign(curvo[1], manejadoresTangentes(curvo, 1, 0.02), { tipo_nodo: 'bezier' });
    const puntos = flattenPath(curvo);
    let peor = 0;
    for (const p of puntos) peor = Math.max(peor, Math.abs(p.x - p.y));
    return { peor, primero: puntos[0], ultimo: puntos[puntos.length - 1] };
  },
  check({ peor, primero, ultimo }) {
    if (peor > 1e-9) return ko(`curvar un nodo tangente no debe torcer una flecha recta; se ha ido ${peor.toFixed(5)}`);
    if (dxy(primero.x, primero.y, 0.2, 0.2) > 1e-9) return ko('y los extremos no se mueven');
    if (dxy(ultimo.x, ultimo.y, 0.8, 0.8) > 1e-9) return ko('y los extremos no se mueven');
    return ok();
  },
});

/* Tramo 6.3 — reanclado de flechas. restPositions ya recolocaba las
   FICHAS (caso de arriba), pero las flechas son coordenadas guardadas y
   se quedaban donde estaban: el jugador aparecía en su sitio nuevo y su
   flecha seguía saliendo del viejo. Medido sobre la biblioteca real:
   2,1 m de separación entre un jugador y el origen de su propia flecha. */

const animEdicion = () => ({
  pista: 'media',
  jugadores: [
    { id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.62, 0.28], tiene_balon: true },
    { id: 'A2', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.62, 0.72], tiene_balon: false },
  ],
  balones: [{ id: 'b1', posicion_inicial: [0.62, 0.28], portador_id: 'A1' }],
  conos: [],
  fases: [
    { id: 'f1', movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: [{ x: 0.62, y: 0.28 }, { x: 0.45, y: 0.35 }] }], pases: [], tiros: [], bloqueos: [] },
    { id: 'f2', movimientos: [], pases: [{ id: 'p1', de_id: 'A1', a_id: 'A2', balon_id: 'b1', path: [{ x: 0.45, y: 0.35 }, { x: 0.62, y: 0.72 }] }], tiros: [], bloqueos: [] },
    { id: 'f3', movimientos: [{ elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: [{ x: 0.62, y: 0.72 }, { x: 0.3, y: 0.6 }] }], pases: [], tiros: [], bloqueos: [] },
  ],
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_reancla_flecha_de_la_fase_siguiente',
  pista: 'media',
  sinGenerica: true,
  async run() {
    const { reanclarPaths } = await import('../js/canvas/rest-positions.js');
    const anim = animEdicion();
    // el entrenador arrastra el final del bote de la fase 1
    const p = anim.fases[0].movimientos[0].path;
    p[p.length - 1] = { x: 0.25, y: 0.5 };
    const pase = anim.fases[1].pases[0];
    const antes = { ...pase.path[0] };
    reanclarPaths(anim);
    return { antes, despues: pase.path[0], destino: pase.path[1] };
  },
  check({ antes, despues, destino }) {
    if (dxy(antes.x, antes.y, 0.45, 0.35) > 1e-9) return ko('el pase debía salir del punto viejo antes de reanclar');
    if (dxy(despues.x, despues.y, 0.25, 0.5) > 1e-9) return ko(`el pase debía salir de donde acabó el bote (0.25, 0.5); sale de (${despues.x}, ${despues.y})`);
    if (dxy(destino.x, destino.y, 0.62, 0.72) > 1e-9) return ko(`el destino del pase debía seguir en el receptor (0.62, 0.72); está en (${destino.x}, ${destino.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_reancla_en_cadena_dos_fases_por_delante',
  pista: 'media',
  sinGenerica: true,
  // No basta con arreglar la fase siguiente: el receptor recibe donde
  // está, y de ahí arranca SU flecha dos fases después.
  async run() {
    const { reanclarPaths } = await import('../js/canvas/rest-positions.js');
    const anim = animEdicion();
    // ahora se mueve al receptor: se arrastra el final de su carrera
    anim.jugadores[1].posicion_inicial = [0.7, 0.9];
    reanclarPaths(anim);
    return {
      finPase: anim.fases[1].pases[0].path[1],
      inicioF3: anim.fases[2].movimientos[0].path[0],
      finF3: anim.fases[2].movimientos[0].path.at(-1),
    };
  },
  check({ finPase, inicioF3, finF3 }) {
    if (dxy(finPase.x, finPase.y, 0.7, 0.9) > 1e-9) return ko(`el pase debía llegar al receptor (0.7, 0.9); llega a (${finPase.x}, ${finPase.y})`);
    if (dxy(inicioF3.x, inicioF3.y, 0.7, 0.9) > 1e-9) return ko(`la flecha de la fase 3 debía arrancar en (0.7, 0.9); arranca en (${inicioF3.x}, ${inicioF3.y})`);
    if (dxy(finF3.x, finF3.y, 0.3, 0.6) > 1e-9) return ko('el DESTINO de la fase 3 es del entrenador y no se debe tocar');
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_reanclar_no_toca_los_nodos_de_en_medio',
  pista: 'media',
  sinGenerica: true,
  // La curva que dibuja el entrenador es suya. Solo se recalculan los
  // nodos que son CONSECUENCIA de dónde está la ficha.
  async run() {
    const { reanclarPaths } = await import('../js/canvas/rest-positions.js');
    const anim = animEdicion();
    const p = anim.fases[0].movimientos[0].path;
    p.splice(1, 0, { x: 0.55, y: 0.1, tipo_nodo: 'lineal' });   // rodeo a mano
    anim.jugadores[0].posicion_inicial = [0.8, 0.2];            // y se mueve la salida
    const tocado = reanclarPaths(anim);
    return { tocado, ini: p[0], medio: p[1], fin: p[2] };
  },
  check({ tocado, ini, medio, fin }) {
    if (!tocado) return ko('reanclarPaths debía avisar de que ha movido algo');
    if (dxy(ini.x, ini.y, 0.8, 0.2) > 1e-9) return ko(`el origen debía seguir a la ficha (0.8, 0.2); está en (${ini.x}, ${ini.y})`);
    if (dxy(medio.x, medio.y, 0.55, 0.1) > 1e-9) return ko('el nodo de en medio es del entrenador y no se debe tocar');
    if (dxy(fin.x, fin.y, 0.45, 0.35) > 1e-9) return ko('el destino es del entrenador y no se debe tocar');
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_reanclar_es_idempotente',
  pista: 'media',
  sinGenerica: true,
  // Sobre una animación ya coherente no debe cambiar NADA: si no, el
  // editor marcaría el ejercicio como sucio solo por abrirlo.
  async run() {
    const { reanclarPaths } = await import('../js/canvas/rest-positions.js');
    const anim = animEdicion();
    const primera = reanclarPaths(anim);
    const foto = JSON.stringify(anim);
    const segunda = reanclarPaths(anim);
    return { primera, segunda, igual: foto === JSON.stringify(anim) };
  },
  check({ primera, segunda, igual }) {
    if (primera) return ko('una animación recién compilada ya es coherente: no debía tocarse nada');
    if (segunda) return ko('reanclar dos veces seguidas debía ser inofensivo');
    if (!igual) return ko('la segunda pasada cambió la animación');
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_nodos_fijos_no_se_pueden_arrastrar',
  pista: 'media',
  sinGenerica: true,
  async run() {
    const { nodosFijos } = await import('../js/canvas/rest-positions.js');
    return {
      mov: [...nodosFijos('run', 3)].sort(),
      corte: [...nodosFijos('cut', 2)].sort(),
      pase: [...nodosFijos('pass', 2)].sort(),
      paseCurvo: [...nodosFijos('pass', 4)].sort(),
    };
  },
  check({ mov, corte, pase, paseCurvo }) {
    const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!eq(mov, [0])) return ko(`en un movimiento solo se ancla el origen; salió ${JSON.stringify(mov)}`);
    if (!eq(corte, [0])) return ko(`en un corte solo se ancla el origen; salió ${JSON.stringify(corte)}`);
    if (!eq(pase, [0, 1])) return ko(`en un pase se anclan los dos extremos; salió ${JSON.stringify(pase)}`);
    if (!eq(paseCurvo, [0, 3])) return ko(`en un pase curvo se anclan los extremos y NO los de en medio; salió ${JSON.stringify(paseCurvo)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_destino_reresuelve_defensa',
  pista: 'media',
  sinGenerica: true,
  // Tramo 6.2: mover el destino de un ATACANTE (op 'destino' → intención)
  // re-resuelve: la defensa reactiva se recoloca goal-side del NUEVO punto.
  async run() {
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const elementos = [jugador('A', 1, 0.5, 0.3), jugador('B', 1, 0.45, 0.25), balon(0.51, 0.31, 'b6a')];
    const base = { intent: { canasta: 'norte', fases: [
      { eventos: [ev('A1', 'bote', { hacia: 'canasta' }), ev('B1', 'defiende', { marca: 'A1' })] },
    ] } };
    const editado = resolverAnimacion(base, [{ fase: 0, elemento: 'A1', op: 'destino', valor: { x: 0.3, y: 0.4 } }], elementos, 'media');
    return { editado };
  },
  check({ editado }) {
    if (!esExito(editado)) return ko(`se esperaba animación, llegó ${forma(editado)}`);
    const mA = (editado.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    const fA = mA && mA.path[mA.path.length - 1];
    if (!fA || dxy(fA.x, fA.y, 0.3, 0.4) > 1e-9) return ko('A1 debía acabar EXACTO en el destino editado (0.3,0.4)');
    // B1 goal-side del NUEVO punto de A1 (misma fórmula legada del compilador)
    const basket = PISTAS.media.baskets.norte;
    const denegar = { x: 0.3 + (basket[0] - 0.3) * 0.25, y: 0.4 + (basket[1] - 0.4) * 0.25 };
    const esperado = { x: 0.45 + (denegar.x - 0.45) * 0.7, y: 0.25 + (denegar.y - 0.25) * 0.7 };
    const mB = (editado.fases[0].movimientos || []).find((m) => m.elemento_id === 'B1');
    const fB = mB && mB.path[mB.path.length - 1];
    if (!fB) return ko('B1 debía re-reaccionar (moverse) al nuevo punto de A1');
    if (dxy(fB.x, fB.y, esperado.x, esperado.y) > 1e-9) return ko(`B1 no se recolocó goal-side del nuevo punto: esperado (${esperado.x.toFixed(4)},${esperado.y.toFixed(4)}), obtuvo (${fB.x.toFixed(4)},${fB.y.toFixed(4)})`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_destino_propaga_a_movimiento_fase_siguiente',
  pista: 'entera',
  sinGenerica: true,
  // Garantía nuclear REAL: al fijar el destino de un elemento que se MUEVE otra
  // vez en la fase siguiente, el ARRANQUE de ese segundo movimiento (path[0], lo
  // que el motor samplea) se recoloca en el punto editado — no solo el
  // diccionario de reposo (que el motor ignora para un elemento que se mueve).
  // Va por la cadena intención→compilador (op 'destino'), la que de verdad
  // propaga. Complementa a edit_propaga_inicio_fase_siguiente (que solo comprueba
  // restPositions, válido para elementos QUIETOS).
  async run() {
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const elementos = [jugador('A', 1, 0.5, 0.8)];
    const base = { intent: { canasta: 'norte', fases: [
      { eventos: [ev('A1', 'bote', { hacia: 'canasta' })] },
      { eventos: [ev('A1', 'bote', { hacia: 'canasta' })] },
    ] } };
    const editado = resolverAnimacion(base, [{ fase: 0, elemento: 'A1', op: 'destino', valor: { x: 0.7, y: 0.4 } }], elementos, 'entera');
    return { editado };
  },
  check({ editado }) {
    if (!esExito(editado)) return ko(`se esperaba animación, llegó ${forma(editado)}`);
    const m0 = (editado.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    const fin0 = m0 && m0.path[m0.path.length - 1];
    if (!fin0 || dxy(fin0.x, fin0.y, 0.7, 0.4) > 1e-9) return ko('A1 debía acabar la fase 1 en el destino editado (0.7,0.4)');
    const m1 = (editado.fases[1].movimientos || []).find((m) => m.elemento_id === 'A1');
    const ini1 = m1 && m1.path[0];
    if (!ini1) return ko('A1 debía seguir moviéndose en la fase 2');
    if (dxy(ini1.x, ini1.y, 0.7, 0.4) > 1e-9) return ko(`el movimiento de A1 en la fase 2 debía arrancar en el punto editado (0.7,0.4); arranca en (${ini1.x}, ${ini1.y}) → teletransporte`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'rest_positions_balon_al_aro_tras_tiro',
  pista: 'entera',
  sinGenerica: true,
  // Tras un tiro el balón queda en el ARO (último nodo del path del tiro), igual
  // que engine.js#_build: el editor pinta las fases posteriores al tiro desde
  // restPositions, así que si no avanzara al aro se vería flotando en la mano del
  // tirador (editor ≠ reproducción).
  async run() {
    const { restPositions } = await import('../js/canvas/rest-positions.js');
    const anim = {
      pista: 'entera',
      jugadores: [{ id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.5, 0.5], tiene_balon: true }],
      balones: [{ id: 'b1', posicion_inicial: [0.5, 0.5], portador_id: 'A1' }],
      conos: [],
      fases: [
        { id: 'f1', movimientos: [], pases: [], bloqueos: [], tiros: [{ jugador_id: 'A1', balon_id: 'b1', canasta: 'norte', path: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.08 }] }] },
        { id: 'f2', movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.8 }] }], pases: [], bloqueos: [], tiros: [] },
      ],
    };
    return { b: restPositions(anim)[1].B.b1 };
  },
  check({ b }) {
    if (!b) return ko('el balón debería existir al inicio de la fase 2');
    if (dxy(b.x, b.y, 0.5, 0.08) > 1e-9) return ko(`tras el tiro el balón debía quedar en el aro (0.5,0.08); quedó en (${b.x}, ${b.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_ruta_distingue_movimiento_y_pase_mismo_jugador',
  pista: 'entera',
  sinGenerica: true,
  // Un jugador con movimiento Y pase en la MISMA fase: una 'ruta' kind='mov' toca
  // solo el movimiento y otra kind='pase' solo el pase (antes el resolver
  // localizaba por id y el movimiento ganaba siempre, corrompiendo el bote al
  // editar el pase y colisionando en la clave de upsertEdicion).
  async run() {
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const elementos = [jugador('A', 1, 0.5, 0.6), jugador('A', 2, 0.3, 0.4)];
    const base = { intent: { canasta: 'norte', fases: [
      { eventos: [ev('A1', 'bote', { hacia: 'canasta' }), ev('A1', 'pase', { a: 'A2' })] },
    ] } };
    const pMov = [{ x: 0.5, y: 0.6 }, { x: 0.55, y: 0.35 }];
    const pPase = [{ x: 0.55, y: 0.35 }, { x: 0.31, y: 0.41 }];
    const editado = resolverAnimacion(base, [
      { fase: 0, elemento: 'A1', op: 'ruta', kind: 'mov', valor: pMov },
      { fase: 0, elemento: 'A1', op: 'ruta', kind: 'pase', valor: pPase },
    ], elementos, 'entera');
    return { editado };
  },
  check({ editado }) {
    if (!esExito(editado)) return ko(`se esperaba animación, llegó ${forma(editado)}`);
    const mov = (editado.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1');
    const pase = (editado.fases[0].pases || []).find((p) => p.de_id === 'A1');
    if (!mov || !pase) return ko('A1 debía tener movimiento Y pase en la fase 1');
    const fmov = mov.path[mov.path.length - 1];
    if (dxy(fmov.x, fmov.y, 0.55, 0.35) > 1e-9) return ko(`el movimiento de A1 debía conservar su ruta (…0.55,0.35); acaba en (${fmov.x},${fmov.y}) — ¿lo pisó el pase?`);
    const fpase = pase.path[pase.path.length - 1];
    if (dxy(fpase.x, fpase.y, 0.31, 0.41) > 1e-9) return ko(`el pase de A1 debía tomar su ruta (…0.31,0.41); acaba en (${fpase.x},${fpase.y})`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'defensa_reactiva_marca_eventos_inyectados',
  pista: 'media',
  sinGenerica: true,
  // Los 'defiende' que defensaReactiva INYECTA llevan _reactiva:true; los
  // DECLARADOS por el entrenador, no. El editor (paso2.js#derivarOps) lo usa para
  // no emitir 'destino' al arrastrar un defensor reactivo (se conserva como trazo
  // y sigue re-reaccionando).
  async run() {
    const { defensaReactiva } = await import('../js/ia/simulador.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const elementos = [jugador('A', 1, 0.5, 0.6), jugador('B', 1, 0.45, 0.55)];
    const intent = { canasta: 'norte', fases: [
      { eventos: [ev('A1', 'bote', { hacia: 'canasta' }), ev('B1', 'defiende', { marca: 'A1' })] },
      { eventos: [ev('A1', 'bote', { hacia: 'canasta' })] }, // B1 sin evento → defensa reactiva lo inyecta
    ] };
    return { out: defensaReactiva(intent, elementos, 'media') };
  },
  check({ out }) {
    const f1 = (out.fases[0].eventos || []).find((e) => e.jugador === 'B1' && e.tipo === 'defiende');
    if (!f1) return ko('B1 debía tener su defiende declarado en la fase 1');
    if (f1._reactiva) return ko('el defiende DECLARADO de la fase 1 no debe marcarse como reactivo');
    const f2 = (out.fases[1].eventos || []).find((e) => e.jugador === 'B1' && e.tipo === 'defiende');
    if (!f2) return ko('B1 debía seguir a A1 en la fase 2 (defensa reactiva)');
    if (!f2._reactiva) return ko('el defiende INYECTADO de la fase 2 debía marcarse _reactiva:true');
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_ruta_se_preserva',
  pista: 'entera',
  sinGenerica: true,
  // op 'ruta' (curvas/waypoints): se conserva TAL CUAL sobre la geometría.
  async run() {
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const elementos = [jugador('A', 1, 0.5, 0.8), balon(0.5, 0.8, 'b6b')];
    const base = { intent: { canasta: 'norte', fases: [{ eventos: [ev('A1', 'corte', { hacia: 'canasta' })] }] } };
    const ruta = [{ x: 0.5, y: 0.8, tipo_nodo: 'lineal' }, { x: 0.3, y: 0.6, tipo_nodo: 'lineal' }, { x: 0.6, y: 0.4, tipo_nodo: 'lineal' }];
    return { r: resolverAnimacion(base, [{ fase: 0, elemento: 'A1', op: 'ruta', valor: ruta }], elementos, 'entera'), ruta };
  },
  check({ r, ruta }) {
    if (!esExito(r)) return ko(`se esperaba animación, llegó ${forma(r)}`);
    const m = (r.fases[0].movimientos || []).find((x) => x.elemento_id === 'A1');
    if (!m) return ko('A1 debería moverse en fase 1');
    if (JSON.stringify(m.path) !== JSON.stringify(ruta)) return ko('el trazo editado (ruta) no se conservó tal cual');
    if ((r._descartadas || []).length) return ko(`no debía descartar nada: ${JSON.stringify(r._descartadas)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_resolver_determinista',
  pista: 'media',
  sinGenerica: true,
  // misma base + mismas ediciones ⇒ geometría idéntica byte a byte.
  async run() {
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const mk = () => [jugador('A', 1, 0.5, 0.3), jugador('B', 1, 0.45, 0.25), balon(0.51, 0.31, 'b6c')];
    const base = { intent: { canasta: 'norte', fases: [{ eventos: [ev('A1', 'bote', { hacia: 'canasta' }), ev('B1', 'defiende', { marca: 'A1' })] }] } };
    const eds = [{ fase: 0, elemento: 'A1', op: 'destino', valor: { x: 0.33, y: 0.44 } }];
    return { a: resolverAnimacion(base, eds, mk(), 'media'), b: resolverAnimacion(base, eds, mk(), 'media') };
  },
  check({ a, b }) {
    if (!esExito(a)) return ko(`se esperaba animación, llegó ${forma(a)}`);
    if (JSON.stringify(a) !== JSON.stringify(b)) return ko('misma base+ediciones dio geometría distinta (no determinista)');
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_sobrevive_regenerar_y_avisa',
  pista: 'entera',
  sinGenerica: true,
  // los retoques que encajan se aplican; los que no, se AVISAN (_descartadas),
  // nunca se pierden en silencio al re-resolver sobre otra base.
  async run() {
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const ev = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });
    const elementos = [jugador('A', 1, 0.5, 0.8), balon(0.5, 0.8, 'b6d')];
    const base = { intent: { canasta: 'norte', fases: [{ eventos: [ev('A1', 'corte', { hacia: 'canasta' })] }] } };
    const ruta = [{ x: 0.5, y: 0.8 }, { x: 0.4, y: 0.5 }];
    const eds = [
      { fase: 0, elemento: 'A1', op: 'ruta', valor: ruta },
      { fase: 0, elemento: 'FANTASMA', op: 'destino', valor: { x: 0.2, y: 0.2 } },
    ];
    return { r: resolverAnimacion(base, eds, elementos, 'entera'), ruta };
  },
  check({ r, ruta }) {
    if (!esExito(r)) return ko(`se esperaba animación, llegó ${forma(r)}`);
    const m = (r.fases[0].movimientos || []).find((x) => x.elemento_id === 'A1');
    if (!m || JSON.stringify(m.path) !== JSON.stringify(ruta)) return ko('el retoque que SÍ encaja debía aplicarse');
    const d = r._descartadas || [];
    if (d.length !== 1 || d[0].elemento !== 'FANTASMA') return ko(`el retoque que no encaja debía avisarse (1 descartada FANTASMA); descartadas=${JSON.stringify(d)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Edición manual (Tramo 6)',
  nombre: 'edit_resolver_reproduce_simulacion',
  pista: 'media',
  sinGenerica: true,
  // re-resolver el intent de una simulación SIN ediciones reproduce su
  // geometría exacta (mismo camino defensaReactiva→compilar): editar y
  // re-resolver no deforma lo que ya había.
  async run() {
    const { simularJugada } = await import('../js/ia/simulador.js');
    const { resolverAnimacion } = await import('../js/ia/resolver.js');
    const sim = simularJugada({ elementos: tablero2v2(), pista: 'media', semilla: 3 });
    const re = resolverAnimacion({ intent: sim._intent }, [], tablero2v2(), 'media');
    return { sim, re };
  },
  check({ sim, re }) {
    if (!esExito(sim) || !esExito(re)) return ko(`se esperaban animaciones (${forma(sim)}, ${forma(re)})`);
    const campos = (o) => JSON.stringify({ jugadores: o.jugadores, balones: o.balones, conos: o.conos, fases: o.fases, canasta: o.canasta });
    if (campos(sim) !== campos(re)) return ko('re-resolver el intent de la simulación no reprodujo su geometría');
    return ok();
  },
});

/* ====================================================================
   Geometría que probaba el lector de texto (Tramo 2.11)

   Estos seis casos entraban por el extractor por regex, que se ha
   retirado con el camino de IA. Lo que comprobaban NO era el extractor
   sino el COMPILADOR —el arco alrededor de un cono, el eslalon, que un
   jugador al que nadie ha nombrado no se mueva—, así que se han
   reescrito con el intent puesto a mano. La cobertura es la misma; lo
   que ha desaparecido es el intermediario que adivinaba.
   ==================================================================== */

casos.push({
  categoria: 'Rodear conos',
  nombre: 'rodear_un_solo_cono_arco_limpio',
  // Rodear UN cono produce un contorno curvo: ≥2 puntos de paso pegados
  // al cono y/o nodos Bézier. Antes se metía un único punto lateral con
  // nodos lineales (pico anguloso); arreglado.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5), cono(0.5, 0.5, 'rodear', null, 'cono_r1')],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('A1', 'bote', { hacia: 'canasta' }), evIA('A1', 'rodea_cono', { cono_id: 'cono_r1' })] },
      { eventos: [evIA('A1', 'tiro')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1' && /balon/.test(m.tipo_movimiento || ''));
    if (!mv) return ko('A1 no tiene movimiento con balón en la primera fase');
    const path = mv.path || [];
    const intermedios = path.slice(1, -1).filter((n) => dxy(n.x, n.y, 0.5, 0.5) <= 0.12).length;
    const hayCurva = path.some((n) => n.tipo_nodo && n.tipo_nodo !== 'lineal');
    if (intermedios >= 2 || hayCurva) return ok();
    return ko(`el path no RODEA el cono: ${intermedios} nodo(s) intermedio(s) junto al cono y todos lineales (desvío anguloso de un solo punto en vez de un arco)`);
  },
});

casos.push({
  categoria: 'Rodear conos',
  nombre: 'rodear_tres_conos_slalom',
  // Tres conos en línea hacia el aro: el bote debe zigzaguear
  // alternando el lado de cada cono, en orden de avance.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.85, 0.5), balon(0.86, 0.5),
    cono(0.65, 0.5, 'rodear', null, 'cono_r1'),
    cono(0.5, 0.5, 'rodear', null, 'cono_r2'),
    cono(0.35, 0.5, 'rodear', null, 'cono_r3'),
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [
        evIA('A1', 'bote', { hacia: 'canasta' }),
        evIA('A1', 'rodea_cono', { cono_id: 'cono_r1' }),
        evIA('A1', 'rodea_cono', { cono_id: 'cono_r2' }),
        evIA('A1', 'rodea_cono', { cono_id: 'cono_r3' }),
      ] },
      { eventos: [evIA('A1', 'tiro')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1' && /balon/.test(m.tipo_movimiento || ''));
    if (!mv) return ko('A1 no tiene movimiento con balón en la primera fase');
    const path = mv.path || [];
    if (path.length < 5) return ko(`path de ${path.length} nodos; un slalom de 3 conos necesita al menos 5`);
    // para cada cono (en orden de avance), el nodo INTERMEDIO más cercano
    // debe estar pegado a él y alternar de lado. Se excluyen el primer y
    // el último nodo: son el arranque y el final, no pasos de slalom.
    const conosX = [0.65, 0.5, 0.35];
    const lados = [];
    const intermedios = path.slice(1, -1);
    for (const cx of conosX) {
      let mejor = null, mejorD = Infinity;
      for (const n of intermedios) { const d = dxy(n.x, n.y, cx, 0.5); if (d < mejorD) { mejorD = d; mejor = n; } }
      if (mejorD > 0.12) return ko(`ningún nodo del path pasa junto al cono en x=${cx} (mínimo ${mejorD.toFixed(3)})`);
      const off = mejor.y - 0.5;
      if (Math.abs(off) < 0.02) return ko(`el paso por el cono en x=${cx} no se separa lateralmente (offset ${off.toFixed(3)})`);
      lados.push(Math.sign(off));
    }
    for (let i = 1; i < lados.length; i++) {
      if (lados[i] === lados[i - 1]) return ko(`el slalom no alterna de lado entre el cono ${i} y el ${i + 1} (lados: ${lados.join(', ')})`);
    }
    return ok();
  },
});

casos.push({
  categoria: 'Movimiento parcial',
  nombre: 'parcial_seis_jugadores_solo_dos_implicados',
  // 6 jugadores en pista y solo dos nombrados: el resto NO debe recibir
  // movimientos, pases ni tiros en ninguna fase.
  esCompiladorDirecto: true,
  pista: 'entera',
  elementos: [
    jugador('A', 1, 0.5, 0.72), jugador('A', 2, 0.38, 0.66),
    jugador('A', 3, 0.62, 0.66), jugador('A', 4, 0.3, 0.5),
    jugador('A', 5, 0.7, 0.5), jugador('B', 1, 0.5, 0.4),
    balon(0.51, 0.72),
  ],
  intent: {
    canasta: 'sur',
    fases: [
      { eventos: [evIA('A1', 'bote', { hacia: 'canasta' }), evIA('A2', 'corte', { hacia: 'canasta' })] },
      { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
      { eventos: [evIA('A2', 'tiro')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!apariciones(res, 'A1')) return ko('A1 (el protagonista) no participa en ninguna fase');
    if (!todosPases(res).some((p) => p.de_id === 'A1' && p.a_id === 'A2')) return ko('no hay pase de A1 a A2');
    if (!todosTiros(res).some((t) => t.jugador_id === 'A2')) return ko('A2 no llega a tirar');
    const quietos = ['A3', 'A4', 'A5', 'B1'];
    const movidos = quietos.filter((id) => apariciones(res, id) > 0);
    if (movidos.length) return ko(`jugadores a los que nadie ha nombrado reciben acciones: ${movidos.join(', ')}`);
    return ok();
  },
});

casos.push({
  categoria: 'Movimiento parcial',
  nombre: 'parcial_defensores_del_hombre_quieto_no_se_mueven',
  // B1 marca al portador (que se mueve) y debe recolocarse; B2 marca a
  // nadie y NO debe moverse, pero sigue contando como defensor.
  esCompiladorDirecto: true,
  pista: 'entera',
  elementos: [
    jugador('A', 1, 0.5, 0.75), jugador('A', 2, 0.3, 0.7),
    jugador('A', 3, 0.72, 0.5), jugador('A', 4, 0.2, 0.4),
    jugador('B', 1, 0.5, 0.7), jugador('B', 2, 0.75, 0.55),
    balon(0.51, 0.76),
  ],
  intent: {
    canasta: 'sur',
    fases: [
      { eventos: [
        evIA('A1', 'bote', { hacia: 'canasta' }), evIA('A2', 'corte', { hacia: 'canasta' }),
        evIA('B1', 'defiende', { marca: 'A1' }), evIA('B2', 'defiende', { marca: null }),
      ] },
      { eventos: [evIA('A1', 'pase', { a: 'A2' }), evIA('B1', 'defiende', { marca: null }), evIA('B2', 'defiende', { marca: null })] },
      { eventos: [evIA('A2', 'tiro'), evIA('B1', 'defiende', { marca: null }), evIA('B2', 'defiende', { marca: null })] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!res.fases.every((f) => mismoConjunto(f.defensores || [], ['B1', 'B2']))) return ko('fase.defensores no es {B1,B2} en todas las fases');
    if (!(res.fases[0].movimientos || []).some((m) => m.elemento_id === 'B1')) return ko('B1 marca al portador y debería recolocarse en la fase 1');
    const quietos = ['A3', 'A4', 'B2'].filter((id) => apariciones(res, id) > 0);
    if (quietos.length) return ko(`deberían quedarse quietos y actúan: ${quietos.join(', ')}`);
    return ok();
  },
});

casos.push({
  categoria: 'Límites y varios',
  nombre: 'jugador_unico_sin_balon_tiro_directo',
  // Un único jugador y ningún balón en el tablero: el compilador
  // sintetiza un balón en sus manos y resuelve con tiro directo.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [jugador('A', 1, 0.5, 0.5)],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('A1', 'bote', { hacia: 'aro' })] },
      { eventos: [evIA('A1', 'tiro')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!Array.isArray(res.balones) || res.balones.length !== 1) return ko(`se esperaba exactamente 1 balón sintetizado; hay ${(res.balones || []).length}`);
    if (res.balones[0].portador_id !== 'A1') return ko(`el balón sintetizado no está en manos de A1 (portador_id='${res.balones[0].portador_id}')`);
    const tiros = todosTiros(res);
    if (tiros.length !== 1 || tiros[0].jugador_id !== 'A1') return ko(`se esperaba un único tiro de A1; hay ${tiros.length} (${tiros.map((t) => t.jugador_id).join(', ')})`);
    if (res.fases.length < 2) return ko(`animación demasiado corta (${res.fases.length} fase)`);
    return ok();
  },
});

casos.push({
  categoria: 'Límites y varios',
  nombre: 'passthrough_id_de_balon_y_dorsal',
  // Los datos del tablero deben sobrevivir el viaje: id del balón en
  // pases/tiros y dorsal/nombre del jugador.
  esCompiladorDirecto: true,
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.7, 0.5, { dorsal: 7, nombre: 'Ana' }),
    jugador('A', 2, 0.5, 0.35),
    balon(0.71, 0.5, 'balon_7'),
  ],
  intent: {
    canasta: 'norte',
    fases: [
      { eventos: [evIA('A2', 'corte', { hacia: 'canasta' })] },
      { eventos: [evIA('A1', 'pase', { a: 'A2' })] },
      { eventos: [evIA('A2', 'tiro')] },
    ],
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!res.balones.some((b) => b.id === 'balon_7')) return ko(`el balón del tablero ('balon_7') no conserva su id: ${res.balones.map((b) => b.id).join(', ')}`);
    const pase = todosPases(res)[0];
    if (!pase) return ko('no hay ningún pase');
    if (pase.balon_id !== 'balon_7') return ko(`el pase usa balon_id '${pase.balon_id}' en vez de 'balon_7'`);
    if (pase.de_id === pase.a_id) return ko('pase de un jugador a sí mismo');
    if (!todosTiros(res).every((t) => t.balon_id === 'balon_7')) return ko('el tiro no usa el balón del tablero');
    const a1 = jugadorPorId(res, 'A1');
    if (!a1 || a1.dorsal !== 7 || a1.nombre !== 'Ana') return ko(`A1 pierde dorsal/nombre por el camino: ${JSON.stringify({ dorsal: a1 && a1.dorsal, nombre: a1 && a1.nombre })}`);
    return ok();
  },
});

/* ====================================================================
   RUNNER
   ==================================================================== */
console.log(`eval-animacion — ${casos.length} casos · Node ${process.version}`);

let pasan = 0;
const fallidos = [];
let categoriaActual = '';

for (const caso of casos) {
  if (caso.categoria !== categoriaActual) {
    categoriaActual = caso.categoria;
    console.log(`\n-- ${categoriaActual} --`);
  }
  let veredicto;
  try {
    const res = await runGenerator(caso);
    const genericos = caso.sinGenerica ? [] : validacionGenerica(res, caso.pista);
    const especifico = caso.check(res);
    const pass = genericos.length === 0 && especifico.pass;
    const motivo = [...genericos.map((m) => `[genérica] ${m}`), ...(especifico.pass ? [] : [especifico.motivo])].join(' | ');
    veredicto = { pass, motivo };
  } catch (e) {
    veredicto = { pass: false, motivo: `excepción durante el caso: ${(e && e.stack) || e}` };
  }
  if (veredicto.pass) {
    pasan++;
    console.log(`PASS ${caso.nombre}`);
  } else {
    fallidos.push(caso);
    console.log(`FAIL ${caso.nombre}: ${veredicto.motivo}`);
  }
}

console.log('\n============================================================');
console.log(`Resumen: ${pasan}/${casos.length} pasaron (${fallidos.length} fallos)`);

const esperados = fallidos.filter((c) => c.falloEsperadoHoy);
const sorpresas = fallidos.filter((c) => !c.falloEsperadoHoy);
const curados = casos.filter((c) => c.falloEsperadoHoy && !fallidos.includes(c));
if (esperados.length) console.log(`Fallos esperados hoy (bugs conocidos): ${esperados.length}\n${esperados.map((c) => `  - ${c.nombre}`).join('\n')}`);
console.log(sorpresas.length
  ? `Fallos NO previstos (investigar): ${sorpresas.length}\n${sorpresas.map((c) => `  - ${c.nombre}`).join('\n')}`
  : 'Fallos NO previstos: ninguno');
if (curados.length) console.log(`Casos de bug conocido que ahora PASAN (¿arreglado? actualizar el caso): ${curados.map((c) => c.nombre).join(', ')}`);

process.exitCode = fallidos.length ? 1 : 0;
