/* ============================================================
   matches.js — partidos (M6): CRUD bajo RLS por equipo y el acta
   en Storage (bucket privado 'actas', ruta '{team_id}/…' que exige
   el guard de 016). El cálculo —resultado, balance, medias— vive en
   el motor puro partidos.js.
   ============================================================ */

import { supabase } from './_client.js';

const COLS_BASE = 'id, team_id, season_id, fecha, hora, lugar, rival, es_local, estado, '
  + 'marcador_favor, marcador_contra, marcador_cuartos, val_defensa, val_ataque, '
  + 'val_actitud, val_acierto, val_global, claves, acta_path, valorada_at, '
  + 'convocatoria_cerrada';

/* `periodos`, `faltas_equipo`, `tiempos_muertos` y `acta_origen` los añade
   la 028 (Tramo 4.1). Se piden y, si no están, se sigue sin ellas: que una
   migración pendiente deje al entrenador sin poder abrir el partido del
   sábado sería mucho peor que no poder apuntar las faltas de equipo.
   `marcador_cuartos` NO va aquí: existe desde la 016. */
let sin028 = false;
const COLS_028 = 'periodos, faltas_equipo, tiempos_muertos, acta_origen';
/* Y la 030 añade la convocatoria (Tramo 4.6). Se degrada igual y por
   separado: quien haya aplicado una y no la otra sigue teniendo el
   resto de la pantalla. */
let sin030 = false;
const COLS_030 = 'convocados, convocatoria_lugar, convocatoria_hora';
/* Y la 034 la convierte en el documento de verdad: los otros dos grupos
   del papel —reserva y descanso— y el desplazamiento. Tercera tanda,
   mismo trato. */
let sin034 = false;
const COLS_034 = 'reservas, descansan, salida_hora, regreso';
const COLS = () => [
  COLS_BASE,
  sin028 ? null : COLS_028,
  sin030 ? null : COLS_030,
  sin034 ? null : COLS_034,
].filter(Boolean).join(', ');

/** Si la 028 está aplicada. La pantalla lo usa para no ofrecer lo que no se
 *  puede guardar, en vez de dejar que el guardado falle con un error crudo. */
export const hayActa = () => !sin028;
/** Si la 030 está aplicada (la convocatoria). */
export const hayConvocatoria = () => !sin030;
/** Si la 034 está aplicada (reserva, descanso y desplazamiento). */
export const hayGruposConvocatoria = () => !sin034;

const esColumnaQueFalta = (error) => error?.code === '42703' || error?.code === 'PGRST204';
const nombra = (error, columnas) => {
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return m.includes('column') && columnas.some((c) => m.includes(c));
};
const COL_028 = ['periodos', 'faltas_equipo', 'tiempos_muertos', 'acta_origen'];
const COL_030 = ['convocados', 'convocatoria_lugar', 'convocatoria_hora'];
const COL_034 = ['reservas', 'descansan', 'salida_hora', 'regreso'];

/* Cuando el error NO dice qué columna es —PostgREST a veces solo manda
   el código— se dan por malas TODAS las tandas que no estén ya
   descartadas. Perder columnas de más es un partido con media pantalla;
   no reintentar es un partido que no se abre. */
const otras = (error, propia) => [COL_028, COL_030, COL_034]
  .filter((c) => c !== propia).some((c) => nombra(error, c));
const falta028 = (error) => nombra(error, COL_028) || (esColumnaQueFalta(error) && !otras(error, COL_028));
const falta030 = (error) => nombra(error, COL_030) || (esColumnaQueFalta(error) && !otras(error, COL_030));
const falta034 = (error) => nombra(error, COL_034) || (esColumnaQueFalta(error) && !otras(error, COL_034));

/* Pide, y si lo que faltaba eran las columnas de la 028, vuelve a pedir sin
   ellas. Una sola vez: `sin028` se queda puesto para el resto de la sesión. */
async function conReintento(pide) {
  let r = await pide();
  /* Hasta dos vueltas: puede faltar la 028, la 030 o las dos. Cuando el
     error no dice qué columna es —PostgREST a veces solo da el código—
     se quitan las dos tandas y se sigue, que es preferible a dejar la
     pantalla sin abrir por no saber cuál de las dos falta. */
  for (let vuelta = 0; vuelta < 3 && r.error; vuelta++) {
    const a = falta028(r.error) && !sin028;
    const b = falta030(r.error) && !sin030;
    const c = falta034(r.error) && !sin034;
    if (!a && !b && !c) break;
    if (a) sin028 = true;
    if (b) sin030 = true;
    if (c) sin034 = true;
    r = await pide();
  }
  return r;
}

