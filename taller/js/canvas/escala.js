/* ============================================================
   canvas/escala.js — cuántos METROS mide una unidad normalizada, y
   las dos operaciones que hacen falta para pensar en metros dentro
   de un sistema que dibuja en [0,1]. Módulo puro: lo usan el
   compilador, el linter de la biblioteca y el banco de pruebas.

   POR QUÉ HACE FALTA
   El sistema entero trabaja en coordenadas [0,1] sobre el lienzo.
   Eso está bien para dibujar y fatal para decidir baloncesto:
   "termina la entrada a 0,08 del aro" no significa nada, mientras
   que "termina a 1,2 m del aro" es exactamente la instrucción que
   un entrenador da. Sin esta traducción las distancias se eligen a
   ojo — y así acabaron trece finalizaciones de la biblioteca
   saliendo a 2, 4 y hasta 8 metros del aro.

   QUÉ HA CAMBIADO
   Este módulo DEDUCÍA la escala midiendo dos rasgos del dibujo (aro
   → tiros libres para un eje, codo a codo para el otro), porque los
   SVG eran ilustraciones estilizadas y no había forma de saber
   cuánto medía el marco. Aquello solo acertaba junto al aro; lejos,
   el dibujo se estiraba y la esquina salía a 8,9 m cuando son 6,6.

   Ahora el marco ES la pista más dos metros de banda por cada lado,
   así que la escala se lee directamente de medidas.js y es exacta
   en toda la pista. Y como los dos ejes están a la misma escala —el
   marco en metros tiene la misma proporción que el lienzo en
   píxeles— un metro son los mismos píxeles vaya en la dirección que
   vaya, y un círculo se dibuja redondo.
   ============================================================ */

import { REGLAS, PISTAS_M, marcoDe, escalaDe as escalaDeMarco } from './medidas.js';

/** Distancias reales que antes servían de referencia para deducir la escala. */
export const ARO_A_TIRO_LIBRE = REGLAS.zonaFondo - REGLAS.aroRetranqueo;   // 4,225
export const ANCHO_ZONA = REGLAS.zonaAncho;                                // 4,90

/** Metros por unidad normalizada en cada eje, por pista. */
export const ESCALA = Object.fromEntries(
  Object.keys(PISTAS_M).map((p) => [p, escalaDeMarco(p)]),
);

/** Escala de una pista, con la entera como red de seguridad. */
export function escalaDe(pista) {
  return ESCALA[pista] || ESCALA.entera || { x: marcoDe('entera').ancho, y: marcoDe('entera').alto };
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
