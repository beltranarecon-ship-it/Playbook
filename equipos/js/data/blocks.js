/* ============================================================
   blocks.js — persistencia del planificador de sesión (M4):
   bloques de ejercicios y objetivos CONGELADOS de la sesión.
   La carga (sessions.carga_total) la recalcula un trigger en BD;
   aquí solo escribimos los bloques. RLS por sesión recorta debajo.
   ============================================================ */

import { supabase, leerTodo, porLotes } from './_client.js';

const COLS_BASE = 'id, session_id, exercise_id, orden, titulo, duracion_min, intensidad, notas';

/* ---- La columna `video` y la migración que puede no estar ----------
   `session_blocks.video` la añade la migración 022 (Tramo 3.3). Si esa
   migración todavía no se ha aplicado, pedirla haría fallar TODA la
   consulta y el planificador no abriría ninguna sesión: un plan entero
   perdido por una función que el entrenador ni siquiera está usando.

   Así que se pide, y si la base de datos dice que no existe se apunta
   y se sigue sin ella. Mismo criterio que el resto del módulo de
   sesiones: cada pieza degrada sola. */
let sinVideo = false;
const cols = () => (sinVideo ? COLS_BASE : `${COLS_BASE}, video`);
const faltaColumnaVideo = (error) => {
  const m = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return error?.code === '42703' || (m.includes('video') && m.includes('column'));
};

/** Bloques de una sesión, en orden. */
export async function getBloques(sessionId) {
  const pide = () => supabase
    .from('session_blocks')
    .select(cols())
    .eq('session_id', sessionId)
    .order('orden');
  let { data, error } = await pide();
  if (error && faltaColumnaVideo(error)) { sinVideo = true; ({ data, error } = await pide()); }
  if (error) throw error;
  return data ?? [];
}

/**
 * Sincroniza los bloques de una sesión con la lista editada (diff por id):
 * actualiza los que traen id, inserta los nuevos, borra los que faltan.
 * `orden` se reescribe con la posición en la lista (fuente de verdad = orden visual).
 * Diff (no delete-all) para no dejar la sesión vacía si algo falla a mitad.
 */
export async function guardarBloques(sessionId, bloques) {
  const { data: existentes, error: e0 } = await supabase
    .from('session_blocks').select('id').eq('session_id', sessionId);
  if (e0) throw e0;
  const idsEnBD = new Set((existentes ?? []).map((e) => e.id));

  const idsEditados = new Set(bloques.filter((b) => b.id).map((b) => b.id));
  const aBorrar = [...idsEnBD].filter((id) => !idsEditados.has(id));
  if (aBorrar.length) {
    const { error } = await supabase.from('session_blocks').delete().in('id', aBorrar);
    if (error) throw error;
  }

  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];
    const fila = {
      session_id: sessionId,
      exercise_id: b.exercise_id ?? null,
      orden: i,
      titulo: (b.titulo || '').trim(),
      duracion_min: Number(b.duracion_min),
      intensidad: Number(b.intensidad),
      notas: b.notas?.trim() || null,
      ...(sinVideo ? {} : { video: b.video ?? null }),
    };
    // insert vs update se decide contra lo que HAY en BD, no contra b.id: si otra
    // pestaña borró este bloque entretanto, su id es obsoleto → se reinserta en
    // vez de hacer un UPDATE de 0 filas que lo perdería en silencio.
    /* Si la 022 no está aplicada, el primer escribir con `video` falla
       aquí (la lectura pudo no haber pasado por este proceso). Se apunta
       y se reintenta SIN la columna, en vez de perder el plan. */
    const escribe = async (f) => (b.id && idsEnBD.has(b.id)
      ? supabase.from('session_blocks').update(f).eq('id', b.id)
      : supabase.from('session_blocks').insert(f));
    let { error } = await escribe(fila);
    if (error && faltaColumnaVideo(error)) {
      sinVideo = true;
      const { video, ...sin } = fila;
      ({ error } = await escribe(sin));
    }
    if (error) throw error;
  }
}

/**
 * Bloques de VARIAS sesiones de una tacada (dossier M7). → {sessionId: [bloques]}
 * Paginado: ~6 bloques por sesión × una temporada se acerca al tope de 1000
 * filas que Supabase sirve por defecto, y recortar no da error.
 */
export async function getBloquesSesiones(sessionIds) {
  if (!sessionIds?.length) return {};
  const out = {};
  for (const lote of porLotes(sessionIds)) {
    const filas = await leerTodo(() => supabase
      .from('session_blocks').select(cols()).in('session_id', lote)
      .order('session_id').order('orden'))
      .catch(async (e) => {
        if (!faltaColumnaVideo(e)) throw e;
        sinVideo = true;
        return leerTodo(() => supabase
          .from('session_blocks').select(cols()).in('session_id', lote)
          .order('session_id').order('orden'));
      });
    for (const b of filas) (out[b.session_id] ||= []).push(b);
  }
  return out;
}

// ── Objetivos CONGELADOS de la sesión ─────────────────────────
/** ids de objetivos vinculados (congelados) a la sesión. */
export async function getObjetivosSesion(sessionId) {
  const { data, error } = await supabase
    .from('session_objectives')
    .select('objective_id')
    .eq('session_id', sessionId);
  if (error) throw error;
  return (data ?? []).map((r) => r.objective_id);
}

/** Objetivos congelados de VARIAS sesiones (dossier M7). → {sessionId: [ids]} */
export async function getObjetivosSesiones(sessionIds) {
  if (!sessionIds?.length) return {};
  const out = {};
  for (const lote of porLotes(sessionIds)) {
    const filas = await leerTodo(() => supabase
      .from('session_objectives').select('session_id, objective_id').in('session_id', lote)
      .order('session_id').order('objective_id'));
    for (const r of filas) (out[r.session_id] ||= []).push(r.objective_id);
  }
  return out;
}

/** Sincroniza el conjunto congelado con los ids elegidos (añade/quita). */
export async function guardarObjetivosSesion(sessionId, objectiveIds) {
  const actuales = new Set(await getObjetivosSesion(sessionId));
  const nuevos = new Set(objectiveIds);

  const aQuitar = [...actuales].filter((id) => !nuevos.has(id));
  const aAniadir = [...nuevos].filter((id) => !actuales.has(id));

  if (aQuitar.length) {
    const { error } = await supabase
      .from('session_objectives').delete()
      .eq('session_id', sessionId).in('objective_id', aQuitar);
    if (error) throw error;
  }
  if (aAniadir.length) {
    const filas = aAniadir.map((objective_id) => ({ session_id: sessionId, objective_id }));
    // upsert idempotente: si otra pestaña ya congeló el mismo objetivo, la PK
    // (session_id, objective_id) chocaría; ignoreDuplicates lo hace inofensivo.
    const { error } = await supabase.from('session_objectives')
      .upsert(filas, { onConflict: 'session_id,objective_id', ignoreDuplicates: true });
    if (error) throw error;
  }
}
