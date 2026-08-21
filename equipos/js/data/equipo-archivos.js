/* ============================================================
   equipo-archivos.js — LOS FICHEROS DEL EQUIPO (Tramos 4.6 y 4.12).
   El bucket privado 'equipos' de la migración 030: la imagen del
   equipo, que se ve en el calendario, y la plantilla PDF de la
   convocatoria.

   Misma forma que el acta (016): ruta '{team_id}/…', porque el guard de
   Storage autoriza por la primera carpeta.
   ============================================================ */

import { supabase } from './_client.js';

const EXT_IMAGEN = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const EXT_PLANTILLA = { ...EXT_IMAGEN, 'application/pdf': 'pdf' };
const TOPE = 10 * 1024 * 1024;

async function subir(teamId, file, permitidas, queEs) {
  const ext = permitidas[file.type];
  if (!ext) throw new Error(`${queEs} tiene que ser ${Object.values(permitidas).join(', ')}.`);
  if (file.size > TOPE) throw new Error(`${queEs} pesa más de 10 MB.`);
  const path = `${teamId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('equipos').upload(path, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  return path;
}

export const subirImagenEquipo = (teamId, file) => subir(teamId, file, EXT_IMAGEN, 'La imagen');
export const subirPlantilla = (teamId, file) => subir(teamId, file, EXT_PLANTILLA, 'La plantilla');
/* El membrete que encabeza la convocatoria (034). Solo imagen: va
   dentro del PDF que compone la app, y un PDF no se puede meter dentro
   de otro sin traer media librería más. */
export const subirMembrete = (teamId, file) => subir(teamId, file, EXT_IMAGEN, 'El membrete');

/**
 * URL temporal para verla. El bucket es privado, así que caduca; la
 * hora que se pide de más es a propósito, porque una convocatoria se
 * deja abierta en el móvil un buen rato.
 */
export async function urlImagenEquipo(path, segundos = 3600) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('equipos').createSignedUrl(path, segundos);
  if (error) throw error;
  return data?.signedUrl ?? null;
}
export const urlPlantilla = urlImagenEquipo;
export const urlMembrete = urlImagenEquipo;

export async function borrarArchivoEquipo(path) {
  if (!path) return;
  const { error } = await supabase.storage.from('equipos').remove([path]);
  if (error) throw error;
}
