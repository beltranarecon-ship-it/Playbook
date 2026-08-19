/* ============================================================
   objectives.js — objetivos por equipo (M3): CRUD bajo RLS y
   biblioteca de ejercicios para la sugerencia determinista.
   La herencia y el ranking viven en sugerencias.js (motor puro).
   ============================================================ */

import { supabase } from './_client.js';

const COLS_BASE = 'id, team_id, season_id, titulo, descripcion, categoria, fecha_inicio, fecha_fin, estado, created_at';

/* `dianas` la añade la migración 025 (Tramo 3.9). Mismo criterio que en
   `blocks.js`: se pide, y si la base de datos dice que no existe se
   apunta y se sigue sin ella. Un equipo sin poder abrir sus objetivos
   por una columna nueva sería mucho peor que no poder medirlos. */
let sinDianas = false;
const COLS = () => (sinDianas ? COLS_BASE : `${COLS_BASE}, dianas`);
const faltaDianas = (error) => {
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return error?.code === '42703' || error?.code === 'PGRST204' || (m.includes('column') && m.includes('dianas'));
};

/** Todos los objetivos del equipo en la temporada (incluye archivados). */
export async function getObjetivos(teamId, seasonId) {
  const pide = () => supabase
    .from('objectives')
    .select(COLS())
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('fecha_inicio')
    .order('created_at');
  let { data, error } = await pide();
  if (error && faltaDianas(error)) { sinDianas = true; ({ data, error } = await pide()); }
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
    .select(COLS())
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

export async function crearObjetivo({ team_id, season_id, titulo, descripcion, categoria, fecha_inicio, fecha_fin, dianas = [] }) {
  const { data: { user } } = await supabase.auth.getUser();
  const fila = {
    team_id, season_id,
    titulo: titulo.trim(),
    descripcion: descripcion?.trim() || null,
    categoria, fecha_inicio, fecha_fin,
    created_by: user.id,
    ...(sinDianas ? {} : { dianas: dianas || [] }),
  };
  let { data, error } = await supabase.from('objectives').insert(fila).select().single();
  if (error && faltaDianas(error)) {
    sinDianas = true;
    const { dianas: _, ...sin } = fila;
    ({ data, error } = await supabase.from('objectives').insert(sin).select().single());
  }
  if (error) throw error;
  return data;
}

/* ── Las categorías que crea el club (Tramo 3.9) ──────────────
   Eran tres fijas y un entrenador que quiera trabajar «actitud» no
   tenía dónde ponerlo. El catálogo existe para que la segunda vez que
   alguien escriba «actitud» salga sugerida, en vez de convertirse en
   «Actitud», «actitud » y «ACTITUD». */

/** Nunca lanza: sin la 025 devuelve las tres de siempre. */
export async function getCategorias() {
  try {
    const { data, error } = await supabase.from('categorias_objetivo').select('nombre').order('nombre');
    if (error || !data?.length) return ['técnico', 'táctico', 'físico'];
    return data.map((r) => r.nombre);
  } catch {
    return ['técnico', 'táctico', 'físico'];
  }
}

/** Da de alta una categoría nueva. Que ya exista no es un error. */
export async function crearCategoria(nombre) {
  const n = String(nombre || '').trim().toLowerCase();
  if (!n) return null;
  try {
    await supabase.from('categorias_objetivo').insert({ nombre: n });
  } catch { /* si no se puede guardar, el objetivo se crea igual */ }
  return n;
}

export async function actualizarObjetivo(id, patch) {
  const p = sinDianas ? (({ dianas, ...r }) => r)(patch) : patch;
  let { error } = await supabase.from('objectives').update(p).eq('id', id);
  if (error && faltaDianas(error)) {
    sinDianas = true;
    const { dianas: _, ...sin } = patch;
    ({ error } = await supabase.from('objectives').update(sin).eq('id', id));
  }
  if (error) throw error;
}

/**
 * En cuántas sesiones se ha trabajado cada objetivo (Tramo 3.9).
 *
 * Es la mitad de «trabajado en 7 sesiones · 5 de 13 han subido»: lo que
 * TÚ has hecho. La otra mitad —lo que ha pasado— sale de la rúbrica.
 *
 * Solo cuentan las sesiones que de verdad OCURRIERON. Una cancelada
 * llevaba el objetivo puesto y no se trabajó; una programada para el
 * viernes tampoco se ha trabajado todavía, y contarla haría que el
 * número subiera por planificar en vez de por entrenar.
 *
 * Ocurrió = está marcada como realizada, o su fecha ya pasó. Lo
 * segundo hace falta porque cerrar la sesión es opcional y muchos
 * entrenamientos se dan sin que nadie los marque.
 *
 * @returns { [objective_id]: nº de sesiones }
 */
export async function getSesionesPorObjetivo(teamId, seasonId, { hoy = null } = {}) {
  try {
    const { data, error } = await supabase
      .from('session_objectives')
      .select('objective_id, sessions!inner(id, team_id, season_id, estado, fecha)')
      .eq('sessions.team_id', teamId)
      .eq('sessions.season_id', seasonId)
      .neq('sessions.estado', 'cancelada');
    if (error) return {};
    const d = new Date();
    const hoyISO = hoy || `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const out = {};
    for (const r of data || []) {
      const ses = r.sessions;
      if (!ses) continue;
      const ocurrio = ses.estado === 'realizada' || String(ses.fecha || '') <= hoyISO;
      if (!ocurrio) continue;
      out[r.objective_id] = (out[r.objective_id] || 0) + 1;
    }
    return out;
  } catch {
    return {};
  }
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
