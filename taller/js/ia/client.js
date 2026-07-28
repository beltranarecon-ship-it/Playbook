/* ============================================================
   ia/client.js — puente del navegador hacia la generación de
   animación. Llama a la Netlify Function (§8.2); si no está
   disponible (desarrollo local), extrae la intención del texto con
   regex (extraerIntentoLocal) y la compila a un JSON §10 con
   ia/compilador.js. La API key NUNCA está aquí: vive sólo en la
   function.
   ============================================================ */

import { PISTAS } from '../canvas/court.js';
import { TEAM_FROM_NUM } from '../canvas/colors.js';
import { compilarAnimacion, sintetizarJugadores } from './compilador.js';
import { validarIntent } from './validador.js';
import { resolverPosicion } from './posiciones.js';
import { defensaReactiva } from './simulador.js';

const ENDPOINT = '/.netlify/functions/generar-animacion';

/* Diccionario custom EFECTIVO: las posiciones guardadas en Supabase para
   esta pista (posicionesCustom, las carga paso2) + las respuestas del
   entrenador a preguntas q_pos_* de ESTA sesión (clic en la pista →
   [x,y]) — así la posición recién marcada resuelve YA, sin esperar al
   round-trip con Supabase. */
function customConRespuestas(posicionesCustom, respuestas) {
  const out = { ...(posicionesCustom || {}) };
  for (const r of (respuestas || [])) {
    if (!r || !/^q_pos_/.test(String(r.id)) || !Array.isArray(r.respuesta) || r.respuesta.length < 2) continue;
    const x = Number(r.respuesta[0]), y = Number(r.respuesta[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) out[String(r.id).slice('q_pos_'.length)] = [x, y];
  }
  return out;
}

/**
 * @param posicionesCustom diccionario { slug: [x,y] } de posiciones custom
 *        de ESTA pista (Supabase, Tramo 2.3) — lo carga paso2; null en dev.
 * @returns objeto §10 (animación) | { preguntas:[...] } (§8.3) | { error }
 */
export async function generarAnimacion({ texto, elementos, pista, respuestas = null, posicionesCustom = null }) {
  // Canasta ambigua (pista de dos aros, sin mención en el texto ni respuesta
  // previa): pregunta OBLIGATORIA y determinista ANTES de llamar al generador
  // (mock o red) — no dependemos de que la IA decida preguntar por su cuenta.
  const qCanasta = necesitaPreguntaCanasta(texto, pista, respuestas);
  if (qCanasta) return { preguntas: [qCanasta] };
  const custom = customConRespuestas(posicionesCustom, respuestas);
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // posiciones_custom: solo los NOMBRES (el modelo emite el nombre en
      // `hacia`; las coordenadas las resuelve el cliente, nunca viajan).
      body: JSON.stringify({ texto, posiciones: elementos, pista, respuestas, posiciones_custom: Object.keys(custom) }),
    });
    const raw = await res.text();
    const data = JSON.parse(raw); // si vino HTML (dev) lanza y caemos al local
    if (data && data.error) return data;
    if (data && Array.isArray(data.preguntas)) {
      // §Tramo 1.3: al entrenador solo le llegan preguntas de la LISTA FIJA de
      // ambigüedades reales (filtrarPreguntasIA); las genéricas del modelo se
      // descartan. Si tras filtrar no queda ninguna, no se le interroga: se
      // genera con el extractor local arrastrando los warnings de degradación.
      const filtro = filtrarPreguntasIA(data.preguntas, { texto, pista, respuestas, posiciones: custom });
      if (filtro.preguntas.length) return { ...data, preguntas: filtro.preguntas };
      return generarLocal(texto, elementos, pista, respuestas, filtro.warnings, custom);
    }
    // Fase 2b: la function devuelve INTENCIÓN ({ intent }), no geometría — se
    // valida/repara (validador.js) y se compila aquí con el MISMO compilador
    // que el camino local. Si llegara geometría §10 completa (function
    // antigua aún desplegada), se acepta tal cual (camino legado).
    if (data && data.intent) {
      // Blindaje: a partir de aquí la respuesta SÍ vino de la IA. Si validar/
      // compilar lanzara, dejar subir la excepción la haría caer al catch de
      // abajo y el fallo se disfrazaría de éxito del mock local (_mock:true,
      // sin los warnings reales). Mejor un { error } honesto.
      try {
        return compilarIntentIA(data, elementos, pista, texto, respuestas, custom);
      } catch (e) {
        console.error('Fallo procesando la respuesta de la IA', e);
        return { error: 'No se pudo procesar la respuesta de la IA. Vuelve a generar la animación.' };
      }
    }
    return reconciliarConos(data, elementos);
  } catch {
    // Sin red (o en dev sin Netlify Function): extrae la INTENCIÓN del texto
    // con regex (quién hace qué, en qué fase — ia/client.js#extraerIntentoLocal)
    // y compílala a geometría real (ia/compilador.js#compilarAnimacion). Las
    // preguntas/errores §8.3 no llegan a compilarse: se devuelven tal cual.
    return generarLocal(texto, elementos, pista, respuestas, [], custom);
  }
}

