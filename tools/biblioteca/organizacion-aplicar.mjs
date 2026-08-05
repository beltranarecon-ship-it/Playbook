#!/usr/bin/env node
/* ============================================================
   organizacion-aplicar.mjs — mete `requisitos.organizacion` en su
   sitio dentro de cada tanda, una sola vez.

   Se hace con un script y no a mano porque son noventa y siete
   inserciones en siete archivos, y a mano se cuela una en la ficha de
   al lado sin que nadie lo note. El texto vive en
   organizacion-datos.mjs; aquí solo está la mecánica.

   Inserta ANTES de la línea `criterio_exito:`, que todas las fichas
   tienen exactamente una vez (es campo obligatorio), respetando su
   sangría. Si una ficha ya lo tiene, se salta.

     node tools/biblioteca/organizacion-aplicar.mjs            → ensayo
     node tools/biblioteca/organizacion-aplicar.mjs --escribir → escribe
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ORGANIZACION } from './organizacion-datos.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARCHIVOS = ['piloto.mjs', 'tanda-02.mjs', 'tanda-03.mjs', 'tanda-04.mjs', 'tanda-05.mjs', 'tanda-06.mjs', 'tanda-07.mjs'];
const escribir = process.argv.includes('--escribir');

const puestas = [];
const yaEstaban = [];
const sinTexto = [];

for (const archivo of ARCHIVOS) {
  const ruta = join(AQUI, archivo);
  const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/);
  const salida = [];
  let ficha = null;         // nombre de la ficha que se está leyendo
  let yaTiene = false;

  for (const linea of lineas) {
    const mNombre = linea.match(/^\s*name:\s*'(.+?)',/);
    if (mNombre) { ficha = mNombre[1]; yaTiene = false; }
    if (/^\s*organizacion:/.test(linea)) yaTiene = true;

    const mCrit = linea.match(/^(\s*)criterio_exito:/);
    if (mCrit && ficha && !yaTiene) {
      const texto = ORGANIZACION[ficha];
      if (!texto) sinTexto.push(ficha);
      else {
        salida.push(`${mCrit[1]}organizacion: '${texto.replace(/'/g, "\\'")}',`);
        puestas.push(ficha);
      }
    } else if (mCrit && yaTiene) yaEstaban.push(ficha);

    salida.push(linea);
  }

  if (escribir) writeFileSync(ruta, salida.join('\n'), 'utf8');
}

console.log(`\n${puestas.length} organizacion(es) insertada(s)${escribir ? '' : '  (ENSAYO: no se ha escrito nada)'}`);
if (yaEstaban.length) console.log(`${yaEstaban.length} ficha(s) ya la tenían.`);
if (sinTexto.length) {
  console.log(`\nSIN TEXTO en organizacion-datos.mjs (${sinTexto.length}):`);
  for (const n of sinTexto) console.log(`  · ${n}`);
}

// Al revés: textos escritos que no casan con ninguna ficha (erratas del nombre)
const nombresUsados = new Set([...puestas, ...yaEstaban, ...sinTexto]);
const huerfanos = Object.keys(ORGANIZACION).filter((n) => !nombresUsados.has(n));
if (huerfanos.length) {
  console.log(`\nTEXTOS QUE NO CASAN con ninguna ficha (${huerfanos.length}) — ¿errata en el nombre?`);
  for (const n of huerfanos) console.log(`  · ${n}`);
}
if (!escribir) console.log('\nPara aplicarlo:  node tools/biblioteca/organizacion-aplicar.mjs --escribir\n');
