/* ============================================================
   rubrica.js — LA RÚBRICA DE UN JUGADOR (Tramo 3.7).
   Módulo PURO: sin DOM, sin red. Vive en el Taller porque el
   vocabulario del que salen sus filas también vive aquí, y porque lo
   usan las dos aplicaciones.

   ── DE DÓNDE SALEN LAS FILAS ────────────────────────────────
   De dos sitios, y la salvedad está declarada en §3:

   · ACCIONES — del vocabulario común (`TAGS`). La misma palabra que
     es pieza del catálogo del paso 2, etiqueta de un ejercicio y
     diana de un objetivo es también una fila de la rúbrica. Eso es lo
     que deja a la app decir «se le cae con defensor; estos cuatro
     ejercicios son el escalón siguiente».
   · CONDUCTAS — cuatro familias (decisión #25) que NO se enlazan con
     ningún ejercicio, porque no las entrena un ejercicio.

   ── LOS CUATRO NIVELES ──────────────────────────────────────
   no lo hace · lo hace con ayuda · lo hace solo · lo hace con
   oposición. Es la misma escala de exigencia con la que están
   clasificados los 204 ejercicios, y por eso «subir de nivel» y
   «subir de ejercicio» significan lo mismo.

   ── POR QUÉ NO SE SOBRESCRIBE ───────────────────────────────
   Cada valoración es una FILA con su fecha: `rubrica_valores` es una
   serie histórica. El nivel de hoy es el último, y el de hace tres
   meses sigue estando. Sin eso no hay progresión que enseñar —solo un
   número que cambia sin dejar rastro— y el cumplimiento de un
   objetivo, que se mide por MOVIMIENTO (decisión #26), no se podría
   calcular.

   ── LA CLAVE ES TEXTO, NO UN uuid ───────────────────────────
   `accion:bote`, `conducta:actitud`. Mismo criterio que el catálogo de
   acciones y que los vídeos: las filas base viven en CÓDIGO y tienen
   que existir sin una llamada de red; las que añada el club viven en
   `rubrica_filas` y se fusionan encima.
   ============================================================ */

import { TAGS } from './ia/vocabulario.js';

/* ── 1. Los cuatro niveles ─────────────────────────────────── */

export const NIVELES = [
  { valor: 0, corto: '—', nombre: 'No lo hace', nota: 'todavía no le sale' },
  { valor: 1, corto: 'A', nombre: 'Con ayuda', nota: 'le sale si se le recuerda o se le guía' },
  { valor: 2, corto: 'S', nombre: 'Solo', nota: 'le sale sin ayuda, sin nadie enfrente' },
  { valor: 3, corto: 'O', nombre: 'Con oposición', nota: 'le sale con un rival de verdad' },
];
export const NIVEL_MAX = 3;
export const esNivel = (n) => Number.isInteger(n) && n >= 0 && n <= NIVEL_MAX;

/* ── 2. Las cuatro conductas ───────────────────────────────── */

/** Decisión #25. No se enlazan con ejercicios: no las entrena uno. */
export const CONDUCTAS = [
  { clave: 'actitud', nombre: 'Actitud y esfuerzo' },
  { clave: 'escucha', nombre: 'Escucha y atención' },
  { clave: 'autonomia', nombre: 'Autonomía y decisión' },
  { clave: 'companerismo', nombre: 'Compañerismo y competir' },
];

/* ── 3. Las filas ──────────────────────────────────────────── */

export const claveAccion = (tag) => `accion:${tag}`;
export const claveConducta = (c) => `conducta:${c}`;
export const esConducta = (clave) => String(clave || '').startsWith('conducta:');

/**
 * Todas las filas de la rúbrica: las conductas primero —se miran en
 * todos los jugadores y en todas las sesiones— y después las acciones
 * del vocabulario.
 *
 * @param club filas añadidas por el club (`rubrica_filas`)
 */
export function filasDeRubrica(club = []) {
  const base = [
    ...CONDUCTAS.map((c, i) => ({
      clave: claveConducta(c.clave), tipo: 'conducta',
      nombre: c.nombre, categoria: 'conducta', orden: i, origen: 'sistema',
    })),
    ...TAGS.map((t, i) => ({
      clave: claveAccion(t), tipo: 'accion',
      nombre: t, categoria: 'acción', orden: 100 + i, origen: 'sistema',
    })),
  ];
  const vistas = new Set(base.map((f) => f.clave));
  for (const f of club || []) {
    const clave = String(f?.clave || '').trim();
    if (!clave || vistas.has(clave)) continue;   // no se redefine lo del sistema
    vistas.add(clave);
    base.push({
      clave, tipo: esConducta(clave) ? 'conducta' : 'accion',
      nombre: f.nombre || clave, categoria: f.categoria || 'club',
      orden: Number.isFinite(f.orden) ? f.orden : 1000, origen: 'club',
    });
  }
  return base.sort((a, b) => a.orden - b.orden);
}

