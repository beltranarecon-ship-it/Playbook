/* ============================================================
   reflection.js — plantilla de reflexión del equipo y respuestas
   de la sesión (M5). El casado plantilla↔respuestas vive en el
   motor puro reflexion.js; aquí solo se persiste.
   `sessions.evaluada_at` lo sella un trigger de BD al escribir la
   primera respuesta: no se toca desde el cliente.
   ============================================================ */

import { supabase, leerTodo, porLotes } from './_client.js';

const COLS_Q_BASE = 'id, team_id, clave, etiqueta, tipo, orden, activa';

/* `ambito` (preguntas) y `player_id` (respuestas) los añade la 027. Se
   piden y, si no existen, se sigue sin ellos: un equipo sin poder
   cerrar sesiones por una migración pendiente sería mucho peor que no
   tener preguntas de jugador. */
let sin027 = false;
const COLS_Q = () => (sin027 ? COLS_Q_BASE : `${COLS_Q_BASE}, ambito`);
const falta027 = (error) => {
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  return m.includes('column') && (m.includes('ambito') || m.includes('player_id'));
};

// ── Plantilla (por equipo) ────────────────────────────────────
export async function getPreguntas(teamId) {
  const pide = () => supabase
    .from('reflection_questions')
    .select(COLS_Q())
    .eq('team_id', teamId)
    .order('orden')
    .order('created_at');
  let { data, error } = await pide();
  if (error && falta027(error)) { sin027 = true; ({ data, error } = await pide()); }
  if (error) throw error;
  return data ?? [];
}

export async function crearPregunta({ team_id, clave, etiqueta, tipo, orden, ambito = 'equipo' }) {
  const { data, error } = await supabase
    .from('reflection_questions')
    .insert({ team_id, clave, etiqueta: etiqueta.trim(), tipo, orden, ...(sin027 ? {} : { ambito: ambito || 'equipo' }) })
    .select(COLS_Q())
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
  let { data, error } = await supabase
    .from('reflection_answers')
    .select(`session_id, clave_snapshot, question_id, etiqueta_snapshot, tipo_snapshot, valor_num, valor_texto${sin027 ? '' : ', player_id'}`)
    .eq('session_id', sessionId);
  if (error && falta027(error)) {
    sin027 = true;
    ({ data, error } = await supabase
      .from('reflection_answers')
      .select('session_id, clave_snapshot, question_id, etiqueta_snapshot, tipo_snapshot, valor_num, valor_texto')
      .eq('session_id', sessionId));
  }
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

/* ¿Es el error de «ese ON CONFLICT no cuadra con ningún índice»? */
const sinIndiceUnico = (error) => error?.code === '42P10'
  || /no unique or exclusion constraint matching/i.test(error?.message || '');

let sin036 = false;

/**
 * Escribe las respuestas. Con la 036 va de un upsert; sin ella, fila a
 * fila.
 *
 * ── POR QUÉ HAY PLAN B ──────────────────────────────────────
 * Porque la migración se aplica cuando el entrenador entra en Supabase,
 * y entre que sale esta versión y eso pasa puede haber días. Perder la
 * reflexión de una sesión durante esos días —que es lo que hacía el
 * upsert roto, y encima con un error en inglés que no dice nada— es
 * mucho peor que hacer tres peticiones en vez de una.
 */
async function escribir(filas) {
  if (!sin036) {
    const { error } = await supabase
      .from('reflection_answers')
      .upsert(filas, { onConflict: 'session_id,clave_snapshot,player_id' });
    if (!error) return;
    if (!sinIndiceUnico(error)) throw error;
    sin036 = true;
    console.warn('[reflexión] falta la migración 036; se guarda fila a fila.');
  }
  /* Sin índice al que apuntar: se mira si ya está y se actualiza o se
     inserta. Es lo que haría el upsert, dicho a mano. */
  for (const f of filas) {
    let q = supabase.from('reflection_answers').select('id')
      .eq('session_id', f.session_id).eq('clave_snapshot', f.clave_snapshot);
    q = f.player_id ? q.eq('player_id', f.player_id) : q.is('player_id', null);
    const { data, error } = await q.limit(1);
    if (error) throw error;
    if (data && data.length) {
      const { error: e2 } = await supabase.from('reflection_answers')
        .update({ valor_num: f.valor_num ?? null, valor_texto: f.valor_texto ?? null })
        .eq('id', data[0].id);
      if (e2) throw e2;
    } else {
      const { error: e3 } = await supabase.from('reflection_answers').insert(f);
      if (e3) throw e3;
    }
  }
}

/**
 * Escribe las respuestas con contenido y borra las que se han vaciado
 * (una respuesta en blanco no existe: no deja fila).
 */
export async function guardarRespuestas(sessionId, { aGuardar, aBorrar }) {
  /* Un solo upsert por las tres columnas (migración 036). Antes eran
     dos, uno por cada índice PARCIAL de la 027, y ninguno de los dos
     funcionaba: un `ON CONFLICT` solo puede resolverse contra un índice
     parcial si la sentencia repite su predicado, y eso desde la API
     REST no se puede mandar. La reflexión no se guardaba nunca. */
  if (sin027) {
    // sin la 027 no hay preguntas de jugador: lo suyo no se puede guardar
    aGuardar = (aGuardar || []).filter((r) => !r.player_id).map(({ player_id, ...r }) => r);
    aBorrar = (aBorrar || []).filter((b) => !(typeof b === 'object' && b.player_id));
  }
  const filas = aGuardar || [];
  if (filas.length) await escribir(filas);

  /* Borrar es por clave Y jugador: sin lo segundo, dejar en blanco la
     respuesta de un crío borraría la de todos los demás. */
  for (const b of aBorrar || []) {
    const clave = typeof b === 'string' ? b : b.clave;
    const player = typeof b === 'string' ? null : (b.player_id ?? null);
    let q = supabase.from('reflection_answers').delete()
      .eq('session_id', sessionId).eq('clave_snapshot', clave);
    q = player ? q.eq('player_id', player) : q.is('player_id', null);
    const { error } = await q;
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