/* Camino local compartido (sin red, o preguntas del modelo todas descartadas
   por el filtro §Tramo 1.3): intención por regex + compilador. extraWarnings
   se fusionan en el resultado (p.ej. las degradaciones de q_pos_*). */
function generarLocal(texto, elementos, pista, respuestas, extraWarnings = [], custom = null) {
  const out = extraerIntentoLocal(texto, elementos, pista, respuestas);
  if (out.preguntas || out.error) return out;
  // Tramo 5a: defensa reactiva — los defensores declarados siguen a su par
  // en fases donde este se mueve y ellos no tienen evento. No-op si el
  // intent no declara defensa (nunca inventa defensores).
  const anim = compilarAnimacion(defensaReactiva(out.intent, elementos, pista), elementos, pista, { posiciones: custom });
  anim.warnings = [...(out.warnings || []), ...extraWarnings];
  return anim;
}

/**
 * Recompila una animación cambiando SOLO la canasta objetivo (chip editable
 * del readback, §Tramo 1.2): reusa el intent ya resuelto (data._intent, lo
 * guarda el compilador) sin reinterpretar el texto. Si no hay intent guardado
 * (p.ej. geometría legada de la function antigua) o el aro no existe en la
 * pista, devuelve `data` sin cambios — nunca rompe lo que ya funciona.
 */
export function recompilarConCanasta(data, canasta, elementos, pista) {
  const intent = data && data._intent;
  const bs = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  if (!intent || !bs[canasta]) return data;
  const anim = compilarAnimacion({ ...intent, canasta }, elementos, pista);
  // se conservan los warnings previos salvo los de canasta (el usuario acaba
  // de fijarla a mano: avisar de la corrección automática ya no informa nada)
  // y las marcas de origen (_mock/_ia) del resultado original.
  anim.warnings = (data.warnings || []).filter((w) => w && w.campo !== 'canasta');
  anim._mock = data._mock ?? anim._mock;
  if ('_ia' in data) anim._ia = data._ia;
  return anim;
}

/**
 * Filtro de preguntas del MODELO (§Tramo 1.3): solo pasan las ambigüedades
 * REALES de la lista fija; el resto se descarta. La lista:
 *  (a) 'q_canasta'  — canasta sin resolver en pista de DOS aros (se re-verifica
 *      con necesitaPreguntaCanasta: si el texto/respuestas ya la resuelven,
 *      la pregunta del modelo es redundante y también cae).
 *  (b) 'q_pos_*'    — posición con nombre. GANCHO Tramo 2 ACTIVADO: si el
 *      nombre RESUELVE (ANCLAS o custom de Supabase) la pregunta del modelo
 *      es redundante → degrada a warning y se genera sin interrogar; si es
 *      desconocida de verdad → pasa como pregunta TIPO A ("Marca la posición
 *      «X» en la pista"), cuyo clic se persistirá (paso2 → guardarPosicion).
 *  (c) 'q_jugadores' — el nº de jugadores mencionados no cuadra con los
 *      colocados en el tablero.
 * @returns { preguntas, warnings } — preguntas que sobreviven + warnings de
 *          las degradaciones (b).
 */
