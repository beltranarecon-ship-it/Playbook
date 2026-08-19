/* ============================================================
   supabase/duraciones.js — lo que de verdad duró cada ejercicio
   (Tramo 3.6). Lee `session_blocks.duracion_real_min`, que empieza a
   escribirse en la pantalla de sesión activa (3.5).

   ── EL «PARA ESE ENTRENADOR» SALE GRATIS ────────────────────
   §5.6 pide que la duración estimada sea la de ESE entrenador, no una
   media del club. No hace falta filtrar por nadie: la RLS de
   `sessions` ya recorta a los equipos de quien pregunta, así que lo
   que vuelve son sus entrenamientos y nada más.

   ── SIN LA MIGRACIÓN 023, NO PASA NADA ──────────────────────
   Si la columna todavía no existe, la consulta falla y aquí se
   devuelve un diccionario vacío: la biblioteca y el planificador
   siguen proponiendo lo que dice la ficha, que es lo que hacían antes.
   ============================================================ */

import { supabase } from './client.js';
import { agruparReales } from '../duracion.js';

/* Un tope generoso: seis bloques por sesión y unas cien sesiones por
   temporada y equipo. Se piden los más recientes, que son los que
   mandan (ver ULTIMAS en duracion.js). */
const TOPE = 1000;

/**
 * @returns { [exercise_id]: [minutos…] } del más reciente al más antiguo.
 *   {} si no se puede saber — nunca lanza.
 */
export async function getDuracionesReales({ teamId = null } = {}) {
  try {
    let q = supabase
      .from('session_blocks')
      .select('exercise_id, duracion_real_min, sessions!inner(fecha, team_id)')
      .not('duracion_real_min', 'is', null)
      .not('exercise_id', 'is', null)
      .order('id', { ascending: false })
      .limit(TOPE);
    if (teamId) q = q.eq('sessions.team_id', teamId);

    const { data, error } = await q;
    if (error) return {};
    return agruparReales((data || []).map((r) => ({
      exercise_id: r.exercise_id,
      duracion_real_min: r.duracion_real_min,
      fecha: r.sessions?.fecha || '',
    })));
  } catch {
    return {};
  }
}
