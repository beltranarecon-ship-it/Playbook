/* ============================================================
   videos.js — los vídeos guardados del club para bloques libres
   (tabla public.videos_bloque, migración 022 · Tramo 3.3).

   Un bloque libre con vídeo se puede guardar con un nombre y volver a
   ponerlo en otra sesión sin buscar el enlace otra vez. Eso es lo que
   hace que la función valga para algo: un vídeo que hay que volver a
   buscar cada martes es lo que ya se hacía por WhatsApp.

   La forma del vídeo la sabe `taller/js/ia/video.js`, que es puro y lo
   prueba un banco Node. Aquí solo se guarda y se lee.
   ============================================================ */

import { supabase } from './_client.js';
import { normalizarVideo, validarVideo } from '../../../taller/js/ia/video.js';

const COLS = 'id, titulo, video, duracion_min, created_by';

/**
 * La lista del club, ordenada por nombre.
 *
 * Nunca lanza: sin la migración 022, sin sesión o sin red devuelve []
 * y el bloque libre con vídeo sigue funcionando —solo que sin lista de
 * dónde elegir—.
 */
export async function getVideosGuardados() {
  try {
    const { data, error } = await supabase.from('videos_bloque').select(COLS).order('titulo');
    if (error) return [];
    return (data || [])
      .map((r) => ({ ...r, video: normalizarVideo(r.video) }))
      .filter((r) => r.video);      // una fila con la forma rota se cae aquí
  } catch {
    return [];
  }
}

/**
 * Guarda un vídeo para reutilizarlo.
 *
 * `created_by` no se manda: lo sella el guard con auth.uid().
 */
export async function guardarVideoBloque({ titulo, video, duracion_min = null }) {
  const v = normalizarVideo(video);
  const { ok, errores } = validarVideo(v);
  if (!v || !ok) throw new Error(errores.join('; ') || 'no se reconoce ese vídeo');
  const nombre = String(titulo || '').trim();
  if (!nombre) throw new Error('ponle un nombre para reconocerlo en la lista');

  const { data, error } = await supabase
    .from('videos_bloque')
    .insert({ titulo: nombre, video: v, duracion_min: duracion_min || null })
    .select(COLS)
    .single();
  if (error) throw new Error(traducir(error));
  return data;
}

/**
 * Lo quita de la lista.
 *
 * La policy puede filtrar la fila en silencio (lo guardó otro): un
 * DELETE filtrado por RLS no da error, responde 0 filas.
 * @returns true si se borró; false si la policy lo protegió.
 */
export async function borrarVideoBloque(id) {
  const { data, error } = await supabase.from('videos_bloque').delete().eq('id', id).select('id');
  if (error) throw new Error(traducir(error));
  return (data?.length ?? 0) > 0;
}

/*
   Igual que en videos_accion: el error de LEER no importa —sin lista
   no hay lista y ya está—, pero el de guardar sí, porque alguien acaba
   de pegar un enlace y tiene que entender por qué no se ha quedado.
*/
function traducir(error) {
  const m = String(error?.message || '');
  if (error?.code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no está la tabla de vídeos guardados. Hay que aplicar la migración 022 en Supabase.';
  }
  return m || 'error desconocido';
}
