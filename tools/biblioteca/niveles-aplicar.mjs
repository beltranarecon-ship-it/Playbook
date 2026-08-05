#!/usr/bin/env node
/* ============================================================
   niveles-aplicar.mjs — convierte el párrafo `variantes` de cada
   ficha en `requisitos.niveles`, estructurado, de una sola pasada.

   POR QUÉ. Los tres escalones de exigencia son EL eje que ordena esta
   biblioteca —la decisión de diseño que sustituye a la edad (D8)— y
   vivían dentro de un campo de texto libre, como prosa:

     'Base: … Intermedio: … Avanzado: …'

   Para enseñarlos había que partirlos con una expresión regular al
   pintar. Funcionaba en las 97 porque las escribí yo con el mismo
   molde, pero es una regla de formato tácita: la primera ficha escrita
   a mano en el Taller que no la siga se enseña como un párrafo denso, y
   nadie se entera. Un eje que solo existe si una regex acierta no es un
   eje, es una convención.

   DÓNDE VAN. Dentro de `requisitos`, que ya es jsonb, y no en una
   columna nueva: añadir columna exige una migración y este proyecto
   tiene dos sin aplicar. La misma decisión que se tomó con
   `organizacion`.

   QUÉ PASA CON `variantes`. Se vacía en estas 97: el contenido se
   MUEVE, no se copia. Dos campos con lo mismo divergen. `variantes`
   sigue existiendo para los ejercicios escritos a mano en el Taller,
   que tienen su propio hueco de texto libre.

     node tools/biblioteca/niveles-aplicar.mjs            → ensayo
     node tools/biblioteca/niveles-aplicar.mjs --escribir → escribe
   ============================================================ */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { niveles as partirNiveles } from '../../taller/js/ficha.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const ARCHIVOS = ['piloto.mjs', 'tanda-02.mjs', 'tanda-03.mjs', 'tanda-04.mjs', 'tanda-05.mjs', 'tanda-06.mjs', 'tanda-07.mjs'];
const escribir = process.argv.includes('--escribir');

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

let hechas = 0; const noParsean = []; const yaEstaban = [];

for (const archivo of ARCHIVOS) {
  const ruta = join(AQUI, archivo);
  const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/);
  const salida = [];
  let ficha = null;
  let pendiente = null;   // los tres niveles de la ficha en curso, ya partidos

  for (const linea of lineas) {
    const mNombre = linea.match(/^\s*name:\s*'(.+?)',\s*$/);
    if (mNombre) { ficha = mNombre[1]; pendiente = null; }

    if (/^\s*niveles:\s*\{/.test(linea)) { yaEstaban.push(ficha); }

    // 1 · la línea de `variantes` desaparece, y su contenido se guarda
    const mVar = linea.match(/^(\s*)variantes:\s*'(.*)',\s*$/);
    if (mVar && ficha) {
      const partidos = partirNiveles(mVar[2].replace(/\\'/g, "'"));
      if (!partidos || partidos.length !== 3) { noParsean.push(ficha); salida.push(linea); continue; }
      pendiente = partidos;
      continue;                              // se salta: el contenido se muda
    }

    // 2 · y reaparece dentro de requisitos, estructurado
    const mCrit = linea.match(/^(\s*)criterio_exito:/);
    if (mCrit && pendiente) {
      const s = mCrit[1];
      salida.push(`${s}niveles: {`);
      for (const n of pendiente) salida.push(`${s}  ${n.nivel.toLowerCase()}: '${esc(n.texto)}',`);
      salida.push(`${s}},`);
      pendiente = null;
      hechas++;
    }

    salida.push(linea);
  }

  if (escribir) writeFileSync(ruta, salida.join('\n'), 'utf8');
}

console.log(`\n${hechas} ficha(s) convertida(s)${escribir ? '' : '  (ENSAYO: no se ha escrito nada)'}`);
if (yaEstaban.length) console.log(`${yaEstaban.length} ya lo tenían.`);
if (noParsean.length) {
  console.log(`\nNO SE PUDIERON PARTIR EN TRES (${noParsean.length}) — hay que escribirlas a mano:`);
  for (const n of noParsean) console.log(`  · ${n}`);
}
if (!escribir) console.log('\nPara aplicarlo:  node tools/biblioteca/niveles-aplicar.mjs --escribir\n');
