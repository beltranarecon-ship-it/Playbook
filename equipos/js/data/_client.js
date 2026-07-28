/* ============================================================
   _client.js — re-export del cliente Supabase SINGLETON de la app
   raíz. El módulo NO crea un cliente propio (el Taller creó un 2º;
   aquí no se repite). Misma sesión, mismo storageKey 'cbp-auth'.
   ============================================================ */

export { supabase } from '/js/supabase-client.js';

/**
 * Lee TODAS las filas de una consulta, no las primeras que quepan.
 *
 * Supabase corta las respuestas en `max-rows` (1000 por defecto) y NO avisa:
 * devuelve mil filas y ningún error. Con el snapshot denso de asistencia
 * (una fila por jugador y sesión) una temporada normal pasa de mil —12
 * jugadores × 86 sesiones = 1.032— así que el % por jugador salía mal a
 * media temporada, en silencio.
 *
 * Se avanza por el número de filas REALMENTE devueltas, no por el tamaño
 * de página pedido: así funciona aunque el servidor tope antes.
 *
 * @param construye () => PostgrestFilterBuilder — debe devolver una consulta
 *   NUEVA en cada llamada y con un `.order()` determinista: sin orden
 *   estable, dos páginas pueden repetir u omitir filas.
 */
export async function leerTodo(construye, { pagina = 1000 } = {}) {
  const out = [];
  for (let desde = 0; ;) {
    const { data, error } = await construye().range(desde, desde + pagina - 1);
    if (error) throw error;
    const n = data?.length ?? 0;
    if (!n) return out;
    out.push(...data);
    desde += n;
  }
}

/** Trocea una lista de ids para no pasarse con la longitud de la URL. */
export function porLotes(ids, tam = 150) {
  const out = [];
  for (let i = 0; i < ids.length; i += tam) out.push(ids.slice(i, i + tam));
  return out;
}
