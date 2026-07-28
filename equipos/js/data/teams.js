/* ============================================================
   teams.js — equipos + ajustes (team_settings) + coaches.
   Patrón js/modules/ejercicios.js: async named, throw en error.
   "Mis equipos" = equipos con fila visible en team_coaches (la RLS
   ya recorta: un coach solo ve las filas de SUS equipos; el admin,
   todas). teams tiene SELECT abierto (001), así que se filtra aquí.
   ============================================================ */

import { supabase } from './_client.js';

export async function getMisEquipos() {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id, name, category,
      team_coaches ( coach_id, rol, profiles ( full_name ) ),
      team_settings ( color, dia_convocatoria )
    `)
    .order('name');
  if (error) throw error;
  return (data ?? [])
    .filter((t) => (t.team_coaches ?? []).length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      color: t.team_settings?.color ?? null,
      dia_convocatoria: t.team_settings?.dia_convocatoria ?? null,
      coaches: (t.team_coaches ?? []).map((c) => c.profiles?.full_name).filter(Boolean),
    }));
}

export async function getEquipo(teamId) {
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id, name, category,
      team_coaches ( coach_id, rol, profiles ( full_name ) ),
      team_settings ( color, dia_convocatoria, reflexion_activa, asistencia_activa )
    `)
    .eq('id', teamId)
    .single();
  if (error) throw error;
  return data;
}

/** Crea el equipo; el trigger de BD auto-asigna al creador y crea settings. */
export async function crearEquipo({ name, category, color, dia_convocatoria }) {
  const { data: team, error } = await supabase
    .from('teams')
    .insert({ name: name.trim(), category: category || null })
    .select()
    .single();
  if (error) throw error;

  if (color || dia_convocatoria) {
    const { error: e2 } = await supabase
      .from('team_settings')
      .update({ color: color || null, dia_convocatoria: dia_convocatoria || null })
      .eq('team_id', team.id);
    if (e2) throw e2;
  }
  return team;
}

export async function actualizarEquipo(teamId, { name, category }) {
  const { error } = await supabase
    .from('teams')
    .update({ name: name?.trim(), category: category || null })
    .eq('id', teamId);
  if (error) throw error;
}

export async function guardarAjustes(teamId, campos) {
  const { error } = await supabase
    .from('team_settings')
    .update(campos)
    .eq('team_id', teamId);
  if (error) throw error;
}
