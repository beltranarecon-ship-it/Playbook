#!/usr/bin/env node
/* ============================================================
   lint.mjs — control de calidad de la biblioteca, por línea de
   órdenes.

   Las dos primeras capas —la FICHA y la GEOMETRÍA— viven en
   `taller/js/ia/lint.js`, dentro de la app, porque el paso 3 del
   Taller enseña lo que el linter va a decir de la ficha MIENTRAS se
   escribe (Tramo 2.12) y dos copias de las reglas serían dos
   listones. Es la misma dirección que ya tenían las anclas y la
   escala: las herramientas importan de la app, no al revés.

   Aquí se queda la capa 3 —el CONJUNTO: invariantes del mapa, huecos
   de cobertura, duplicados—, que solo significa algo sobre la
   biblioteca entera, y lo único que necesita Node: leer un fichero y
   salir con código 1.

   Uso:
     node tools/biblioteca/lint.mjs fichas.json
     node tools/biblioteca/lint.mjs fichas.json --solo-errores

   Su banco de pruebas es su propio punto de entrada, como los otros
   ocho del proyecto (importarlo desde aquí crearía un ciclo):
     node tools/biblioteca/lint.prueba.mjs

   Sale con código 1 si hay ERRORES (no si solo hay avisos), de modo
   que se pueda encadenar antes de importar.
   ============================================================ */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { huecos, revisarInvariantes, validarMapa, MAPA, OBJETIVO_TOTAL } from './mapa.mjs';
import { revisaFicha, revisaGeometria } from '../../taller/js/ia/lint.js';

export { revisaFicha, revisaGeometria };

/* ---------- capa 3 · el conjunto -------------------------------- */

const clave = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export function revisaConjunto(fichas) {
  const errores = [...revisarInvariantes(fichas)];
  const avisos = [];

  /* Duplicados encubiertos: el mismo ejercicio con dos nombres. */
  const vistos = new Map();
  for (const f of fichas) {
    const k = clave(f.name);
    if (vistos.has(k)) errores.push(`nombre duplicado: "${f.name}" y "${vistos.get(k)}"`);
    else vistos.set(k, f.name);
  }

  /* La proporción sin rival, a la vista. El tope duro de D1 mira ahora
     los dos ejes (mapa.mjs), pero este número sigue diciendo cuánta
     biblioteca no tiene a nadie enfrente, y conviene no perderlo. */
  if (fichas.length >= 20) {
    const nulas = fichas.filter((f) => (f.requisitos?.oposicion || 'nula') === 'nula').length;
    avisos.push(`${(nulas / fichas.length * 100).toFixed(0)} % sin rival enfrente (${nulas}/${fichas.length}) — el tope duro mira oposición Y presión`);
  }

  for (const h of huecos(fichas)) {
    if (h.faltan) avisos.push(`${h.bloque}: ${h.tiene}/${h.objetivo} (faltan ${h.faltan})`);
    if (h.tiene && h.contenidosSinCubrir.length) {
      avisos.push(`${h.bloque}: sin cubrir → ${h.contenidosSinCubrir.join(', ')}`);
    }
  }

  return { errores, avisos };
}

/* ---------- informe --------------------------------------------- */

export function lint(fichas) {
  const porFicha = fichas.map((f, i) => {
    const a = revisaFicha(f);
    const b = revisaGeometria(f);
    return { i, nombre: f.name || `(ficha ${i + 1})`, errores: [...a.errores, ...b.errores], avisos: [...a.avisos, ...b.avisos] };
  });
  const conjunto = revisaConjunto(fichas);
  const nErrores = porFicha.reduce((n, f) => n + f.errores.length, 0) + conjunto.errores.length;
  const nAvisos = porFicha.reduce((n, f) => n + f.avisos.length, 0) + conjunto.avisos.length;
  return { porFicha, conjunto, nErrores, nAvisos };
}

/* ---------- CLI --------------------------------------------------- */

/* Rutas resueltas, no cadenas: en Windows conviven las dos barras. */
const esCLI = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCLI) {
  const errMapa = validarMapa();
  if (errMapa.length) {
    console.error('El mapa de cobertura está mal:\n' + errMapa.map((e) => '  · ' + e).join('\n'));
    process.exit(1);
  }

  const ruta = process.argv.find((a, i) => i >= 2 && !a.startsWith('--'));
  if (!ruta) {
    console.error('Uso: node tools/biblioteca/lint.mjs <fichas.json> [--solo-errores]');
    console.error(`Mapa: ${MAPA.length} bloques, ${OBJETIVO_TOTAL} ejercicios objetivo.`);
    process.exit(1);
  }

  const datos = JSON.parse(readFileSync(ruta, 'utf8'));
  const fichas = Array.isArray(datos) ? datos : (datos.fichas || datos.datos || []);
  const r = lint(fichas);
  const soloErrores = process.argv.includes('--solo-errores');

  console.log(`\n${fichas.length} ficha(s) · ${r.nErrores} error(es) · ${r.nAvisos} aviso(s)\n`);

  for (const f of r.porFicha) {
    if (!f.errores.length && (soloErrores || !f.avisos.length)) continue;
    console.log(`  ${f.nombre}`);
    for (const e of f.errores) console.log(`    ERROR  ${e}`);
    if (!soloErrores) for (const a of f.avisos) console.log(`    aviso  ${a}`);
    console.log('');
  }

  if (r.conjunto.errores.length || (!soloErrores && r.conjunto.avisos.length)) {
    console.log('  — conjunto de la biblioteca —');
    for (const e of r.conjunto.errores) console.log(`    ERROR  ${e}`);
    if (!soloErrores) for (const a of r.conjunto.avisos) console.log(`    aviso  ${a}`);
    console.log('');
  }

  process.exit(r.nErrores ? 1 : 0);
}
