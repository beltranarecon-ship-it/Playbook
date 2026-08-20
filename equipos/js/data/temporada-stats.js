/* ============================================================
   temporada-stats.js — LO QUE LLEVA CADA UNO EN LA TEMPORADA
   (Tramo 4.4). Módulo PURO: sin DOM, sin red.

   ── PERIODOS, NO MINUTOS ────────────────────────────────────
   §5.9. En minibasket no se juegan minutos: se juegan periodos, y
   sumarlos es sumar la unidad que existe. Traducir a minutos obligaría
   a inventarse una equivalencia («un periodo son ocho minutos») que en
   el acta no está escrita en ningún sitio.

   ── LA PREGUNTA QUE IMPORTA NO ES CUÁNTOS PUNTOS ────────────
   Los puntos se suman porque están en el acta y porque al crío le
   hacen ilusión. Pero lo que un entrenador de formación necesita ver
   —y lo que nadie mira si la tabla se ordena por anotación— es
   **cuántos periodos lleva cada uno**. Por eso el reparto tiene su
   propio número, `periodosPorPartido`, y por eso la tabla se ordena
   por periodos y no por puntos.

   ── AUSENCIA NO ES CERO ─────────────────────────────────────
   Un partido sin acta apuntada no dice que nadie jugara: dice que no
   se apuntó. No cuenta ni a favor ni en contra, igual que en la
   rúbrica una fila sin mirar no es un suspenso. Y por eso todo lo que
   se enseña dice SOBRE CUÁNTOS partidos se ha calculado.
   ============================================================ */

/** Un entero seguro, sin sorpresas con null ni con texto. */
const n = (x) => { const v = Math.round(Number(x)); return Number.isFinite(v) ? v : 0; };

/**
 * Acumula las filas de `partido_estadisticas` por jugador.
 *
 * @param filas     lo que devuelve `estadisticas.getEstadisticasDePartidos`
 * @param partidos  los partidos de la temporada, para saber cuáles son
 *                  de verdad y en qué orden van
 *
 * @returns Map player_id → {
 *   partidos, periodos, puntos, faltas,
 *   periodosPorPartido, puntosPorPartido,
 *   masPeriodos, menosPeriodos,     // el techo y el suelo de la temporada
 *   ultimos: [{match_id, fecha, periodos, puntos, faltas}],  // por fecha
 * }
 */
export function acumular(filas, partidos = []) {
  /* Solo cuentan los partidos que existen y que se jugaron: una fila
     huérfana —de un partido borrado o aplazado— sumaría periodos de un
     partido que no se jugó. */
  const validos = new Map();
  for (const m of partidos || []) {
    if (m?.estado === 'jugado') validos.set(m.id, m);
  }

  const out = new Map();
  for (const f of filas || []) {
    const m = validos.get(f.match_id);
    if (!m) continue;
    let a = out.get(f.player_id);
    if (!a) {
      a = { partidos: 0, periodos: 0, puntos: 0, faltas: 0, masPeriodos: 0, menosPeriodos: Infinity, ultimos: [] };
      out.set(f.player_id, a);
    }
    const per = n(f.periodos_jugados);
    a.partidos += 1;
    a.periodos += per;
    a.puntos += n(f.puntos);
    a.faltas += n(f.faltas);
    a.masPeriodos = Math.max(a.masPeriodos, per);
    a.menosPeriodos = Math.min(a.menosPeriodos, per);
    a.ultimos.push({ match_id: f.match_id, fecha: m.fecha, periodos: per, puntos: n(f.puntos), faltas: n(f.faltas) });
  }

  for (const a of out.values()) {
    a.periodosPorPartido = a.partidos ? a.periodos / a.partidos : 0;
    a.puntosPorPartido = a.partidos ? a.puntos / a.partidos : 0;
    if (a.menosPeriodos === Infinity) a.menosPeriodos = 0;
    a.ultimos.sort((x, y) => String(y.fecha).localeCompare(String(x.fecha)));
  }
  return out;
}