export function filtrarPreguntasIA(preguntas, { texto = '', pista = 'entera', respuestas = null, posiciones = null } = {}) {
  const out = [];
  const warnings = [];
  for (const q of (Array.isArray(preguntas) ? preguntas : [])) {
    if (!q || typeof q !== 'object' || !q.id) continue;
    if (q.id === 'q_canasta') {
      if (necesitaPreguntaCanasta(texto, pista, respuestas)) out.push(q);
      continue;
    }
    if (/^q_pos_/.test(String(q.id))) {
      // el nombre viaja en el propio id (q_pos_<slug>); el lado (norte/sur)
      // solo cambia las coords, no la EXISTENCIA del nombre, así que para
      // decidir si se pregunta basta resolver contra 'norte'.
      const slug = String(q.id).slice('q_pos_'.length);
      const legible = slug.replace(/_/g, ' ');
      if (resolverPosicion(pista, legible, 'norte', posiciones)) {
        warnings.push({
          texto_original: q.texto || legible,
          interpretacion: `posición «${legible}» conocida: se resuelve con su ancla sin preguntar`,
          campo: 'posicion',
        });
      } else {
        out.push({ id: q.id, tipo: 'A', texto: `Marca la posición «${legible}» en la pista`, nombre: slug });
      }
      continue;
    }
    if (q.id === 'q_jugadores') { out.push(q); continue; }
    // cualquier otra pregunta es genérica del modelo: se descarta en silencio.
  }
  return { preguntas: out, warnings };
}

/**
 * Camino de red de la Fase 2b: sanea el Intent devuelto por la IA
 * (ia/validador.js — descarta ids fantasma, corrige canasta/coordenadas),
 * impone la canasta ya resuelta por el CLIENTE (texto o respuesta a
 * q_canasta — la misma fuente que el preflight de generarAnimacion; el
 * cliente manda sobre lo que diga el modelo) y compila a geometría §10.
 * Exportada aparte para poder probar este camino sin red
 * (taller/tools/eval-animacion.mjs).
 */
export function compilarIntentIA(data, elementos, pista, texto = '', respuestas = null, posiciones = null) {
  // custom efectivo: Supabase (posiciones) + respuestas q_pos_* de la sesión
  // (idempotente si el llamador ya las fusionó).
  const custom = customConRespuestas(posiciones, respuestas);
  // La canasta del CLIENTE se impone ANTES de validar: el validador resuelve
  // las posiciones con nombre contra el lado atacado (el poste bajo de
  // 'norte' no es el de 'sur'), así que debe ver ya la canasta definitiva.
  const keyCliente = canastaResuelta(texto, respuestas);
  const bs = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  const intentIn = (data && data.intent && keyCliente && bs[keyCliente])
    ? { ...data.intent, canasta: keyCliente }
    : (data && data.intent);
  const v = validarIntent(intentIn, elementos, pista, { posiciones: custom });
  if (v.error) return v;
  // posiciones con nombre desconocido: el validador pide marcarlas (tipo A)
  // — se devuelven tal cual y paso2 corre su flujo de preguntas de siempre.
  if (v.preguntas) return { preguntas: v.preguntas };
  // Tramo 5a: defensa reactiva sobre el intent YA saneado (mismo criterio que
  // el camino local) — el modelo suele olvidar mover a la defensa en fases
  // posteriores; aquí el par declarado se sigue solo.
  const anim = compilarAnimacion(defensaReactiva(v.intent, elementos, pista), elementos, pista, { posiciones: custom });
  // los warnings del modelo solo se fusionan si están bien formados (el banner
  // de paso2.js pinta `"texto_original" — interpretacion`; un {} llegaría como
  // `"undefined" — undefined`).
  const warningsIA = (Array.isArray(data.warnings) ? data.warnings : [])
    .filter((w) => w && typeof w === 'object' && typeof w.texto_original === 'string' && typeof w.interpretacion === 'string');
  anim.warnings = [...v.warnings, ...warningsIA];
  anim._mock = false; // vino de la IA real, no del extractor local
  anim._ia = true;
  return anim;
}

// Los conos son estáticos y los configura el usuario (posición, función "fila"/
// "rodear", fila_config). El motor de IA nunca los mueve, así que el tablero es
// la fuente de verdad: sustituimos data.conos para que la config no se pierda
// si el modelo la omite o la pone a null. (Solo aplica al camino LEGADO de
// geometría completa: en el camino intent el compilador ya construye los conos
// desde el tablero, así que este problema desaparece de raíz.)
function reconciliarConos(data, elementos = []) {
  if (!data || !Array.isArray(data.fases)) return data; // preguntas/error: sin tocar
  const conos = (elementos || []).filter((e) => e.kind === 'cono');
  const iaById = new Map((data.conos || []).map((c) => [c.id, c]));
  data.conos = conos.map((c, i) => {
    const id = c.id || `cono_${i + 1}`;
    const base = { id, posicion: [c.x, c.y], funcion: c.funcion || 'decorativo', fila_config: c.fila_config || null };
    // Estructura (funcion, equipo, dirección) manda el board; pero respetamos el
    // n_jugadores de la IA por si sacó al primero de la fila a trabajar.
    if (base.funcion === 'fila' && base.fila_config) {
      const ia = iaById.get(id);
      const n = ia && ia.fila_config && Number.isFinite(ia.fila_config.n_jugadores) ? ia.fila_config.n_jugadores : base.fila_config.n_jugadores;
      base.fila_config = { ...base.fila_config, n_jugadores: n };
    }
    return base;
  });
  return data;
}

