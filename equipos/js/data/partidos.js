/* ============================================================
   partidos.js — motor PURO de partidos (módulo Sesiones · M6).
   Sin DOM, sin Supabase: lo importan la vista de partido, la ficha
   del equipo y el banco Node (equipos/tools/eval-partidos.mjs).

   Aquí vive lo único que hay que calcular bien: qué es una victoria,
   qué dice el balance de la temporada y cuándo un partido está de
   verdad valorado. El resto es formulario.
   ============================================================ */

export const VALORACION_MAX = 5;

/** Los cinco ejes que valora el entrenador, en el orden en que se pintan. */
export const EJES_VALORACION = [
  { clave: 'val_defensa', etiqueta: 'Defensa' },
  { clave: 'val_ataque',  etiqueta: 'Ataque' },
  { clave: 'val_actitud', etiqueta: 'Actitud' },
  { clave: 'val_acierto', etiqueta: 'Acierto' },
  { clave: 'val_global',  etiqueta: 'Global' },
];

export const ESTADOS_PARTIDO = {
  programado: 'Programado',
  jugado: 'Jugado',
  aplazado: 'Aplazado',
  cancelado: 'Cancelado',
};

const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const esEntero = (v) => Number.isInteger(v);

/** ¿El marcador está completo y es válido (0-300 ambos)? */
export function marcadorValido(favor, contra) {
  const f = num(favor), c = num(contra);
  return esEntero(f) && esEntero(c) && f >= 0 && c >= 0 && f <= 300 && c <= 300;
}

/**
 * Resultado desde el punto de vista del equipo propio.
 * @returns 'victoria' | 'derrota' | 'empate' | null (sin marcador o no jugado)
 */
export function resultadoPartido(m) {
  if (!m || m.estado !== 'jugado') return null;
  if (!marcadorValido(m.marcador_favor, m.marcador_contra)) return null;
  const f = Number(m.marcador_favor), c = Number(m.marcador_contra);
  if (f > c) return 'victoria';
  if (f < c) return 'derrota';
  return 'empate';
}

/** Diferencia de puntos (positiva = a favor). null si no hay marcador. */
export function diferencia(m) {
  if (!m || !marcadorValido(m.marcador_favor, m.marcador_contra)) return null;
  return Number(m.marcador_favor) - Number(m.marcador_contra);
}

/**
 * Balance de una lista de partidos. Solo cuentan los JUGADOS con marcador:
 * un programado o un aplazado no ensucia la estadística.
 * `racha` = resultados consecutivos más recientes ({tipo, n}), leyendo la
 * lista tal como llega ORDENADA POR FECHA ASCENDENTE.
 * @returns {jugados, victorias, derrotas, empates, favor, contra,
 *           difMedia, pctVictorias, racha}
 */
export function balancePartidos(partidos) {
  const jugados = (partidos || []).filter((m) => resultadoPartido(m));
  const r = {
    jugados: jugados.length, victorias: 0, derrotas: 0, empates: 0,
    favor: 0, contra: 0, difMedia: null, pctVictorias: null, racha: null,
  };
  for (const m of jugados) {
    const res = resultadoPartido(m);
    if (res === 'victoria') r.victorias++;
    else if (res === 'derrota') r.derrotas++;
    else r.empates++;
    r.favor += Number(m.marcador_favor);
    r.contra += Number(m.marcador_contra);
  }
  if (r.jugados) {
    r.difMedia = (r.favor - r.contra) / r.jugados;
    r.pctVictorias = Math.round((r.victorias / r.jugados) * 100);
    let n = 0;
    const tipo = resultadoPartido(jugados[jugados.length - 1]);
    for (let i = jugados.length - 1; i >= 0; i--) {
      if (resultadoPartido(jugados[i]) !== tipo) break;
      n++;
    }
    r.racha = { tipo, n };
  }
  return r;
}

/** Media de las valoraciones puestas (null si no hay ninguna). */
export function mediaValoracion(m) {
  const vals = EJES_VALORACION
    .map((e) => Number(m?.[e.clave]))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= VALORACION_MAX);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** ¿Hay al menos una valoración? (lo que sella valorada_at en BD). */
export function hayValoracion(m) {
  return EJES_VALORACION.some((e) => {
    const v = Number(m?.[e.clave]);
    return Number.isInteger(v) && v >= 1 && v <= VALORACION_MAX;
  });
}

/**
 * Media por eje de una lista de partidos: dónde se gana y dónde se pierde
 * la temporada. @returns [{clave, etiqueta, media, n}]
 */
export function mediasPorEje(partidos) {
  return EJES_VALORACION.map((e) => {
    const vals = (partidos || [])
      .map((m) => Number(m?.[e.clave]))
      .filter((v) => Number.isInteger(v) && v >= 1 && v <= VALORACION_MAX);
    return {
      clave: e.clave,
      etiqueta: e.etiqueta,
      n: vals.length,
      media: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    };
  });
}

/**
 * Valida lo que se va a guardar. Devuelve el primer problema en lenguaje
 * de entrenador, o null si está listo.
 */
export function validaPartido(m) {
  if (!m?.rival || !String(m.rival).trim()) return 'Falta el rival.';
  if (!m?.fecha) return 'Falta la fecha.';
  const f = num(m.marcador_favor), c = num(m.marcador_contra);
  const algunMarcador = f !== null || c !== null;
  if (algunMarcador && !marcadorValido(f, c)) {
    return 'El marcador tiene que ser dos números enteros entre 0 y 300.';
  }
  if (m.estado === 'jugado' && !marcadorValido(f, c)) {
    return 'Un partido jugado necesita marcador.';
  }
  return null;
}
