/* ============================================================
   reflection.js — plantilla de reflexión del equipo y respuestas
   de la sesión (M5). El casado plantilla↔respuestas vive en el
   motor puro reflexion.js; aquí solo se persiste.
   `sessions.evaluada_at` lo sella un trigger de BD al escribir la
   primera respuesta: no se toca desde el cliente.
   ============================================================ */

import { supabase, leerTodo, porLotes } from './_client.js';

const COLS_Q = 'id, team_id, clave, etiqueta, tipo, orden, activa';

// ── Plantilla (por equipo) ────────────────────────────────────
export async function getPreguntas(teamId) {
  const { data, error } = await supabase
    .from('reflection_questions')
    .select(COLS_Q)
    .eq('team_id', teamId)
    .order('orden')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function crearPregunta({ team_id, clave, etiqueta, tipo, orden }) {
  const { data, error } = await supabase
    .from('reflection_questions')
    .insert({ team_id, clave, etiqueta: etiqueta.trim(), tipo, orden })
    .select(COLS_Q)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPregunta(id, patch) {
  const { error } = await supabase.from('reflection_questions').update(patch).eq('id', id);
  if (error) throw error;
}

/** Borrar una pregunta NO borra lo ya respondido (question_id → NULL);
 *  la respuesta se conserva como huérfana gracias a clave_snapshot. */
export async function borrarPregunta(id) {
  const { error } = await supabase.from('reflection_questions').delete().eq('id', id);
  if (error) throw error;
}

/** Reescribe el orden tras subir/bajar preguntas. */
export async function guardarOrdenPreguntas(filas) {
  for (const f of filas) {
    const { error } = await supabase
      .from('reflection_questions').update({ orden: f.orden }).eq('id', f.id);
    if (error) throw error;
  }
}

/** Repone las preguntas por defecto que falten (RPC; no pisa las propias). */
export async function restaurarPlantilla(teamId) {
  const { data, error } = await supabase.rpc('ensure_reflection_template', { p_team_id: teamId });
  if (error) throw error;
  return data ?? 0;
}

// ── Respuestas (por sesión) ───────────────────────────────────
export async function getRespuestas(sessionId) {
  const { data, error } = await supabase
    .from('reflection_answers')
    .select('session_id, clave_snapshot, question_id, etiqueta_snapshot, tipo_snapshot, valor_num, valor_texto')
    .eq('session_id', sessionId);
  if (error) throw error;
  return data ?? [];
}

/**
 * Respuestas de VARIAS sesiones de una tacada (dossier M7). → {sessionId: [resp]}
 * Paginado y en orden de PK: sin esto una temporada larga se recortaba en las
 * 1000 filas por defecto de Supabase, sin error (ver leerTodo en _client.js).
 */
export async function getRespuestasSesiones(sessionIds) {
  if (!sessionIds?.length) return {};
  const out = {};
  for (const lote of porLotes(sessionIds)) {
    const filas = await leerTodo(() => supabase
      .from('reflection_answers')
      .select('session_id, clave_snapshot, etiqueta_snapshot, tipo_snapshot, valor_num, valor_texto')
      .in('session_id', lote)
      .order('session_id').order('clave_snapshot'));
    for (const r of filas) (out[r.session_id] ||= []).push(r);
  }
  return out;
}

/**
 * Escribe las respuestas con contenido y borra las que se han vaciado
 * (una respuesta en blanco no existe: no deja fila).
 */
export async function guardarRespuestas(sessionId, { aGuardar, aBorrar }) {
  if (aGuardar?.length) {
    const { error } = await supabase
      .from('reflection_answers')
      .upsert(aGuardar, { onConflict: 'session_id,clave_snapshot' });
    if (error) throw error;
  }
  if (aBorrar?.length) {
    const { error } = await supabase
      .from('reflection_answers').delete()
      .eq('session_id', sessionId)
      .in('clave_snapshot', aBorrar);
    if (error) throw error;
  }
}

/**
 * Cumplimiento por sesión en un rango — SIEMPRE por la vista
 * (CONTRACT: nadie lee reflection_answers para esto).
 */
export async function getCumplimientoRango({ desde, hasta, teamId = null }) {
  let q = supabase
    .from('v_session_cumplimiento')
    .select('session_id, team_id, season_id, fecha, cumplimiento, evaluada_at')
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha');
  if (teamId) q = q.eq('team_id', teamId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}
