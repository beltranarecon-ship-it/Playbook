/* ============================================================
   objetivos-medida.js — CUÁNTO SE HA CUMPLIDO UN OBJETIVO (Tramo 3.9).
   Módulo PURO: sin DOM, sin Supabase. Lo importan la ficha del equipo,
   el planificador y el banco Node.

   ── QUÉ SUSTITUYE ───────────────────────────────────────────
   La pregunta de cumplimiento AUTODECLARADA de la reflexión: «¿has
   cumplido el objetivo?» con una respuesta del propio entrenador. Se
   retira (§7) y en su sitio queda una medida (decisión #26):

       trabajado en 7 sesiones · 5 de 13 han subido

   Los dos números dicen cosas distintas y hacen falta los dos. El
   primero es lo que TÚ has hecho: cuántas veces has puesto ese
   objetivo en un entrenamiento. El segundo es lo que ha PASADO:
   cuántos jugadores han subido de nivel en las filas a las que apunta.

   Un objetivo trabajado siete sesiones con cero jugadores que suben no
   es un objetivo cumplido: es un objetivo que hay que replantear. Y
   eso, autodeclarado, no se ve nunca.

   ── QUÉ CUENTA COMO «HA SUBIDO» ─────────────────────────────
   Que el nivel de HOY en alguna diana sea mayor que el que tenía
   cuando el objetivo empezó. No el movimiento del último día: el del
   periodo entero, que es lo que el objetivo dice trabajar.

   Un jugador sin ninguna valoración dentro del periodo no cuenta ni a
   favor ni en contra — no es que no haya subido, es que no se le ha
   mirado. Por eso el denominador es «de cuántos se sabe algo», y se
   dice cuántos faltan.
   ============================================================ */

const enRango = (iso, desde, hasta) => {
  const f = String(iso || '').slice(0, 10);
  if (!f) return false;
  if (desde && f < String(desde).slice(0, 10)) return false;
  if (hasta && f > String(hasta).slice(0, 10)) return false;
  return true;
};

/**
 * El periodo de un objetivo como {desde, hasta}.
 *
 * Existe para que nadie le pase el objetivo entero a
 * `nivelesEnPeriodo`: lleva `fecha_inicio`/`fecha_fin` y la función
 * espera `desde`/`hasta`, así que pasarlo tal cual no daría error —
 * mediría sobre TODA la historia y el número saldría mal sin que nada
 * se quejara. Pasó escribiendo el banco de pruebas de esta misma fila.
 */
export const rangoDe = (objetivo) => ({
  desde: objetivo?.fecha_inicio || null,
  hasta: objetivo?.fecha_fin || null,
});

/**
 * El nivel de un jugador en una fila JUSTO ANTES de una fecha, y el
 * último dentro del periodo.
 *
 * @param valores serie de UN jugador [{clave, nivel, created_at}]
 * @returns {antes, ahora} — null cada uno si no hay dato
 */
export function nivelesEnPeriodo(valores, clave, { desde = null, hasta = null } = {}) {
  let antes = null, ahora = null, fAntes = '', fAhora = '';
  for (const v of valores || []) {
    if (v?.clave !== clave || !Number.isInteger(Number(v.nivel))) continue;
    const f = String(v.created_at || '').slice(0, 10);
    if (!f) continue;
    if (desde && f < String(desde).slice(0, 10)) {
      // lo más reciente ANTES de empezar: ese es el punto de partida
      if (f >= fAntes) { antes = Number(v.nivel); fAntes = f; }
    } else if (enRango(f, desde, hasta)) {
      if (f >= fAhora) { ahora = Number(v.nivel); fAhora = f; }
      // la primera valoración DENTRO del periodo también sirve de
      // partida si no había ninguna antes: sin ella, un jugador al que
      // solo se ha mirado durante el objetivo nunca podría «subir»
      if (antes == null && (fAntes === '' || f < fAntes)) { fAntes = f; antes = Number(v.nivel); }
    }
  }
  return { antes, ahora };
}

/**
 * La medida de un objetivo.
 *
 * @param objetivo   {dianas, fecha_inicio, fecha_fin}
 * @param opts.jugadores  [{id}] los del equipo
 * @param opts.porJugador { [player_id]: [valores] }
 * @param opts.sesiones   ids de las sesiones que llevaron este objetivo
 * @returns {sesiones, subieron, bajaron, igual, medidos, total, sinMirar}
 */
