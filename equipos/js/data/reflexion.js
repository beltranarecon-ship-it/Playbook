/* ============================================================
   reflexion.js — motor PURO de la reflexión post-sesión
   (módulo Sesiones · M5). Sin DOM, sin Supabase: lo importan la
   vista de cierre, los ajustes del equipo y el banco Node
   (equipos/tools/eval-reflexion.mjs).

   Modelo: la PLANTILLA (reflection_questions) es del equipo y
   cambia con el tiempo; la RESPUESTA (reflection_answers) es de la
   sesión y no debe cambiar de significado nunca. Por eso la clave
   viaja congelada en la respuesta (clave_snapshot) y este motor
   sabe casar las dos caras, incluso cuando ya no encajan.
   ============================================================ */

export const TIPOS_REFLEXION = ['estrellas', 'texto'];
export const ESTRELLAS_MAX = 5;
/** Clave reservada: la única que alimenta v_session_cumplimiento. */
export const CLAVE_CUMPLIMIENTO = 'cumplimiento';

export const ESTRELLA_LABEL = {
  1: 'Muy mal', 2: 'Flojo', 3: 'Correcto', 4: 'Bien', 5: 'Excelente',
};

const limpia = (s) => (s == null ? '' : String(s)).trim();

/**
 * Une plantilla + respuestas en el modelo que se pinta.
 * · Una entrada por pregunta ACTIVA, en su orden, con su respuesta.
 * · Las respuestas HUÉRFANAS (su pregunta se desactivó o se borró
 *   después de contestar) se añaden al final marcadas: el histórico
 *   se sigue viendo, aunque ya no se pregunte.
 * · Si el TIPO de la pregunta cambió tras responder (o la clave se
 *   reutilizó para otra pregunta), manda el tipo ACTUAL: el valor viejo
 *   no se puede pintar en ese control, así que viaja aparte en
 *   `conflicto` — se enseña y NO se borra (ver filasRespuesta).
 * @param preguntas   [{id, clave, etiqueta, tipo, orden, activa}]
 * @param respuestas  [{clave_snapshot, question_id, etiqueta_snapshot, tipo_snapshot, valor_num, valor_texto}]
 * @returns [{clave, etiqueta, tipo, question_id, valor_num, valor_texto, conflicto, huerfana}]
 */
export function plantillaEfectiva(preguntas, respuestas) {
  const porClave = new Map((respuestas || []).map((r) => [r.clave_snapshot, r]));
  const usadas = new Set();

  const activas = (preguntas || [])
    .filter((q) => q.activa !== false)
    .slice()
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || String(a.clave).localeCompare(String(b.clave)));

  const items = activas.map((q) => {
    const r = porClave.get(q.clave);
    if (r) usadas.add(q.clave);
    const mismoTipo = r && r.tipo_snapshot === q.tipo;
    return {
      clave: q.clave,
      etiqueta: q.etiqueta,
      tipo: q.tipo,
      question_id: q.id ?? null,
      valor_num: mismoTipo ? (r.valor_num ?? null) : null,
      valor_texto: mismoTipo ? (r.valor_texto ?? null) : null,
      conflicto: r && !mismoTipo
        ? {
            tipo: r.tipo_snapshot,
            valor_num: r.valor_num ?? null,
            valor_texto: r.valor_texto ?? null,
            etiqueta: r.etiqueta_snapshot || null,
          }
        : null,
      huerfana: false,
    };
  });

  const huerfanas = (respuestas || [])
    .filter((r) => !usadas.has(r.clave_snapshot))
    .map((r) => ({
      clave: r.clave_snapshot,
      etiqueta: r.etiqueta_snapshot || r.clave_snapshot,
      tipo: r.tipo_snapshot,
      question_id: r.question_id ?? null,
      valor_num: r.valor_num ?? null,
      valor_texto: r.valor_texto ?? null,
      conflicto: null,
      huerfana: true,
    }));

  return [...items, ...huerfanas];
}

