/* ============================================================
   eval-animacion.mjs — banco de pruebas (eval harness) del motor
   de generación de animaciones del Taller.

   Ejecutar:  node taller/tools/eval-animacion.mjs
   (funciona desde cualquier cwd: los imports son relativos a este
   archivo; no requiere servidor ni red)

   Qué mide: llama a generarAnimacion() con ~30 escenarios reales
   (texto + elementos del tablero + pista) y valida el JSON devuelto
   contra el comportamiento DESEADO. Los casos marcados con
   `falloEsperadoHoy: true` codifican bugs conocidos del mock: el
   check exige el comportamiento correcto y HOY falla a propósito —
   ese es el baseline. Cuando se arregle el motor, deberían pasar.

   Salida: PASS/FAIL por caso + resumen X/Y. Exit code 0 solo si
   pasan todos (hoy NO pasan todos: es lo esperado).

   ------------------------------------------------------------------
   PUNTO DE EXTENSIÓN (futuro, NO implementado a propósito):
   hoy runGenerator() llama a generarAnimacion() de client.js, que en
   Node siempre cae al mock local determinista (el fetch usa una URL
   relativa que en Node rechaza sin llegar a la red). Para medir la
   calidad del modelo real (Claude Haiku vía la Netlify Function),
   basta con sustituir el cuerpo de runGenerator() por una llamada
   HTTP absoluta al endpoint desplegado (o a `netlify dev` local):

     const res = await fetch('https://<sitio>/.netlify/functions/generar-animacion', {
       method: 'POST', headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ texto: caso.texto, posiciones: caso.elementos,
                              pista: caso.pista, respuestas: caso.respuestas ?? null }),
     });
     return await res.json();

   Los casos y sus checks NO cambian: validan el JSON resultante,
   venga del mock o del modelo real.
   ============================================================ */

import { generarAnimacion, compilarIntentIA, recompilarConCanasta, filtrarPreguntasIA } from '../js/ia/client.js';
import { compilarAnimacion } from '../js/ia/compilador.js';
import { PISTAS } from '../js/canvas/court.js';

