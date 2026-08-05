#!/usr/bin/env node
/* ============================================================
   ejes-aplicar.mjs — separa `oposicion` de `presion` en las siete
   tandas, una sola vez.

   Mismo oficio que organizacion-aplicar.mjs: son noventa y siete
   ediciones en siete archivos y a mano se cuela una en la ficha de al
   lado. El criterio vive en ejes-datos.mjs; aquí solo la mecánica.

   Trabaja sobre la línea que ya tiene `oposicion: '…'` (todas la
   tienen exactamente una vez): corrige el valor si la ficha está en
   CORRECCIONES y añade `presion: '…'` justo detrás. Si la ficha ya
   tiene presión, se salta.

     node tools/biblioteca/ejes-aplicar.mjs            → ensayo
     node tools/biblioteca/ejes-aplicar.mjs --escribir → escribe
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORRECCIONES, presionDe } from './ejes-datos.mjs';
import { biblioteca } from './construir.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARCHIVOS = ['piloto.mjs', 'tanda-02.mjs', 'tanda-03.mjs', 'tanda-04.mjs', 'tanda-05.mjs', 'tanda-06.mjs', 'tanda-07.mjs'];
const escribir = process.argv.includes('--escribir');

/* La presión sale de la ficha COMPILADA porque depende de los tags, y
   los tags viven en el objeto, no en el texto del archivo. */
const porNombre = new Map(biblioteca().map((f) => [f.name, f]));

const puestas = [];
const corregidas = [];
const yaEstaban = [];
const sinTocar = [];

for (const archivo of ARCHIVOS) {
  const ruta = join(AQUI, archivo);
  const original = readFileSync(ruta, 'utf8');
  const lineas = original.split(/\r?\n/);
  const salida = [];
  let ficha = null;

  for (const linea of lineas) {
    const mNombre = linea.match(/^\s*name:\s*'(.+?)',/);
    if (mNombre) ficha = mNombre[1];

    const mOpo = linea.match(/oposicion: '(\w+)',/);
    if (!mOpo || !ficha) { salida.push(linea); continue; }

    if (/presion: '/.test(linea)) { yaEstaban.push(ficha); salida.push(linea); continue; }

    const f = porNombre.get(ficha);
    if (!f) { sinTocar.push(`${ficha} (no está en la biblioteca compilada)`); salida.push(linea); continue; }

    const opoNueva = CORRECCIONES[ficha] || mOpo[1];
    if (opoNueva !== mOpo[1]) corregidas.push(`${ficha}: ${mOpo[1]} → ${opoNueva}`);
    const presion = presionDe(f);
    puestas.push(`${ficha}: presion ${presion}`);
    salida.push(linea.replace(/oposicion: '\w+',/, `oposicion: '${opoNueva}', presion: '${presion}',`));
  }

  const texto = salida.join('\n');
  if (escribir && texto !== original) writeFileSync(ruta, texto, 'utf8');
}

console.log(`\n${puestas.length} presion(es) puesta(s) · ${corregidas.length} oposicion(es) corregida(s) · ${yaEstaban.length} ya la tenían`);
for (const c of corregidas) console.log(`  CORRIGE  ${c}`);
for (const s of sinTocar) console.log(`  OJO      ${s}`);
if (!escribir) console.log('\n(ensayo — vuelve a lanzarlo con --escribir)');
