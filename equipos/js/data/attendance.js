/* ============================================================
   attendance.js — asistencia por sesión (M5). Snapshot denso: se
   guarda una fila por jugador del roster, no solo por los ausentes
   (el motor puro asistencia.js arma la lista). RLS por sesión.
   ============================================================ */

import { supabase, leerTodo, porLotes } from './_client.js';

const COLS = 'session_id, player_id, estado, motivo';
/** Orden de la PK: determinista, y el que necesita la paginación. */
const enOrden = (q) => q.order('session_id').order('player_id');

/** Lo guardado para una sesión. */
export async function getAsistencia(sessionId) {
  const { data, error } = await enOrden(supabase
    .from('attendance').select(COLS).eq('session_id', sessionId));
  if (error) throw error;
  return data ?? [];
}

/**
 * Asistencia de VARIAS sesiones de una tacada (dossier M7). → {sessionId: [filas]}
 * Paginado: una temporada entera pasa de las 1000 filas que Supabase sirve
 * por defecto, y el recorte no da error (ver leerTodo en _client.js).
 */
export async function getAsistenciaSesiones(sessionIds) {
  if (!sessionIds?.length) return {};
  const out = {};
  for (const lote of porLotes(sessionIds)) {
    const filas = await leerTodo(() => enOrden(supabase
      .from('attendance').select(COLS).in('session_id', lote)));
    for (const f of filas) (out[f.session_id] ||= []).push(f);
  }
  return out;
}

/**
 * Guarda la lista completa de una tacada (upsert por (session_id, player_id)).
 * Denso = no hay que borrar nada: cada jugador tiene su fila y se actualiza.
 */
export async function guardarAsistencia(filas) {
  if (!filas?.length) return;
  const { error } = await supabase
    .from('attendance')
    .upsert(filas, { onConflict: 'session_id,player_id' });
  if (error) throw error;
}

/**
 * Todas las filas de asistencia del equipo en la temporada (para el
 * % acumulado por jugador). Excluye las sesiones canceladas: si se
 * cancela DESPUÉS de pasar lista, esas filas ya no cuentan.
 */
export async function getAsistenciaEquipo(teamId, seasonId) {
  const data = await leerTodo(() => supabase
    .from('attendance')
    .select('player_id, estado, sessions!inner(id, team_id, season_id, estado, fecha)')
    .eq('sessions.team_id', teamId)
    .eq('sessions.season_id', seasonId)
    .neq('sessions.estado', 'cancelada')
    .order('session_id')
    .order('player_id'));
  return data.map((r) => ({
    player_id: r.player_id,
    estado: r.estado,
    session_id: r.sessions?.id ?? null,
    fecha: r.sessions?.fecha ?? null,
  }));
}