// ---- punto de extensión: generador bajo prueba --------------------
// Los casos normales pasan por texto+regex (generarAnimacion). Los marcados
// `esCompiladorDirecto` saltan el extractor de texto por completo y llaman
// a compilarAnimacion() con un Intent escrito a mano — prueban el
// COMPILADOR en sí, independientemente de qué tan lista esté la heurística
// regex de hoy (o el LLM real de mañana) para producir ese Intent.
async function runGenerator(caso) {
  if (caso.run) return caso.run(); // caso a medida (p.ej. lógica de Board sin DOM)
  if (caso.esCompiladorDirecto) return compilarAnimacion(caso.intent, caso.elementos, caso.pista);
  // Los marcados `esIntentIA` simulan el camino de RED de la Fase 2b sin red:
  // `dataIA` hace de respuesta de la Netlify Function ({ intent, warnings? })
  // y se procesa con compilarIntentIA (validador + canasta del cliente +
  // compilador) — el mismo código exacto que ejecuta el navegador al recibir
  // la respuesta real de la IA.
  // `posicionesCustom` (Tramo 2): stub del diccionario de Supabase — el banco
  // NUNCA toca la red; las posiciones custom se inyectan como objeto plano.
  if (caso.esIntentIA) return compilarIntentIA(caso.dataIA, caso.elementos, caso.pista, caso.texto || '', caso.respuestas ?? null, caso.posicionesCustom ?? null);
  return generarAnimacion({
    texto: caso.texto,
    elementos: caso.elementos,
    pista: caso.pista,
    respuestas: caso.respuestas ?? null,
    posicionesCustom: caso.posicionesCustom ?? null,
  });
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

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_media_pista_un_solo_aro',
  // Media pista: solo existe la canasta 'norte'; imposible equivocarse.
  texto: 'A1 bota hacia el aro y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.6, 0.5), balon(0.61, 0.5)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro en la animación');
    if (!tiros.every((t) => t.canasta === 'norte')) return ko(`tiro a canasta '${tiros[0].canasta}', en media pista solo existe 'norte'`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_entera_sin_pista_textual_pregunta',
  // Dos aros y el texto NO dice a cuál: decidir por cercanía era el
  // comportamiento antiguo. Decisión de producto actual: el sistema DEBE
  // devolver la pregunta fija 'q_canasta' — nunca inferir en silencio.
  texto: 'Pase al ala y tiro.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.5, 0.75), jugador('A', 2, 0.35, 0.68), balon(0.51, 0.75)],
  check(res) {
    if (!esPreguntas(res)) return ko(`con dos aros y sin mención textual se esperaba una pregunta de canasta; llegó ${forma(res)}`);
    const q = res.preguntas.find((p) => p.id === 'q_canasta');
    if (!q) return ko(`ninguna pregunta tiene id 'q_canasta': ${JSON.stringify(res.preguntas.map((p) => p.id))}`);
    if (q.tipo !== 'B' || !Array.isArray(q.opciones) || q.opciones.length < 2) return ko(`pregunta de canasta mal formada: ${JSON.stringify(q)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_numero_1_explicita_no_pregunta',
  // "canasta 1" (convención numerada: Canasta 1 = 'norte') con el juego en
  // la mitad SUR: el texto manda sobre la cercanía y no se pregunta.
  texto: 'Subida rápida de balón y tiro en la canasta 1.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.5, 0.7), jugador('A', 2, 0.38, 0.62), balon(0.51, 0.7)],
  check(res) {
    if (esPreguntas(res)) return ko('el texto ya nombra la canasta 1: no debería preguntar');
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (!tiros.every((t) => t.canasta === 'norte')) return ko(`"canasta 1" = 'norte', pero el tiro va a '${tiros[0].canasta}'`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_numero_2_explicita_no_pregunta',
  // "canasta 2" = 'sur' aunque los jugadores estén junto al aro norte.
  texto: 'A1 cruza toda la pista botando y tira en la canasta 2.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.4, 0.3), jugador('A', 2, 0.6, 0.35), balon(0.41, 0.3)],
  check(res) {
    if (esPreguntas(res)) return ko('el texto ya nombra la canasta 2: no debería preguntar');
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (!tiros.every((t) => t.canasta === 'sur')) return ko(`"canasta 2" = 'sur', pero el tiro va a '${tiros[0].canasta}'`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_respuesta_previa_resuelve_sin_repreguntar',
  // Dos aros, sin mención textual, pero 'q_canasta' ya respondida con
  // "Canasta 2": genera usando 'sur' (la respuesta manda sobre la cercanía,
  // los jugadores están junto al aro norte) y no vuelve a preguntar.
  texto: 'Pase al ala y tiro.',
  pista: 'entera',
  respuestas: [{ id: 'q_canasta', tipo: 'B', respuesta: 'Canasta 2' }],
  elementos: [jugador('A', 1, 0.45, 0.25), jugador('A', 2, 0.3, 0.3), balon(0.46, 0.25)],
  check(res) {
    if (esPreguntas(res)) return ko('q_canasta ya está respondida: no debería volver a preguntar');
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (!tiros.every((t) => t.canasta === 'sur')) return ko(`la respuesta "Canasta 2" = 'sur', pero el tiro va a '${tiros[0].canasta}'`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_media_un_aro_sin_mencion_no_pregunta',
  // Control de no-regresión: con UN solo aro no hay ambigüedad, así que
  // nunca se pregunta por la canasta aunque el texto no la mencione.
  texto: 'Pase al ala y tiro.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.6, 0.5), jugador('A', 2, 0.45, 0.4), balon(0.61, 0.5)],
  check(res) {
    if (esPreguntas(res)) return ko(`en media pista (un aro) no debe preguntarse por la canasta; llegó ${forma(res)}`);
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!todosTiros(res).every((t) => t.canasta === 'norte')) return ko('en media pista todos los tiros van a la única canasta (norte)');
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_texto_pide_sur_jugadores_al_norte',
  // Jugadores junto a la canasta norte, pero el texto pide la sur: la
  // mención explícita del texto manda sobre la cercanía.
  texto: 'Subida de balón y tiro en la canasta sur.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.5, 0.2), jugador('A', 2, 0.35, 0.28), balon(0.5, 0.21)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (!tiros.every((t) => t.canasta === 'sur')) return ko(`el texto pide explícitamente la canasta SUR pero el tiro va a '${tiros[0].canasta}' (bug conocido: se ignora la canasta del texto y se usa la más cercana)`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_texto_pide_norte_contraataque_desde_sur',
  // Contraataque desde la mitad sur hacia la canasta norte: el texto
  // nombra la canasta y el tiro debe ir a la pista contraria.
  texto: 'Contraataque hacia la canasta norte y tiro.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.5, 0.8), jugador('A', 2, 0.6, 0.72), balon(0.5, 0.81)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (!tiros.every((t) => t.canasta === 'norte')) return ko(`el texto pide la canasta NORTE (contraataque a pista contraria) pero el tiro va a '${tiros[0].canasta}' (bug conocido: canasta por cercanía, no por texto)`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_texto_coincide_con_cercania_control',
  // Control: cuando texto y posición coinciden, el resultado es
  // correcto (el bug solo aflora cuando discrepan).
  texto: 'Pase y tiro a la canasta norte.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.45, 0.25), jugador('A', 2, 0.3, 0.3), balon(0.46, 0.25)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (!tiros.every((t) => t.canasta === 'norte')) return ko(`texto y posición apuntan a 'norte' pero el tiro va a '${tiros[0].canasta}'`);
    return ok();
  },
});

casos.push({
  categoria: 'Canasta',
  nombre: 'canasta_entera_fiba_texto_explicito',
  // Variante de pista entera_fiba (dos aros: aplica la regla de canasta
  // explícita): la clave debe seguir siendo válida y la nombrada en el texto.
  texto: 'Pase y tiro hacia la canasta 1.',
  pista: 'entera_fiba',
  elementos: [jugador('A', 1, 0.5, 0.3), jugador('A', 2, 0.4, 0.35), balon(0.51, 0.3)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const tiros = todosTiros(res);
    if (!tiros.length) return ko('no hay ningún tiro');
    if (res.pista !== 'entera_fiba') return ko(`la pista del resultado ('${res.pista}') no es la del caso`);
    if (tiros[0].canasta !== 'norte') return ko(`el texto pide la canasta 1 ('norte'); llegó '${tiros[0].canasta}'`);
    return ok();
  },
});

/* ---------------------- 2. ROLES Y DEFENSA ------------------------ */

casos.push({
  categoria: 'Roles y defensa',
  nombre: 'defensa_equipo2_defiende_orden_normal',
  texto: 'El equipo 2 defiende. A1 penetra, pasa fuera y A2 tira.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.7, 0.5), jugador('A', 2, 0.5, 0.3),
    jugador('B', 1, 0.6, 0.45), jugador('B', 2, 0.45, 0.35),
    balon(0.71, 0.5),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mal = (res.jugadores || []).filter((j) => (j.equipo === 'B') !== (j.tipo === 'defensor'));
    if (mal.length) return ko(`roles mal asignados: ${mal.map((j) => `${j.id}=${j.tipo}`).join(', ')} (el equipo 2/B debía defender)`);
    if (!res.fases.every((f) => mismoConjunto(f.defensores || [], ['B1', 'B2']))) return ko(`fase.defensores no es {B1,B2} en todas las fases: ${JSON.stringify(res.fases.map((f) => f.defensores))}`);
    return ok();
  },
});

casos.push({
  categoria: 'Roles y defensa',
  nombre: 'defensa_orden_inverso_defiende_el_equipo3',
  texto: 'Defiende el equipo 3 mientras el equipo 1 mueve el balón hasta el tiro.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.6, 0.55), jugador('A', 2, 0.4, 0.45),
    jugador('C', 1, 0.55, 0.5), jugador('C', 2, 0.35, 0.4),
    balon(0.61, 0.55),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mal = (res.jugadores || []).filter((j) => (j.equipo === 'C') !== (j.tipo === 'defensor'));
    if (mal.length) return ko(`roles mal asignados con orden inverso ("Defiende el equipo 3"): ${mal.map((j) => `${j.id}=${j.tipo}`).join(', ')}`);
    if (!res.fases.every((f) => mismoConjunto(f.defensores || [], ['C1', 'C2']))) return ko('fase.defensores no es {C1,C2} en todas las fases');
    return ok();
  },
});

casos.push({
  categoria: 'Roles y defensa',
  nombre: 'defensa_sin_mencion_todos_atacan',
  // Sin mención de defensa, los equipos son neutrales: todos atacan
  // (los roles no dependen del color de equipo). Comportamiento deseado.
  texto: 'A1 pasa a B1 y B1 tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.6, 0.5), jugador('B', 1, 0.4, 0.4), balon(0.61, 0.5)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const defs = (res.jugadores || []).filter((j) => j.tipo === 'defensor');
    if (defs.length) return ko(`sin mención de defensa nadie debería defender; defienden: ${defs.map((j) => j.id).join(', ')}`);
    if (!res.fases.every((f) => (f.defensores || []).length === 0)) return ko('hay fases con defensores pese a no mencionarse defensa');
    return ok();
  },
});

casos.push({
  categoria: 'Roles y defensa',
  nombre: 'defensa_por_letra_equipo_B',
  // La mención por letra ("equipo B") también debe funcionar.
  texto: 'El equipo B defiende la salida del contraataque.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.6, 0.5), jugador('A', 2, 0.45, 0.4), jugador('B', 1, 0.55, 0.45), balon(0.61, 0.5)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const b1 = jugadorPorId(res, 'B1');
    if (!b1) return ko('falta el jugador B1 en el resultado');
    if (b1.tipo !== 'defensor') return ko(`"el equipo B defiende" no asignó rol defensor a B1 (tipo='${b1.tipo}')`);
    if ((res.jugadores || []).some((j) => j.equipo === 'A' && j.tipo !== 'atacante')) return ko('algún jugador A quedó como defensor');
    return ok();
  },
});

casos.push({
  categoria: 'Roles y defensa',
  nombre: 'defensa_mencion_lejos_del_verbo',
  // "equipo 2 … (≈60 caracteres) … defiende": la asociación equipo↔verbo
  // es por cercanía SIN techo de distancia (antes había un límite de 30
  // caracteres que hacía fallar este caso; se eliminó).
  texto: 'El equipo 2 quiere trabajar la salida de contraataque mientras defiende la primera línea de pase.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.6, 0.5), jugador('A', 2, 0.45, 0.4),
    jugador('B', 1, 0.55, 0.45), jugador('B', 2, 0.4, 0.35),
    balon(0.61, 0.5),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const b = (res.jugadores || []).filter((j) => j.equipo === 'B');
    if (!b.length) return ko('faltan jugadores del equipo B');
    if (!b.every((j) => j.tipo === 'defensor')) return ko(`el texto dice que el equipo 2 defiende, pero: ${b.map((j) => `${j.id}=${j.tipo}`).join(', ')} (la mención "equipo N" y el verbo de defensa deben asociarse aunque estén lejos)`);
    return ok();
  },
});

casos.push({
  categoria: 'Roles y defensa',
  nombre: 'defensa_solo_equipo_defensor_fallback_ataque',
  // Solo hay jugadores del equipo al que el texto manda defender: la
  // salvaguarda actual hace que todos ataquen (sin ataque no hay
  // ejercicio). Se documenta como comportamiento aceptado.
  texto: 'El equipo 1 defiende el rebote.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.5, 0.6), jugador('A', 2, 0.4, 0.5), balon(0.51, 0.6)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!(res.jugadores || []).every((j) => j.tipo === 'atacante')) return ko('con todos los jugadores en el equipo "defensor" debería aplicarse la salvaguarda: todos atacan');
    if (!res.fases.every((f) => (f.defensores || []).length === 0)) return ko('quedaron defensores en alguna fase pese a la salvaguarda');
    if (!todosTiros(res).length) return ko('la animación de la salvaguarda no llega a ningún tiro');
    return ok();
  },
});

/* ---------------------------- 3. FILA ------------------------------ */

casos.push({
  categoria: 'Fila',
  nombre: 'fila_con_jugadores_sin_balon_cerca_queda_inerte',
  // Arreglado en la Fase 2a (extraerIntentoLocal): el texto pone a trabajar
  // al primero de la fila aunque el balón esté lejos del cono (junto a A1) —
  // "primero de la fila" en el texto basta para elegirlo como protagonista
  // directamente, sin depender de la cercanía al balón. Antes quedaba inerte
  // (bug conocido, ya corregido).
  texto: 'El primero de la fila sale botando hacia el aro y tira.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.3, 0.6), jugador('A', 2, 0.45, 0.7),
    balon(0.31, 0.6),
    cono(0.85, 0.25, 'fila', { n_jugadores: 3, direccion_grados: 90, equipo: 'A' }, 'cono_fila'),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const fila = (res.jugadores || []).find((j) => /^fila/.test(j.id));
    if (!fila) return ko('no se sintetizó ningún jugador de la fila (id fila*)');
    if (!fila.tiene_balon) return ko(`el primero de la fila ('${fila.id}') debería ser el protagonista con el balón (tiene_balon=false)`);
    if (apariciones(res, fila.id) < 2) return ko(`'${fila.id}' debería botar y tirar (≥2 apariciones); tiene ${apariciones(res, fila.id)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Fila',
  nombre: 'fila_con_balon_cerca_sale_el_primero',
  // Con el balón junto al cono de fila, el primero de la fila SÍ sale a
  // trabajar: lleva el balón, avanza y asiste. La cola baja de 4 a 3.
  texto: 'El primero de la fila sale con bote, pase a A1 y tiro de A1.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.45, 0.6),
    balon(0.81, 0.31),
    cono(0.8, 0.3, 'fila', { n_jugadores: 4, direccion_grados: 90, equipo: 'A' }, 'cono_fila'),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const fila = (res.jugadores || []).find((j) => /^fila/.test(j.id));
    if (!fila) return ko('no se sintetizó ningún jugador de la fila');
    if (fila.tiene_balon !== true) return ko(`el primero de la fila ('${fila.id}') debería salir con el balón (tiene_balon=false)`);
    const mueveConBalon = (res.fases[0].movimientos || []).some((m) => m.elemento_id === fila.id && /balon/.test(m.tipo_movimiento || ''));
    if (!mueveConBalon) return ko(`'${fila.id}' no tiene movimiento con balón en la primera fase`);
    const pase = todosPases(res).find((p) => p.de_id === fila.id && p.a_id === 'A1');
    if (!pase) return ko(`no hay pase de '${fila.id}' a A1`);
    if (!todosTiros(res).some((t) => t.jugador_id === 'A1')) return ko('A1 no llega a tirar');
    const conoFila = (res.conos || []).find((c) => c.id === 'cono_fila');
    if (!conoFila || !conoFila.fila_config) return ko('el cono de fila no vuelve en el resultado con su fila_config');
    if (conoFila.fila_config.n_jugadores !== 3) return ko(`la cola debería bajar de 4 a 3 al salir el primero; queda en ${conoFila.fila_config.n_jugadores}`);
    return ok();
  },
});

casos.push({
  categoria: 'Fila',
  nombre: 'fila_vuelve_a_la_fila_fase_final',
  // "…y vuelve a la fila": tras el tiro debe haber una fase final en la
  // que el jugador salido de la fila corre (sin balón) hasta el final
  // de su cola (cerca del cono).
  texto: 'El primero de la fila sale con bote, pase a A1, tiro de A1 y vuelve a la fila.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.45, 0.6),
    balon(0.81, 0.31),
    cono(0.8, 0.3, 'fila', { n_jugadores: 4, direccion_grados: 90, equipo: 'A' }, 'cono_fila'),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const fila = (res.jugadores || []).find((j) => /^fila/.test(j.id));
    if (!fila) return ko('no se sintetizó ningún jugador de la fila');
    if (res.fases.length < 3) return ko(`se esperaban al menos 3 fases (jugada + vuelta); hay ${res.fases.length}`);
    const ultima = res.fases[res.fases.length - 1];
    const vuelta = (ultima.movimientos || []).find((m) => m.elemento_id === fila.id && m.tipo_movimiento === 'carrera_sin_balon');
    if (!vuelta) return ko(`la última fase no contiene la vuelta a la fila de '${fila.id}' (carrera_sin_balon)`);
    const fin = (vuelta.path || [])[vuelta.path.length - 1];
    if (!fin) return ko('la vuelta a la fila no tiene path');
    if (dxy(fin.x, fin.y, 0.8, 0.3) > 0.3) return ko(`la vuelta termina en (${fin.x.toFixed(2)}, ${fin.y.toFixed(2)}), lejos de la cola del cono (0.80, 0.30)`);
    return ok();
  },
});

