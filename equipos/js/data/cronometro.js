/* ============================================================
   cronometro.js — EL RELOJ DEL ENTRENAMIENTO (Tramo 3.5).
   Módulo PURO: sin DOM, sin Supabase, sin temporizadores. Lo importan
   la pantalla de sesión activa y el banco Node.

   ── POR QUÉ NO HAY UN TEMPORIZADOR AQUÍ ─────────────────────
   Porque un cronómetro que cuenta con `setInterval` miente. El móvil
   se bloquea en el bolsillo, la pestaña pasa a segundo plano y el
   navegador deja de darle latidos: al volver, el reloj lleva ocho
   minutos de retraso justo cuando hacía falta que estuviera bien.

   Aquí todo se CALCULA a partir de dos cosas: cuándo se arrancó y qué
   bloques ya se han dado. La pantalla pregunta la hora cada segundo,
   pero si no pregunta en diez minutos, a los diez minutos la respuesta
   sigue siendo exacta.

   ── DE DÓNDE SALE EL PRINCIPIO ──────────────────────────────
   Del `arranque`, que por defecto es la hora de pista y que se corrige
   de UN TOQUE si se empezó tarde (§5.6). Es lo que evita que los
   tiempos reales se falseen: un entrenamiento que empieza a y cuarto
   no tiene bloques de menos, tiene el mismo plan quince minutos más
   tarde.

   ── Y EL BLOQUE EN CURSO ────────────────────────────────────
   El primero que todavía no se ha dado por FINALIZADO. Los dados
   guardan su duración REAL, así que el bloque en curso empieza donde
   acabó el anterior de verdad, no donde el plan decía que acabaría.
   Eso es lo que hace que el reloj siga sirviendo en el minuto 70 de un
   entrenamiento que se ha ido torciendo desde el minuto 10.
   ============================================================ */

const MIN = 60000;

/** Minutos que se añaden de un toque cuando un bloque necesita más. */
export const MAS_MIN = 5;

const dur = (b) => Math.max(0, Number(b?.duracion_min) || 0);
const real = (b) => (Number.isFinite(Number(b?.duracion_real_min)) && b?.duracion_real_min !== null
  ? Math.max(0, Number(b.duracion_real_min)) : null);

/** ¿Este bloque ya se ha dado? */
export const estaHecho = (b) => real(b) !== null;

/**
 * El estado del reloj en un instante.
 *
 * @param bloques  los del plan, EN ORDEN. Los ya dados traen
 *   `duracion_real_min`; el resto, no.
 * @param opts.arranque  ms en que empezó el entrenamiento
 * @param opts.ahora     ms
 * @param opts.extras    { [uid|id]: minutos } lo que se ha ido añadiendo
 *   con «+5» al bloque en curso. Vive en la pantalla y no en la base de
 *   datos: en cuanto el bloque se da por finalizado, lo que cuenta es
 *   su duración REAL, no la que se le fue concediendo.
 *
 * @returns {
 *   indice, bloque, hechos, total,
 *   inicioBloque, transcurridoMs, previstoMs, restanteMs,
 *   finPrevisto, desvioMin, terminada
 * }
 */
export function estadoCronometro(bloques, { arranque = 0, ahora = 0, extras = {} } = {}) {
  const lista = (Array.isArray(bloques) ? bloques : []).filter((b) => b && dur(b) > 0);
  const total = lista.length;

  let indice = lista.findIndex((b) => !estaHecho(b));
  const terminada = indice === -1;
  if (terminada) indice = total;

  // el bloque en curso empieza donde acabó el anterior DE VERDAD
  let inicioBloque = Number(arranque) || 0;
  for (let i = 0; i < Math.min(indice, total); i++) inicioBloque += real(lista[i]) * MIN;

  const bloque = terminada ? null : lista[indice] || null;
  const extra = bloque ? Math.max(0, Number(extras[claveDe(bloque)]) || 0) : 0;
  const previstoMs = bloque ? (dur(bloque) + extra) * MIN : 0;
  const transcurridoMs = bloque ? Math.max(0, Number(ahora) - inicioBloque) : 0;

  // lo que queda del PLAN completo, contando lo ya gastado de verdad
  let finPrevisto = Number(arranque) || 0;
  for (let i = 0; i < total; i++) {
    const b = lista[i];
    finPrevisto += estaHecho(b)
      ? real(b) * MIN
      : (dur(b) + (Number(extras[claveDe(b)]) || 0)) * MIN;
  }
  // el bloque en curso ya puede haberse pasado de lo previsto
  if (bloque && transcurridoMs > previstoMs) finPrevisto += transcurridoMs - previstoMs;

  const planeadoMs = lista.reduce((s, b) => s + dur(b) * MIN, 0);
  const arranqueMs = Number(arranque) || 0;

  return {
    indice, bloque, total,
    hechos: lista.filter(estaHecho).length,
    inicioBloque,
    transcurridoMs,
    previstoMs,
    restanteMs: previstoMs - transcurridoMs,   // negativo = se está pasando
    finPrevisto,
    desvioMin: Math.round((finPrevisto - (arranqueMs + planeadoMs)) / MIN),
    terminada,
  };
}

/** La clave con la que un bloque se reconoce en la pantalla. */
export const claveDe = (b) => b?.uid || b?.id || String(b?.orden ?? '');

/**
 * Los minutos REALES que hay que guardar al dar un bloque por
 * finalizado. Se redondea al minuto y nunca baja de uno: un bloque que
 * se dio no duró cero, y guardar cero haría que la próxima vez el
 * ejercicio se propusiera con una duración imposible (fila 3.6).
 */
export function minutosReales(transcurridoMs) {
  return Math.max(1, Math.round((Number(transcurridoMs) || 0) / MIN));
}

/**
 * El arranque cuando se empieza tarde, de un toque.
 *
 * Se mueve el PRINCIPIO, no se recortan los bloques: un entrenamiento
 * que empieza a y cuarto tiene el mismo plan quince minutos más tarde
 * (§11). Los bloques ya dados no se tocan.
 */
export const arranqueAhora = (ahora) => Number(ahora) || 0;

/** «12:34» a partir de ms. Con signo si va en contra. */
export function textoReloj(ms) {
  const n = Number(ms) || 0;
  const signo = n < 0 ? '−' : '';
  const s = Math.floor(Math.abs(n) / 1000);
  return `${signo}${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** «va 4 min por delante» / «lleva 7 min de retraso» / «en hora». */
export function textoDesvio(desvioMin) {
  const d = Math.round(Number(desvioMin) || 0);
  if (d === 0) return 'en hora';
  if (d > 0) return `${d} min de retraso`;
  return `${-d} min por delante`;
}
