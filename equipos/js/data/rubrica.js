/* ============================================================
   rubrica.js — persistencia de la rúbrica (migración 024 · Tramo 3.7).

   La CUENTA —los cuatro niveles, de dónde salen las filas, qué es un
   movimiento, a quién toca mirar— vive en `taller/js/rubrica.js`, que
   es puro y lo prueba un banco Node. Aquí solo se lee y se escribe.

   Nunca lanza al LEER: sin la migración 024, sin red o sin sesión
   devuelve listas vacías y la pantalla dice que todavía no hay nada.
   Al ESCRIBIR sí lanza: alguien acaba de valorar y tiene que saber si
   se ha quedado.
   ============================================================ */

import { supabase, leerTodo, porLotes } from './_client.js';

const COLS = 'id, player_id, clave, nivel, session_id, nota, created_at';

/**
 * La serie de UN jugador, de lo más nuevo a lo más viejo.
 * @param opts.desde  ISO; por defecto, toda su historia
 */
export async function getRubricaJugador(playerId, { desde = null } = {}) {
  if (!playerId) return [];
  try {
    let q = supabase.from('rubrica_valores').select(COLS)
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (desde) q = q.gte('created_at', desde);
    const { data, error } = await q;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

/**
 * Las series de VARIOS jugadores de una tacada → { player_id: [...] }.
 *
 * Lo pide la pantalla de evaluar (hay que saber a quién toca mirar
 * antes de elegir) y la de Progresión. Paginado, como el resto de
 * lecturas en bloque del módulo: una temporada de rúbrica de catorce
 * críos se acerca al tope de mil filas que sirve PostgREST, y recortar
 * no da error.
 */
export async function getRubricaEquipo(playerIds, { desde = null } = {}) {
  const out = {};
  if (!playerIds?.length) return out;
  try {
    for (const lote of porLotes(playerIds)) {
      const filas = await leerTodo(() => {
        let q = supabase.from('rubrica_valores').select(COLS)
          .in('player_id', lote)
          .order('created_at', { ascending: false });
        if (desde) q = q.gte('created_at', desde);
        return q;
      });
      for (const f of filas) (out[f.player_id] ||= []).push(f);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Valora. SIEMPRE inserta: corregir un nivel es valorar otra vez, y
 * eso es una fila nueva. Es lo que mantiene la serie siendo una serie.
 *
 * @param valores [{player_id, clave, nivel}] — se manda de una tacada
 *   porque en la pantalla de evaluar se tocan varias a la vez y una
 *   petición por toque haría el pabellón insoportable.
 */
export async function valorar(valores, { sessionId = null } = {}) {
  const filas = (valores || [])
    .filter((v) => v?.player_id && v?.clave && Number.isInteger(v.nivel))
    .map((v) => ({
      player_id: v.player_id,
      clave: v.clave,
      nivel: v.nivel,
      session_id: sessionId,
      nota: String(v.nota || '').trim() || null,
    }));
  if (!filas.length) return [];
  const { data, error } = await supabase.from('rubrica_valores').insert(filas).select(COLS);
  if (error) throw new Error(traducir(error));
  return data ?? [];
}

/** Deshacer un toque que no era. No se puede editar: solo borrar. */
export async function borrarValor(id) {
  const { data, error } = await supabase.from('rubrica_valores').delete().eq('id', id).select('id');
  if (error) throw new Error(traducir(error));
  return (data?.length ?? 0) > 0;
}

/** Las filas que ha añadido el club. Las base viven en código. */
export async function getFilasClub() {
  try {
    const { data, error } = await supabase.from('rubrica_filas').select('clave, nombre, categoria, orden').order('orden');
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
}

function traducir(error) {
  const m = String(error?.message || '');
  if (error?.code === 'PGRST205' || /Could not find the table/i.test(m)) {
    return 'todavía no están las tablas de la rúbrica. Hay que aplicar la migración 024 en Supabase.';
  }
  return m || 'error desconocido';
}
