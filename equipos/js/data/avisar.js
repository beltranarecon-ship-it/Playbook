/* ============================================================
   avisar.js — AVISAR AL OTRO ENTRENADOR (Tramo 4.13).
   §5.10: «cada cambio de un entrenador se avisa al otro entrenador del
   mismo equipo».

   ── POR QUÉ ESTO NO PUEDE FALLAR HACIA ARRIBA ───────────────
   Avisar es un efecto secundario de guardar. Si la consulta de
   entrenadores falla, o la 031 no está aplicada, lo que NO puede pasar
   es que el guardado parezca haber fallado: el trabajo está hecho y
   perderlo por no poder mandar una notificación sería absurdo. Por eso
   todo va dentro de un try y lo peor que ocurre es un `console.warn`.

   ── Y POR QUÉ NO SE AVISA A UNO MISMO ───────────────────────
   Porque avisar a alguien de lo que acaba de hacer él es la manera más
   rápida de que silencie la aplicación, y entonces tampoco le llegará
   lo del compañero, que es lo único que esta fila quiere conseguir.

   ── UN EQUIPO CON UN SOLO ENTRENADOR NO GENERA NADA ─────────
   Ni una consulta de más: se mira primero cuántos hay.
   ============================================================ */

import { supabase } from './_client.js';
import { avisoDeCambio } from './avisos.js';
import { encolar } from './push.js';

/** Los user_id de los entrenadores de un equipo. */
async function entrenadoresDe(teamId) {
  const { data, error } = await supabase
    .from('team_coaches')
    .select('coach_id, profiles(full_name)')
    .eq('team_id', teamId);
  if (error) throw error;
  return (data || []).map((c) => ({ id: c.coach_id, nombre: c.profiles?.full_name || null }));
}

/**
 * Avisa a los demás entrenadores del equipo de que algo ha cambiado.
 *
 * @param teamId
 * @param opts.que        qué se ha tocado, en cristiano: «el plan del martes»
 * @param opts.url        adónde lleva el aviso
 * @param opts.nombreEquipo
 * @returns a cuántos se ha avisado (0 también cuando no se ha podido)
 */
export async function avisarAlEquipo(teamId, { que, url = null, nombreEquipo = '' } = {}) {
  if (!teamId || !que) return 0;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    const gente = await entrenadoresDe(teamId);
    const otros = gente.filter((c) => c.id !== user.id);
    if (!otros.length) return 0;   // equipo de uno: nada que avisar

    const yo = gente.find((c) => c.id === user.id);
    const aviso = avisoDeCambio({
      quienCambia: user.id,
      nombreQuienCambia: yo?.nombre || 'Tu compañero',
      equipo: { id: teamId, name: nombreEquipo, coaches: gente.map((c) => c.id) },
      que,
      url,
      cuando: new Date(),
    });
    return await encolar(aviso);
  } catch (e) {
    /* Avisar es secundario: el guardado ya está hecho y no se toca. */
    console.warn('[avisar] no se ha podido avisar al equipo:', e.message);
    return 0;
  }
}
