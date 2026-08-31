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

/** Minutos que este bloque estuvo parado. Sin pausa, cero. */
const perdido = (b) => Math.max(0, Number(b?.tiempo_perdido_min) || 0);

/**
 * Lo que un bloque ya dado OCUPÓ DE PISTA: lo entrenado más lo parado.
 *
 * Es lo que sitúa al siguiente en el reloj, y es distinto de lo que se
 * entrenó. Si se descontara aquí lo perdido, los diez minutos que se
 * pasaron esperando a que se fuera el otro equipo harían que todos los
 * bloques siguientes empezaran diez minutos antes de lo que marca el
 * reloj de pared, y la cuenta atrás mentiría el resto del
 * entrenamiento.
 */
const ocupado = (b) => (real(b) === null ? null : real(b) + perdido(b));

/** ¿Este bloque ya se ha dado? */
export const estaHecho = (b) => real(b) !== null;

/**
 * Milisegundos que el bloque en curso lleva parado, contando la pausa
 * abierta si la hay.
 *
 * `pausa` es `{ acumuladoMs, desde }`: `desde` es el instante en que se
 * tocó el reloj, o null si está corriendo. Se guarda ASÍ y no como un
 * contador que va sumando porque, igual que el resto del módulo, tiene
 * que sobrevivir a un móvil bloqueado en el bolsillo: al volver, lo
 * pausado se CALCULA desde `desde`, esté la pantalla despierta o no.
 */
export function pausadoMs(pausa, ahora = 0) {
  if (!pausa) return 0;
  const acumulado = Math.max(0, Number(pausa.acumuladoMs) || 0);
  const desde = Number(pausa.desde);
  if (!Number.isFinite(desde) || !desde) return acumulado;
  return acumulado + Math.max(0, (Number(ahora) || 0) - desde);
}

/** ¿Está parado ahora mismo? */
export const estaPausado = (pausa) => !!(pausa && Number(pausa.desde));

/** Tocar el reloj: para si corría, reanuda si estaba parado. */
export function alternarPausa(pausa, ahora = 0) {
  const t = Number(ahora) || 0;
  if (estaPausado(pausa)) {
    return { ...pausa, acumuladoMs: pausadoMs(pausa, t), desde: null };
  }
  return { motivo: '', ...pausa, acumuladoMs: Math.max(0, Number(pausa?.acumuladoMs) || 0), desde: t };
}

/**
 * Los minutos perdidos que hay que guardar al finalizar el bloque.
 *
 * Se redondea al minuto y se devuelve `null` si no llegó a uno: NULL en
 * la base significa «no se pausó», y una parada de quince segundos para
 * atarse una zapatilla no es tiempo perdido, es un entrenamiento.
 */
export function minutosPerdidos(ms) {
  const m = Math.round((Number(ms) || 0) / MIN);
  return m > 0 ? m : null;
}

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
export function estadoCronometro(bloques, { arranque = 0, ahora = 0, extras = {}, pausa = null } = {}) {
  const lista = (Array.isArray(bloques) ? bloques : []).filter((b) => b && dur(b) > 0);
  const total = lista.length;

  let indice = lista.findIndex((b) => !estaHecho(b));
  const terminada = indice === -1;
  if (terminada) indice = total;

  /* El bloque en curso empieza donde acabó el anterior DE VERDAD: lo
     que se entrenó MÁS lo que se estuvo parado, porque las dos cosas
     ocuparon pista y el reloj de pared no perdona ninguna. */
  let inicioBloque = Number(arranque) || 0;
  for (let i = 0; i < Math.min(indice, total); i++) inicioBloque += ocupado(lista[i]) * MIN;

  const bloque = terminada ? null : lista[indice] || null;
  const extra = bloque ? Math.max(0, Number(extras[claveDe(bloque)]) || 0) : 0;
  const previstoMs = bloque ? (dur(bloque) + extra) * MIN : 0;
  const paradoMs = bloque ? pausadoMs(pausa, ahora) : 0;
  /* Lo parado no cuenta como entrenado: la cuenta atrás se queda quieta
     mientras el equipo está esperando, que es justo lo que se espera al
     tocar el reloj. */
  const transcurridoMs = bloque
    ? Math.max(0, (Number(ahora) - inicioBloque) - paradoMs) : 0;

  // lo que queda del PLAN completo, contando lo ya gastado de verdad
  let finPrevisto = Number(arranque) || 0;
  for (let i = 0; i < total; i++) {
    const b = lista[i];
    finPrevisto += estaHecho(b)
      ? ocupado(b) * MIN
      : (dur(b) + (Number(extras[claveDe(b)]) || 0)) * MIN;
  }
  // lo que llevamos parados en el bloque en curso también retrasa el final
  finPrevisto += paradoMs;
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
    paradoMs,
    pausado: estaPausado(pausa),
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
