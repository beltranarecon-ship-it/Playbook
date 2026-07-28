/* ============================================================
   gen-anclas.mjs — regenera taller/js/canvas/anclas.js a partir de
   taller/tools/anclas-medidas.json (el anchor map MEDIDO a píxel
   sobre el render real de cada pista, Tramo 2).

   Ejecutar:  node taller/tools/gen-anclas.mjs

   ¿Por qué generar un .js en vez de importar el .json? El Taller es
   una app estática servida por python (serve.py): los import
   assertions de JSON no están garantizados en todos los navegadores
   objetivo, así que se emite una constante ES module normal. Si se
   re-mide alguna pista, corrige el JSON y vuelve a ejecutar esto.
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(readFileSync(join(here, 'anclas-medidas.json'), 'utf8'));
const { _meta, ...pistas } = src; // _meta (metodología) no viaja al navegador

const out = `/* ============================================================
   canvas/anclas.js — anclas MEDIDAS de las 4 pistas (Tramo 2).

   GENERADO por taller/tools/gen-anclas.mjs desde
   taller/tools/anclas-medidas.json — NO editar a mano: corrige el
   JSON y regenera con \`node taller/tools/gen-anclas.mjs\`.

   Coordenadas normalizadas [0,1] en el MISMO marco que court.js y
   el resto del motor (las medias van dibujadas en paisaje con el
   aro a la izquierda; izq/der de los nombres = arriba/abajo en
   pantalla, pero las coords ya lo llevan incorporado).

   Diferencia deliberada con court.js: en las MEDIAS el centro REAL
   del aro está en x≈0.172 (medido sobre el render), mientras
   PISTAS.media.baskets usa x≈0.143 (cae entre tablero y aro).
   court.js sigue mandando en la lógica de lado/orientación
   (canastaKey, haciaCanasta, resaltado del aro); estas anclas dan
   el ENDPOINT exacto del tiro y las posiciones con nombre.
   ============================================================ */

export const ANCLAS = ${JSON.stringify(pistas, null, 2)};

// posiciones de una pista+canasta; con una sola canasta (medias) se
// ignora la clave pedida y se usa la única existente. null si la
// pista no está en el registro.
export function posicionesDe(pista, canasta) {
  const p = ANCLAS[pista];
  if (!p || !p.pos) return null;
  return p.pos[canasta] || p.pos.norte || p.pos[Object.keys(p.pos)[0]] || null;
}

/** Centro EXACTO (medido) del aro de esa pista+canasta. [x,y] | null. */
export function aroExacto(pista, canasta) {
  const pos = posicionesDe(pista, canasta);
  return pos ? pos.aro : null;
}
`;

writeFileSync(join(here, '../js/canvas/anclas.js'), out);
console.log('taller/js/canvas/anclas.js regenerado.');
