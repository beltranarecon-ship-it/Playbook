/* ============================================================
   estadisticas.js — LO QUE HIZO CADA JUGADOR EN UN PARTIDO
   (tabla `partido_estadisticas`, migración 028 · Tramo 4.1).

   El cálculo —totales, descuadres, lo que falta— vive en el motor
   puro `acta.js`. Aquí solo se persiste, como en el resto de la app.

   ── TODO EN PERIODOS ────────────────────────────────────────
   En minibasket no se juegan minutos (§5.9). La tabla guarda QUÉ
   periodos jugó cada uno —`periodos: [1, 2, 4]`, que es la rejilla del
   acta oficial— y los contadores derivados de ella. La rejilla hace
   falta para la regla de los cinco primeros (4.3); los contadores,
   para acumular la temporada sin recorrer jsonb (4.4).

   ── SI LA 028 NO ESTÁ APLICADA ──────────────────────────────
   La tabla no existe todavía. En vez de romper la pantalla entera del
   partido, la lectura devuelve una lista vacía y `hayTabla()` pasa a
   false: se ve el marcador, las valoraciones y el acta como siempre, y
   la parte de estadísticas dice que falta la migración. Un partido del
   sábado que no se puede abrir es mucho peor que un partido al que le
   falta media pantalla.
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'match_id, player_id, dorsal, periodos, periodos_jugados, '
  + 'periodos_descansados, puntos, faltas';

let sinTabla = false;

/** Si la 028 está aplicada. La pantalla lo pregunta antes de ofrecer nada. */
export const hayTabla = () => !sinTabla;

/* `42P01` es «esa tabla no existe» de Postgres; `PGRST205`, el mismo
   caso visto desde PostgREST, que responde por el caché de esquema. */
const faltaTabla = (error) => {
  if (error?.code === '42P01' || error?.code === 'PGRST205') return true;
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return m.includes('partido_estadisticas')
    && (m.includes('does not exist') || m.includes('not find'));
};

/** Las filas del acta de un partido. Vacío si aún no se ha apuntado nada. */
export async function getEstadisticas(matchId) {
  const { data, error } = await supabase
    .from('partido_estadisticas')
    .select(COLS)
    .eq('match_id', matchId);
  if (error) {
    if (faltaTabla(error)) { sinTabla = true; return []; }
    throw error;
  }
  return data ?? [];
}

/**
 * Guarda el acta entera de una vez.
 *
 * Es un upsert por (match_id, player_id), que es la clave primaria: al
 * corregir un acta el lunes se vuelven a mandar las mismas filas con
 * otros números, y eso tiene que ACTUALIZAR, no duplicar.
 *
 * Las filas llegan ya saneadas por `acta.saneaFila` —recortadas a los
 * límites del CHECK— para que un dedo de más al copiar del papel no
 * tire el guardado entero.
 */
export async function guardarEstadisticas(matchId, filas) {
  if (sinTabla) throw new Error('Falta aplicar la migración 028 para guardar estadísticas.');
  const payload = (filas || []).map((f) => ({ ...f, match_id: matchId }));
  if (!payload.length) return 0;
  const { error } = await supabase
    .from('partido_estadisticas')
    .upsert(payload, { onConflict: 'match_id,player_id' });
  if (error) {
    if (faltaTabla(error)) { sinTabla = true; throw new Error('Falta aplicar la migración 028 para guardar estadísticas.'); }
    throw error;
  }
  return payload.length;
}

/**
 * Quita del acta a jugadores que no jugaron.
 *
 * Se borran de verdad, y no se dejan a cero: una fila a cero dice «vino
 * y no jugó ni un periodo», que es una acusación; no estar en el acta
 * dice «no vino», que suele ser la verdad. El reglamento (4.3) mira esa
 * diferencia.
 */
export async function borrarEstadisticas(matchId, playerIds) {
  if (sinTabla || !(playerIds || []).length) return;
  const { error } = await supabase
    .from('partido_estadisticas')
    .delete()
    .eq('match_id', matchId)
    .in('player_id', playerIds);
  if (error && !faltaTabla(error)) throw error;
}

/**
 * Las estadísticas de varios partidos de una tacada, para acumular por
 * jugador (fila 4.4). Va por `match_id` y no por `player_id` porque la
 * RLS de la 028 autoriza mirando el partido.
 */
export async function getEstadisticasDePartidos(matchIds) {
  const ids = (matchIds || []).filter(Boolean);
  if (!ids.length || sinTabla) return [];
  const { data, error } = await supabase
    .from('partido_estadisticas')
    .select(COLS)
    .in('match_id', ids);
  if (error) {
    if (faltaTabla(error)) { sinTabla = true; return []; }
    throw error;
  }
  return data ?? [];
}
