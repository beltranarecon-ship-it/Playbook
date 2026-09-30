/* ============================================================
   supabase/variantes.js — las variantes técnicas que añade el club
   (tabla public.variantes, migración 044; ESPEC-PIZARRA-v3 §4.3).

   Mismo reparto de siempre: lo que se comprueba y se calcula vive en
   pizarra/variantes.js, que es puro y lo prueba un banco Node; aquí
   solo se habla con la base de datos. El vídeo de una variante no se
   guarda aquí: va en videos_accion (supabase/videos.js) con la clave
   `accion__variante`.
   ============================================================ */

import { supabase } from './client.js';
import { normalizarVarianteDelClub } from '../pizarra/variantes.js';

const COLS = 'id, accion, slug, nombre, descripcion';

/**
 * Las variantes del club, saneadas.
 *
 * Nunca lanza: sin sesión, sin la tabla (la 044 sin aplicar) o sin red
 * devuelve [] y la Pizarra ofrece las de serie, como siempre.
 */
export async function cargarVariantes() {
  try {
    const { data, error } = await supabase.from('variantes').select(COLS).order('nombre');
    if (error) return [];
    return (data || []).map(normalizarVarianteDelClub).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Crea una variante del club (ya comprobada con validarVarianteNueva).
 * `created_by` no se manda: lo sella el guard.
 */
export async function crearVariante({ accion, slug, nombre, descripcion = '' }) {
  const { data, error } = await supabase
    .from('variantes')
    .insert({ accion, slug, nombre, descripcion: descripcion || null })
    .select(COLS)
    .single();
  if (error) throw new Error(traducir(error));
  return normalizarVarianteDelClub(data);
}

/* El error de leer no importa; el de GUARDAR sí: alguien acaba de
   escribir una variante y tiene que entender por qué no se ha quedado. */
function traducir(error) {
  const m = String(error?.message || '');
  if (error?.code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no está la tabla de variantes. Hay que aplicar la migración 044 en Supabase.';
  }
  if (error?.code === '23505') return 'esa variante ya está';
  if (/de serie/.test(m)) return 'esa es una variante de serie';
  return m || 'error desconocido';
}
