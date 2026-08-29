/* ============================================================
   eval-comprobar.mjs — banco de COMPROBAR.sql.

     node tools/eval-comprobar.mjs

   ── DE DÓNDE SALE ESTO ──────────────────────────────────────
   La primera versión de COMPROBAR.sql preguntaba por dos tablas que no
   existían en ninguna migración: `rubrica_niveles` y
   `objetivos_individuales`. Nombres inventados. Como no existían, la
   comprobación decía `false` para la 024 y la 026 — y se corrieron esas
   migraciones otra vez, y otra, buscando un fallo que no estaba en la
   base sino en la pregunta.

   Una comprobación que se equivoca es peor que no tener ninguna: manda
   a arreglar lo que ya funcionaba.

   ── QUÉ VIGILA ──────────────────────────────────────────────
     1. Que todo objeto por el que pregunta COMPROBAR.sql aparezca de
        verdad en la migración a la que se le atribuye.
     2. Que no se quede ninguna migración sin comprobar — una nueva sin
        su fila entra en producción sin que nadie sepa si está puesta.

   No hace falta base de datos: se lee el SQL y se contrasta con los
   ficheros de migración, que es donde está la verdad.
   ============================================================ */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'supabase', 'migrations');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

const comprobar = readFileSync(join(DIR, 'COMPROBAR.sql'), 'utf8');

/* Los ficheros de migración, por número. */
const migracion = {};
for (const f of readdirSync(DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f))) {
  migracion[f.slice(0, 3)] = readFileSync(join(DIR, f), 'utf8');
}
const corpus = Object.values(migracion).join('\n');

/* Las filas del VALUES: ('034', 'lo que trae', 'columna', 'matches.reservas') */
const filas = [...comprobar.matchAll(/\('(\d{3})',\s*'[^']*',\s*'(\w+)',\s*'([^']+)'\)/g)]
  .map(([, mig, clase, obj]) => ({ mig, clase, obj }));

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** ¿El objeto aparece en el texto de SU migración? */
function apareceEn(texto, clase, obj) {
  switch (clase) {
    case 'tabla':
      return texto.includes(`CREATE TABLE IF NOT EXISTS public.${obj}`);
    case 'vista':
      return new RegExp(`CREATE (OR REPLACE )?VIEW public\\.${esc(obj)}\\b`).test(texto);
    case 'funcion':
      return new RegExp(`CREATE (OR REPLACE )?FUNCTION public\\.${esc(obj)}\\s*\\(`).test(texto);
    case 'indice':
      return new RegExp(`CREATE UNIQUE INDEX (IF NOT EXISTS )?${esc(obj)}\\b`).test(texto);
    case 'politica':
      return texto.includes(`"${obj}"`);
    case 'defecto': {
      /* «tabla.columna=valor»: la migración fija el valor por defecto
         de esa columna. Es la huella de una que no crea nada. */
      const [tabla, resto] = obj.split('.');
      const [col, valor] = resto.split('=');
      return new RegExp(`ALTER COLUMN ${esc(col)} SET DEFAULT ${esc(valor)}\\b`).test(texto)
        && corpus.includes(`public.${tabla}`);
    }
    case 'columna': {
      /* Una columna o se añade con ALTER, o nace dentro del CREATE TABLE. */
      const [tabla, col] = obj.split('.');
      if (new RegExp(`ADD COLUMN IF NOT EXISTS\\s+${esc(col)}\\b`).test(texto)) {
        return corpus.includes(`public.${tabla}`);
      }
      const m = texto.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${esc(tabla)}\\s*\\(([\\s\\S]*?)\\n\\);`));
      return !!m && new RegExp(`^\\s*${esc(col)}\\s`, 'm').test(m[1])
        && corpus.includes(`public.${tabla}`);
    }
    default:
      return false;
  }
}

console.log('\n· la pregunta cuadra con la migración');

test('se leen las filas del VALUES', () => {
  ok(filas.length >= 50, `solo se han leído ${filas.length} filas; ¿ha cambiado el formato?`);
});

test('todo objeto por el que se pregunta existe en SU migración', () => {
  /* Éste es el banco que habría evitado lo de `rubrica_niveles`. */
  const malos = filas.filter((f) => !apareceEn(migracion[f.mig] || '', f.clase, f.obj));
  ok(malos.length === 0,
    'inventados o mal atribuidos:\n      ' +
    malos.map((f) => `${f.mig} → ${f.clase} ${f.obj}`).join('\n      '));
});

test('las clases son las que el SQL sabe mirar', () => {
  /* Una clase con una errata cae en el ELSE del CASE y devuelve NULL:
     la migración saldría como no puesta sin haberla mirado. */
  const CONOCIDAS = new Set(['tabla', 'vista', 'columna', 'funcion', 'indice', 'politica', 'defecto']);
  const raras = [...new Set(filas.map((f) => f.clase))].filter((c) => !CONOCIDAS.has(c));
  ok(raras.length === 0, `clases que el CASE no contempla: ${raras.join(', ')}`);
});

console.log('\n· no se queda ninguna fuera');

test('todas las migraciones tienen al menos una comprobación', () => {
  const cubiertas = new Set(filas.map((f) => f.mig));
  const fuera = Object.keys(migracion).sort().filter((m) => !cubiertas.has(m));
  ok(fuera.length === 0,
    `sin comprobar: ${fuera.join(', ')}. Una migración nueva sin su fila entra `
    + 'en producción sin que nadie sepa si está puesta.');
});

test('no se pregunta por migraciones que no existen', () => {
  const fantasma = [...new Set(filas.map((f) => f.mig))].filter((m) => !migracion[m]);
  ok(fantasma.length === 0, `no hay fichero para: ${fantasma.join(', ')}`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