casos.push({
  categoria: 'Fila',
  nombre: 'fila_al_borde_clamp_de_cola',
  // Cola que se sale del lienzo: cono en (0.9, 0.9) mirando hacia abajo
  // con 5 jugadores (la cola teórica acaba en y=1.2). La vuelta debe
  // quedar dentro de [0,1] (clamp) y aun así llegar a la zona de la cola.
  // (El texto nombra la canasta 2: la pista entera tiene dos aros y sin
  // mención el sistema preguntaría en vez de generar.)
  texto: 'Sale el primero botando, tira a la canasta 2 y vuelve a la fila.',
  pista: 'entera',
  elementos: [
    balon(0.89, 0.89),
    cono(0.9, 0.9, 'fila', { n_jugadores: 5, direccion_grados: 90, equipo: 'A' }, 'cono_fila'),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const fila = (res.jugadores || []).find((j) => /^fila/.test(j.id));
    if (!fila) return ko('no se sintetizó el jugador de la fila (único "jugador" del tablero)');
    const ultima = res.fases[res.fases.length - 1];
    const vuelta = (ultima.movimientos || []).find((m) => m.elemento_id === fila.id && m.tipo_movimiento === 'carrera_sin_balon');
    if (!vuelta) return ko('no hay fase final de vuelta a la fila');
    const fin = (vuelta.path || [])[vuelta.path.length - 1];
    if (!fin) return ko('la vuelta no tiene path');
    // la genérica ya exige [0,1]; aquí, además, que llegue al borde donde vive la cola
    if (fin.y < 0.95) return ko(`la cola apunta al borde inferior (y→1) pero la vuelta termina en y=${fin.y.toFixed(3)}`);
    return ok();
  },
});

