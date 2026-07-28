/* ============================================================
   sessions.js — sesiones: lectura por rango, alta manual, ciclo
   de vida (promover/reprogramar/cancelar) y aplicación del plan
   de regeneración. La RLS por equipo recorta todo por debajo.
   ============================================================ */

import { supabase } from './_client.js';

// La temporada vive en seasons.js (crear/activar/leer con tolerancia); se
// re-exporta aquí porque media app la importa desde este módulo.
export { getTemporadaActiva } from './seasons.js';

const COLS = 'id, team_id, season_id, slot_id, fecha, slot_date, hora_inicio, hora_fin, lugar, titulo, notas, estado, origen, cancel_motivo, slot_duracion_min, duracion_total_min, carga_total';

export async function getSesionesRango({ desde, hasta, teamId = null }) {
  let q = supabase
    .from('sessions')
    .select(COLS)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
    .order('hora_inicio', { nullsFirst: false });
  if (teamId) q = q.eq('team_id', teamId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Una sesión con todas sus columnas (planificador M4). */
export async function getSesion(id) {
  const { data, error } = await supabase
    .from('sessions')
    .select(COLS + ', material, evaluada_at')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

/** Sesiones AUTO de un equipo en la temporada (para la reconciliación). */
export async function getSesionesAuto(teamId, seasonId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('id, origen, estado, slot_id, slot_date, fecha, hora_inicio, hora_fin, lugar, slot_duracion_min')
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .eq('origen', 'auto');
  if (error) throw error;
  return data ?? [];
}

/**
 * Una sesión creada a mano nace 'programada' (es un acto deliberado).
 * `created_by` NO se manda: lo impone `sessions_guard` con auth.uid(), como
 * en objectives/matches/team_notes. La autoría no la declara el cliente.
 */
export async function crearSesionManual({ team_id, season_id, fecha, hora_inicio, hora_fin, lugar, notas }) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({
      team_id, season_id, fecha,
      hora_inicio: hora_inicio || null,
      hora_fin: hora_fin || null,
      lugar: lugar?.trim() || null,
      notas: notas?.trim() || null,
      estado: 'programada',
      origen: 'manual',
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Reprogramar mueve `fecha`; slot_date queda como ancla de reconciliación. */
export async function reprogramarSesion(id, nuevaFecha) {
  const { error } = await supabase.from('sessions').update({ fecha: nuevaFecha }).eq('id', id);
  if (error) throw error;
}

export async function promoverSesion(id) {
  const { error } = await supabase.from('sessions').update({ estado: 'programada' }).eq('id', id);
  if (error) throw error;
}

/**
 * Cierra la sesión (M5): pasó y entra en el histórico. `evaluada_at` no
 * se toca aquí — lo sella un trigger al escribir la primera respuesta de
 * la reflexión, para que "evaluada" signifique siempre lo mismo.
 */
export async function marcarRealizada(id) {
  const { error } = await supabase.from('sessions').update({ estado: 'realizada' }).eq('id', id);
  if (error) throw error;
}

/** Cabecera editable de la sesión (título/notas). No toca estado ni identidad. */
export async function guardarCabeceraSesion(id, patch) {
  const campos = {};
  if ('titulo' in patch) campos.titulo = patch.titulo?.trim() || null;
  if ('notas' in patch) campos.notas = patch.notas?.trim() || null;
  if (!Object.keys(campos).length) return;
  const { error } = await supabase.from('sessions').update(campos).eq('id', id);
  if (error) throw error;
}

export async function cancelarSesion(id, motivo) {
  const { error } = await supabase
    .from('sessions')
    .update({ estado: 'cancelada', cancel_motivo: motivo })
    .eq('id', id);
  if (error) throw error;
}

/** Restaurar una cancelada (deshacer): vuelve a programada sin motivo. */
export async function restaurarSesion(id) {
  const { error } = await supabase
    .from('sessions')
    .update({ estado: 'programada', cancel_motivo: null })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Solo la RLS permite borrar preliminares auto (andamiaje), y desde 015 §7
 * tampoco si ya tienen lista o reflexión. Un DELETE que la policy rechaza
 * NO da error: filtra la fila y responde 0. Por eso se cuenta lo que
 * REALMENTE se ha borrado (mismo criterio que aplicarPlan).
 * @returns true si se borró; false si la policy la protegió.
 */
export async function borrarPreliminar(id) {
  const { data, error } = await supabase.from('sessions').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * Aplica un plan de planRegeneracion() para un equipo/temporada.
 * Orden: borrar → actualizar → insertar (así el índice único parcial
 * (slot_id, slot_date) nunca colisiona en el camino).
 */
export async function aplicarPlan(teamId, seasonId, plan) {
  // La policy de borrado puede rechazar filas en silencio (p. ej. una
  // preliminar que ya tiene asistencia o reflexión, M5): se cuenta lo que
  // REALMENTE se ha borrado, no lo que se pidió borrar.
  let borradas = 0;
  if (plan.aBorrar.length) {
    const { data, error } = await supabase
      .from('sessions').delete().in('id', plan.aBorrar).select('id');
    if (error) throw error;
    borradas = data?.length ?? 0;
  }
  for (const u of plan.aActualizar) {
    // guarda anti-carrera: el patch solo aterriza si la sesión SIGUE intacta
    // (preliminar y en su fecha teórica); si otro tab la tocó, 0 filas y ya.
    let q = supabase.from('sessions').update(u.patch).eq('id', u.id).eq('estado', 'preliminar');
    if (u.slot_date) q = q.eq('fecha', u.slot_date);
    const { error } = await q;
    if (error) throw error;
  }
  if (plan.aInsertar.length) {
    const filas = plan.aInsertar.map((o) => ({
      team_id: teamId,
      season_id: seasonId,
      slot_id: o.slot_id,
      slot_date: o.slot_date,
      fecha: o.slot_date,           // nace en su fecha teórica
      hora_inicio: o.hora_inicio,
      hora_fin: o.hora_fin,
      lugar: o.lugar,
      slot_duracion_min: o.slot_duracion_min,
      estado: 'preliminar',
      origen: 'auto',
      // created_by lo pone sessions_guard (auth.uid()), no el cliente
    }));
    const { error } = await supabase.from('sessions').insert(filas);
    if (error) throw error;
  }
  return {
    insertadas: plan.aInsertar.length,
    actualizadas: plan.aActualizar.length,
    borradas,
    conservadas: plan.aBorrar.length - borradas,   // tenían cierre registrado
  };
}