/** Quita del patch lo que la base de datos todavía no tiene. */
const saneaPatch = (patch) => {
  const out = { ...patch };
  if (sin028) for (const k of COL_028) delete out[k];
  if (sin030) for (const k of COL_030) delete out[k];
  if (sin034) for (const k of COL_034) delete out[k];
  return out;
};

/** Partidos que caen en un rango de fechas (calendario). */
export async function getPartidosRango({ desde, hasta, teamId = null }) {
  const pide = () => {
    let q = supabase
      .from('matches')
      .select(COLS())
      .gte('fecha', desde)
      .lte('fecha', hasta)
      .order('fecha')
      .order('hora', { nullsFirst: false });
    if (teamId) q = q.eq('team_id', teamId);
    return q;
  };
  const { data, error } = await conReintento(pide);
  if (error) throw error;
  return data ?? [];
}

/** Todos los del equipo en la temporada, por fecha ASCENDENTE (balance/racha). */
export async function getPartidosEquipo(teamId, seasonId) {
  const { data, error } = await conReintento(() => supabase
    .from('matches')
    .select(COLS())
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('fecha'));
  if (error) throw error;
  return data ?? [];
}

export async function getPartido(id) {
  const { data, error } = await conReintento(
    () => supabase.from('matches').select(COLS()).eq('id', id).single());
  if (error) throw error;
  return data;
}

/** `created_by` y `valorada_at` los pone el trigger de 016, no el cliente. */
export async function crearPartido({ team_id, season_id, fecha, hora, lugar, rival, es_local = true }) {
  const { data, error } = await conReintento(() => supabase
    .from('matches')
    .insert({
      team_id, season_id, fecha,
      hora: hora || null,
      lugar: lugar?.trim() || null,
      rival: rival.trim(),
      es_local,
    })
    .select(COLS())
    .single());
  if (error) throw error;
  return data;
}

export async function actualizarPartido(id, patch) {
  const manda = (p) => supabase.from('matches').update(saneaPatch(p)).eq('id', id);
  let { error } = await manda(patch);
  // el reintento va con el patch YA saneado: si se reenviara entero volvería
  // a fallar por lo mismo y el guardado se perdería igual
  for (let vuelta = 0; vuelta < 3 && error; vuelta++) {
    const a = falta028(error) && !sin028;
    const b = falta030(error) && !sin030;
    const c = falta034(error) && !sin034;
    if (!a && !b && !c) break;
    if (a) sin028 = true;
    if (b) sin030 = true;
    if (c) sin034 = true;
    ({ error } = await manda(patch));
  }
  if (error) throw error;
}

/**
 * La RLS solo deja borrar los 'programado' (el resto es histórico). Un DELETE
 * que la policy rechaza NO da error: filtra la fila y responde 0. Se cuenta
 * lo borrado de verdad, como en sessions.aplicarPlan.
 * @returns true si se borró; false si la policy lo protegió.
 */
export async function borrarPartido(id, actaPath = null) {
  const { data, error } = await supabase.from('matches').delete().eq('id', id).select('id');
  if (error) throw error;
  const fue = (data?.length ?? 0) > 0;
  // el acta vive en Storage, no en la fila: si se borra el partido primero,
  // nadie vuelve a saber su ruta y el fichero se queda huérfano en el bucket
  if (fue && actaPath) await borrarActa(actaPath).catch(() => {});
  return fue;
}

// ── Acta (Storage privado) ────────────────────────────────────
const EXT_OK = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/**
 * Sube la foto/PDF del acta y devuelve su ruta. La primera carpeta DEBE ser
 * el team_id: el guard de Storage (007) autoriza por ahí.
 */
export async function subirActa(teamId, file) {
  const ext = EXT_OK[file.type];
  if (!ext) throw new Error('El acta tiene que ser una foto (JPG/PNG/WebP) o un PDF.');
  if (file.size > 10 * 1024 * 1024) throw new Error('El acta pesa más de 10 MB.');
  const path = `${teamId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('actas').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return path;
}

/** URL temporal para verla (el bucket es privado). */
export async function urlActa(path, segundos = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('actas').createSignedUrl(path, segundos);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function borrarActa(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('actas').remove([path]);
  if (error) throw error;
}
