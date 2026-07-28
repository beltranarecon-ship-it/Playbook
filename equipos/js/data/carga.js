/* ============================================================
   carga.js — motor PURO de la curva de carga de una sesión
   (módulo Sesiones · M4). Sin DOM, sin Supabase: lo importan el
   planificador y el banco Node (equipos/tools/eval-carga.mjs).

   Modelo: una sesión es una secuencia de bloques con duración e
   intensidad 1-5. La "carga" de un bloque = intensidad × duración
   (área). La curva es un escalón: intensidad constante durante la
   duración del bloque, encadenados en el tiempo.
   ============================================================ */

export const INTENSIDAD_MAX = 5;

/** Etiquetas de intensidad 1-5 (para la UI y la leyenda). */
export const INTENSIDAD_LABEL = {
  1: 'Muy suave', 2: 'Suave', 3: 'Media', 4: 'Alta', 5: 'Máxima',
};

/**
 * Totales y segmentos temporales de una lista de bloques.
 * @param bloques [{duracion_min, intensidad, titulo?}] EN ORDEN
 * @returns {segmentos:[{x0,x1,intensidad,duracion,titulo}], duracion, carga, cargaMedia}
 *   · x0/x1 = minuto de inicio/fin acumulado
 *   · carga = Σ intensidad×duración   · cargaMedia = intensidad media ponderada
 */
export function curvaCarga(bloques) {
  let t = 0, carga = 0;
  const segmentos = [];
  for (const b of bloques || []) {
    const dur = Number(b.duracion_min) || 0;
    const int = Number(b.intensidad) || 0;
    if (dur <= 0) continue;
    segmentos.push({ x0: t, x1: t + dur, intensidad: int, duracion: dur, titulo: b.titulo ?? null });
    t += dur;
    carga += int * dur;
  }
  return {
    segmentos,
    duracion: t,
    carga,
    cargaMedia: t ? carga / t : 0,
  };
}

/**
 * Geometría de la curva escalón para pintarla en un SVG de `ancho`×`alto`.
 * Devuelve puntos numéricos (el view arma el string) → testeable sin floats
 * frágiles: la escala X reparte por TIEMPO, la Y por intensidad (1..max).
 * @returns {top:[{x,y}], area:[{x,y}], duracion, escalaX, escalaY}
 */
export function geometriaCurva(segmentos, { ancho, alto, maxIntensidad = INTENSIDAD_MAX } = {}) {
  const dur = segmentos.length ? segmentos[segmentos.length - 1].x1 : 0;
  const escalaX = (min) => (dur ? (min / dur) * ancho : 0);
  const escalaY = (int) => alto - (Math.max(0, Math.min(int, maxIntensidad)) / maxIntensidad) * alto;

  const top = [];
  for (const s of segmentos) {
    top.push({ x: escalaX(s.x0), y: escalaY(s.intensidad) });
    top.push({ x: escalaX(s.x1), y: escalaY(s.intensidad) });
  }
  // polígono de área cerrado: base izquierda → escalón → base derecha
  const area = dur
    ? [{ x: 0, y: alto }, ...top, { x: ancho, y: alto }]
    : [];
  return { top, area, duracion: dur, escalaX, escalaY };
}

/**
 * Aviso de desajuste con la duración del slot (si se conoce). Solo informa;
 * nunca bloquea (el coach manda). Umbral: ±5 min se considera "cuadra".
 * @returns null | {tipo:'excede'|'corto', diff}  (diff en minutos, positivo)
 */
export function avisoDuracion(duracionTotal, slotDuracionMin) {
  if (!slotDuracionMin || slotDuracionMin <= 0) return null;
  const diff = duracionTotal - slotDuracionMin;
  if (diff > 5) return { tipo: 'excede', diff };
  if (diff < -5) return { tipo: 'corto', diff: -diff };
  return null;
}
