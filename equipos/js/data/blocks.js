/* ============================================================
   blocks.js — persistencia del planificador de sesión (M4):
   bloques de ejercicios y objetivos CONGELADOS de la sesión.
   La carga (sessions.carga_total) la recalcula un trigger en BD;
   aquí solo escribimos los bloques. RLS por sesión recorta debajo.
   ============================================================ */

import { supabase, leerTodo, porLotes } from './_client.js';

const COLS_BASE = 'id, session_id, exercise_id, orden, titulo, duracion_min, intensidad, notas';

/* ---- Las columnas nuevas y las migraciones que pueden no estar -----
   `video` la añade la 022 (Tramo 3.3); `duracion_real_min` y
   `fallido`, la 023 (Tramo 3.5). Si esas migraciones todavía no se
   han aplicado, pedirlas haría fallar TODA la consulta y el
   planificador no abriría ninguna sesión: un plan entero perdido por
   funciones que el entrenador ni siquiera está usando.

   Así que se piden y, si la base de datos dice que no existen, se
   apunta y se sigue sin ellas. Mismo criterio que el resto del módulo
   de sesiones: cada pieza degrada sola. */
const COLS_NUEVAS = ['video', 'duracion_real_min', 'fallido'];
let sinNuevas = false;

/* La 040 va con SU PROPIO interruptor y no dentro de COLS_NUEVAS.
   Metiéndola ahí, un club con la 022 y la 023 aplicadas pero sin la
   040 dejaría de guardar `duracion_real_min` —que hoy le funciona— en
   cuanto la base se quejara de `tiempo_perdido_min`. Cada migración
   responde solo de lo suyo. */
const COLS_040 = ['tiempo_perdido_min', 'motivo_perdido'];
let sin040 = false;

const cols = () => [
  COLS_BASE,
  sinNuevas ? null : COLS_NUEVAS.join(', '),
  sin040 ? null : COLS_040.join(', '),
].filter(Boolean).join(', ');

const texto = (error) => `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
const nombra = (error, lista) => lista.some((c) => texto(error).includes(c));
/** ¿El error es «esa columna no existe»? (PostgREST: 42703 / PGRST204) */
const esColumnaAusente = (error) => error?.code === '42703'
  || error?.code === 'PGRST204'
  || texto(error).includes('column');

/* Si la base nombra una columna de la 040, la culpa es suya y no de las
   otras: apagar el grupo equivocado dejaría de guardar `duracion_real_min`
   por un fallo que no era el suyo. */
const falta040 = (error) => esColumnaAusente(error) && nombra(error, COLS_040);
const faltaColumna = (error) => esColumnaAusente(error)
  && !nombra(error, COLS_040)
  && (nombra(error, COLS_NUEVAS) || error?.code === '42703' || error?.code === 'PGRST204');

/** Bloques de una sesión, en orden. */
export async function getBloques(sessionId) {
  const pide = () => supabase
    .from('session_blocks')
    .select(cols())
    .eq('session_id', sessionId)
    .order('orden');
  let { data, error } = await pide();
  // cada grupo de columnas se apaga por separado; puede faltar cualquiera
  if (error && falta040(error)) { sin040 = true; ({ data, error } = await pide()); }
  if (error && faltaColumna(error)) { sinNuevas = true; ({ data, error } = await pide()); }
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
      ...(sinNuevas ? {} : {
        video: b.video ?? null,
        duracion_real_min: b.duracion_real_min ?? null,
        fallido: !!b.fallido,
      }),
      ...(sin040 ? {} : {
        // null = no se pauso, que no es lo mismo que pausar cero minutos
        tiempo_perdido_min: b.tiempo_perdido_min ?? null,
        motivo_perdido: (b.motivo_perdido || '').trim() || null,
      }),
    };
    // insert vs update se decide contra lo que HAY en BD, no contra b.id: si otra
    // pestaña borró este bloque entretanto, su id es obsoleto → se reinserta en
    // vez de hacer un UPDATE de 0 filas que lo perdería en silencio.
    /* Si 022/023 no están aplicadas, el primer escribir falla aquí (la
       lectura pudo no haber pasado por este proceso). Se apunta y se
       reintenta SIN esas columnas, en vez de perder el plan. */
    const escribe = async (f) => (b.id && idsEnBD.has(b.id)
      ? supabase.from('session_blocks').update(f).eq('id', b.id)
      : supabase.from('session_blocks').insert(f));
    let { error } = await escribe(fila);
    if (error && falta040(error)) {
      sin040 = true;
      const sin = { ...fila };
      for (const c of COLS_040) delete sin[c];
      ({ error } = await escribe(sin));
    }
    if (error && faltaColumna(error)) {
      sinNuevas = true;
      const sin = { ...fila };
      for (const c of COLS_NUEVAS) delete sin[c];
      if (sin040) for (const c of COLS_040) delete sin[c];
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
        if (falta040(e)) sin040 = true;
        else if (faltaColumna(e)) sinNuevas = true;
        else throw e;
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
