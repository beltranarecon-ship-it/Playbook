/* ============================================================
   notes.js — notas del cuerpo técnico (M7). Lo que explica la
   temporada y no cabe en una sesión ni en un partido. Alimentan el
   dossier exportable. `created_by` lo pone el trigger de 017.
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'id, team_id, season_id, fecha, titulo, cuerpo, created_at';

/** Notas del equipo en la temporada: primero las fechadas, luego las de siempre. */
export async function getNotas(teamId, seasonId) {
  const { data, error } = await supabase
    .from('team_notes')
    .select(COLS)
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('fecha', { nullsFirst: false })
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export async function crearNota({ team_id, season_id, fecha, titulo, cuerpo }) {
  const { data, error } = await supabase
    .from('team_notes')
    .insert({
      team_id, season_id,
      fecha: fecha || null,
      titulo: titulo?.trim() || null,
      cuerpo: cuerpo.trim(),
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarNota(id, patch) {
  const { error } = await supabase.from('team_notes').update(patch).eq('id', id);
  if (error) throw error;
}

/** Una nota SÍ se borra: es un apunte, no un registro del que dependa nada. */
export async function borrarNota(id) {
  const { error } = await supabase.from('team_notes').delete().eq('id', id);
  if (error) throw error;
}
