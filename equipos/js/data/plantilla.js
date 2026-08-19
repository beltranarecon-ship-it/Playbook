/* ============================================================
   plantilla.js — LA PLANTILLA QUE SE PUEDE INTERROGAR (Tramo 3.12).
   Módulo PURO: sin DOM, sin Supabase. Lo importan la ficha del equipo
   y el banco Node.

   ── QUÉ RESUELVE ────────────────────────────────────────────
   La plantilla era una lista con el estado de cada jugador. Con
   catorce críos eso se lee; con catorce críos y tres meses de historia
   detrás, las preguntas que se hacen de verdad no se pueden contestar
   mirándola:

     · ¿quién ha faltado esta semana?
     · ¿quién no ha subido de nivel en todo el trimestre?
     · ¿cuánto ha entrenado de verdad cada uno?

   Las tres salen de datos que ya se recogen —asistencia (M5), rúbrica
   (3.7) y minutos activos (3.1)—; lo que faltaba era poder preguntar.

   ── LOS MINUTOS ACTIVOS DE UN JUGADOR ───────────────────────
   No es «los minutos de las sesiones a las que vino»: es la suma de
   los minutos ACTIVOS de cada una, y esos dependen de cuánta gente
   hubo ESE día (3.1). Un martes que vinieron seis rinde más por crío
   que un jueves que vinieron dieciocho, y esa diferencia es justo lo
   que el número tiene que enseñar.

   Solo suma quien estuvo. El que no vino no entrenó: contarle los
   minutos de esa sesión sería premiarle por faltar.
   ============================================================ */

import { minutosDeSesion } from './minutos.js';

const VINO = new Set(['presente', 'tarde']);

/**
 * Minutos activos acumulados por jugador.
 *
 * @param opts.sesiones          [{id, fecha, estado}]
 * @param opts.bloquesPorSesion  { [session_id]: [bloques] }
 * @param opts.asistencia        [{player_id, session_id, estado}]
 * @param opts.requisitosDe      (bloque) => requisitos|null
 * @returns { [player_id]: {minutos, sesiones} }
 */
export function minutosPorJugador({ sesiones = [], bloquesPorSesion = {}, asistencia = [], requisitosDe = null } = {}) {
  // quién estuvo en cada sesión
  const porSesion = new Map();
  for (const a of asistencia) {
    if (!a?.session_id || !VINO.has(a.estado)) continue;
    if (!porSesion.has(a.session_id)) porSesion.set(a.session_id, []);
    porSesion.get(a.session_id).push(a.player_id);
  }

  const out = {};
  for (const s of sesiones) {
    if (!s || s.estado === 'cancelada') continue;
    const presentes = porSesion.get(s.id) || [];
    if (!presentes.length) continue;

    const m = minutosDeSesion(bloquesPorSesion[s.id] || [], {
      jugadores: presentes.length,   // los que hubo ESE día
      requisitosDe,
    });
    if (!m.minutos) continue;

    for (const p of presentes) {
      const f = out[p] ||= { minutos: 0, sesiones: 0 };
      f.minutos += m.minutos;
      f.sesiones += 1;
    }
  }
  for (const p of Object.keys(out)) out[p].minutos = Math.round(out[p].minutos);
  return out;
}

/* ── Asistencia por periodo ────────────────────────────────── */

const DIA = 86400000;

/**
 * Asistencia de cada jugador en un periodo.
 *
 * «Semana» son los últimos siete días y no la semana natural: el lunes
 * por la mañana, una semana natural está vacía y la pregunta —¿quién
 * ha faltado últimamente?— se queda sin respuesta justo cuando se hace.
 *
 * @returns { [player_id]: {vino, total, pct} } — pct null sin sesiones
 */
export function asistenciaPorPeriodo(asistencia, { desde = null, hasta = null } = {}) {
  const out = {};
  for (const a of asistencia || []) {
    const f = String(a?.fecha || '').slice(0, 10);
    if (!a?.player_id) continue;
    if (desde && f && f < desde) continue;
    if (hasta && f && f > hasta) continue;
    const r = out[a.player_id] ||= { vino: 0, total: 0, pct: null };
    r.total += 1;
    if (VINO.has(a.estado)) r.vino += 1;
  }
  for (const k of Object.keys(out)) {
    const r = out[k];
    r.pct = r.total ? Math.round((r.vino / r.total) * 100) : null;
  }
  return out;
}

/** Los últimos siete días hasta `hoy`, en ISO. */
export function ultimaSemana(hoy = new Date()) {
  const d = hoy instanceof Date ? hoy : new Date(hoy);
  const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  return { desde: iso(new Date(d.getTime() - 6 * DIA)), hasta: iso(d) };
}

/* ── Los filtros ───────────────────────────────────────────── */

/** Los tres ejes por los que se puede preguntar (§6). */
export const FILTROS_ESTADO = ['activo', 'lesionado', 'baja'];
export const FILTROS_RENDIMIENTO = ['subido', 'bajado', 'sin_mirar'];

/**
 * ¿Este jugador pasa los filtros?
 *
 * @param opts.estados      [] = todos
 * @param opts.rendimiento  [] = todos
 * @param opts.asistenciaMax  % por debajo del cual interesa (null = no filtra)
 * @param opts.resumenes    { [player_id]: {subidas, bajadas, miradas} } de la rúbrica
 * @param opts.asistencia   { [player_id]: {pct} } del periodo elegido
 */
export function pasaFiltros(jugador, {
  estados = [], rendimiento = [], asistenciaMax = null,
  resumenes = {}, asistencia = {},
} = {}) {
  if (!jugador) return false;
  if (estados.length && !estados.includes(jugador.estado)) return false;

  if (rendimiento.length) {
    const r = resumenes[jugador.id] || { subidas: 0, bajadas: 0, miradas: 0 };
    const casa = rendimiento.some((k) => (
      k === 'subido' ? r.subidas > 0
        : k === 'bajado' ? r.bajadas > 0
          : /* sin_mirar */ !r.miradas
    ));
    if (!casa) return false;
  }

  if (asistenciaMax != null) {
    const a = asistencia[jugador.id];
    // sin datos NO es lo mismo que faltar: no se cuela en el filtro
    if (!a || a.pct == null || a.pct > asistenciaMax) return false;
  }
  return true;
}

/** «12 de 14 · 86 %» / «sin sesiones» */
export function textoAsistencia(a) {
  if (!a || a.pct == null) return 'sin sesiones';
  return `${a.vino} de ${a.total} · ${a.pct} %`;
}

/** «184 min activos en 12 sesiones» */
export function textoMinutos(m) {
  if (!m || !m.sesiones) return 'sin minutos todavía';
  return `${m.minutos} min activos en ${m.sesiones} ${m.sesiones === 1 ? 'sesión' : 'sesiones'}`;
}