/* ------------------------ 4. RODEAR CONOS -------------------------- */

casos.push({
  categoria: 'Rodear conos',
  nombre: 'rodear_un_solo_cono_arco_limpio',
  // Rodear UN cono produce un contorno curvo: ≥2 puntos de paso pegados
  // al cono y/o nodos Bézier (handle_in/handle_out). Antes el mock metía
  // un único punto lateral con nodos lineales (pico anguloso); arreglado.
  texto: 'A1 sale botando, rodea el cono y entra a canasta con tiro.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.8, 0.5), balon(0.81, 0.5), cono(0.5, 0.5, 'rodear', null, 'cono_r1')],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1' && /balon/.test(m.tipo_movimiento || ''));
    if (!mv) return ko('A1 no tiene movimiento con balón en la primera fase');
    const path = mv.path || [];
    const intermedios = path.slice(1, -1).filter((n) => dxy(n.x, n.y, 0.5, 0.5) <= 0.12).length;
    const hayCurva = path.some((n) => n.tipo_nodo && n.tipo_nodo !== 'lineal');
    if (intermedios >= 2 || hayCurva) return ok();
    return ko(`el path no RODEA el cono: ${intermedios} nodo(s) intermedio(s) junto al cono y todos los nodos lineales (bug conocido: desvío anguloso de un solo punto en vez de un arco)`);
  },
});

casos.push({
  categoria: 'Rodear conos',
  nombre: 'rodear_tres_conos_slalom',
  // Tres conos en línea hacia el aro: el bote debe zigzaguear
  // alternando el lado de cada cono (slalom), en orden de avance.
  texto: 'Slalom de bote entre los conos y tiro al final.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.85, 0.5), balon(0.86, 0.5),
    cono(0.65, 0.5, 'rodear', null, 'cono_r1'),
    cono(0.5, 0.5, 'rodear', null, 'cono_r2'),
    cono(0.35, 0.5, 'rodear', null, 'cono_r3'),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    const mv = (res.fases[0].movimientos || []).find((m) => m.elemento_id === 'A1' && /balon/.test(m.tipo_movimiento || ''));
    if (!mv) return ko('A1 no tiene movimiento con balón en la primera fase');
    const path = mv.path || [];
    if (path.length < 5) return ko(`path de ${path.length} nodos; un slalom de 3 conos necesita al menos 5 (inicio + 3 pasos + final)`);
    // para cada cono (en orden de avance), el nodo INTERMEDIO más cercano
    // del path debe estar pegado a él y alternar de lado (arriba/abajo de
    // y=0.5). Se excluyen el primer y el último nodo: son el arranque del
    // jugador y el final de la penetración, no pasos de slalom (el final
    // puede caer casualmente al lado de un cono sin estar sorteándolo).
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

/* --------------------- 5. MOVIMIENTO PARCIAL ----------------------- */

casos.push({
  categoria: 'Movimiento parcial',
  nombre: 'parcial_seis_jugadores_solo_dos_implicados',
  // 6 jugadores en pista pero el texto solo implica a A1 y A2: el resto
  // NO debe recibir movimientos/pases/tiros en ninguna fase (se quedan
  // en su posicion_inicial). (Canasta 2 nombrada: dos aros sin mención
  // dispararían la pregunta obligatoria de canasta.)
  texto: 'A1 penetra y dobla el pase a A2 para el tiro en la canasta 2.',
  pista: 'entera',
  elementos: [
    jugador('A', 1, 0.5, 0.72), jugador('A', 2, 0.38, 0.66),
    jugador('A', 3, 0.62, 0.66), jugador('A', 4, 0.3, 0.5),
    jugador('A', 5, 0.7, 0.5), jugador('B', 1, 0.5, 0.4),
    balon(0.51, 0.72),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!apariciones(res, 'A1')) return ko('A1 (el protagonista) no participa en ninguna fase');
    if (!todosPases(res).some((p) => p.de_id === 'A1' && p.a_id === 'A2')) return ko('no hay pase de A1 a A2');
    if (!todosTiros(res).some((t) => t.jugador_id === 'A2')) return ko('A2 no llega a tirar');
    const quietos = ['A3', 'A4', 'A5', 'B1'];
    const movidos = quietos.filter((id) => apariciones(res, id) > 0);
    if (movidos.length) return ko(`jugadores no implicados en el texto reciben acciones: ${movidos.join(', ')}`);
    return ok();
  },
});

casos.push({
  categoria: 'Movimiento parcial',
  nombre: 'parcial_defensores_del_hombre_quieto_no_se_mueven',
  // Con defensa: B1 marca al portador (activo) y debe moverse; B2 marca
  // a A3 (quieto) y NO debe moverse. Los atacantes no implicados (A3,
  // A4) tampoco. (Canasta 2 nombrada para no disparar la pregunta.)
  texto: 'El equipo 2 defiende. A1 penetra y asiste a A2 para el tiro en la canasta 2.',
  pista: 'entera',
  elementos: [
    jugador('A', 1, 0.5, 0.75), jugador('A', 2, 0.3, 0.7),
    jugador('A', 3, 0.72, 0.5), jugador('A', 4, 0.2, 0.4),
    jugador('B', 1, 0.5, 0.7), jugador('B', 2, 0.75, 0.55),
    balon(0.51, 0.76),
  ],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!res.fases.every((f) => mismoConjunto(f.defensores || [], ['B1', 'B2']))) return ko('fase.defensores no es {B1,B2} en todas las fases');
    if (!(res.fases[0].movimientos || []).some((m) => m.elemento_id === 'B1')) return ko('B1 marca al portador (activo) y debería moverse en la fase 1');
    const quietos = ['A3', 'A4', 'B2'].filter((id) => apariciones(res, id) > 0);
    if (quietos.length) return ko(`deberían quedarse quietos (marcan/son jugadores no implicados) pero actúan: ${quietos.join(', ')}`);
    return ok();
  },
});

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