export function medirObjetivo(objetivo, { jugadores = [], porJugador = {}, sesiones = 0 } = {}) {
  const dianas = Array.isArray(objetivo?.dianas) ? objetivo.dianas : [];
  const rango = rangoDe(objetivo);

  let subieron = 0, bajaron = 0, igual = 0, medidos = 0;
  for (const j of jugadores) {
    const serie = porJugador[j.id] || [];
    let mejor = null;   // el mayor cambio del jugador en cualquier diana
    for (const d of dianas) {
      const { antes, ahora } = nivelesEnPeriodo(serie, d, rango);
      if (antes == null || ahora == null) continue;
      const delta = ahora - antes;
      if (mejor == null || delta > mejor) mejor = delta;
    }
    if (mejor == null) continue;      // de este no se sabe nada: no cuenta
    medidos += 1;
    if (mejor > 0) subieron += 1;
    else if (mejor < 0) bajaron += 1;
    else igual += 1;
  }

  return {
    sesiones: Math.max(0, Number(sesiones) || 0),
    subieron, bajaron, igual, medidos,
    total: jugadores.length,
    sinMirar: Math.max(0, jugadores.length - medidos),
    conDiana: dianas.length > 0,
  };
}

/**
 * La frase de la fila 3.9: «trabajado en 7 sesiones · 5 de 13 han
 * subido».
 *
 * Sin diana no hay medida y se dice: un objetivo que no apunta a
 * ninguna fila de la rúbrica no se puede medir, solo trabajar.
 */
export function textoMedida(m) {
  const ses = m.sesiones === 1 ? 'trabajado en 1 sesión' : `trabajado en ${m.sesiones} sesiones`;
  if (!m.conDiana) return `${ses} · sin diana, no se puede medir`;
  if (!m.medidos) return `${ses} · todavía no se ha mirado a nadie`;
  return `${ses} · ${m.subieron} de ${m.medidos} han subido`;
}

/** El detalle largo, para el título flotante y el panel del equipo. */
export function detalleMedida(m) {
  if (!m.conDiana) {
    return 'Este objetivo no apunta a ninguna fila de la rúbrica, así que no hay nada que medir. '
      + 'Elige una diana al editarlo.';
  }
  const partes = [];
  if (m.subieron) partes.push(`${m.subieron} han subido`);
  if (m.igual) partes.push(`${m.igual} siguen igual`);
  if (m.bajaron) partes.push(`${m.bajaron} han bajado`);
  if (m.sinMirar) partes.push(`${m.sinMirar} sin mirar`);
  return partes.join(' · ') || 'Todavía no hay valoraciones en el periodo del objetivo.';
}

/* ── El panel «qué vigilar hoy» (§6) ────────────────────────── */

/**
 * Una o dos líneas por objetivo de la sesión.
 *
 * No es un resumen del objetivo: es lo que hay que MIRAR hoy en la
 * pista. Sale de sus dianas y de quién está más bajo en ellas, porque
 * eso es lo accionable — «vigila la entrada, sobre todo en Ana y
 * Bruno» sirve; «objetivo: mejorar la entrada» no.
 *
 * @param objetivos los de la sesión
 * @param opts.jugadores  [{id, nombre}]
 * @param opts.porJugador { [player_id]: [valores] }
 * @param opts.nombreDe   (clave) => nombre legible de la fila
 * @param opts.cuantos    a cuántos jugadores nombrar (2 por defecto)
 */
export function queVigilarHoy(objetivos, { jugadores = [], porJugador = {}, nombreDe = (c) => c, cuantos = 2 } = {}) {
  return (objetivos || []).map((o) => {
    const dianas = Array.isArray(o?.dianas) ? o.dianas : [];
    const lineas = [];

    for (const d of dianas) {
      // los más bajos en esta diana, y los que no se han mirado nunca
      const conNivel = [];
      const sinMirar = [];
      for (const j of jugadores) {
        const { ahora } = nivelesEnPeriodo(porJugador[j.id] || [], d, {});
        if (ahora == null) sinMirar.push(j);
        else conNivel.push({ j, nivel: ahora });
      }
      conNivel.sort((a, b) => a.nivel - b.nivel);
      const nombres = conNivel.slice(0, cuantos).map((x) => x.j.nombre);

      if (nombres.length) {
        lineas.push(`${nombreDe(d)}: mira sobre todo a ${nombres.join(' y ')}.`);
      } else if (sinMirar.length) {
        lineas.push(`${nombreDe(d)}: todavía no has mirado a nadie en esto.`);
      }
    }

    if (!lineas.length) {
      lineas.push('Sin diana: al editarlo puedes apuntarlo a una fila de la rúbrica y así se mide solo.');
    }
    return { objetivo: o, lineas: lineas.slice(0, 2) };
  });
}
