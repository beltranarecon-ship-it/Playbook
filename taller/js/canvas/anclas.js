/* ============================================================
   canvas/anclas.js — las posiciones con nombre de cada pista.

   DERIVADAS de canvas/medidas.js, no medidas. Antes este fichero
   era una tabla generada a partir de anclas-medidas.json, que a su
   vez salía de escanear los píxeles de cada SVG buscando dónde
   caía el aro, el codo o la esquina. Funcionaba, pero heredaba
   todos los defectos del dibujo: la misma posición no estaba en el
   mismo sitio en la entera y en la media, la zona salía un 17 % más
   estrecha de lo que dice el reglamento y la esquina quedaba a 8,9 m
   del aro cuando de verdad son 6,6.

   Ahora hay una sola tabla de medidas en metros y cuatro marcos a
   escala; cada ancla se calcula. Si mañana cambia una medida, cambia
   en las cuatro pistas a la vez y no hay nada que volver a medir.

   La forma pública NO cambia: `ANCLAS`, `posicionesDe(pista,
   canasta)` y `aroExacto(pista, canasta)` siguen devolviendo lo
   mismo que antes — coordenadas normalizadas [0,1] sobre el marco
   de esa pista. Lo único que cambia es que ahora son exactas.

   Diferencia respecto a la versión anterior que conviene tener
   presente: las medias pistas también tienen `poste_alto` (antes
   no existía y el validador lo daba por nombre desconocido), y su
   `centro` cae en la línea de medio campo, que es lo que significa
   "el centro", en vez de a media distancia de la nada.
   ============================================================ */

import { PISTAS_M, marcoDe, anclasDe } from './medidas.js';

/** { pista: { frame, pos: { canasta: { nombre: [x, y] } } } } */
export const ANCLAS = Object.fromEntries(Object.keys(PISTAS_M).map((pista) => {
  const m = marcoDe(pista);
  const pos = Object.fromEntries(m.canastas.map((c) => [c, anclasDe(pista, c)]));
  return [pista, { frame: { anchoM: m.ancho, altoM: m.alto, orientacion: m.orientacion }, pos }];
}));

/**
 * Posiciones de una pista+canasta. Con una sola canasta (medias) se
 * ignora la clave pedida y se usa la única que hay. null si la pista
 * no está en el registro.
 */
export function posicionesDe(pista, canasta) {
  const p = ANCLAS[pista];
  if (!p || !p.pos) return null;
  return p.pos[canasta] || p.pos.norte || p.pos[Object.keys(p.pos)[0]] || null;
}

/** Centro exacto del aro de esa pista+canasta. [x,y] | null. */
export function aroExacto(pista, canasta) {
  const pos = posicionesDe(pista, canasta);
  return pos ? pos.aro : null;
}

/*
   Las quince anclas, con el nombre que un entrenador usa en pista.
   Las claves son las de medidas.js#anclasEnMetros: si mañana se añade
   una, aquí falta su nombre y el banco lo dice (eval-medidas.mjs).

   Venían de `ia/sujetos.js`, del motor viejo, que se borra. Se quedan
   porque son vocabulario de pista, no del motor: los van a pedir la
   frase automática (§9.1) y las posiciones con nombre (§7.7).

   'aro' no está a propósito: la canasta se nombra aparte («el aro»,
   «la canasta»), porque no es un sitio más de la lista sino EL
   objetivo del ejercicio.
*/
export const NOMBRE_ANCLA = {
  base: 'Base',
  centro: 'Centro',
  tiro_libre: 'Tiro libre',
  escolta_der: 'Escolta derecho',
  escolta_izq: 'Escolta izquierdo',
  alero_der: 'Alero derecho',
  alero_izq: 'Alero izquierdo',
  esquina_der: 'Esquina derecha',
  esquina_izq: 'Esquina izquierda',
  codo_der: 'Codo derecho',
  codo_izq: 'Codo izquierdo',
  poste_bajo_der: 'Poste bajo derecho',
  poste_bajo_izq: 'Poste bajo izquierdo',
  poste_alto_der: 'Poste alto derecho',
  poste_alto_izq: 'Poste alto izquierdo',
};
