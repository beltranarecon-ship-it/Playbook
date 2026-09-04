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

/* ¿Es un error de «esta columna no existe»? */
const esColumnaQueFalta = (error) => error?.code === '42703' || error?.code === 'PGRST204';
/* ¿El error NOMBRA una columna de esta tanda? PostgREST casi siempre lo
   dice; cuando no, hay que adivinar, y adivinar mal es lo que hay que
   evitar. */
const nombra = (error, columnas) => {
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return m.includes('column') && columnas.some((c) => m.includes(c));
};
const falta030 = (error) => nombra(error, COLS_030);
const falta034 = (error) => nombra(error, COLS_034);

/* Pide, y si lo que faltaba eran columnas de una migración, vuelve a
   pedir sin ellas.

   ── POR QUÉ SE EMPIEZA POR LA MÁS ANTIGUA ───────────────────
   Cuando el error no dice de qué columna se queja —PostgREST a veces
   solo manda el código— hay que probar. Antes se probaba quitando la
   034 primero, y eso tenía un efecto feo: una base a la que solo le
   falta la 030 daba error, se quitaba la 034 «por si acaso», y a partir
   de ahí la cabecera de la convocatoria quedaba apagada para el resto
   de la sesión aunque SÍ estuviera aplicada. Empezando por la 030 —la
   que de verdad puede faltar en una base vieja— la 034 solo se apaga si
   el error persiste sin ella. */
async function conReintento(pide) {
  let r = await pide();
  for (let i = 0; i < 3 && r.error; i++) {
    if (!sin030 && falta030(r.error)) { sin030 = true; r = await pide(); continue; }
    if (!sin034 && falta034(r.error)) { sin034 = true; r = await pide(); continue; }
    if (esColumnaQueFalta(r.error)) {
      // no dice cuál: se prueba primero sin la vieja, luego sin las dos
      if (!sin030) { sin030 = true; r = await pide(); continue; }
      if (!sin034) { sin034 = true; r = await pide(); continue; }
    }
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

/* ── El cuadro técnico (Tramo 5.7, fase 1: solo admin) ─────────
   La escritura en `team_coaches` es SOLO de admin desde la 007, y a
   propósito: si un entrenador pudiera escribir ahí, podría meterse él
   solo en cualquier equipo del club. Estas cuatro funciones son para la
   pantalla de administración; a cualquier otro la base le dirá que no,
   que es exactamente lo que tiene que pasar. */

/**
 * TODOS los equipos del club, incluidos los que se han quedado SIN
 * ENTRENADOR.
 *
 * `getMisEquipos` los descarta —un equipo sin cuadro no es «mío»— y eso
 * deja fuera justo el caso que hay que poder arreglar: el equipo
 * huérfano al que hay que asignarle alguien. `teams` tiene el SELECT
 * abierto a todo autenticado (001), así que la lista sale entera; lo
 * que la RLS recorta es el embed de `team_coaches`, y por eso esto solo
 * sirve de verdad en administración.
 */
export async function getTodosLosEquipos() {
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
  return (data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    color: t.team_settings?.color ?? null,
    dia_convocatoria: t.team_settings?.dia_convocatoria ?? null,
    imagen_path: t.team_settings?.imagen_path ?? null,
    coaches: (t.team_coaches ?? []).map((c) => c.profiles?.full_name).filter(Boolean),
    /* El cuadro con sus ids: `coaches` son solo nombres para enseñar y
       no sirve para quitar a nadie. */
    cuadro: (t.team_coaches ?? []).map((c) => ({
      coach_id: c.coach_id,
      rol: c.rol,
      nombre: c.profiles?.full_name || null,
    })),
  }));
}

/**
 * Los entrenadores del club, para elegir a quién añadir.
 *
 * Solo devuelve algo útil a un admin: la RLS de `profiles` (001) deja
 * ver el propio perfil y nada más. No es un fallo que a un coach le
 * llegue una lista de uno; es la cerradura funcionando.
 */
export async function getEntrenadoresDelClub() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

/** Mete a un entrenador en un equipo con su papel. */
export async function añadirEntrenador(teamId, coachId, rol = 'ayudante') {
  const { error } = await supabase
    .from('team_coaches')
    .insert({ team_id: teamId, coach_id: coachId, rol });
  if (error) throw error;
}

/**
 * Lo saca del equipo. Quien llama tiene que haber comprobado antes
 * `puedeQuitar` (data/entrenadores.js): la base NO impide dejar un
 * equipo a cero y ahí el equipo desaparece de la lista de todos.
 */
export async function quitarEntrenador(teamId, coachId) {
  const { error } = await supabase
    .from('team_coaches')
    .delete()
    .eq('team_id', teamId)
    .eq('coach_id', coachId);
  if (error) throw error;
}