/* ── 4. Leer la serie ──────────────────────────────────────── */

const alRevés = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));

/**
 * El estado de un jugador: por cada fila mirada alguna vez, su nivel
 * de HOY, el anterior y cuándo se miró por última vez.
 *
 * @param valores [{clave, nivel, created_at}] de UN jugador
 * @returns { [clave]: {nivel, anterior, fecha, veces} }
 */
export function estadoDe(valores) {
  const out = {};
  for (const v of [...(valores || [])].sort(alRevés)) {
    if (!v?.clave || !esNivel(Number(v.nivel))) continue;
    const f = out[v.clave] ||= { nivel: null, anterior: null, fecha: null, veces: 0 };
    if (f.nivel == null) { f.nivel = Number(v.nivel); f.fecha = v.created_at || null; }
    else if (f.anterior == null) f.anterior = Number(v.nivel);
    f.veces += 1;
  }
  return out;
}

/**
 * Cuánto se ha movido un jugador en una fila: +1 subió un escalón,
 * −1 bajó, 0 sigue igual, null si solo se ha mirado una vez.
 *
 * Es la medida del cumplimiento de un objetivo (decisión #26): no lo
 * que el entrenador cree que ha trabajado, sino lo que los jugadores
 * han subido.
 */
export function movimiento(estado, clave) {
  const f = estado?.[clave];
  if (!f || f.anterior == null) return null;
  return f.nivel - f.anterior;
}

/* ── 5. A quién toca mirar ─────────────────────────────────── */

const DIA = 86400000;

/**
 * Días desde la última vez que se miró a un jugador, en cualquier
 * fila. `null` = nunca.
 */
export function diasSinMirar(valores, ahora = Date.now()) {
  let ultima = null;
  for (const v of valores || []) {
    const t = Date.parse(v?.created_at || '');
    if (Number.isFinite(t) && (ultima == null || t > ultima)) ultima = t;
  }
  if (ultima == null) return null;
  return Math.max(0, Math.floor((Number(ahora) - ultima) / DIA));
}

/**
 * El orden en que conviene mirar a los jugadores: primero los que
 * llevan más tiempo sin mirarse, y antes que nadie los que no se han
 * mirado nunca.
 *
 * §5.7: la rúbrica la dispara el entrenador y elige a quien quiera,
 * sin tope. Esto no elige por él: solo marca discretamente el orden,
 * que es lo que evita que se evalúe siempre a los mismos cinco.
 *
 * @param jugadores [{id, nombre}]
 * @param porJugador { [player_id]: [valores] }
 */
export function ordenSugerido(jugadores, porJugador = {}, ahora = Date.now()) {
  return [...(jugadores || [])]
    .map((j) => ({ jugador: j, dias: diasSinMirar(porJugador[j.id], ahora) }))
    .sort((a, b) => {
      if (a.dias == null && b.dias == null) return String(a.jugador.nombre || '').localeCompare(String(b.jugador.nombre || ''), 'es');
      if (a.dias == null) return -1;      // nunca mirado: el primero
      if (b.dias == null) return 1;
      return b.dias - a.dias;
    });
}

/** «hace 12 días» / «nunca» — para el aviso discreto de §5.7. */
export function textoSinMirar(dias) {
  if (dias == null) return 'sin mirar nunca';
  if (dias === 0) return 'mirado hoy';
  if (dias === 1) return 'mirado ayer';
  return `hace ${dias} días`;
}

/* ── 5b. El resumen de un jugador ──────────────────────────── */

/**
 * Los cuatro números de la cabecera de Progresión (§5.7).
 *
 * `subidas` y `bajadas` cuentan MOVIMIENTOS, no niveles: es la unidad
 * en la que se mide el cumplimiento desde la decisión #26, y es
 * también lo único que distingue «va bien» de «empezó bien».
 *
 * Las medias van por familia porque mezclar «actitud» con «tiro» en un
 * solo número daría una nota, y una nota no dice qué hacer el martes.
 */
export function resumenDe(estado) {
  const filas = Object.entries(estado || {});
  let subidas = 0, bajadas = 0;
  const suma = { conducta: 0, accion: 0 };
  const cuenta = { conducta: 0, accion: 0 };

  for (const [clave, f] of filas) {
    if (f.anterior != null) {
      if (f.nivel > f.anterior) subidas += 1;
      else if (f.nivel < f.anterior) bajadas += 1;
    }
    const fam = esConducta(clave) ? 'conducta' : 'accion';
    suma[fam] += f.nivel;
    cuenta[fam] += 1;
  }

  const media = (fam) => (cuenta[fam] ? Math.round((suma[fam] / cuenta[fam]) * 10) / 10 : null);
  return {
    miradas: filas.length,
    subidas,
    bajadas,
    mediaConducta: media('conducta'),
    mediaAccion: media('accion'),
  };
}