/** Dificultad sugerida por complejidad (§12). */
export function sugerirDificultad(anim) {
  if (!anim || !anim.fases) return 3;
  const fases = anim.fases.length;
  const jugadores = (anim.jugadores || []).length;
  const acciones = anim.fases.reduce((n, f) => n + (f.pases?.length || 0) + (f.tiros?.length || 0) + (f.bloqueos?.length || 0), 0);
  return Math.max(1, Math.min(6, 1 + fases + (acciones >= 2 ? 1 : 0) + (jugadores > 4 ? 1 : 0)));
}

/* ---- Extractor de intención local (sólo desarrollo) ---------------
   Interpreta texto+tablero con regex y produce un Intent (ia/compilador.js)
   — NUNCA geometría directamente (paths/Bézier/timings viven SOLO en el
   compilador; ver ese archivo). Esta es la pieza que en producción (Fase 2b,
   más adelante) pasa a ser el LLM real vía la Netlify Function. ---- */
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---- Resolución de canasta ---------------------------------
   Convención de cara al entrenador: Canasta 1 = clave 'norte',
   Canasta 2 = clave 'sur' (cuando la pista tiene dos aros). ---- */

// Canasta mencionada EXPLÍCITAMENTE en un texto: "canasta 1"/"canasta 2",
// "aro 1"/"aro 2", o "canasta norte"/"canasta sur". Devuelve la clave interna
// ('norte'/'sur') o null si el texto no la nombra.
export function canastaDelTexto(texto = '') {
  const m = String(texto).toLowerCase().match(/(?:canasta|aro)\s*(?:n[ºo°.]\s*)?(1|2|norte|sur)\b/);
  if (!m) return null;
  return (m[1] === '1' || m[1] === 'norte') ? 'norte' : 'sur';
}

// Canasta ya resuelta por el usuario: mención explícita en el texto, o
// respuesta previa a la pregunta fija 'q_canasta' ("Canasta 1"/"Canasta 2"),
// que se traduce por EL MISMO camino que el texto. null = sin resolver.
function canastaResuelta(texto, respuestas) {
  const porTexto = canastaDelTexto(texto);
  if (porTexto) return porTexto;
  const r = (respuestas || []).find((x) => x && x.id === 'q_canasta');
  return r ? canastaDelTexto(String(r.respuesta ?? '')) : null;
}

// Pregunta obligatoria de canasta (decisión de producto): con DOS aros y sin
// resolución por texto/respuesta, el sistema pregunta — nunca infiere en
// silencio por cercanía. Devuelve la pregunta §8.3 o null si no hace falta.
export function necesitaPreguntaCanasta(texto, pista, respuestas = null) {
  const baskets = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  if (Object.keys(baskets).length < 2) return null;   // un solo aro: sin ambigüedad
  if (canastaResuelta(texto, respuestas)) return null;
  if ((respuestas || []).some((r) => r && r.id === 'q_canasta')) return null; // ya respondida (aunque sea texto libre no interpretable)
  return { id: 'q_canasta', tipo: 'B', texto: '¿Hacia qué canasta ataca esta jugada?', opciones: ['Canasta 1', 'Canasta 2'] };
}

// Canasta (clave + posición) más cercana a un punto. Solo se usa como
// FALLBACK cuando no hay ambigüedad que resolver (un solo aro) o cuando una
// respuesta libre a q_canasta no se pudo interpretar.
function aroMasCercano(pista, p) {
  const bs = (PISTAS[pista] && PISTAS[pista].baskets) || { norte: [0.5, 0.1] };
  let key = 'norte', best = Infinity;
  for (const k in bs) { const d = Math.hypot(bs[k][0] - p.x, bs[k][1] - p.y); if (d < best) { best = d; key = k; } }
  return { key, pos: bs[key] || [0.5, 0.1] };
}
// verbos/sustantivos de acción reconocibles; si el texto no contiene ninguno es ambiguo.
const CON_ACCION = /pase|pas[oó]|corte|cortar|bloque|pick|tiro|tira|lanza|dribl|bote|transici|contraataque|rueda|rebote|ayuda|cambio|switch|defiend|presi[oó]n/i;

