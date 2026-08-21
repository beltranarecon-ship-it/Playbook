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
const COLS_030 = ['plantilla_path', 'imagen_path', 'hora_convocatoria'];

/* La cabecera fija de la convocatoria la añade la 034: club, categoría,
   competición, cancha, qué llevar y cuánto antes hay que estar. Mismo
   trato que la 030 y por la misma razón — un equipo que no se puede
   abrir por una migración pendiente es mucho peor que una convocatoria
   con la cabecera en blanco. */
let sin034 = false;
const AJUSTES_034 = 'conv_club, conv_categoria, conv_competicion, conv_cancha, conv_llevar, conv_minutos_antes, conv_oficina, conv_email, conv_membrete_path';
const COLS_034 = ['conv_club', 'conv_categoria', 'conv_competicion', 'conv_cancha', 'conv_llevar',
  'conv_minutos_antes', 'conv_oficina', 'conv_email', 'conv_membrete_path'];

const ajustes = (extra = '') => `${AJUSTES_BASE}${extra ? ', ' + extra : ''}`
  + (sin030 ? '' : `, ${AJUSTES_030}`)
  + (sin034 ? '' : `, ${AJUSTES_034}`);

export const hayArchivosEquipo = () => !sin030;
export const hayCabeceraConvocatoria = () => !sin034;

const faltaAlguna = (error, columnas) => {
  if (error?.code === '42703' || error?.code === 'PGRST204') return true;
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return m.includes('column') && columnas.some((c) => m.includes(c));
};
const falta030 = (error) => faltaAlguna(error, COLS_030);
const falta034 = (error) => faltaAlguna(error, COLS_034);

/* Se reintenta hasta DOS veces: con las dos migraciones pendientes, el
   primer reintento quita la 034 y el segundo la 030. Un solo reintento
   dejaba el error de la otra sin tratar y la pantalla en blanco. */
async function conReintento(pide) {
  let r = await pide();
  for (let i = 0; i < 2 && r.error; i++) {
    if (!sin034 && falta034(r.error)) { sin034 = true; r = await pide(); continue; }
    if (!sin030 && falta030(r.error)) { sin030 = true; r = await pide(); continue; }
    break;
  }
  return r;
}

/** Los ajustes de convocatoria de un equipo, ya con sus valores por defecto. */
export function cabeceraConvocatoria(settings) {
  const s = settings || {};
  return {
    conv_club: s.conv_club ?? null,
    conv_categoria: s.conv_categoria ?? null,
    conv_competicion: s.conv_competicion ?? null,
    conv_cancha: s.conv_cancha ?? null,
    conv_llevar: s.conv_llevar ?? null,
    conv_minutos_antes: s.conv_minutos_antes ?? null,
    conv_oficina: s.conv_oficina ?? null,
    conv_email: s.conv_email ?? null,
    conv_membrete_path: s.conv_membrete_path ?? null,
  };
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
      ...cabeceraConvocatoria(t.team_settings),
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
  const quita = (c, columnas) => {
    const out = { ...c };
    for (const k of columnas) delete out[k];
    return out;
  };
  const sanea = (c) => {
    let out = c;
    if (sin030) out = quita(out, COLS_030);
    if (sin034) out = quita(out, COLS_034);
    return out;
  };
  const manda = () => supabase.from('team_settings').update(sanea(campos)).eq('team_id', teamId);
  let { error } = await manda();
  for (let i = 0; i < 2 && error; i++) {
    if (!sin034 && falta034(error)) { sin034 = true; ({ error } = await manda()); continue; }
    if (!sin030 && falta030(error)) { sin030 = true; ({ error } = await manda()); continue; }
    break;
  }
  if (error) throw error;
}

/* ── Borrar un equipo (Tramo 4.9) ────────────────── */

/**
 * Qué historia tiene un equipo. Se pregunta antes de ofrecer el borrado.
 *
 * Los JUGADORES se cuentan aparte y no impiden borrar: pegar la
 * plantilla es lo primero que se hace al crear un equipo, y también lo
 * primero que se hace mal. Lo que impide borrar es que haya PASADO
 * algo —un entrenamiento o un partido—.
 */
export async function queHayEnEquipo(teamId) {
  const [ses, par, jug] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
    supabase.from('players').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
  ]);
  /* `count` nulo = no se sabe, que NO es cero: leerlo como vacío
     ofrecería borrar un equipo con temporadas dentro. La puerta de
     verdad es la policy de la 033, que lo rechaza igual. */
  return { sesiones: ses.count, partidos: par.count, jugadores: jug.count };
}

/**
 * Borra un equipo SIN historia. Se lleva por delante, en cascada, sus
 * ajustes, jugadores, horarios, objetivos y entrenadores: sin equipo no
 * significan nada.
 *
 * @returns true si se borró; false si la policy lo protegió
 */
export async function borrarEquipo(id) {
  const { data, error } = await supabase.from('teams').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
