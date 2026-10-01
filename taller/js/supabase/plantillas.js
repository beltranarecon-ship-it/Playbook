/* ============================================================
   supabase/plantillas.js — las colocaciones y fases guardadas del club
   (tabla public.plantillas, migración 045; ESPEC-PIZARRA-v3 §7.8).

   Mismo reparto de siempre: qué es una plantilla y cómo se pone lo sabe
   pizarra/plantillas.js, que es puro y lo prueba un banco Node; aquí
   solo se habla con la base de datos.
   ============================================================ */

import { supabase } from './client.js';
import { normalizarPlantilla } from '../pizarra/plantillas.js';

const COLS = 'id, tipo, nombre, pista, datos';

/**
 * Las plantillas del club, saneadas.
 *
 * Nunca lanza: sin sesión, sin la tabla (la 045 sin aplicar) o sin red
 * devuelve null —«no se sabe»— y la Pizarra sigue con las que tuviera.
 */
export async function cargarPlantillas() {
  try {
    const { data, error } = await supabase.from('plantillas').select(COLS).order('nombre');
    if (error) return null;
    const salida = [];
    for (const fila of data || []) {
      try { const p = normalizarPlantilla(fila); if (p) salida.push(p); } catch { /* fuera */ }
    }
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
  if (error) throw new Error(traducir(error));
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
  if (error) throw new Error(traducir(error));
  return (data?.length ?? 0) > 0;
}

function traducir(error) {
  const m = String(error?.message || '');
  if (error?.code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no está la tabla de plantillas. Hay que aplicar la migración 045 en Supabase.';
  }
  if (error?.code === '42501' || /row-level security/i.test(m)) {
    return 'esa plantilla la guardó otro entrenador: solo puede tocarla quien la guardó, o un administrador.';
  }
  return m || 'error desconocido';
}