casos.push({
  categoria: 'Preguntas',
  nombre: 'pregunta_texto_vacio',
  texto: '',
  pista: 'media',
  elementos: [jugador('A', 1, 0.5, 0.5), balon(0.51, 0.5)],
  check(res) {
    if (!esPreguntas(res)) return ko(`con texto vacío se esperaban preguntas de aclaración; llegó ${forma(res)}`);
    const q = res.preguntas[0];
    if (!q.id || !q.texto || !/^[AB]$/.test(q.tipo || '')) return ko(`pregunta mal formada: ${JSON.stringify(q)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Preguntas',
  nombre: 'pregunta_texto_largo_sin_accion',
  // Texto largo pero sin ningún verbo/sustantivo de acción reconocible:
  // también debe pedir aclaración.
  texto: 'Los jugadores se colocan por parejas en media pista.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.5, 0.5), jugador('A', 2, 0.4, 0.4), balon(0.51, 0.5)],
  check(res) {
    if (!esPreguntas(res)) return ko(`texto sin acción reconocible: se esperaban preguntas; llegó ${forma(res)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Preguntas',
  nombre: 'pregunta_texto_corto_con_accion',
  // "tiro" contiene una acción pero con <8 caracteres sigue siendo
  // demasiado escueto: debe preguntar.
  texto: 'tiro',
  pista: 'media',
  elementos: [jugador('A', 1, 0.5, 0.5), balon(0.51, 0.5)],
  check(res) {
    if (!esPreguntas(res)) return ko(`texto de 4 caracteres: se esperaban preguntas; llegó ${forma(res)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Preguntas',
  nombre: 'respuestas_previas_desbloquean_generacion',
  // Mismo texto breve pero CON respuestas del usuario a la pregunta
  // previa: ya no debe volver a preguntar, sino generar.
  texto: 'jugada',
  pista: 'media',
  respuestas: [{ id: 'q1', tipo: 'B', respuesta: 'Ataque' }],
  elementos: [jugador('A', 1, 0.6, 0.5), jugador('A', 2, 0.45, 0.4), balon(0.61, 0.5)],
  check(res) {
    if (esPreguntas(res)) return ko('con respuestas ya dadas no debería volver a preguntar');
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (res.fases.length < 2) return ko(`animación demasiado corta (${res.fases.length} fase)`);
    return ok();
  },
});

/* ----------------------- 8. LÍMITES Y VARIOS ----------------------- */

casos.push({
  categoria: 'Límites y varios',
  nombre: 'error_tablero_sin_jugadores',
  // Balón y cono decorativo pero ni un jugador ni una fila con gente:
  // error claro, no animación ni pregunta.
  texto: 'Pase y tiro.',
  pista: 'media',
  elementos: [balon(0.5, 0.5), cono(0.4, 0.4, 'decorativo')],
  check(res) {
    if (!esError(res)) return ko(`sin jugadores se esperaba { error }; llegó ${forma(res)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Límites y varios',
  nombre: 'error_fila_con_cero_jugadores',
  // Una fila vacía (n_jugadores: 0) no cuenta como jugadores.
  texto: 'Pase y tiro.',
  pista: 'media',
  elementos: [balon(0.5, 0.5), cono(0.7, 0.3, 'fila', { n_jugadores: 0, direccion_grados: 90, equipo: 'A' }, 'cono_fila')],
  check(res) {
    if (!esError(res)) return ko(`con la fila vacía se esperaba { error }; llegó ${forma(res)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Límites y varios',
  nombre: 'jugador_unico_sin_balon_tiro_directo',
  // Un único jugador y ningún balón en el tablero: el generador debe
  // sintetizar un balón en manos del jugador y resolver con tiro directo.
  texto: 'A1 bota hasta el aro y tira.',
  pista: 'media',
  elementos: [jugador('A', 1, 0.5, 0.5)],
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
  texto: 'Pase y tiro tras el corte.',
  pista: 'media',
  elementos: [
    jugador('A', 1, 0.7, 0.5, { dorsal: 7, nombre: 'Ana' }),
    jugador('A', 2, 0.5, 0.35),
    balon(0.71, 0.5, 'balon_7'),
  ],
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

casos.push({
  categoria: 'Límites y varios',
  nombre: 'warning_interpretacion_lateral',
  // Términos espaciales vagos ("el lateral") deben producir un warning
  // con la interpretación tomada, no fallar en silencio. (Canasta 1
  // nombrada para no disparar la pregunta de canasta en pista entera.)
  texto: 'A1 sube por el lateral hasta la canasta 1 y tira.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.2, 0.6), jugador('A', 2, 0.4, 0.5), balon(0.21, 0.6)],
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!Array.isArray(res.warnings) || !res.warnings.length) return ko('el término vago "el lateral" debería generar un warning de interpretación');
    const w = res.warnings[0];
    if (!w.texto_original || !w.campo) return ko(`warning mal formado: ${JSON.stringify(w)}`);
    return ok();
  },
});

/* -------------- 8. IA (camino de red, Fase 2b) ---------------------
   Simulan la respuesta { intent } de la Netlify Function y prueban el
   pipeline real del navegador: validador (repara/descarta) → canasta
   del cliente (manda sobre el modelo) → compilador. Sin red. */
const evIA = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });

casos.push({
  categoria: 'IA (camino de red)',
  nombre: 'ia_intent_valido_se_compila',
  // Respuesta bien formada del modelo: bote → pase → tiro. Debe compilar
  // a una animación completa marcada como venida de la IA (_ia, no _mock).
  esIntentIA: true,
  texto: 'A1 penetra y dobla a A2 para el tiro.',
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
    if (res._ia !== true || res._mock !== false) return ko(`la animación del camino de red debe marcarse _ia:true/_mock:false (llegó _ia=${res._ia}, _mock=${res._mock})`);
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
  categoria: 'IA (camino de red)',
  nombre: 'ia_intent_canasta_cliente_manda',
  // El texto dice "canasta 2" (sur) pero el modelo devuelve "norte": la
  // resolución del CLIENTE (la misma del preflight) manda sobre el modelo.
  esIntentIA: true,
  texto: 'Penetración y tiro hacia la canasta 2.',
  pista: 'entera',
  elementos: [jugador('A', 1, 0.5, 0.6), balon(0.51, 0.6)],
  dataIA: {
    intent: {
      canasta: 'norte',
      fases: [
        { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
        { eventos: [evIA('A1', 'tiro')] },
      ],
    },
  },
  check(res) {
    if (!esExito(res)) return ko(`se esperaba animación, llegó ${forma(res)}`);
    if (!todosTiros(res).length) return ko('no hay tiro'); // .every() con lista vacía es true: sin esto el caso pasaría sin tiros
    if (!todosTiros(res).every((t) => t.canasta === 'sur')) return ko(`el texto pide la canasta 2 ('sur') y debe mandar sobre el modelo; el tiro va a '${todosTiros(res)[0]?.canasta}'`);
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
  nombre: 'ia_fallo_procesando_respuesta_real_no_cae_al_mock',
  // Blindaje del fallback silencioso de generarAnimacion(): si la function
  // responde con un intent que no compila a nada, el resultado debe ser un
  // { error } (o éxito _ia) — NUNCA un éxito _mock:true que disfrace el fallo.
  sinGenerica: true,
  async run() {
    const fetchPrevio = globalThis.fetch;
    globalThis.fetch = async () => ({ text: async () => JSON.stringify({ intent: { canasta: 'norte', fases: [{ eventos: {} }] } }) });
    try {
      return await generarAnimacion({ texto: 'A1 penetra, pase y tiro.', elementos: [jugador('A', 1, 0.6, 0.5), balon(0.61, 0.5)], pista: 'media', respuestas: null });
    } finally {
      if (fetchPrevio) globalThis.fetch = fetchPrevio; else delete globalThis.fetch;
    }
  },
  check(res) {
    if (res && res._mock === true) return ko('el fallo procesando la respuesta REAL de la IA se disfrazó de éxito del mock local');
    if (!esError(res)) return ko(`se esperaba { error } honesto; llegó ${forma(res)}`);
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
    // ancla medida de esquina_der en la media: (0.206, 0.893)
    if (dxy(fin.x, fin.y, 0.206, 0.893) > 1e-9) return ko(`el bote debía terminar en el ancla esquina_der (0.206, 0.893); termina en (${fin.x}, ${fin.y})`);
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
    const data = await generarAnimacion({ texto: 'A1 penetra y dobla a A2 para el tiro.', elementos, pista: 'media', respuestas: null });
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

casos.push({
  categoria: 'Tramo 1 (confirmación visual)',
  nombre: 'chip_editar_canasta_recompila',
  // El chip de canasta del readback: recompilar con la OTRA canasta remapea
  // bote y tiro al aro nuevo SIN reinterpretar el texto (reusa data._intent)
  // y sin mover el planteamiento inicial (mismas posiciones de salida).
  sinGenerica: true, // dos resultados: la genérica se aplica a ambos a mano
  async run() {
    const elementos = [jugador('A', 1, 0.5, 0.7), jugador('A', 2, 0.38, 0.62), balon(0.51, 0.7)];
    const data = await generarAnimacion({ texto: 'A1 penetra y dobla a A2 para el tiro en la canasta 1.', elementos, pista: 'entera', respuestas: null });
    const cambiado = recompilarConCanasta(data, 'sur', elementos, 'entera');
    return { data, cambiado, generica: [...validacionGenerica(data, 'entera'), ...validacionGenerica(cambiado, 'entera')] };
  },
  check({ data, cambiado, generica }) {
    if (!esExito(data)) return ko(`se esperaba animación, llegó ${forma(data)}`);
    if (generica.length) return ko(`[genérica] ${generica.join(' | ')}`);
    if (data.canasta !== 'norte' || !todosTiros(data).every((t) => t.canasta === 'norte')) return ko(`el original debía atacar 'norte' (canasta 1); data.canasta='${data.canasta}'`);
    if (!esExito(cambiado)) return ko(`la recompilación no devolvió animación: ${forma(cambiado)}`);
    if (cambiado.canasta !== 'sur') return ko(`tras el chip, data.canasta debería ser 'sur'; es '${cambiado.canasta}'`);
    const tiros = todosTiros(cambiado);
    if (!tiros.length || !tiros.every((t) => t.canasta === 'sur')) return ko(`el tiro debía remapearse a la canasta 'sur'; va a '${tiros[0] && tiros[0].canasta}'`);
    // el planteamiento inicial no cambia: mismas posiciones de salida
    for (const j of data.jugadores) {
      const j2 = jugadorPorId(cambiado, j.id);
      if (!j2 || dxy(j.posicion_inicial[0], j.posicion_inicial[1], j2.posicion_inicial[0], j2.posicion_inicial[1]) > 1e-9) {
        return ko(`cambiar de canasta movió la posición inicial de ${j.id}`);
      }
    }
    // y se puede volver a cambiar: el intent recompilado guarda la canasta nueva
    if (!cambiado._intent || cambiado._intent.canasta !== 'sur') return ko('el resultado recompilado no conserva _intent con la canasta nueva');
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 1 (confirmación visual)',
  nombre: 'pregunta_solo_si_ambiguedad_real',
  // §Tramo 1.3: una pregunta GENÉRICA del modelo (fuera de la lista fija
  // canasta / posición desconocida / nº de jugadores) se DESCARTA y no
  // bloquea: el sistema genera igualmente. Las q_pos_* de posiciones
  // CONOCIDAS ('esquina' está en las ANCLAS) degradan a warning — gancho
  // del Tramo 2 ya activo: solo las DESCONOCIDAS preguntan (ver el caso
  // q_pos_desconocida_del_modelo_pasa_como_tipo_A). Y el filtro en sí
  // conserva SOLO las ambigüedades reales cuando siguen vivas.
  sinGenerica: true,
  async run() {
    const elementos = [jugador('A', 1, 0.6, 0.5), jugador('A', 2, 0.45, 0.4), balon(0.61, 0.5)];
    const fetchPrevio = globalThis.fetch;
    globalThis.fetch = async () => ({ text: async () => JSON.stringify({ preguntas: [
      { id: 'q_estilo', tipo: 'B', texto: '¿Qué sistema táctico prefieres trabajar?', opciones: ['Flex', 'Princeton'] },
      { id: 'q_pos_esquina', tipo: 'B', texto: '¿Dónde queda "la esquina fuerte"?', opciones: ['Derecha', 'Izquierda'] },
    ] }) });
    let res;
    try {
      res = await generarAnimacion({ texto: 'A1 penetra, pasa a A2 y tiro.', elementos, pista: 'media', respuestas: null });
    } finally {
      if (fetchPrevio) globalThis.fetch = fetchPrevio; else delete globalThis.fetch;
    }
    // el filtro puro: con la ambigüedad de canasta VIVA (pista de dos aros,
    // texto sin mención), q_canasta y q_jugadores pasan; la genérica cae.
    const filtro = filtrarPreguntasIA([
      { id: 'q_canasta', tipo: 'B', texto: '¿Hacia qué canasta?', opciones: ['Canasta 1', 'Canasta 2'] },
      { id: 'q_jugadores', tipo: 'B', texto: 'Mencionas 3 jugadores pero hay 2 en el tablero.', opciones: ['Añadir', 'Seguir con 2'] },
      { id: 'q_libre', tipo: 'B', texto: '¿Nivel del equipo?', opciones: ['Alto', 'Bajo'] },
    ], { texto: 'Pase y tiro.', pista: 'entera', respuestas: null });
    return { res, filtro, generica: validacionGenerica(res, 'media') };
  },
  check({ res, filtro, generica }) {
    if (esPreguntas(res)) return ko(`las preguntas genéricas del modelo deberían descartarse, no llegar al entrenador: ${JSON.stringify(res.preguntas.map((q) => q.id))}`);
    if (!esExito(res)) return ko(`descartadas las genéricas, debía generarse la animación; llegó ${forma(res)}`);
    if (generica.length) return ko(`[genérica] ${generica.join(' | ')}`);
    if (!(res.warnings || []).some((w) => w.campo === 'posicion' && /conocida/.test(w.interpretacion || ''))) return ko('la q_pos_* de posición CONOCIDA debía degradar a warning de posición (no bloqueante), no desaparecer en silencio');
    if (!mismoConjunto(filtro.preguntas.map((q) => q.id), ['q_canasta', 'q_jugadores'])) return ko(`el filtro debía conservar SOLO q_canasta y q_jugadores (lista fija); quedó ${JSON.stringify(filtro.preguntas.map((q) => q.id))}`);
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
  // El endpoint del tiro es el centro MEDIDO del aro (anclas.js), por pista
  // y por canasta — en las medias difiere de court.js baskets (x≈0.172 vs
  // 0.143). El compilador emite el path explícito; el último nodo debe
  // clavar el ancla en las 5 combinaciones pista/canasta.
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
    // ancla medida de poste_bajo_izq en la media: (0.192, 0.386)
    if (dxy(fin.x, fin.y, 0.192, 0.386) > 1e-9) return ko(`el corte debía terminar en poste_bajo_izq (0.192, 0.386); termina en (${fin.x}, ${fin.y})`);
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
  // El clic del entrenador a q_pos_refugio ([x,y] en `respuestas`) actúa
  // como diccionario custom inmediato: en la siguiente vuelta el mismo
  // intent resuelve a ESE punto, sin volver a preguntar. (En producción
  // paso2 además lo persiste vía guardarPosicion; aquí, sin red, el stub
  // es la propia respuesta.)
  esIntentIA: true,
  texto: 'A1 bota hasta el refugio y tira.',
  pista: 'media',
  respuestas: [{ id: 'q_pos_refugio', tipo: 'A', respuesta: [0.25, 0.4] }],
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
    if (esPreguntas(res)) return ko('q_pos_refugio ya está respondida: no debía volver a preguntar');
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

casos.push({
  categoria: 'Tramo 2 (posiciones con nombre)',
  nombre: 'q_pos_desconocida_del_modelo_pasa_como_tipo_A',
  // Contraparte del degradado: cuando el MODELO pregunta por una posición
  // que tampoco nosotros conocemos, la pregunta sobrevive al filtro — pero
  // CONVERTIDA a tipo A (clic en pista) con el slug en `nombre`. Con un
  // custom inyectado que SÍ la conoce, degrada a warning y no bloquea.
  sinGenerica: true,
  async run() {
    const qModelo = [{ id: 'q_pos_refugio', tipo: 'B', texto: '¿Dónde está "el refugio"?', opciones: ['Izquierda', 'Derecha'] }];
    return {
      sinDato: filtrarPreguntasIA(qModelo, { texto: 'Bote al refugio y tiro.', pista: 'media', respuestas: null }),
      conCustom: filtrarPreguntasIA(qModelo, { texto: 'Bote al refugio y tiro.', pista: 'media', respuestas: null, posiciones: { refugio: [0.3, 0.3] } }),
    };
  },
  check({ sinDato, conCustom }) {
    const q = sinDato.preguntas.find((p) => p.id === 'q_pos_refugio');
    if (!q) return ko(`sin dato custom, q_pos_refugio debía sobrevivir al filtro; quedó ${JSON.stringify(sinDato.preguntas.map((p) => p.id))}`);
    if (q.tipo !== 'A' || q.nombre !== 'refugio') return ko(`debía convertirse a tipo 'A' con nombre 'refugio'; llegó ${JSON.stringify({ tipo: q.tipo, nombre: q.nombre })}`);
    if (conCustom.preguntas.some((p) => /^q_pos_/.test(p.id))) return ko('con la posición ya definida en el custom, la pregunta del modelo es redundante y debía degradar a warning');
    if (!conCustom.warnings.some((w) => w.campo === 'posicion')) return ko('falta el warning de posición conocida en el caso con custom');
    return ok();
  },
});

/* ------------- 12. Tramo 3: vista del modelo -------------------------
   (a) El payload hacia Claude incluye balón(es) con su poseedor y los
   dorsales/nombres visibles; (b) balones múltiples con posesión en
   paralelo; (c) truncado por max_tokens → error accionable, nunca un JSON
   a medias; (d) bloqueo directo como eventos encadenados (aproximación +
   bloqueo + roll/pop); (e) rotación de filas en serie. Los casos que
   ejercitan la Netlify Function REAL la importan (CJS→ESM interop) y
   stubbean fetch + API key: cero red, y se valida el payload EXACTO que
   viajaría a Anthropic. */

// Ejecuta el handler real de la Netlify Function con la respuesta de
// Anthropic simulada. Devuelve { res: cuerpo parseado de la function,
// capturado: cuerpo EXACTO del request que habría ido a Anthropic }.
async function llamarFunction(payload, respuestaAnthropic) {
  const mod = await import('../../netlify/functions/generar-animacion.js');
  const handler = mod.handler || (mod.default && mod.default.handler);
  if (!handler) throw new Error('no se pudo importar el handler de la Netlify Function');
  const keyPrevia = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = 'test-key-banco';
  const fetchPrevio = globalThis.fetch;
  let capturado = null;
  globalThis.fetch = async (url, opts) => {
    capturado = JSON.parse(opts.body);
    return { ok: true, status: 200, json: async () => respuestaAnthropic, text: async () => JSON.stringify(respuestaAnthropic) };
  };
  try {
    const out = await handler({ httpMethod: 'POST', body: JSON.stringify(payload) });
    return { res: JSON.parse(out.body), capturado };
  } finally {
    if (fetchPrevio) globalThis.fetch = fetchPrevio; else delete globalThis.fetch;
    if (keyPrevia === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = keyPrevia;
  }
}

casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'balon_y_poseedor_se_envian_al_modelo',
  // El payload que construye la Function incluye los balones (posición +
  // en_manos_de por cercanía), el dorsal VISIBLE y el nombre de cada
  // jugador, y los SIGUIENTES de cada fila (fila1_2…). El SYSTEM documenta
  // la convención id = equipo+número / dorsal.
  sinGenerica: true,
  async run() {
    const elementos = [
      jugador('A', 1, 0.7, 0.55, { dorsal: 7, nombre: 'Ana' }),
      jugador('A', 2, 0.45, 0.3),
      balon(0.71, 0.55, 'balon_7'),
      cono(0.85, 0.25, 'fila', { n_jugadores: 3, direccion_grados: 90, equipo: 'A' }, 'cono_fila'),
    ];
    const respuesta = {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: JSON.stringify({
        intent: { canasta: 'norte', fases: [
          { eventos: [evIA('A1', 'bote', { hacia: 'canasta' })] },
          { eventos: [evIA('A1', 'tiro')] },
        ] },
        warnings: [],
      }) }],
    };
    return llamarFunction({ texto: 'A1 penetra y tira.', posiciones: elementos, pista: 'media' }, respuesta);
  },
  check({ res, capturado }) {
    if (!capturado) return ko('la Function no llegó a llamar a Anthropic');
    if (!(capturado.max_tokens >= 4096)) return ko(`max_tokens debería ser ≥4096 (5v5 multifase medido); es ${capturado.max_tokens}`);
    let userMsg;
    try { userMsg = JSON.parse(capturado.messages[capturado.messages.length - 1].content); }
    catch { return ko('el último mensaje de usuario no es JSON parseable'); }
    // balones con poseedor
    if (!Array.isArray(userMsg.balones) || userMsg.balones.length !== 1) return ko(`el payload debería llevar 1 balón; lleva ${JSON.stringify(userMsg.balones)}`);
    const b = userMsg.balones[0];
    if (b.id !== 'balon_7') return ko(`el balón no conserva su id ('${b.id}')`);
    if (b.en_manos_de !== 'A1') return ko(`en_manos_de debería ser 'A1' (balón pegado a él); es '${b.en_manos_de}'`);
    // dorsal visible y nombre
    const a1 = (userMsg.jugadores || []).find((j) => j.id === 'A1');
    if (!a1 || a1.dorsal !== 7) return ko(`A1 debería viajar con dorsal 7 (el visible); llegó ${JSON.stringify(a1)}`);
    if (a1.nombre !== 'Ana') return ko(`A1 debería viajar con su nombre; llegó '${a1.nombre}'`);
    const a2 = (userMsg.jugadores || []).find((j) => j.id === 'A2');
    if (!a2 || a2.dorsal !== 2) return ko(`A2 sin dorsal custom debería viajar con dorsal 2 (su label); llegó ${JSON.stringify(a2)}`);
    // siguientes de la fila (rotación)
    const idsFila = (userMsg.jugadores || []).filter((j) => /^fila/.test(j.id)).map((j) => j.id);
    if (!mismoConjunto(idsFila, ['fila1', 'fila1_2', 'fila1_3'])) return ko(`con una fila de 3 deberían viajar fila1, fila1_2 y fila1_3; viajan ${JSON.stringify(idsFila)}`);
    // el SYSTEM documenta la convención y el vocabulario nuevo
    if (!/en_manos_de/.test(capturado.system)) return ko('el SYSTEM no documenta en_manos_de');
    if (!/dorsal/.test(capturado.system)) return ko('el SYSTEM no documenta el dorsal↔id');
    if (!/BLOQUEO DIRECTO/.test(capturado.system)) return ko('el SYSTEM no documenta el bloqueo directo');
    if (!/fila1_2/.test(capturado.system)) return ko('el SYSTEM no documenta los siguientes de la fila (fila1_2…)');
    // y la respuesta bien formada pasa tal cual
    if (!res || !res.intent) return ko(`la respuesta válida del modelo debería devolverse ({intent}); llegó ${JSON.stringify(res).slice(0, 120)}`);
    return ok();
  },
});

casos.push({
  categoria: 'Tramo 3 (vista del modelo)',
  nombre: 'intent_truncado_no_se_parsea_como_valido',
  // stop_reason === 'max_tokens': el JSON viene cortado. La Function debe
  // devolver { error } accionable SIN intentar rescatar el JSON a medias.
  sinGenerica: true,
  async run() {
    const elementos = [jugador('A', 1, 0.7, 0.55), balon(0.71, 0.55)];
    const respuesta = {
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: '{"intent":{"canasta":"norte","fases":[{"eventos":[{"jugador":"A1","tipo":"bote"' }],
    };
    return llamarFunction({ texto: 'Jugada 5c5 muy larga.', posiciones: elementos, pista: 'media' }, respuesta);
  },
  check({ res }) {
    if (res && res.intent) return ko('un JSON truncado se dio por válido (llegó { intent })');
    if (!res || typeof res.error !== 'string' || !res.error) return ko(`se esperaba { error } accionable; llegó ${JSON.stringify(res).slice(0, 160)}`);
    if (!/larga|divid|simplifica/i.test(res.error)) return ko(`el error no es accionable (debería sugerir dividir/simplificar): "${res.error}"`);
    return ok();
  },
});

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
  // El modelo puede DECLARAR el poseedor inicial (intent.balones): si es
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
    const conDecl = compilarIntentIA(
      { intent: { canasta: 'norte', balones: [{ id: 'balon_1', portador: 'A2' }], fases } },
      elementos, 'media', 'A2 sale con balón.', null, null,
    );
    const invalida = compilarIntentIA(
      { intent: { canasta: 'norte', balones: [{ id: 'balon_1', portador: 'Z9' }], fases } },
      elementos, 'media', 'Jugada.', null, null,
    );
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
    // ancla medida del aro en la media: (0.172, 0.5)
    if (dxy(finRoll.x, finRoll.y, 0.172, 0.5) > 1e-9) return ko(`el roll debía terminar en el centro medido del aro (0.172, 0.5); termina en (${finRoll.x}, ${finRoll.y})`);
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
    // ancla medida de codo_der en la media: (0.336, 0.606)
    if (dxy(fin.x, fin.y, 0.336, 0.606) > 1e-9) return ko(`el pop debía terminar en codo_der (0.336, 0.606); termina en (${fin.x}, ${fin.y})`);
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
   [0.172, 0.5]); portador por cercanía al balón (≤ RADIO_CAPTURA).
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
    if (dxy(fin.x, fin.y, 0.172, 0.5) > 1e-9) return ko(`el tiro debería morir en el aro medido (0.172, 0.5); muere en (${fin.x}, ${fin.y})`);
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
    if (dxy(finB1.x, finB1.y, 0.172, 0.5) >= dxy(finA1.x, finA1.y, 0.172, 0.5)) return ko('B1 debería quedar entre el portador y el aro (goal-side)');
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
   RUNNER
   ==================================================================== */
console.log(`eval-animacion — ${casos.length} casos · Node ${process.version}`);

let pasan = 0;
const fallidos = [];
const sinMock = [];
let categoriaActual = '';

for (const caso of casos) {
  if (caso.categoria !== categoriaActual) {
    categoriaActual = caso.categoria;
    console.log(`\n-- ${categoriaActual} --`);
  }
  let veredicto;
  try {
    const res = await runGenerator(caso);
    // (los casos esIntentIA producen _mock:false a propósito: simulan la IA real)
    if (!caso.esIntentIA && esExito(res) && res._mock !== true) sinMock.push(caso.nombre);
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
if (sinMock.length) console.log(`AVISO: ${sinMock.length} resultado(s) no vinieron del mock local (${sinMock.join(', ')}) — ¿hay un endpoint respondiendo?`);

process.exitCode = fallidos.length ? 1 : 0;
