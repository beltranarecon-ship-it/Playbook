/* ============================================================
   supabase/plantillas.js — las colocaciones y fases guardadas del club
   (tabla public.plantillas, migración 045; ESPEC-PIZARRA-v3 §7.8).

   Mismo reparto de siempre: qué es una plantilla y cómo se pone lo sabe
   pizarra/plantillas.js, que es puro y lo prueba un banco Node; aquí
   solo se habla con la base de datos. También es de allí lo que se le
   dice al entrenador cuando algo falla (errorDePlantilla), para poder
   probarlo sin red.
   ============================================================ */

import { supabase } from './client.js';
import { normalizarPlantilla, errorDePlantilla } from '../pizarra/plantillas.js';

const COLS = 'id, tipo, nombre, pista, datos';

/**
 * Las plantillas del club, saneadas.
 *
 * Nunca lanza: sin sesión, sin la tabla (la 045 sin aplicar) o sin red
 * devuelve null —«no se sabe»— y la Pizarra sigue con las que tuviera.
 * Una fila rota no se lleva por delante a las demás: se deja fuera y se
 * cuenta en `descartadas`, una propiedad de la lista devuelta (no
 * enumerable: recorrerla o copiarla no la ve), para poder decirlo.
 */
export async function cargarPlantillas() {
  try {
    const { data, error } = await supabase.from('plantillas').select(COLS).order('nombre');
    if (error) return null;
    const salida = [];
    let descartadas = 0;
    for (const fila of data || []) {
      try { const p = normalizarPlantilla(fila); if (p) salida.push(p); else descartadas++; } catch { descartadas++; }
    }
    Object.defineProperty(salida, 'descartadas', { value: descartadas, enumerable: false });
    return salida;
  } catch {
    return null;
  }
}

/** Guarda una plantilla. `created_by` no se manda: lo sella el guard. */
export async function crearPlantilla({ tipo, nombre, pista, datos }) {
  const { data, error } = await supabase
    .from('plantillas')
    .insert({ tipo, nombre, pista, datos })
    .select(COLS)
    .single();
  if (error) throw new Error(errorDePlantilla(error, 'guardar'));
  return normalizarPlantilla(data);
}

/**
 * Borra una plantilla.
 *
 * La política puede filtrar la fila en silencio (no la guardaste tú y no
 * eres administrador): entonces no hay error y no se borra nada. Se
 * devuelve si de verdad se ha borrado.
 */
export async function borrarPlantilla(id) {
  const { data, error } = await supabase.from('plantillas').delete().eq('id', id).select('id');
  if (error) throw new Error(errorDePlantilla(error, 'borrar'));
  return (data?.length ?? 0) > 0;
}
