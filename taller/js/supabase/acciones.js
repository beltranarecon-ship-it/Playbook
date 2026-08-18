/* ============================================================
   supabase/acciones.js — las acciones que crea el club
   (tabla public.acciones, migración 020).

   El catálogo del sistema —las diez acciones sin las que el Taller no
   funciona— vive en CÓDIGO (ia/acciones.js), por la misma razón que
   las anclas: tiene que estar disponible sin una llamada de red. Esta
   tabla guarda lo que añade el club, y aquí se fusionan.

   Mismo reparto que con las posiciones: el motor (ia/acciones.js) es
   PURO y el banco Node lo importa tal cual; la persistencia vive aquí
   y se inyecta.
   ============================================================ */

import { supabase } from './client.js';
import { fusionarCatalogo, validarAccion, CATALOGO_SISTEMA } from '../ia/acciones.js';

const COLS = 'id, slug, nombre, familia, parametros, pide, sinonimos, simbolo, descripcion, video, created_by';

/**
 * El catálogo COMPLETO: sistema + club. Nunca lanza — sin sesión, sin
 * tabla o sin red devuelve el del sistema, y el Taller sigue
 * funcionando con el vocabulario de siempre.
 *
 * @returns { acciones, descartadas } — `descartadas` son las filas del
 *   club que no pasan el validador o que pisan un slug del sistema, con
 *   su porqué, para que la pantalla pueda DECIRLO en vez de tragárselo.
 */
export async function cargarCatalogo() {
  try {
    const { data, error } = await supabase.from('acciones').select(COLS).order('nombre');
    if (error) return { acciones: [...CATALOGO_SISTEMA], descartadas: [] };
    return fusionarCatalogo(data || []);
  } catch {
    return { acciones: [...CATALOGO_SISTEMA], descartadas: [] };
  }
}

/**
 * Crea una acción nueva. Se valida ANTES de mandarla: el error que
 * devuelve el validador dice qué parámetro está mal, y el de la base de
 * datos solo diría que una restricción falló.
 *
 * `created_by` NO se manda: lo sella el guard con auth.uid(), como en
 * sessions, objectives y matches. La autoría no la declara el cliente.
 */
export async function crearAccion(accion) {
  const { ok, errores } = validarAccion(accion);
  if (!ok) throw new Error(errores.join('; '));
  const { slug, nombre, familia, parametros, pide, sinonimos, simbolo, descripcion, video } = accion;
  const { data, error } = await supabase
    .from('acciones')
    .insert({
      slug, nombre, familia,
      parametros: parametros || {},
      pide: pide || [],
      sinonimos: sinonimos || [],
      simbolo: simbolo || null,
      descripcion: descripcion?.trim() || null,
      video: video || null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return data;
}

/** Edición. La RLS ya recorta a autor o administrador. */
export async function guardarAccion(id, patch) {
  const campos = {};
  for (const k of ['nombre', 'familia', 'parametros', 'pide', 'sinonimos', 'simbolo', 'descripcion', 'video']) {
    if (k in patch) campos[k] = patch[k];
  }
  if (!Object.keys(campos).length) return null;
  const { data, error } = await supabase.from('acciones').update(campos).eq('id', id).select(COLS).single();
  if (error) throw error;
  return data;
}

/**
 * Borra una acción del club.
 *
 * La policy puede rechazar la fila en silencio (no eres el autor ni
 * administrador): un DELETE que la RLS filtra NO da error, responde 0
 * filas. Se cuenta lo que REALMENTE se borró, mismo criterio que
 * borrarPreliminar en el módulo de sesiones.
 *
 * @returns true si se borró; false si la policy la protegió.
 */
export async function borrarAccion(id) {
  const { data, error } = await supabase.from('acciones').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