// Equipo al que la descripción asigna defender (p.ej. "el equipo 2 defiende" o
// "defiende el equipo 3"). Heurística robusta al orden de palabras: el defensor
// es la mención de "equipo N" MÁS CERCANA a un verbo de defensa, mire al lado que
// mire. Acepta número (1-4) o letra (A-D); devuelve la letra interna o null.
function equipoQueDefiende(texto = '') {
  const low = texto.toLowerCase();
  const defs = [...low.matchAll(/defien|defens/g)].map((m) => m.index);
  if (!defs.length) return null;
  const teams = [...low.matchAll(/equipo\s*([1-4a-d])/g)].map((m) => ({ pos: m.index, tok: m[1] }));
  let best = null, bestDist = Infinity;
  for (const t of teams) for (const d of defs) {
    const dd = Math.abs(d - t.pos);
    if (dd < bestDist) { bestDist = dd; best = t.tok; }
  }
  if (best == null) {                             // ninguna mención "equipo N" en el texto
    const m = low.match(/(?:el|los)\s*([1-4])\s*(?:defien|defens)/);
    if (!m) return null;
    best = m[1];
  }
  const tok = best.toUpperCase();
  return /[1-4]/.test(tok) ? (TEAM_FROM_NUM[tok] || null) : tok;
}

// Construye un evento de Intent con todos los campos a null salvo los dados
// — ver la forma del Intent documentada en ia/compilador.js.
const evento = (jugador, tipo, extra = {}) => ({ jugador, tipo, hacia: null, a: null, cono_id: null, marca: null, bloqueado_id: null, ...extra });

/**
 * Extrae la INTENCIÓN (§ ia/compilador.js) de texto+tablero con regex — NUNCA
 * geometría (eso es compilarAnimacion). Devuelve { intent, warnings } en el
 * caso normal, o { preguntas:[...] } / { error } igual que antes (§8.3).
 */