/** Principal ↔ ayudante. */
export async function cambiarRolEntrenador(teamId, coachId, rol) {
  const { error } = await supabase
    .from('team_coaches')
    .update({ rol })
    .eq('team_id', teamId)
    .eq('coach_id', coachId);
  if (error) throw error;
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

/**
 * Guarda ajustes del equipo. Sin la migración correspondiente, lo que la
 * base de datos no tiene NO se manda — pero **se dice qué se ha
 * quedado fuera**.
 *
 * ── POR QUÉ DEVUELVE LO DESCARTADO ──────────────────────────
 * Antes se descartaba en silencio y la pantalla cantaba «Ajustes
 * guardados». El entrenador escribía la cabecera entera de la
 * convocatoria —club, categoría, competición, el pabellón, qué
 * llevar—, veía la confirmación, y al recargar estaba todo en blanco.
 * Eso es exactamente lo contrario de la regla de la casa: lo que no
 * cuadra se dice, no se calla. Ahora quien llama sabe qué no ha
 * entrado y lo cuenta.
 *
 * @returns {descartadas: string[]} las columnas que no se han mandado
 */
export async function guardarAjustes(teamId, campos) {
  const quita = (c, columnas, fuera) => {
    const out = { ...c };
    for (const k of columnas) if (k in out) { delete out[k]; fuera.push(k); }
    return out;
  };
  const descartadas = [];
  const sanea = (c) => {
    descartadas.length = 0;
    let out = c;
    if (sin030) out = quita(out, COLS_030, descartadas);
    if (sin034) out = quita(out, COLS_034, descartadas);
    return out;
  };
  const manda = async () => {
    const patch = sanea(campos);
    /* Un UPDATE sin nada que actualizar no es un guardado: es una
       petición que dice «sí» sin haber hecho nada. Mismo guard que
       `guardarCabeceraSesion` en sessions.js. */
    if (!Object.keys(patch).length) return { error: null, vacio: true };
    return supabase.from('team_settings').update(patch).eq('team_id', teamId);
  };
  let { error } = await manda();
  for (let i = 0; i < 3 && error; i++) {
    if (!sin030 && falta030(error)) { sin030 = true; ({ error } = await manda()); continue; }
    if (!sin034 && falta034(error)) { sin034 = true; ({ error } = await manda()); continue; }
    if (esColumnaQueFalta(error)) {
      if (!sin030) { sin030 = true; ({ error } = await manda()); continue; }
      if (!sin034) { sin034 = true; ({ error } = await manda()); continue; }
    }
    break;
  }
  if (error) throw error;
  return { descartadas: [...descartadas] };
}

/** Cómo se le cuenta a una persona que faltó una migración. */
export function textoDescartadas(descartadas) {
  if (!descartadas || !descartadas.length) return '';
  const dela34 = descartadas.some((c) => COLS_034.includes(c));
  const dela30 = descartadas.some((c) => COLS_030.includes(c));
  const cual = dela34 && dela30 ? 'las migraciones 030 y 034'
    : dela34 ? 'la migración 034' : 'la migración 030';
  const n = descartadas.length;
  return `No se ha guardado todo: faltan columnas que trae ${cual}. `
    + (n === 1 ? 'Se ha quedado fuera un campo.' : `Se han quedado fuera ${n} campos.`);
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

/**
 * Borra un equipo CON toda su historia. Sesiones, partidos, actas,
 * asistencias, reflexiones, objetivos y jugadores: todo.
 *
 * ── POR QUÉ PASA POR UNA FUNCIÓN Y NO POR UN DELETE ─────────
 * Porque relajar la policy de la 033 abriría el borrado total a
 * cualquier pantalla y a cualquier clic mal dado. La función de la 035
 * solo atiende al administrador y EXIGE el nombre escrito, así que la
 * puerta de todos los días sigue siendo la estrecha.
 *
 * @param confirmacion el nombre del equipo, tal cual lo escribió el usuario
 * @returns {nombre, sesiones, partidos, jugadores} — el recibo de lo que se llevó
 */
export async function borrarEquipoConHistorial(id, confirmacion) {
  const { data, error } = await supabase.rpc('borrar_equipo_del_todo', {
    p_team_id: id, p_confirmacion: confirmacion,
  });
  if (error) throw new Error(traduceBorrado(error));
  return data;
}

/* Los errores de la función vienen con el mensaje que ella escribe, que
   ya está en castellano y dice qué hacer. Lo único que hay que tratar
   es que la función NO EXISTA: eso significa que falta la migración, y
   «404» no se lo dice a nadie. */
function traduceBorrado(error) {
  const m = `${error?.message || ''} ${error?.details || ''}`;
  if (error?.code === 'PGRST202' || /could not find the function|function .* does not exist/i.test(m)) {
    return 'Falta aplicar la migración 035 en la base de datos: todavía no se puede borrar con historial.';
  }
  return error?.message || 'No se ha podido borrar.';
}
