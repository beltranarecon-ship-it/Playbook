/* ============================================================
   estrellas.js — la estrella rápida de la sesión activa
   (tabla public.session_stars, migración 023 · Tramo 3.5).

   Es la capa de «un toque» de la progresión individual (§5.7): no
   cuesta nada y es lo único que se va a apuntar de verdad los días que
   no dé tiempo a la rúbrica.

   Nunca lanza al LEER: sin la migración aplicada, sin red o sin sesión
   devuelve una lista vacía y la pantalla funciona igual. Al ESCRIBIR sí
   lanza, porque alguien acaba de tocar una estrella y tiene que saber
   si se ha quedado.
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'id, session_id, player_id, block_id, nota, created_at';

/** Las de una sesión, de la más reciente a la más antigua. */
export async function getEstrellas(sessionId) {
  if (!sessionId) return [];
  try {
    const { data, error } = await supabase
      .from('session_stars').select(COLS)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Una estrella. `block_id` puede ir en null: una estrella puesta entre
 * bloques sigue valiendo, y perderla por no saber dónde colocarla sería
 * tirar justo lo que se quería apuntar.
 */
export async function ponerEstrella({ sessionId, playerId, blockId = null, nota = null }) {
  const { data, error } = await supabase
    .from('session_stars')
    .insert({
      session_id: sessionId,
      player_id: playerId,
      // los bloques sin guardar todavía no tienen id en la base de datos
      block_id: /^[0-9a-f-]{36}$/i.test(String(blockId || '')) ? blockId : null,
      nota: String(nota || '').trim() || null,
    })
    .select(COLS)
    .single();
  if (error) throw new Error(traducir(error));
  return data;
}

/** Quitarla, para el toque que no era. */
export async function quitarEstrella(id) {
  const { data, error } = await supabase.from('session_stars').delete().eq('id', id).select('id');
  if (error) throw new Error(traducir(error));
  return (data?.length ?? 0) > 0;
}

function traducir(error) {
  const m = String(error?.message || '');
  if (error?.code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no está la tabla de estrellas. Hay que aplicar la migración 023 en Supabase.';
  }
  return m || 'error desconocido';
}
