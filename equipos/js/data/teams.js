/* ============================================================
   teams.js — equipos + ajustes (team_settings) + coaches.
   Patrón js/modules/ejercicios.js: async named, throw en error.
   "Mis equipos" = equipos con fila visible en team_coaches (la RLS
   ya recorta: un coach solo ve las filas de SUS equipos; el admin,
   todas). teams tiene SELECT abierto (001), así que se filtra aquí.
   ============================================================ */

import { supabase } from './_client.js';

/* `plantilla_path`, `imagen_path` y `hora_convocatoria` los añade la 030
   (Tramos 4.6 y 4.12). Se piden y, si no están, se sigue sin ellas: el
   club entero sin poder abrir sus equipos por una migración pendiente
   sería mucho peor que un calendario sin escudos. */
let sin030 = false;
const AJUSTES_BASE = 'color, dia_convocatoria';
const AJUSTES_030 = 'plantilla_path, imagen_path, hora_convocatoria';
const ajustes = (extra = '') => `${AJUSTES_BASE}${extra ? ', ' + extra : ''}`
  + (sin030 ? '' : `, ${AJUSTES_030}`);

export const hayArchivosEquipo = () => !sin030;

const falta030 = (error) => {
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return m.includes('column')
    && ['plantilla_path', 'imagen_path', 'hora_convocatoria'].some((c) => m.includes(c));
};

async function conReintento(pide) {
  let r = await pide();
  if (r.error && falta030(r.error)) { sin030 = true; r = await pide(); }
  return r;
}

export async function getMisEquipos() {
  const pide = () => supabase
    .from('teams')
    .select(`
      id, name, category,
      team_coaches ( coach_id, rol, profiles ( full_name ) ),
      team_settings ( ${ajustes()} )
    `)
    .order('name');
  const { data, error } = await conReintento(pide);
  if (error) throw error;
  return (data ?? [])
    .filter((t) => (t.team_coaches ?? []).length > 0)
    .map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      color: t.team_settings?.color ?? null,
      dia_convocatoria: t.team_settings?.dia_convocatoria ?? null,
      imagen_path: t.team_settings?.imagen_path ?? null,
      plantilla_path: t.team_settings?.plantilla_path ?? null,
      hora_convocatoria: t.team_settings?.hora_convocatoria ?? null,
      coaches: (t.team_coaches ?? []).map((c) => c.profiles?.full_name).filter(Boolean),
    }));
}

export async function getEquipo(teamId) {
  const pide = () => supabase
    .from('teams')
    .select(`
      id, name, category,
      team_coaches ( coach_id, rol, profiles ( full_name ) ),
      team_settings ( ${ajustes('reflexion_activa, asistencia_activa')} )
    `)
    .eq('id', teamId)
    .single();
  const { data, error } = await conReintento(pide);
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
  // sin la 030 no se manda lo que la base de datos no tiene: el resto
  // de los ajustes se guardan igual
  const sanea = (c) => {
    if (!sin030) return c;
    const { plantilla_path, imagen_path, hora_convocatoria, ...resto } = c;
    return resto;
  };
  const manda = () => supabase.from('team_settings').update(sanea(campos)).eq('team_id', teamId);
  let { error } = await manda();
  if (error && falta030(error)) { sin030 = true; ({ error } = await manda()); }
  if (error) throw error;
}
