/* ============================================================
   objectives.js — objetivos por equipo (M3): CRUD bajo RLS y
   biblioteca de ejercicios para la sugerencia determinista.
   La herencia y el ranking viven en sugerencias.js (motor puro).
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'id, team_id, season_id, titulo, descripcion, categoria, fecha_inicio, fecha_fin, estado, created_at';

/** Todos los objetivos del equipo en la temporada (incluye archivados). */
export async function getObjetivos(teamId, seasonId) {
  const { data, error } = await supabase
    .from('objectives')
    .select(COLS)
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('fecha_inicio')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

/**
 * Objetivos que TOCAN un rango de fechas (solape, bordes inclusivos).
 * Para el calendario: los archivados quedan fuera por defecto.
 */
export async function getObjetivosRango({ desde, hasta, teamId = null, incluirArchivados = false }) {
  let q = supabase
    .from('objectives')
    .select(COLS)
    .lte('fecha_inicio', hasta)
    .gte('fecha_fin', desde)
    .order('fecha_inicio')
    .order('created_at');
  if (teamId) q = q.eq('team_id', teamId);
  if (!incluirArchivados) q = q.neq('estado', 'archivado');
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function crearObjetivo({ team_id, season_id, titulo, descripcion, categoria, fecha_inicio, fecha_fin }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('objectives')
    .insert({
      team_id, season_id,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      categoria, fecha_inicio, fecha_fin,
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarObjetivo(id, patch) {
  const { error } = await supabase.from('objectives').update(patch).eq('id', id);
  if (error) throw error;
}

export async function borrarObjetivo(id) {
  const { error } = await supabase.from('objectives').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Biblioteca sugerible (una vez por sesión de página): columnas mínimas
 * que consume el motor de ranking. La lectura de exercises es global
 * para autenticados (001), no depende del equipo.
 */
let _biblioteca = null;
export async function getEjerciciosSugeribles() {
  if (_biblioteca) return _biblioteca;
  const { data, error } = await supabase
    .from('exercises')
    /* `requisitos` viaja con la lista LIGERA (Tramo 3.1): es lo que
       necesitan los minutos activos —densidad, aforo, simultáneo— y
       pesa unos cientos de bytes por ficha. Lo pesado sigue fuera: la
       animación es un jsonb de decenas de kB y esa solo se pide del
       ejercicio que se abre. */
    .select('id, name, type, category, difficulty, duration_min, description, tags, intensidad, requisitos')
    .eq('is_archived', false);
  if (error) throw error;
  _biblioteca = data ?? [];
  return _biblioteca;
}
