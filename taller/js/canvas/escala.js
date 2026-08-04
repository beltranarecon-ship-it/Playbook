/* ============================================================
   canvas/escala.js — cuántos METROS mide una unidad normalizada, en
   cada eje y en cada pista. Módulo puro (sin DOM): lo usan el
   compilador, el linter de la biblioteca y el banco de pruebas.

   POR QUÉ HACE FALTA
   El sistema entero trabaja en coordenadas [0,1] sobre el lienzo. Eso
   está bien para dibujar y fatal para decidir baloncesto: "termina la
   entrada a 0,08 del aro" no significa nada, mientras que "termina a
   1,2 m del aro" es exactamente la instrucción que un entrenador da.
   Sin esta traducción, las distancias se eligen a ojo — y así acabaron
   trece finalizaciones de la biblioteca saliendo a 2, 4 y hasta 8
   metros del aro.

   POR QUÉ NO SE DEDUCE DEL TAMAÑO DE LA PISTA
   Sería lo natural (28 × 15 m repartidos sobre el marco) y da mal:
   los SVG de pista son dibujos ESTILIZADOS, no planos a escala. Se
   dibujan con margen de sobra alrededor para que las fichas quepan sin
   salirse, así que el marco no mide lo que dice medir, y los dos ejes
   ni siquiera están estirados igual.

   DE DÓNDE SALE ENTONCES
   De dos distancias que sí son un hecho del juego y que además están
   MEDIDAS sobre el render (anclas.js), una por eje:

     · aro → línea de tiros libres = 4,225 m
       (la línea está a 5,80 m del fondo; el centro del aro, a 1,575 m)
     · codo a codo = ancho de la zona = 4,90 m

   Cada una cae limpia sobre un eje distinto en las cuatro pistas, así
   que dan la escala de los dos ejes sin suponer nada. Se calculan al
   cargar el módulo: si mañana se regeneran las anclas, la escala se
   corrige sola.

   Comprobación que da confianza: con la escala así derivada, el largo
   de la pista entera (marco baseline 0,02→0,98) sale 27,97 m. Son los
   28 m de una pista de verdad.

   HASTA DÓNDE LLEGA LA PRECISIÓN
   Las dos referencias están JUNTO AL ARO, así que ahí la escala es
   exacta — que es justo donde se decide si una finalización termina
   donde debe. Lejos del aro el dibujo se estira (en la media, la
   esquina sale a 8,9 m del aro cuando de verdad son 6,6), porque el
   SVG deja margen alrededor. Se acepta: el error va del lado seguro,
   nunca hará pasar por cercano un tiro que está lejos.
   ============================================================ */

import { ANCLAS, posicionesDe } from './anclas.js';

/** Distancias reales, en metros, de las dos referencias medidas. */
export const ARO_A_TIRO_LIBRE = 4.225;
export const ANCHO_ZONA = 4.90;

/** Metros por unidad normalizada en cada eje, por pista. */
export const ESCALA = {};

for (const pista of Object.keys(ANCLAS)) {
  const pos = posicionesDe(pista, 'norte');
  if (!pos?.aro || !pos?.tiro_libre || !pos?.codo_izq || !pos?.codo_der) continue;

  // Cada referencia se proyecta sobre el eje en el que de verdad se
  // extiende. En las enteras el aro y el tiro libre están alineados en
  // vertical y los codos en horizontal; en las medias, al revés
  // (van dibujadas en paisaje). Se mira cuál de los dos deltas manda en
  // vez de asumirlo, así una pista nueva no rompe nada.
  const eje = (a, b) => (Math.abs(a[0] - b[0]) >= Math.abs(a[1] - b[1]) ? 'x' : 'y');
  const delta = (a, b, e) => Math.abs(e === 'x' ? a[0] - b[0] : a[1] - b[1]);

  const ejeTL = eje(pos.aro, pos.tiro_libre);
  const ejeZona = eje(pos.codo_izq, pos.codo_der);
  if (ejeTL === ejeZona) continue;   // referencias degeneradas: mejor sin escala que con una inventada

  const e = {};
  e[ejeTL] = ARO_A_TIRO_LIBRE / delta(pos.aro, pos.tiro_libre, ejeTL);
  e[ejeZona] = ANCHO_ZONA / delta(pos.codo_izq, pos.codo_der, ejeZona);
  ESCALA[pista] = e;
}

/** Escala de una pista, con la de media como red de seguridad. */
export function escalaDe(pista) {
  return ESCALA[pista] || ESCALA.media || { x: 25.8, y: 22.3 };
}

/** Distancia REAL en metros entre dos puntos normalizados de esa pista. */
export function metrosEntre(pista, a, b) {
  const e = escalaDe(pista);
  const ax = Array.isArray(a) ? a[0] : a.x, ay = Array.isArray(a) ? a[1] : a.y;
  const bx = Array.isArray(b) ? b[0] : b.x, by = Array.isArray(b) ? b[1] : b.y;
  return Math.hypot((ax - bx) * e.x, (ay - by) * e.y);
}

/**
 * Punto situado a `metros` de `destino`, sobre la recta que va de
 * `desde` a `destino`. Es la operación que convierte "acaba la entrada
 * cerca del aro" en una coordenada: se acerca TODO lo que hace falta y
 * se para a la distancia pedida, venga el jugador de donde venga.
 *
 * Si el jugador ya está más cerca que `metros`, se queda donde está: la
 * entrada nunca hace retroceder a nadie.
 */
export function puntoADistanciaDe(pista, desde, destino, metros) {
  const e = escalaDe(pista);
  const dx = Array.isArray(desde) ? desde[0] : desde.x;
  const dy = Array.isArray(desde) ? desde[1] : desde.y;
  const tx = Array.isArray(destino) ? destino[0] : destino.x;
  const ty = Array.isArray(destino) ? destino[1] : destino.y;

  // vector desde→destino, medido en METROS (los ejes no escalan igual)
  const mx = (tx - dx) * e.x, my = (ty - dy) * e.y;
  const largo = Math.hypot(mx, my);
  if (largo <= metros || largo === 0) return { x: dx, y: dy };

  // se avanza hasta quedar a `metros` del destino, y se vuelve a [0,1]
  const avance = (largo - metros) / largo;
  return { x: dx + (tx - dx) * avance, y: dy + (ty - dy) * avance };
}
