/* ============================================================
   duraciones.js — lo que de verdad ha durado cada ejercicio, para la
   tarjeta de la biblioteca (Tramo 3.6).

   La cuenta —mediana de las últimas veces, de dónde sale el número—
   es la MISMA que usa el planificador y vive una sola vez, en
   `taller/js/duracion.js`. Lo único que se repite aquí es la consulta,
   y se repite a propósito: la biblioteca tiene su propio cliente de
   Supabase (`js/supabase-client.js`) y montar dos en la misma página
   solo para ahorrar ocho líneas deja dos sesiones de autenticación
   vivas discutiendo entre ellas.

   Nunca lanza: sin la migración 023, sin red o sin sesión devuelve {}
   y la tarjeta enseña lo que dice la ficha, como siempre.
   ============================================================ */

import { supabase } from '../supabase-client.js';
import { agruparReales } from '../../taller/js/duracion.js';

const TOPE = 1000;

/** @returns { [exercise_id]: [minutos…] } del más reciente al más antiguo. */
export async function getDuracionesReales() {
  try {
    const { data, error } = await supabase
      .from('session_blocks')
      .select('exercise_id, duracion_real_min, sessions!inner(fecha)')
      .not('duracion_real_min', 'is', null)
      .not('exercise_id', 'is', null)
      .order('id', { ascending: false })
      .limit(TOPE);
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
