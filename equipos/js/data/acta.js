/* ============================================================
   acta.js — EL ACTA DE UN PARTIDO, EN PERIODOS (Tramo 4.1).
   Módulo PURO: sin DOM, sin Supabase. Lo importan la pantalla de
   partido, el puente al chat (4.2), el reglamento (4.3), las
   estadísticas por jugador (4.4) y el banco Node.

   ── LA CORRECCIÓN DE DOMINIO ────────────────────────────────
   En minibasket y alevín no se juegan minutos: se juegan PERIODOS
   (§5.9). El reglamento está escrito en periodos —«dos completos
   jugados y dos descansados de los cinco primeros»— y el acta también.
   Traducir a minutos obligaría a inventarse una equivalencia que no
   existe: un periodo es una unidad, no un rato.

   ── LO QUE SE PUEDE COMPROBAR SIN SABER BALONCESTO ──────────
   Un acta tiene aritmética interna, y cuadrarla es lo primero que hay
   que hacer con una copiada a mano:

     · los puntos de los jugadores suman el marcador;
     · el marcador por periodo suma el marcador final;
     · nadie juega y descansa más periodos de los que hay;
     · nadie tiene más faltas de las que se permiten.

   Ninguna de estas comprobaciones opina sobre el partido: dicen que
   los números no cuadran, que es lo único que se puede afirmar. Lo que
   sí es una regla de juego —los dos periodos de los cinco primeros—
   va en el reglamento (4.3), aparte, porque depende de la categoría.

   ── LA REJILLA MANDA SOBRE EL CONTADOR ──────────────────────
   Cada fila guarda QUÉ periodos jugó —[1, 2, 4]— y no solo cuántos.
   El acta oficial es exactamente eso, una rejilla jugador × periodo, y
   la regla de la categoría habla de «los cinco primeros»: con un
   contador suelto no se puede comprobar, porque no se sabe cuáles
   fueron. Los contadores se conservan porque a veces son lo único que
   hay —un acta dictada al chat (4.2) da el total y no la rejilla— y
   porque acumular la temporada (4.4) es sumarlos. Cuando hay rejilla,
   los contadores se DERIVAN de ella: nunca dos versiones de lo mismo
   que puedan discrepar.
   ============================================================ */

/** Lo normal en minibasket. Se puede cambiar por partido. */
export const PERIODOS_DEFECTO = 6;
export const FALTAS_MAX = 5;

const n = (x, min = 0, max = Infinity) => {
  const v = Math.round(Number(x));
  return Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : 0;
};

/** Una fila de acta en blanco para un jugador. */
export const filaVacia = (jugador) => ({
  player_id: jugador.id,
  nombre: jugador.nombre,
  dorsal: jugador.dorsal ?? null,
  periodos: [],
  periodos_jugados: 0,
  periodos_descansados: 0,
  puntos: 0,
  faltas: 0,
});

/**
 * Cuántos periodos tiene este partido.
 *
 * Del partido si lo dice; si no, seis, que es lo que se juega en
 * minibasket. No se deduce de la categoría del equipo a propósito: un
 * amistoso contra un cadete se juega como se acuerde, y el acta dice
 * lo que pasó, no lo que debería haber pasado.
 */
export const periodosDe = (partido) => {
  // Ojo con el 0 y el null: `Number(null)` es 0, y 0 recortado al
  // mínimo da 1, así que un partido con `periodos: null` —que es como
  // sale de la base de datos mientras nadie lo toque— se pintaba con UN
  // periodo en vez de con los seis de siempre. Menos de uno es «no lo
  // dice», no «uno».
  const bruto = Number(partido?.periodos);
  if (!Number.isFinite(bruto) || bruto < 1) return PERIODOS_DEFECTO;
  return n(bruto, 1, 12);
};

/* ── La rejilla ────────────────────────────────────────────── */

/** La rejilla de una fila: los periodos que jugó, ordenados y sin repetidos. */
export function rejillaDe(f) {
  const P = new Set();
  for (const x of f?.periodos || []) {
    const k = Math.round(Number(x));
    if (Number.isFinite(k) && k >= 1 && k <= 12) P.add(k);
  }
  return [...P].sort((a, b) => a - b);
}

/** ¿Jugó el periodo k? */
export const jugoEn = (f, k) => rejillaDe(f).includes(k);

