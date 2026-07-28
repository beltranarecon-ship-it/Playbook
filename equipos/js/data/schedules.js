/* ============================================================
   schedules.js — horarios semanales (slots) + periodos sin
   entreno + orquestación de la regeneración (motor puro).
   Los slots que se quitan se DESACTIVAN (activo=false), nunca se
   borran: sus sesiones conservan slot_id y la reconciliación puede
   podar las preliminares intactas (regla del motor).
   ============================================================ */

import { supabase } from './_client.js';
import { expandirTemporada, planRegeneracion } from './programacion.js';
import { getSesionesAuto } from './sessions.js';

// ── Slots ────────────────────────────────────────────────────
export async function getSlots(teamId, seasonId, { soloActivos = true } = {}) {
  let q = supabase
    .from('team_schedules')
    .select('id, team_id, season_id, weekday, hora_inicio, hora_fin, lugar, activo')
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('weekday')
    .order('hora_inicio');
  if (soloActivos) q = q.eq('activo', true);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Slots ACTIVOS del equipo en OTRAS temporadas. Al abrir temporada nueva el
 * equipo se queda sin horarios (son de cada temporada) y hay que reescribir a
 * mano lo mismo de siempre; esto permite ofrecer "copiar los del año pasado".
 */
export async function getSlotsOtrasTemporadas(teamId, seasonIdActual) {
  const { data, error } = await supabase
    .from('team_schedules')
    .select('id, season_id, weekday, hora_inicio, hora_fin, lugar')
    .eq('team_id', teamId)
    .eq('activo', true)
    .neq('season_id', seasonIdActual)
    .order('weekday')
    .order('hora_inicio');
  if (error) throw error;
  return data ?? [];
}

/**
 * Sincroniza los slots editados con la BD.
 * @param editados [{id?, weekday, hora_inicio, hora_fin, lugar}] — sin id = nuevo
 */
export async function guardarSlots(teamId, seasonId, editados) {
  const { data: { user } } = await supabase.auth.getUser();
  const actuales = await getSlots(teamId, seasonId);
  const editadosConId = new Map(editados.filter((s) => s.id).map((s) => [s.id, s]));

  // desactivar los que ya no están
  const aDesactivar = actuales.filter((a) => !editadosConId.has(a.id)).map((a) => a.id);
  if (aDesactivar.length) {
    const { error } = await supabase
      .from('team_schedules').update({ activo: false }).in('id', aDesactivar);
    if (error) throw error;
  }
  // actualizar los que cambian
  for (const a of actuales) {
    const e = editadosConId.get(a.id);
    if (!e) continue;
    if (e.weekday !== a.weekday || e.hora_inicio !== a.hora_inicio
        || e.hora_fin !== a.hora_fin || (e.lugar ?? null) !== (a.lugar ?? null)) {
      const { error } = await supabase
        .from('team_schedules')
        .update({ weekday: e.weekday, hora_inicio: e.hora_inicio, hora_fin: e.hora_fin, lugar: e.lugar?.trim() || null })
        .eq('id', a.id);
      if (error) throw error;
    }
  }
  // insertar los nuevos
  const nuevos = editados.filter((s) => !s.id);
  if (nuevos.length) {
    const { error } = await supabase.from('team_schedules').insert(nuevos.map((s) => ({
      team_id: teamId, season_id: seasonId,
      weekday: s.weekday, hora_inicio: s.hora_inicio, hora_fin: s.hora_fin,
      lugar: s.lugar?.trim() || null, created_by: user.id,
    })));
    if (error) throw error;
  }
}

// ── Periodos sin entreno ─────────────────────────────────────
/** Periodos que afectan a un equipo: los de club (team_id NULL) + los suyos. */
export async function getPeriodos(seasonId, teamId = null) {
  let q = supabase
    .from('no_training_periods')
    .select('id, season_id, team_id, fecha_inicio, fecha_fin, motivo')
    .eq('season_id', seasonId)
    .order('fecha_inicio');
  if (teamId) q = q.or(`team_id.is.null,team_id.eq.${teamId}`);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** clubWide=true → team_id NULL (solo admin, lo impone la RLS). */
export async function addPeriodo({ season_id, team_id = null, fecha_inicio, fecha_fin, motivo }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('no_training_periods')
    .insert({ season_id, team_id, fecha_inicio, fecha_fin, motivo: motivo?.trim() || null, created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Alta en bloque: líneas "YYYY-MM-DD YYYY-MM-DD motivo" o "YYYY-MM-DD motivo". */
export async function addPeriodosBulk({ season_id, team_id = null, texto }) {
  const { data: { user } } = await supabase.auth.getUser();
  const filas = [];
  for (const linea of texto.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = linea.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(\d{4}-\d{2}-\d{2}))?\s*(.*)$/);
    if (!m) continue;
    filas.push({
      season_id, team_id,
      fecha_inicio: m[1],
      fecha_fin: m[2] || m[1],
      motivo: m[3]?.trim() || null,
      created_by: user.id,
    });
  }
  if (!filas.length) return [];
  const { data, error } = await supabase.from('no_training_periods').insert(filas).select();
  if (error) throw error;
  return data ?? [];
}

export async function borrarPeriodo(id) {
  const { error } = await supabase.from('no_training_periods').delete().eq('id', id);
  if (error) throw error;
}

// ── Regeneración (motor puro + datos frescos) ────────────────
/**
 * Calcula el plan SIN aplicarlo (para el modal de previsualización).
 * @returns { plan, resumen: {insertar, actualizar, borrar, saltadas} }
 */
export async function previewRegeneracion(teamId, temporada) {
  const [slots, periodos, existentes] = await Promise.all([
    getSlots(teamId, temporada.id),
    getPeriodos(temporada.id, teamId),
    getSesionesAuto(teamId, temporada.id),
  ]);
  const sinFiltro = expandirTemporada(temporada, slots, []);
  const ocurrencias = expandirTemporada(temporada, slots, periodos);
  const plan = planRegeneracion(ocurrencias, existentes);
  return {
    plan,
    resumen: {
      insertar: plan.aInsertar.length,
      actualizar: plan.aActualizar.length,
      borrar: plan.aBorrar.length,
      saltadas: sinFiltro.length - ocurrencias.length, // días en periodos sin entreno
    },
  };
}
