/* ============================================================
   pizarra/iman.js — a qué se pega lo que sueltas (§3.4).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-iman.mjs.

   ── QUÉ RESUELVE ────────────────────────────────────────────
   Dos ejercicios que dicen «desde el codo» tienen que empezar en EL
   MISMO codo. Colocando a ojo no pasa: quedan a treinta centímetros
   uno de otro y, al proyectarlos seguidos, el mismo sitio se mueve.

   El imán no es una comodidad — es lo que hace que la biblioteca sea
   coherente consigo misma.

   ── SE ACTIVA CON SHIFT, NO AL REVÉS ────────────────────────
   Decisión tomada: por defecto se coloca donde uno quiere, y con Shift
   se pega. Es lo que ya dice la especificación de la v2.1, y tiene
   sentido en una pizarra donde media colocación es deliberadamente
   irregular (los conos de un slalom, una fila torcida a propósito).
   Este módulo solo calcula; quién pulsa Shift es cosa del Lienzo.

   ── TODO SE MIDE EN METROS ──────────────────────────────────
   El radio de agarre son 0,60 m de pista, no un número de píxeles ni
   de unidades normalizadas. En píxeles, el imán agarraría más lejos al
   alejar el zoom; en normalizado sería peor todavía, porque el marco
   no es cuadrado —la pista entera es 18 × 27 m— y el mismo 0,01
   valdría 18 cm a lo ancho y 27 a lo largo. Medido en metros, el imán
   se comporta igual a cualquier zoom y en las cuatro pistas.
   ============================================================ */

import { posicionesDe } from '../canvas/anclas.js';
import { metrosEntre } from '../canvas/escala.js';
import { contornoDe } from '../canvas/zonas.js';

/** Radio de agarre, en METROS de pista (§3.4). */
export const RADIO_IMAN = 0.60;

/*
   Cómo se llama cada ancla de cara al entrenador. El cursor enseña a
   qué se está pegando (§3.4), y «codo_der» no es algo que nadie diga
   en una pista. Los nombres van sin artículo porque se leen dentro de
   una etiqueta pequeña, no en una frase.
*/
const NOMBRES = {
  aro: 'aro',
  tiro_libre: 'tiro libre',
  base: 'base',
  centro: 'centro',
  poste_bajo: 'poste bajo',
  poste_alto: 'poste alto',
  codo: 'codo',
  esquina: 'esquina',
  alero: 'alero',
  escolta: 'escolta',
};
const LADOS = { der: 'derecho', izq: 'izquierdo' };

/** «codo_der» → «codo derecho». Lo que no reconoce, lo devuelve tal cual. */
export function nombreDeAncla(slug) {
  const m = /^(.*)_(der|izq)$/.exec(String(slug || ''));
  if (!m) return NOMBRES[slug] || String(slug || '');
  const base = NOMBRES[m[1]] || m[1];
  return `${base} ${LADOS[m[2]]}`;
}

/**
 * Todo a lo que se puede pegar algo en esta pista.
 *
 * El orden importa cuando dos candidatos empatan: primero lo que el
 * entrenador ha puesto —sus posiciones con nombre, sus conos, sus
 * fichas—, y después las anclas de la cancha. Pegarse a un cono que
 * acabas de colocar es más probable que quererlo pegar a un ancla que
 * casualmente cae en el mismo sitio.
 *
 * @param excluir  ids que no cuentan (lo que se está arrastrando: una
 *                 ficha no puede imantarse a sí misma)
 */
export function puntosDeIman({
  pista = 'entera', canasta = 'norte', elementos = [], posiciones = {}, excluir = [],
} = {}) {
  const fuera = new Set(excluir);
  const puntos = [];

  // 1) las posiciones que ha marcado el entrenador
  for (const [slug, xy] of Object.entries(posiciones || {})) {
    if (!Array.isArray(xy) || xy.length < 2) continue;
    puntos.push({ x: xy[0], y: xy[1], nombre: slug.replace(/_/g, ' '), tipo: 'propia' });
  }

  // 2) lo que hay puesto en la pista
  for (const e of elementos) {
    if (!e || fuera.has(e.id)) continue;
    if (e.kind === 'zona') {
      /* De una zona interesan sus VÉRTICES y los puntos medios de sus
         lados: son las esquinas de un pasillo y el centro de una
         puerta, que es donde de verdad se coloca algo. */
      const { puntos: vs, cerrado } = contornoDe(pista, e);
      const nombre = e.nombre || 'zona';
      const lista = cerrado ? [...vs, vs[0]] : vs;
      for (const v of vs) puntos.push({ x: v.x, y: v.y, nombre: `${nombre} · esquina`, tipo: 'zona' });
      for (let i = 1; i < lista.length; i++) {
        puntos.push({
          x: (lista[i - 1].x + lista[i].x) / 2,
          y: (lista[i - 1].y + lista[i].y) / 2,
          nombre: `${nombre} · medio`,
          tipo: 'zona',
        });
      }
      continue;
    }
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
    puntos.push({ x: e.x, y: e.y, nombre: e.nombre || e.kind, tipo: 'elemento', id: e.id });
  }

  // 3) las anclas de la cancha
  const anclas = posicionesDe(pista, canasta) || {};
  for (const [slug, xy] of Object.entries(anclas)) {
    puntos.push({ x: xy[0], y: xy[1], nombre: nombreDeAncla(slug), tipo: 'ancla', slug });
  }

  return puntos;
}

/**
 * A qué se pega un punto, si es que se pega a algo.
 *
 * Devuelve el más cercano dentro del radio, con su nombre para poder
 * decirlo en el cursor, o null. Nunca devuelve algo a lo que no se
 * llega: preferir «no se pegó» a «se pegó a algo que no querías» es
 * deliberado, porque lo segundo se descubre tarde.
 */
export function imantar(punto, puntos, pista = 'entera', radio = RADIO_IMAN) {
  if (!punto || !Number.isFinite(punto.x) || !Number.isFinite(punto.y)) return null;
  let mejor = null;
  let mejorM = Infinity;
  for (const p of puntos || []) {
    const m = metrosEntre(pista, punto, p);
    if (!(m <= radio)) continue;
    /* Estrictamente menor: con un empate exacto gana el PRIMERO, y el
       orden de `puntosDeIman` pone delante lo que ha puesto el
       entrenador. */
    if (m < mejorM) { mejorM = m; mejor = p; }
  }
  return mejor ? { ...mejor, metros: mejorM } : null;
}

/** El atajo de siempre: calcular los puntos y pegar en un paso. */
export function pegar(punto, opciones = {}) {
  const puntos = puntosDeIman(opciones);
  return imantar(punto, puntos, opciones.pista, opciones.radio ?? RADIO_IMAN);
}
