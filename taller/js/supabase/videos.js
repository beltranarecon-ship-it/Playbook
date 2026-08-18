/* ============================================================
   supabase/videos.js — el vídeo de referencia de cada acción
   (tabla public.videos_accion, migración 021).

   Vive aparte de `acciones` porque las diez acciones del sistema no
   están en esa tabla —viven en código y sus slugs están reservados— y
   son justo a las que un entrenador quiere colgarle un vídeo. Ver la
   cabecera de la migración.

   Mismo reparto de siempre: el motor (ia/video.js) es PURO y lo prueba
   un banco Node; la persistencia vive aquí.
   ============================================================ */

import { supabase } from './client.js';
import { normalizarVideo, validarVideo } from '../ia/video.js';

/**
 * Todos los vídeos puestos, por slug.
 *
 * Nunca lanza: sin sesión, sin tabla o sin red devuelve {} y el Taller
 * funciona exactamente igual —un vídeo es un extra, no un requisito
 * (§11)—. Y sanea al leer: una fila con la forma rota se descarta aquí
 * en vez de reventar en el proyector.
 *
 * @returns { [slug]: video }
 */
export async function cargarVideos() {
  try {
    const { data, error } = await supabase.from('videos_accion').select('slug, video');
    if (error) return {};
    const out = {};
    for (const r of data || []) {
      const v = normalizarVideo(r?.video);
      if (v && r.slug) out[r.slug] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Pone (o cambia) el vídeo de una acción.
 *
 * `created_by` no se manda: lo sella el guard con auth.uid(). El
 * `upsert` por slug es lo que hace que volver a pegar un enlace
 * sustituya al anterior en vez de dar un error de clave repetida.
 */
export async function guardarVideo(slug, video) {
  const v = normalizarVideo(video);
  const { ok, errores } = validarVideo(v);
  if (!v || !ok) throw new Error(errores.join('; ') || 'no se reconoce ese vídeo');
  const { data, error } = await supabase
    .from('videos_accion')
    .upsert({ slug, video: v }, { onConflict: 'slug' })
    .select('slug, video')
    .single();
  if (error) throw new Error(traducir(error));
  return data;
}

/*
   El error de leer no importa —sin tabla no hay vídeos y ya está—, pero
   el de GUARDAR sí: alguien acaba de pegar un enlace y tiene que
   entender por qué no se ha quedado. Y el caso más probable durante un
   tiempo es este: la migración 021 todavía sin aplicar, que PostgREST
   cuenta en inglés y hablando de esquemas.
*/
function traducir(error) {
  const m = String(error?.message || '');
  if (error?.code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no está la tabla de vídeos. Hay que aplicar la migración 021 en Supabase.';
  }
  return m || 'error desconocido';
}

/**
 * Quita el vídeo de una acción.
 *
 * La policy puede filtrar la fila en silencio (no eres quien lo puso
 * ni administrador): un DELETE filtrado por RLS no da error, responde
 * 0 filas. Se cuenta lo que de verdad se borró, mismo criterio que
 * `borrarAccion`.
 *
 * @returns true si se borró; false si la policy lo protegió.
 */
export async function borrarVideo(slug) {
  const { data, error } = await supabase.from('videos_accion').delete().eq('slug', slug).select('slug');
  if (error) throw new Error(traducir(error));
  return (data?.length ?? 0) > 0;
}