function extraerIntentoLocal(texto = '', elementos = [], pista = 'entera', respuestas = null) {
  const jugadoresBoard = elementos.filter((e) => e.kind === 'jugador');
  const conos = elementos.filter((e) => e.kind === 'cono');
  const balones = elementos.filter((e) => e.kind === 'balon');
  const filasConJugadores = conos.filter((c) => c.funcion === 'fila' && c.fila_config && (c.fila_config.n_jugadores || 0) > 0);
  if (!jugadoresBoard.length && !filasConJugadores.length) return { error: 'Coloca al menos un jugador (o una fila con jugadores) antes de generar la animación.' };

  // Descripción breve o sin ninguna acción reconocible y sin respuestas previas -> pregunta (§8.3).
  if ((texto.trim().length < 8 || !CON_ACCION.test(texto)) && !respuestas) {
    return { preguntas: [{ id: 'q1', tipo: 'B', texto: 'La descripción es muy breve. ¿Qué trabaja sobre todo este ejercicio?', opciones: ['Ataque', 'Defensa', 'Transición'] }] };
  }

  // El extractor regex NO monta series de fila: los SIGUIENTES de cada cola
  // (fila1_2… — _extraFila, Tramo 3c) se ignoran aquí; solo el intent del
  // modelo (o uno escrito a mano) los usa.
  const J = sintetizarJugadores(elementos).filter((j) => !j._extraFila);
  // Rol por descripción: el equipo que el texto manda defender son defensores; el
  // resto, atacantes. Si no se menciona defensa, todos atacan (equipos neutrales).
  const defTeam = equipoQueDefiende(texto);
  let atacantes = defTeam ? J.filter((j) => j.equipo !== defTeam) : J.slice();
  let defensores = defTeam ? J.filter((j) => j.equipo === defTeam) : [];
  if (!atacantes.length) { atacantes = J.slice(); defensores = []; } // todos del equipo defensor: no nos quedamos sin ataque

  // Protagonista (portador inicial): si hay UNA fila con gente y el texto
  // sugiere que es ella quien trabaja ("fila"/"cola" en el texto, o
  // directamente no hay ningún balón en el tablero y por tanto no hay otro
  // candidato razonable), el primero de la fila es el portador DIRECTAMENTE
  // — sin esto, "el primero de la fila sale botando" con el balón lejos del
  // cono elegía por cercanía al atacante equivocado (bug ya arreglado: la
  // fila quedaba inerte). Si no aplica, portador = atacante más cercano al
  // balón (o el primero, si no hay balón).
  const filaAtacantes = atacantes.filter((a) => /^fila/.test(a.id));
  const filaEsProtagonista = filaAtacantes.length > 0 && (/(fila|cola)/i.test(texto) || balones.length === 0);
  let carrier;
  if (filaEsProtagonista) {
    carrier = filaAtacantes[0];
  } else {
    carrier = atacantes[0];
    if (balones.length) { let best = Infinity; for (const a of atacantes) { const d = dist(a, balones[0]); if (d < best) { best = d; carrier = a; } } }
  }
  const receptor = atacantes.find((a) => a !== carrier);

  // Canasta: manda la mención explícita del texto (o la respuesta a
  // 'q_canasta'); la posición del portador solo decide cuando no hay
  // resolución válida para esta pista (un solo aro, o respuesta libre no
  // interpretable — con dos aros y sin resolver, generarAnimacion() ya
  // habría preguntado antes de llegar aquí).
  const keyResuelta = canastaResuelta(texto, respuestas);
  const bsPista = (PISTAS[pista] && PISTAS[pista].baskets) || {};
  const canasta = (keyResuelta && bsPista[keyResuelta]) ? keyResuelta : aroMasCercano(pista, carrier).key;

  // Defensa: SIEMPRE el mismo equipo en todas las fases — limitación real de
  // interpretar un único bloque de texto con regex (detectar "cambia de rol a
  // mitad de jugada" requiere NLU de verdad; eso es la Fase 2b con el LLM).
  // Cada defensor marca al atacante más cercano; solo "activos" (portador y
  // receptor) reciben marca no nula en fase 1 (el compilador solo mueve al
  // defensor si su marca no es null) — el resto de fases cuentan a todos los
  // defensores como tal (fase.defensores) pero con marca null (no se mueven),
  // igual que el mock viejo.
  const activos = new Set([carrier.id, receptor && receptor.id].filter(Boolean));
  const marcaDe = (def) => atacantes.reduce((best, a) => (!best || dist(def, a) < dist(def, best) ? a : best), atacantes[0]);
  const eventosDefiendeQuietos = () => defensores.map((d) => evento(d.id, 'defiende', { marca: null }));

  const rodearConos = conos.filter((c) => c.funcion === 'rodear');

  const fases = [];

  // Fase 1: el portador bota (+ rodea conos "rodear"), el receptor corta, los
  // defensores marcan (solo se mueven si su marca está activa esta fase).
  const eventos1 = [
    evento(carrier.id, 'bote', { hacia: 'canasta' }),
    ...rodearConos.map((c) => evento(carrier.id, 'rodea_cono', { cono_id: c.id })),
  ];
  if (receptor) eventos1.push(evento(receptor.id, 'corte', { hacia: 'canasta' }));
  for (const d of defensores) {
    const hombre = marcaDe(d);
    eventos1.push(evento(d.id, 'defiende', { marca: (hombre && activos.has(hombre.id)) ? hombre.id : null }));
  }
  fases.push({ eventos: eventos1 });

  // Fase(s) siguientes: pase + tiro, o tiro directo si juega solo.
  if (receptor) {
    fases.push({ eventos: [evento(carrier.id, 'pase', { a: receptor.id }), ...eventosDefiendeQuietos()] });
    fases.push({ eventos: [evento(receptor.id, 'tiro'), ...eventosDefiendeQuietos()] });
  } else {
    fases.push({ eventos: [evento(carrier.id, 'tiro'), ...eventosDefiendeQuietos()] });
  }

  // "Volver a la fila": si el texto lo pide y el portador salió de una fila,
  // una fase final lo lleva hasta el FINAL de su cola.
  if (carrier._tail && /vuelv\w*[^.]{0,15}(fila|cola)/i.test(texto)) {
    fases.push({ eventos: [evento(carrier.id, 'vuelve_a_fila'), ...eventosDefiendeQuietos()] });
  }

  const warnings = /lateral/i.test(texto)
    ? [{ texto_original: 'en el lateral', interpretacion: 'Ala izquierda (x=0.15)', campo: 'posicion' }]
    : [];

  return { intent: { canasta, fases }, warnings };
}
