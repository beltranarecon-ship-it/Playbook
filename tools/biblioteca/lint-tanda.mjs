#!/usr/bin/env node
/* ============================================================
   lint-tanda.mjs — revisa UNA tanda suelta, sin tocar el resto.

   `construir.mjs --lint` revisa la biblioteca entera, y eso solo
   funciona cuando todas las tandas existen y están enchufadas. Al
   escribir una tanda nueva hace falta el bucle corto: compilar SU
   fichero, pasarle las dos primeras capas del linter (la ficha y la
   geometría) y ver los errores propios, sin el ruido de los huecos de
   cobertura del conjunto —que dependen de las otras trece tandas y no
   se pueden arreglar desde aquí—.

     node tools/biblioteca/lint-tanda.mjs tanda-08.mjs
     node tools/biblioteca/lint-tanda.mjs tanda-08.mjs --avisos

   Sale con código 1 si hay errores, 0 si no. Los avisos no hacen
   fallar: son "míralo", no "está mal".
   ============================================================ */

import { dirname, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compilarFichas } from './montaje.mjs';
import { revisaFicha, revisaGeometria } from './lint.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2];
if (!arg) {
  console.error('Falta el fichero. Ejemplo:  node tools/biblioteca/lint-tanda.mjs tanda-08.mjs');
  process.exit(2);
}
const verAvisos = process.argv.includes('--avisos');
const ruta = join(AQUI, basename(arg));

let mod;
try {
  mod = await import(pathToFileURL(ruta).href);
} catch (e) {
  // Un fallo de sintaxis o un import roto se ve aquí y no en un stack de mil líneas.
  console.error(`\nNo se puede cargar ${basename(arg)}:\n  ${e.message}\n`);
  process.exit(1);
}

/* La tanda exporta una sola constante con el array (TANDA_08, PILOTO…);
   se coge la primera exportación que sea un array de objetos con `name`,
   así el nombre de la constante no es un contrato más que recordar. */
const crudas = Object.values(mod).find((v) => Array.isArray(v) && v.length && v[0] && typeof v[0].name === 'string');
if (!crudas) {
  console.error(`\n${basename(arg)} no exporta ningún array de fichas.\n`);
  process.exit(1);
}

let fichas;
try {
  fichas = compilarFichas(crudas);
} catch (e) {
  // Casi siempre: un `tablero()` que referencia un ancla que no existe.
  console.error(`\nLa compilación de las animaciones ha reventado:\n  ${e.message}\n`);
  process.exit(1);
}

let nErr = 0;
let nAvi = 0;
console.log(`\n${basename(arg)} · ${fichas.length} ficha(s)\n`);
for (const f of fichas) {
  const a = revisaFicha(f);
  const b = revisaGeometria(f);
  const errores = [...a.errores, ...b.errores];
  const avisos = [...a.avisos, ...b.avisos];
  nErr += errores.length;
  nAvi += avisos.length;
  if (!errores.length && !(verAvisos && avisos.length)) continue;
  console.log(`  ${f.name}`);
  for (const e of errores) console.log(`    ERROR  ${e}`);
  if (verAvisos) for (const v of avisos) console.log(`    aviso  ${v}`);
}

/* Recuento de la tanda: sirve para no entregar ocho fichas sin
   oposición en un bloque técnico (INVARIANTES.minProporcionConOposicion). */
const conOp = fichas.filter((f) => ['semiactiva', 'real'].includes(f.requisitos?.oposicion)).length;
const animadas = fichas.filter((f) => f.animacion?.fases?.length).length;
console.log(`\n  ${nErr} error(es) · ${nAvi} aviso(s)`);
console.log(`  ${conOp}/${fichas.length} con oposición semiactiva o real · ${animadas}/${fichas.length} con animación\n`);
if (!verAvisos && nAvi) console.log('  (los avisos se ven con --avisos)\n');

process.exit(nErr ? 1 : 0);
