/* ============================================================
   seasons.js — temporadas del club. Una sola activa a la vez (lo
   impone un índice único parcial en 001). Escritura solo admin
   (RLS de 001); la lectura, cualquier autenticado.

   Toda la app cuelga de la temporada activa: los horarios, los
   objetivos, las sesiones y su auto-generación. Si esa temporada ya
   terminó, todo lo que generes cae en el pasado — por eso aquí hay
   además una lectura TOLERANTE (getTemporadaActiva) que nunca deja
   la app sin temporada por un `is_active` mal puesto.
   ============================================================ */

import { supabase } from './_client.js';

const COLS = 'id, label, start_date, end_date, is_active';

/** Todas, de la más reciente a la más antigua. */
export async function getTemporadas() {
  const { data, error } = await supabase
    .from('seasons')
    .select(COLS)
    .order('start_date', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * La temporada de trabajo. Preferencia: la marcada activa → la que
 * contiene hoy → la más reciente. Así un `is_active` desactualizado
 * (o el hueco entre desactivar una y activar otra) no tumba la app.
 */
export async function getTemporadaActiva(hoyISO = null) {
  const todas = await getTemporadas();
  if (!todas.length) throw new Error('No hay ninguna temporada creada.');
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  return todas.find((t) => t.is_active)
    || todas.find((t) => t.start_date && t.end_date && hoy >= t.start_date && hoy <= t.end_date)
    || todas[0];
}

/**
 * Crea una temporada. `activar` la deja como la de trabajo.
 * El índice único parcial exige desactivar la anterior ANTES de
 * activar la nueva; se hace en ese orden y con la nueva ya creada,
 * de modo que un fallo a mitad deje datos coherentes (peor caso:
 * ninguna activa, y getTemporadaActiva lo absorbe).
 */
export async function crearTemporada({ label, start_date, end_date, activar = true }) {
  const { data, error } = await supabase
    .from('seasons')
    .insert({ label: label.trim(), start_date, end_date, is_active: false })
    .select(COLS)
    .single();
  if (error) throw error;
  if (activar) await activarTemporada(data.id);
  return data;
}

/** Convierte una temporada en la activa (desactiva la que hubiera). */
export async function activarTemporada(id) {
  const { error: e1 } = await supabase
    .from('seasons').update({ is_active: false }).eq('is_active', true).neq('id', id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from('seasons').update({ is_active: true }).eq('id', id);
  if (e2) throw e2;
}

/* ── Borrar (Tramo 4.9 / §5.10) ──────────────────── */

/**
 * Cuánto hay dentro de una temporada. Se pregunta ANTES de ofrecer el
 * borrado: «se borrará la temporada 2025/26» y «se borrará la temporada
 * 2025/26, con 112 entrenamientos y 18 partidos» son la misma frase para
 * la base de datos y dos decisiones muy distintas para una persona.
 */
export async function queHayEn(seasonId) {
  const [ses, par] = await Promise.all([
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
    supabase.from('matches').select('id', { count: 'exact', head: true }).eq('season_id', seasonId),
  ]);
  /* `count` puede venir nulo si el servidor no manda el `Content-Range`.
     Un recuento DESCONOCIDO no es cero: leerlo como vacío ofrecería
     borrar una temporada llena. Se devuelve null y quien pregunta lo
     trata como «no lo sé». La puerta de verdad es la policy de la 033,
     que rechaza el borrado igual. */
  return { sesiones: ses.count, partidos: par.count };
}

/**
 * Borra una temporada VACÍA.
 *
 * La policy de la 033 solo deja borrar al administrador y solo si no
 * tiene ni sesiones ni partidos. Un DELETE que la policy rechaza NO da
 * error: filtra la fila y responde 0. Por eso se cuenta lo que
 * realmente se ha borrado, como en `borrarPreliminar`.
 *
 * @returns true si se borró; false si la policy la protegió
 */
export async function borrarTemporada(id) {
  const { data, error } = await supabase.from('seasons').delete().eq('id', id).select('id');
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