/**
 * Reparto de la reflexión editada: qué filas se escriben y qué claves
 * se borran. Una respuesta VACÍA no se guarda: se borra su fila (así
 * "hay reflexión" nunca es una fila en blanco).
 * EXCEPCIÓN: si la pregunta arrastra un `conflicto` (hay una respuesta
 * guardada en otro formato), dejarla en blanco NO la borra. Nadie pierde
 * una valoración de enero por abrir esa sesión en abril y guardar.
 * @returns {aGuardar:[fila], aBorrar:[clave]}
 */
export function filasRespuesta(sessionId, items) {
  const aGuardar = [], aBorrar = [];
  for (const it of items || []) {
    const esEstrellas = it.tipo === 'estrellas';
    const num = Number(it.valor_num);
    const txt = limpia(it.valor_texto);
    const valeNum = esEstrellas && Number.isInteger(num) && num >= 1 && num <= ESTRELLAS_MAX;
    const valeTxt = !esEstrellas && txt !== '';

    if (!valeNum && !valeTxt) {
      if (!it.conflicto) aBorrar.push(it.clave);   // lo que no se puede pintar, no se borra
      continue;
    }
    aGuardar.push({
      session_id: sessionId,
      clave_snapshot: it.clave,
      question_id: it.question_id ?? null,
      etiqueta_snapshot: it.etiqueta ?? null,
      tipo_snapshot: it.tipo,
      valor_num: valeNum ? num : null,
      valor_texto: valeTxt ? txt : null,
    });
  }
  return { aGuardar, aBorrar };
}

/**
 * Media de las estrellas RESPONDIDAS (null si no hay ninguna).
 * OJO con el filtro: `Number(null)` es 0 y `Number('')` también, así que
 * `Number.isFinite()` a secas colaba las preguntas sin responder como ceros
 * y hundía la media (3 preguntas, una con 5 → 1,7 en vez de 5). Se exige el
 * MISMO predicado que filasRespuesta(): entero de 1 a 5 o no cuenta.
 */
export function mediaEstrellas(items) {
  const nums = (items || [])
    .filter((it) => it.tipo === 'estrellas')
    .map((it) => Number(it.valor_num))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= ESTRELLAS_MAX);
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

/** El valor de cumplimiento (1-5) que verá v_session_cumplimiento, o null. */
export function cumplimientoDe(items) {
  const it = (items || []).find((x) => x.clave === CLAVE_CUMPLIMIENTO && x.tipo === 'estrellas');
  const n = Number(it?.valor_num);
  return Number.isInteger(n) && n >= 1 && n <= ESTRELLAS_MAX ? n : null;
}

/** ¿Hay algo respondido? (para el badge "evaluada"). */
export function hayRespuestas(items) {
  return filasRespuesta('x', items).aGuardar.length > 0;
}

/**
 * Clave estable a partir de la etiqueta de una pregunta nueva.
 * Debe casar con el CHECK de BD: ^[a-z][a-z0-9_]{1,39}$.
 * Sin tildes, sin espacios, sin colisiones dentro del equipo.
 * @param tipo si se pasa y NO es 'estrellas', la clave reservada
 *   'cumplimiento' se considera ocupada: la BD solo la admite en
 *   estrellas (CHECK de 015) y el error llegaría crudo al entrenador.
 */
export function claveDesdeEtiqueta(etiqueta, clavesExistentes = [], { tipo = null } = {}) {
  let base = limpia(etiqueta)
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')  // fuera tildes
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  if (!/^[a-z]/.test(base)) base = ('p_' + base).slice(0, 40);
  base = base.replace(/_+$/g, '');
  if (base.length < 2) base = 'pregunta';

  const usadas = new Set(clavesExistentes);
  if (tipo && tipo !== 'estrellas') usadas.add(CLAVE_CUMPLIMIENTO);
  if (!usadas.has(base)) return base;
  for (let i = 2; i < 100; i++) {
    const cand = `${base.slice(0, 40 - String(i).length - 1)}_${i}`;
    if (!usadas.has(cand)) return cand;
  }
  return `${base.slice(0, 36)}_zzz`;
}