/**
 * La serie de UNA fila, de lo más viejo a lo más nuevo, para pintar su
 * línea. Se devuelven los puntos tal cual —fecha y nivel— y no una
 * geometría: quien la pinte sabrá de cuántos píxeles dispone.
 */
export function serieDe(valores, clave) {
  return (valores || [])
    .filter((v) => v?.clave === clave && esNivel(Number(v.nivel)))
    .map((v) => ({ fecha: String(v.created_at || '').slice(0, 10), nivel: Number(v.nivel) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/* ── 5c. Objetivos propuestos desde su propia rúbrica (3.10) ─ */

/**
 * Qué le vendría bien trabajar a este jugador.
 *
 * §5.7: «objetivos individuales: uno o dos vivos por niño, propuestos
 * desde su propia rúbrica». La propuesta sale de lo que YA se ha
 * medido en él, no de una lista general: la fila donde está más bajo
 * es, por definición, donde más tiene que ganar.
 *
 * Lo que NO se propone: filas sin mirar —de esas no se sabe si están
 * bajas o altas— ni filas ya en el tope, que no tienen escalón
 * siguiente.
 *
 * @returns [{fila, nivel, siguiente}] — `siguiente` es el nivel al que
 *   se aspira, que es el escalón inmediato y no el máximo: un objetivo
 *   de «no lo hace» a «con oposición» no es un objetivo, es un deseo.
 */
export function proponerObjetivos(estado, filas, { cuantos = 3 } = {}) {
  return (filas || [])
    .map((f) => ({ fila: f, ...(estado?.[f.clave] || {}) }))
    .filter((x) => esNivel(x.nivel) && x.nivel < NIVEL_MAX)
    .sort((a, b) => {
      if (a.nivel !== b.nivel) return a.nivel - b.nivel;              // lo más bajo
      return String(a.fecha || '').localeCompare(String(b.fecha || ''));   // lo más viejo
    })
    .slice(0, cuantos)
    .map((x) => ({ fila: x.fila, nivel: x.nivel, siguiente: x.nivel + 1 }));
}

/** «Pasar de "con ayuda" a "solo" en el cambio de mano». */
export function tituloPropuesta({ fila, nivel, siguiente }) {
  return `Pasar de «${NIVELES[nivel].nombre.toLowerCase()}» a «${NIVELES[siguiente].nombre.toLowerCase()}» en ${fila.nombre}`;
}

/* ── 6. El escalón siguiente ───────────────────────────────── */

/**
 * Las filas por las que empezar con un jugador.
 *
 * No es un diagnóstico: es un orden para no perder tiempo delante de
 * una lista de setenta filas con doce críos esperando. Va en tres
 * capas, y la de en medio es la que hace que la lista NO sea siempre
 * la misma:
 *
 *   1. Las cuatro CONDUCTAS. Se miran en todos y en todas las
 *      sesiones: no dependen de lo que se haya entrenado.
 *   2. Lo que se ha ENTRENADO HOY (`preferidas`). Es el eslabón del
 *      vocabulario único: la misma palabra que etiqueta los ejercicios
 *      del plan es una fila de la rúbrica, así que al cerrar se
 *      pregunta por lo que se acaba de ver. Sin esta capa, con setenta
 *      filas sin mirar salían siempre las mismas seis.
 *   3. El resto, para completar.
 *
 * Dentro de cada capa: lo más bajo primero y, a igualdad, lo que lleva
 * más tiempo sin mirarse.
 */
export function porDondeEmpezar(estado, filas, { cuantas = 6, preferidas = null } = {}) {
  const pref = preferidas instanceof Set ? preferidas : new Set(preferidas || []);
  const orden = (a, b) => {
    const na = a.nivel == null ? -1 : a.nivel;
    const nb = b.nivel == null ? -1 : b.nivel;
    if (na !== nb) return na - nb;                                        // lo más bajo primero
    return String(a.fecha || '').localeCompare(String(b.fecha || ''));    // lo más viejo primero
  };
  const conDato = (filas || []).map((f) => ({ fila: f, ...(estado?.[f.clave] || { nivel: null, fecha: null }) }));

  const capas = [
    conDato.filter((x) => x.fila.tipo === 'conducta'),
    conDato.filter((x) => x.fila.tipo !== 'conducta' && pref.has(x.fila.clave)),
    conDato.filter((x) => x.fila.tipo !== 'conducta' && !pref.has(x.fila.clave)),
  ];

  const out = [];
  for (const capa of capas) {
    for (const x of capa.sort(orden)) {
      if (out.length >= cuantas) return out;
      out.push(x.fila);
    }
  }
  return out;
}