/**
 * Pone al día los contadores a partir de la rejilla.
 *
 * Solo cuando hay rejilla: si viene vacía —un acta dictada al chat da
 * el total y no los periodos— los contadores que traiga la fila son lo
 * único que hay y se respetan. Poner `periodos_jugados: 0` porque la
 * rejilla esté vacía borraría el dato bueno.
 *
 * `aunqueVacia` es para cuando la rejilla se está TOCANDO: ahí una
 * rejilla vacía no es «no la tengo», es «no jugó», y los contadores
 * tienen que irse a cero. Sin esto, desmarcar el último periodo dejaba
 * el contador viejo puesto y el jugador no salía nunca del acta.
 */
export function recuenta(f, partido, { aunqueVacia = false } = {}) {
  const lista = rejillaDe(f);
  if (!lista.length && !aunqueVacia) return { ...f, periodos: [] };
  const P = periodosDe(partido);
  const dentro = lista.filter((k) => k <= P);
  return {
    ...f,
    periodos: dentro,
    periodos_jugados: dentro.length,
    periodos_descansados: P - dentro.length,
  };
}

/** Marca o desmarca un periodo. Devuelve una fila NUEVA, ya recontada. */
export function alterna(f, k, partido) {
  const lista = rejillaDe(f);
  const hay = lista.includes(k);
  return recuenta(
    { ...f, periodos: hay ? lista.filter((x) => x !== k) : [...lista, k] },
    partido,
    { aunqueVacia: true },   // se está tocando: manda lo que hay marcado
  );
}

/**
 * Cuántos jugadores hay marcados en el periodo k.
 *
 * En baloncesto hay CINCO en pista, así que la columna que no sume
 * cinco está mal copiada. No es un descuadre —mientras se rellena la
 * rejilla ninguna columna suma cinco todavía, y un aviso que salta en
 * cada clic no lo lee nadie—: se enseña el recuento y ya.
 */
export const enPista = (filas, k) => (filas || []).filter((f) => jugoEn(f, k)).length;

/**
 * Cuántos de los `hasta` primeros periodos jugó y cuántos descansó.
 * Lo usa el reglamento (4.3), que habla de los cinco primeros. Devuelve
 * null si esta fila no tiene rejilla: sin ella la pregunta no se puede
 * contestar, y contestarla igual sería inventarse el acta.
 */
export function enLosPrimeros(f, hasta, partido) {
  const lista = rejillaDe(f);
  if (!lista.length) return null;
  const tope = Math.min(hasta, periodosDe(partido));
  const jugados = lista.filter((k) => k <= tope).length;
  return { jugados, descansados: tope - jugados, de: tope };
}

/* ── Totales ───────────────────────────────────────────────── */

/**
 * Lo que suman las filas del acta.
 * @returns {puntos, faltas, jugadores, conPeriodos}
 */
export function totales(filas) {
  const t = { puntos: 0, faltas: 0, jugadores: 0, conPeriodos: 0 };
  for (const f of filas || []) {
    t.jugadores += 1;
    t.puntos += n(f.puntos);
    t.faltas += n(f.faltas);
    if (n(f.periodos_jugados) > 0) t.conPeriodos += 1;
  }
  return t;
}

/** Lo que suma el marcador por periodo: {favor, contra}. */
export function sumaPeriodos(cuartos) {
  let favor = 0, contra = 0;
  for (const c of cuartos || []) { favor += n(c?.favor); contra += n(c?.contra); }
  return { favor, contra };
}

/* ── Que los números cuadren ───────────────────────────────── */

/**
 * Los descuadres del acta. Cada uno dice QUÉ no cuadra y con qué, para
 * que se pueda ir al campo y arreglarlo.
 *
 * Nunca se corrige nada solo: un acta copiada a mano con un número mal
 * se arregla mirando el papel, no adivinando cuál de los dos números
 * era el bueno.
 *
 * @returns [{campo, texto}] — vacío si todo cuadra
 */
