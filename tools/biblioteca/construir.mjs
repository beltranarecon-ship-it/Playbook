#!/usr/bin/env node
/* ============================================================
   construir.mjs — junta todas las tandas, compila sus animaciones
   y revisa el conjunto.

   Las invariantes del mapa (proporción con oposición, tope de
   densidad baja, duplicados) solo tienen sentido sobre la biblioteca
   ENTERA: una tanda suelta puede parecer sana y desequilibrar el
   conjunto. Por eso el linter de verdad se pasa aquí, no tanda a
   tanda.

     node tools/biblioteca/construir.mjs           → escribe biblioteca.json
     node tools/biblioteca/construir.mjs --lint    → lo escribe y lo revisa
     node tools/biblioteca/construir.mjs --resumen → reparto por bloque
   ============================================================ */

import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compilarFichas } from './montaje.mjs';
import { PILOTO } from './piloto.mjs';
import { TANDA_02 } from './tanda-02.mjs';
import { TANDA_03 } from './tanda-03.mjs';
import { TANDA_04 } from './tanda-04.mjs';
import { TANDA_05 } from './tanda-05.mjs';
import { TANDA_06 } from './tanda-06.mjs';
import { TANDA_07 } from './tanda-07.mjs';
import { TANDA_08 } from './tanda-08.mjs';
import { TANDA_09 } from './tanda-09.mjs';
import { TANDA_10 } from './tanda-10.mjs';
import { TANDA_11 } from './tanda-11.mjs';
import { TANDA_12 } from './tanda-12.mjs';
import { MAPA, OBJETIVO_TOTAL } from './mapa.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));

/** Orden de las tandas: es el orden en que se escribieron. */
export const TANDAS = [
  { nombre: 'piloto', fichas: PILOTO },
  { nombre: 'tanda-02 · tiro y bote', fichas: TANDA_02 },
  { nombre: 'tanda-03 · 1c1, defensa y juego reducido', fichas: TANDA_03 },
  { nombre: 'tanda-04 · pase, entrada, juego de dos y contraataque', fichas: TANDA_04 },
  { nombre: 'tanda-05 · manejo, pies, rebote, calentamiento y psicomotricidad', fichas: TANDA_05 },
  { nombre: 'tanda-06 · profundidad en juego reducido, tiro, bote, 1c1 y defensa', fichas: TANDA_06 },
  { nombre: 'tanda-07 · manejo, rebote, calentamiento y psicomotricidad', fichas: TANDA_07 },
  { nombre: 'tanda-08 · bote: el de avance, los tres cambios y la protección', fichas: TANDA_08 },
  { nombre: 'tanda-09 · tiro: la distancia que se gana y el tiro con oposición', fichas: TANDA_09 },
  { nombre: 'tanda-10 · 1c1: el defensivo, el que se juega sin balón y las restricciones', fichas: TANDA_10 },
  { nombre: 'tanda-11 · defensa: el cierre de rebote como hábito, la ayuda y la voz', fichas: TANDA_11 },
  { nombre: 'tanda-12 · juego reducido: superioridades, inferioridades y reglas', fichas: TANDA_12 },
];

export function biblioteca() {
  return compilarFichas(TANDAS.flatMap((t) => t.fichas));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichas = biblioteca();
  const destino = join(AQUI, 'biblioteca.json');
  writeFileSync(destino, JSON.stringify(fichas, null, 2), 'utf8');

  const animadas = fichas.filter((f) => f.animacion?.fases?.length).length;
  console.log(`\n${fichas.length} de ${OBJETIVO_TOTAL} fichas → ${destino}`);
  console.log(`  ${animadas} con animación · ${fichas.length - animadas} solo montaje`);
  for (const t of TANDAS) console.log(`  · ${t.nombre}: ${t.fichas.length}`);

  if (process.argv.includes('--resumen')) {
    const porBloque = new Map();
    for (const f of fichas) porBloque.set(f.category, (porBloque.get(f.category) || 0) + 1);
    console.log('\n  bloque             tiene  objetivo');
    for (const m of MAPA) {
      const n = porBloque.get(m.bloque) || 0;
      const barra = '█'.repeat(Math.round(n / m.objetivo * 20)).padEnd(20, '·');
      console.log(`  ${m.bloque.padEnd(18)} ${String(n).padStart(3)}   ${String(m.objetivo).padStart(4)}  ${barra}`);
    }
  }

  if (process.argv.includes('--lint')) {
    const { lint } = await import('./lint.mjs');
    const r = lint(fichas);
    console.log(`\n${r.nErrores} error(es) · ${r.nAvisos} aviso(s)\n`);
    for (const f of r.porFicha) {
      if (!f.errores.length) continue;
      console.log(`  ${f.nombre}`);
      for (const e of f.errores) console.log(`    ERROR  ${e}`);
    }
    for (const e of r.conjunto.errores) console.log(`  CONJUNTO  ${e}`);
    process.exit(r.nErrores ? 1 : 0);
  }
}