/** El acumulado de un jugador, o uno a cero si no ha jugado nada. */
export const deJugador = (mapa, playerId) => mapa?.get(playerId) || {
  partidos: 0, periodos: 0, puntos: 0, faltas: 0,
  periodosPorPartido: 0, puntosPorPartido: 0,
  masPeriodos: 0, menosPeriodos: 0, ultimos: [],
};

/**
 * La tabla del equipo, ordenada por PERIODOS.
 *
 * Por periodos y no por puntos a propósito: una tabla ordenada por
 * anotación pone arriba al que ya lo tiene todo y esconde justo lo que
 * hay que mirar, que es quién está jugando poco. Aquí el primero es el
 * que más juega y el último el que menos, y ese último es el nombre
 * que el entrenador tiene que ver.
 */
export function tabla(mapa, jugadores) {
  return (jugadores || [])
    .map((j) => ({ jugador: j, ...deJugador(mapa, j.id) }))
    .sort((a, b) => b.periodos - a.periodos
      || b.partidos - a.partidos
      || String(a.jugador.nombre).localeCompare(String(b.jugador.nombre)));
}

/* ── El reparto ────────────────────────────────────────────── */

/**
 * Cómo de repartido está el juego.
 *
 * No es una nota: es la distancia entre el que más juega y el que
 * menos, contando solo a los que han estado en alguna acta. Un equipo
 * de formación con doce puntos de diferencia entre el primero y el
 * último tiene una conversación pendiente, y este número es la que la
 * empieza.
 *
 * @returns {n, max, min, media, brecha, quienMenos} o null si no hay nada
 */
export function reparto(mapa, jugadores) {
  const filas = (jugadores || [])
    .map((j) => ({ jugador: j, ...deJugador(mapa, j.id) }))
    .filter((x) => x.partidos > 0);
  if (!filas.length) return null;
  const per = filas.map((x) => x.periodos);
  const max = Math.max(...per), min = Math.min(...per);
  const media = per.reduce((s, x) => s + x, 0) / filas.length;
  const ultimo = filas.reduce((a, b) => (b.periodos < a.periodos ? b : a));
  return { n: filas.length, max, min, media, brecha: max - min, quienMenos: ultimo.jugador };
}

/* ── Cómo se lee ───────────────────────────────────────────── */

/** Un número con un decimal, y sin el «.0» cuando es redondo. */
export const conUnDecimal = (x) => {
  const v = Number(x) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/**
 * «14 periodos en 5 partidos · 2,8 por partido · 18 puntos»
 *
 * Siempre dice sobre cuántos partidos va la cuenta: una media sobre
 * dos partidos y una sobre veinte se leen igual y no valen lo mismo.
 */
export function textoAcumulado(a) {
  if (!a || !a.partidos) return 'Todavía no ha jugado ningún partido con acta apuntada.';
  const partes = [
    `${a.periodos} periodo${a.periodos === 1 ? '' : 's'} en ${a.partidos} partido${a.partidos === 1 ? '' : 's'}`,
    `${conUnDecimal(a.periodosPorPartido)} por partido`,
    a.puntos ? `${a.puntos} punto${a.puntos === 1 ? '' : 's'}` : null,
    a.faltas ? `${a.faltas} falta${a.faltas === 1 ? '' : 's'}` : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/** El aviso del reparto, en cristiano, o cadena vacía si no hay que decir nada. */
export function textoReparto(r, { brechaQueImporta = 6 } = {}) {
  if (!r || r.n < 2) return '';
  if (r.brecha < brechaQueImporta) {
    return `El juego está repartido: del que más al que menos hay ${r.brecha} periodo${r.brecha === 1 ? '' : 's'}.`;
  }
  return `Del que más juega al que menos hay ${r.brecha} periodos. El que menos, ${r.quienMenos.nombre}, lleva ${r.min}.`;
}
