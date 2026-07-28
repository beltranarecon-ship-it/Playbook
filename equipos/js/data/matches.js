/* ============================================================
   matches.js — partidos (M6): CRUD bajo RLS por equipo y el acta
   en Storage (bucket privado 'actas', ruta '{team_id}/…' que exige
   el guard de 016). El cálculo —resultado, balance, medias— vive en
   el motor puro partidos.js.
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'id, team_id, season_id, fecha, hora, lugar, rival, es_local, estado, '
  + 'marcador_favor, marcador_contra, val_defensa, val_ataque, val_actitud, '
  + 'val_acierto, val_global, claves, acta_path, valorada_at, convocatoria_cerrada';

/** Partidos que caen en un rango de fechas (calendario). */
export async function getPartidosRango({ desde, hasta, teamId = null }) {
  let q = supabase
    .from('matches')
    .select(COLS)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha')
    .order('hora', { nullsFirst: false });
  if (teamId) q = q.eq('team_id', teamId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/** Todos los del equipo en la temporada, por fecha ASCENDENTE (balance/racha). */
export async function getPartidosEquipo(teamId, seasonId) {
  const { data, error } = await supabase
    .from('matches')
    .select(COLS)
    .eq('team_id', teamId)
    .eq('season_id', seasonId)
    .order('fecha');
  if (error) throw error;
  return data ?? [];
}

export async function getPartido(id) {
  const { data, error } = await supabase.from('matches').select(COLS).eq('id', id).single();
  if (error) throw error;
  return data;
}

/** `created_by` y `valorada_at` los pone el trigger de 016, no el cliente. */
export async function crearPartido({ team_id, season_id, fecha, hora, lugar, rival, es_local = true }) {
  const { data, error } = await supabase
    .from('matches')
    .insert({
      team_id, season_id, fecha,
      hora: hora || null,
      lugar: lugar?.trim() || null,
      rival: rival.trim(),
      es_local,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPartido(id, patch) {
  const { error } = await supabase.from('matches').update(patch).eq('id', id);
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
