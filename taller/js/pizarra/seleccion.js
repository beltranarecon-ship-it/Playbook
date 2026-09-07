/* ============================================================
   pizarra/seleccion.js — qué hay debajo del dedo, y qué cae dentro
   del marco (§3.2).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-elementos.mjs.

   ── EL ACIERTO SE MIDE EN METROS ────────────────────────────
   Un jugador mide 1,30 m y hay que poder cogerlo por su ficha. Pero
   con el dedo hace falta además un suelo de 44 px de PANTALLA (§2.6),
   y eso sí depende del zoom: al 50 % una ficha se dibuja de 8 px y
   sería imposible de coger.

   Así que el acierto tiene dos partes y aquí llegan las dos ya en
   metros: el radio real del elemento, y un mínimo que el Lienzo
   traduce de píxeles a metros con el zoom de ahora (`lienzo.metros`).
   Este módulo no sabe de píxeles ni de zoom, y por eso se puede probar.

   ── Y GANA EL MÁS CERCANO, NO EL DE ARRIBA ──────────────────
   Al 50 %, dos jugadores a 1,20 m tienen discos de acierto que se
   solapan. Si ganara el último dibujado, coger «el de la izquierda»
   dependería del orden en que se colocaron, que nadie recuerda. Gana
   el más cercano al contacto y, solo en empate, el de arriba.
   ============================================================ */

import { metrosEntre } from '../canvas/escala.js';
import { radioMetros } from './elementos.js';
import { cajaDe } from '../canvas/zonas.js';

/**
 * Qué hay debajo de un punto.
 *
 * @param punto    { x, y } normalizado SIN recortar
 * @param minimoM  radio mínimo de agarre, en metros (el suelo del dedo)
 * @param excluir  ids que no cuentan
 * @returns el elemento, o null
 */
export function acierto(elementos, punto, { pista = 'entera', minimoM = 0, excluir = [] } = {}) {
  if (!punto || !Number.isFinite(punto.x) || !Number.isFinite(punto.y)) return null;
  const fuera = new Set(excluir);
  let mejor = null;
  let mejorD = Infinity;
  let mejorOrden = -1;

  elementos.forEach((e, i) => {
    if (!e || fuera.has(e.id) || e.kind === 'zona') return;
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) return;
    const alcance = Math.max(radioMetros(e.kind), minimoM);
    const d = metrosEntre(pista, punto, e);
    if (d > alcance) return;
    /* Más cercano gana; en empate exacto, el que se dibuja después
       (que es el que se ve encima). */
    if (d < mejorD || (d === mejorD && i > mejorOrden)) { mejorD = d; mejor = e; mejorOrden = i; }
  });
  return mejor;
}

/**
 * Las zonas se comprueban APARTE y las últimas, igual que hacía el
 * tablero viejo y por el mismo motivo: son el escenario, no los
 * actores. Una zona grande por debajo de tres jugadores se comería
 * todos los clics si entrara en el mismo reparto.
 */
export function aciertoZona(elementos, punto, pista = 'entera') {
  if (!punto || !Number.isFinite(punto.x)) return null;
  for (let i = elementos.length - 1; i >= 0; i--) {
    const z = elementos[i];
    if (!z || z.kind !== 'zona') continue;
    const c = cajaDe(pista, z);
    if (punto.x >= c.x0 && punto.x <= c.x1 && punto.y >= c.y0 && punto.y <= c.y1) return z;
  }
  return null;
}

/** Normaliza un marco arrastrado en cualquier dirección. */
export function marcoDesde(a, b) {
  return {
    x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x),
    y0: Math.min(a.y, b.y), y1: Math.max(a.y, b.y),
  };
}

/**
 * Lo que cae dentro del marco de selección. Se mira el CENTRO de cada
 * ficha y no si el marco la toca: rozar el borde de un jugador al
 * pasar por encima no es quererlo seleccionar, y de la otra manera un
 * marco grande se lleva media pista sin querer.
 */
export function enMarco(elementos, marco, { excluirZonas = true } = {}) {
  if (!marco) return [];
  return elementos
    .filter((e) => e && Number.isFinite(e.x) && Number.isFinite(e.y)
      && !(excluirZonas && e.kind === 'zona')
      && e.x >= marco.x0 && e.x <= marco.x1 && e.y >= marco.y0 && e.y <= marco.y1)
    .map((e) => e.id);
}

/* ── El conjunto seleccionado ──────────────────────────────── */

/**
 * Cómo cambia la selección al pinchar algo. Es una función y no tres
 * ramas repartidas por el código porque la regla —Shift suma o resta,
 * sin Shift sustituye— tiene que ser la misma en la pista, en el marco
 * y en la lista del panel.
 */
export function alPinchar(seleccion, id, { shift = false } = {}) {
  const s = new Set(seleccion);
  if (!id) return shift ? s : new Set();
  if (!shift) return new Set([id]);
  if (s.has(id)) s.delete(id); else s.add(id);
  return s;
}

/** Lo mismo para un marco: sin Shift sustituye, con Shift suma. */
export function alMarcar(seleccion, ids, { shift = false } = {}) {
  return shift ? new Set([...seleccion, ...ids]) : new Set(ids);
}