export function descuadres(partido, filas) {
  const out = [];
  const P = periodosDe(partido);
  const t = totales(filas);
  const favor = partido?.marcador_favor;
  const cuartos = Array.isArray(partido?.marcador_cuartos) ? partido.marcador_cuartos : [];

  if (favor != null && t.puntos && t.puntos !== n(favor)) {
    out.push({
      campo: 'puntos',
      texto: `Los puntos de los jugadores suman ${t.puntos} y el marcador dice ${favor}.`,
    });
  }

  if (cuartos.length) {
    const s = sumaPeriodos(cuartos);
    if (favor != null && s.favor !== n(favor)) {
      out.push({ campo: 'marcador_cuartos', texto: `El marcador por periodos suma ${s.favor} y el final dice ${favor}.` });
    }
    if (partido?.marcador_contra != null && s.contra !== n(partido.marcador_contra)) {
      out.push({ campo: 'marcador_cuartos', texto: `Los periodos del rival suman ${s.contra} y el final dice ${partido.marcador_contra}.` });
    }
    if (cuartos.length !== P) {
      out.push({ campo: 'periodos', texto: `Hay ${cuartos.length} periodos apuntados y el partido tiene ${P}.` });
    }
  }

  for (const f of filas || []) {
    const jug = n(f.periodos_jugados), des = n(f.periodos_descansados);
    if (jug + des > P) {
      out.push({
        campo: `jugador:${f.player_id}`,
        texto: `${f.nombre}: ${jug} jugados y ${des} descansados son ${jug + des}, y el partido tiene ${P} periodos.`,
      });
    }
    if (n(f.faltas) > FALTAS_MAX) {
      out.push({ campo: `jugador:${f.player_id}`, texto: `${f.nombre} tiene ${f.faltas} faltas; el máximo es ${FALTAS_MAX}.` });
    }
  }
  return out;
}

/* ── Lo que falta ──────────────────────────────────────────── */

/**
 * Qué le falta al acta para estar completa. No es un error: un partido
 * se puede guardar a medias y terminarse el lunes.
 */
export function loQueFalta(partido, filas) {
  const falta = [];
  if (partido?.marcador_favor == null || partido?.marcador_contra == null) falta.push('el marcador');
  /* Una rejilla de ceros no es un marcador por periodos: es una rejilla
     sin rellenar. La pantalla la estira a tantas entradas como periodos
     para poder pintar los campos, y si aquí contara como escrita, el
     «falta por apuntar» desaparecería sin que nadie apuntara nada. */
  const s = sumaPeriodos(partido?.marcador_cuartos);
  if (!(partido?.marcador_cuartos || []).length || (!s.favor && !s.contra)) {
    falta.push('el marcador por periodos');
  }
  if (!(filas || []).some((f) => n(f.periodos_jugados) > 0)) falta.push('quién jugó y cuánto');
  if (!partido?.acta_path) falta.push('la foto del acta');
  return falta;
}

/** «5 de 12 · 34 puntos» — el resumen de una fila de la lista. */
export function textoFila(f, partido) {
  const P = periodosDe(partido);
  const partes = [
    `${n(f.periodos_jugados)} de ${P} periodos`,
    n(f.puntos) ? `${f.puntos} pt` : null,
    n(f.faltas) ? `${f.faltas} faltas` : null,
  ];
  return partes.filter(Boolean).join(' · ');
}

/* ── Normalizar lo que entra ───────────────────────────────── */

/**
 * Deja una fila lista para guardar. Recorta a los límites del CHECK en
 * vez de dejar que la base de datos rechace la fila entera: el
 * entrenador está copiando de un papel y un dedo de más no puede
 * costarle todo lo demás.
 */
export function saneaFila(f, partido) {
  const P = periodosDe(partido);
  const r = recuenta(f, partido);
  return {
    player_id: f.player_id,
    dorsal: f.dorsal ?? null,
    periodos: r.periodos,
    periodos_jugados: n(r.periodos_jugados, 0, P),
    periodos_descansados: n(r.periodos_descansados, 0, P),
    puntos: n(f.puntos, 0, 200),
    faltas: n(f.faltas, 0, FALTAS_MAX),
  };
}

/** El marcador por periodos, con tantas entradas como periodos haya. */
export function saneaCuartos(cuartos, partido) {
  const P = periodosDe(partido);
  const out = [];
  for (let i = 0; i < P; i++) {
    const c = (cuartos || [])[i] || {};
    out.push({ favor: n(c.favor, 0, 200), contra: n(c.contra, 0, 200) });
  }
  return out;
}
