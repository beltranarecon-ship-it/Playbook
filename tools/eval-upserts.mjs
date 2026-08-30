/* ============================================================
   eval-upserts.mjs — que cada `onConflict` tenga un índice al que
   apuntar. Sin red, sin base de datos: se leen los .js y los .sql.

     node tools/eval-upserts.mjs

   ── POR QUÉ EXISTE ──────────────────────────────────────────
   Este fallo ha salido TRES veces, y siempre igual: alguien escribe

     .upsert(filas, { onConflict: 'a,b' })

   contra una tabla cuyo índice único no es sobre esas columnas
   peladas, sino PARCIAL o sobre una EXPRESIÓN. PostgreSQL entonces
   contesta

     «there is no unique or exclusion constraint matching the
      ON CONFLICT specification»

   y lo hace SIEMPRE, no de vez en cuando. La función sale muerta.

     · la reflexión de la sesión (027 → arreglado en la 036): dos
       índices PARCIALES, uno por rama del player_id. No se guardó una
       sola reflexión durante semanas y nadie lo supo hasta que alguien
       leyó el error en un móvil.
     · la invitación por correo (032 → arreglado en la 039): índice
       sobre `lower(trim(email))`. Se detectó antes de desplegar, de
       milagro.

   Lo que tienen en común: el índice está BIEN —protege lo que tiene que
   proteger— y aun así el upsert no puede apuntarle. No es un error de
   SQL que salte al aplicar la migración; solo se ve al ejecutar la
   consulta, en producción, con datos de verdad.

   ── QUÉ HACE ────────────────────────────────────────────────
   Reproduce, migración a migración y en orden, qué índices únicos y
   qué restricciones quedan sobre cada tabla —creando, y también
   BORRANDO, que es lo que hacen la 036 y la 039—. Después busca cada
   upsert del código y comprueba que sus columnas casen con alguno que
   sea utilizable: ni parcial ni de expresión.

   No sustituye a la base de datos: es un modelo. Pero un modelo que
   pilla el único fallo que esta familia produce, y lo pilla sin
   levantar nada.
   ============================================================ */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRACIONES = join(RAIZ, 'supabase', 'migrations');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ── 1. Qué índices dejan las migraciones ──────────────────── */

/** ¿La lista de columnas son identificadores pelados? */
const columnas = (txt) => txt.split(',').map((c) => c.trim().replace(/"/g, ''));
const esExpresion = (cols) => cols.some((c) => !/^[a-z_][a-z0-9_]*$/i.test(c));

/**
 * Recorre las migraciones EN ORDEN y devuelve, por tabla, los índices
 * únicos y restricciones que quedan vivos al final.
 * @returns Map<tabla, Array<{nombre, cols, parcial, expresion, tipo}>>
 */
export function indicesTrasMigrar(dir = MIGRACIONES) {
  const ficheros = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
  /** nombre del índice → { tabla, ... } ; los sin nombre van con una clave sintética */
  const vivos = new Map();
  let anonimo = 0;

  for (const f of ficheros) {
    /* Los comentarios se borran ANTES de nada: casi todas estas
       migraciones explican en prosa el índice que van a crear, y a
       veces citan el SQL de otro. Sin quitarlos, el modelo se cree que
       existen índices que solo están contados. */
    const sql = readFileSync(join(dir, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/--[^\n]*/g, ' ');

    // CREATE UNIQUE INDEX [IF NOT EXISTS] nombre ON public.tabla (cols) [NULLS NOT DISTINCT] [WHERE …]
    const rxIdx = /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z0-9_]+)\s+ON\s+(?:public\.)?([a-z0-9_]+)\s*\(([^)]*(?:\([^)]*\)[^)]*)*)\)([^;]*)/gi;
    for (const m of sql.matchAll(rxIdx)) {
      const [, nombre, tabla, cols, cola] = m;
      const lista = columnas(cols);
      vivos.set(nombre, {
        tabla, nombre, cols: lista,
        parcial: /\bWHERE\b/i.test(cola),
        expresion: esExpresion(lista),
        tipo: 'índice único',
      });
    }

    // DROP INDEX [IF EXISTS] public.nombre
    for (const m of sql.matchAll(/DROP\s+INDEX\s+(?:IF\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)/gi)) {
      vivos.delete(m[1]);
    }

    // ALTER TABLE … ADD CONSTRAINT nombre UNIQUE (cols)
    const rxCons = /ALTER\s+TABLE\s+(?:public\.)?([a-z0-9_]+)[\s\S]{0,80}?ADD\s+CONSTRAINT\s+([a-z0-9_]+)\s+UNIQUE\s*\(([^)]*)\)/gi;
    for (const m of sql.matchAll(rxCons)) {
      const [, tabla, nombre, cols] = m;
      const lista = columnas(cols);
      vivos.set(nombre, { tabla, nombre, cols: lista, parcial: false, expresion: esExpresion(lista), tipo: 'restricción UNIQUE' });
    }
    for (const m of sql.matchAll(/DROP\s+CONSTRAINT\s+(?:IF\s+EXISTS\s+)?([a-z0-9_]+)/gi)) {
      vivos.delete(m[1]);
    }

    // dentro de CREATE TABLE: PRIMARY KEY (…) y UNIQUE (…)
    const rxTabla = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-z0-9_]+)\s*\(([\s\S]*?)\n\s*\);/gi;
    for (const m of sql.matchAll(rxTabla)) {
      const [, tabla, cuerpo] = m;
      for (const c of cuerpo.matchAll(/\b(PRIMARY\s+KEY|UNIQUE)\s*\(([^)]*)\)/gi)) {
        const lista = columnas(c[2]);
        const clave = `${tabla}__${lista.join('_')}__${anonimo++}`;
        vivos.set(clave, {
          tabla, nombre: clave, cols: lista, parcial: false, expresion: esExpresion(lista),
          tipo: /PRIMARY/i.test(c[1]) ? 'clave primaria' : 'UNIQUE de tabla',
        });
      }
      // y las columnas declaradas `x uuid PRIMARY KEY` (una sola columna)
      for (const c of cuerpo.matchAll(/^\s*([a-z0-9_]+)\s+[a-z][a-z0-9 ()]*\s+PRIMARY\s+KEY/gim)) {
        const clave = `${tabla}__${c[1]}__${anonimo++}`;
        vivos.set(clave, { tabla, nombre: clave, cols: [c[1]], parcial: false, expresion: false, tipo: 'clave primaria' });
      }
      // y `x text ... UNIQUE` en la propia columna
      for (const c of cuerpo.matchAll(/^\s*([a-z0-9_]+)\s+[a-z][a-z0-9 ()]*\s+[^,\n]*\bUNIQUE\b/gim)) {
        const clave = `${tabla}__${c[1]}__${anonimo++}`;
        vivos.set(clave, { tabla, nombre: clave, cols: [c[1]], parcial: false, expresion: false, tipo: 'UNIQUE de columna' });
      }
    }
  }

  const porTabla = new Map();
  for (const i of vivos.values()) {
    if (!porTabla.has(i.tabla)) porTabla.set(i.tabla, []);
    porTabla.get(i.tabla).push(i);
  }
  return porTabla;
}

/* ── 2. Qué upserts hay en el código ───────────────────────── */

const CARPETAS = ['js', 'equipos/js', 'taller/js', 'netlify/functions'];

function jsDe(dir, out = []) {
  let entradas;
  try { entradas = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entradas) {
    const p = join(dir, e.name);
    if (e.isDirectory()) jsDe(p, out);
    else if (/\.m?js$/.test(e.name)) out.push(p);
  }
  return out;
}

/* Los comentarios se borran conservando los saltos de línea, para no
   perder la numeración. Sin esto, un comentario que EXPLIQUE un
   onConflict cuenta como uno de verdad — y como el `.from` más cercano
   por detrás es el de otra consulta, el banco denuncia una tabla que no
   tiene nada que ver. Pasó al documentar este mismo arreglo. */
const sinComentarios = (txt) => txt
  .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
  .replace(/(^|[^:])\/\/[^\n]*/g, (t, p) => p + ' '.repeat(t.length - p.length));

/** Todos los `.from('tabla')….upsert(…, { onConflict: 'a,b' })` del código. */
export function upsertsDelCodigo(raiz = RAIZ) {
  const encontrados = [];
  for (const carpeta of CARPETAS) {
    for (const ruta of jsDe(join(raiz, carpeta))) {
      const txt = sinComentarios(readFileSync(ruta, 'utf8'));
      /* Se busca el onConflict y se retrocede hasta el `.from('…')` más
         cercano por detrás: en este código la cadena siempre va junta,
         y así no hay que entender JavaScript para leerla. */
      for (const m of txt.matchAll(/onConflict:\s*'([^']+)'/g)) {
        const antes = txt.slice(0, m.index);
        const from = [...antes.matchAll(/\.from\(\s*['"`]([a-z0-9_]+)['"`]\s*\)/g)].pop();
        encontrados.push({
          fichero: relative(raiz, ruta).replace(/\\/g, '/'),
          linea: antes.split('\n').length,
          tabla: from ? from[1] : null,
          cols: m[1].split(',').map((c) => c.trim()),
        });
      }
    }
  }
  return encontrados;
}

/* ── 3. Las pruebas ────────────────────────────────────────── */

const mismasCols = (a, b) => a.length === b.length
  && [...a].sort().join(',') === [...b].sort().join(',');

const INDICES = indicesTrasMigrar();
const UPSERTS = upsertsDelCodigo();

console.log('\n· se encuentra lo que hay que mirar');

test('el modelo lee índices de las migraciones', () => {
  const total = [...INDICES.values()].flat().length;
  ok(total >= 20, `solo ${total} índices; ¿ha cambiado el formato del SQL?`);
});

test('se encuentran los upserts del código', () => {
  ok(UPSERTS.length >= 6, `solo ${UPSERTS.length} upserts con onConflict`);
  ok(UPSERTS.every((u) => u.tabla), 'algún upsert sin tabla:\n      '
    + UPSERTS.filter((u) => !u.tabla).map((u) => `${u.fichero}:${u.linea}`).join('\n      '));
});

console.log('\n· cada onConflict tiene un índice al que apuntar');

test('todos casan con un índice USABLE de su tabla', () => {
  /* La prueba que habría ahorrado semanas de reflexiones perdidas. */
  const malos = [];
  for (const u of UPSERTS) {
    const deLaTabla = INDICES.get(u.tabla) || [];
    const casan = deLaTabla.filter((i) => mismasCols(i.cols, u.cols));
    const usables = casan.filter((i) => !i.parcial && !i.expresion);
    if (usables.length) continue;

    const porque = casan.length
      ? casan.map((i) => `${i.nombre} es ${i.parcial ? 'PARCIAL' : 'de EXPRESIÓN'}`).join('; ')
      : `no hay ningún índice único sobre (${u.cols.join(', ')})`;
    malos.push(`${u.fichero}:${u.linea}  ${u.tabla}(${u.cols.join(',')}) → ${porque}`);
  }
  ok(malos.length === 0,
    'estos upserts fallarían SIEMPRE con «no unique or exclusion constraint '
    + 'matching the ON CONFLICT specification»:\n      ' + malos.join('\n      '));
});

console.log('\n· el modelo distingue lo que tiene que distinguir');

test('reconoce un índice parcial como no usable', () => {
  /* El caso de la 027: dos índices parciales, uno por rama. */
  const todos = [...INDICES.values()].flat();
  ok(todos.some((i) => 'parcial' in i), 'el modelo no marca los parciales');
  const cols = ['session_id', 'clave_snapshot', 'player_id'];
  const ref = (INDICES.get('reflection_answers') || []).filter((i) => mismasCols(i.cols, cols));
  ok(ref.length > 0, 'no se ve el índice de reflection_answers');
  ok(ref.some((i) => !i.parcial && !i.expresion),
    'tras la 036 tiene que quedar uno usable sobre las tres columnas');
});

test('reconoce un índice de expresión como no usable', () => {
  /* El caso de la 032: lower(trim(email)) no vale para onConflict. */
  ok(esExpresion(['lower(btrim(email))']), 'no detecta una expresión');
  ok(esExpresion(['lower(trim(email))']), 'no detecta una expresión');
  ok(!esExpresion(['email']), 'toma una columna pelada por expresión');
  ok(!esExpresion(['session_id', 'player_id']), 'toma dos columnas por expresión');
});

test('un DROP INDEX se lleva el índice por delante', () => {
  /* La 036 y la 039 tiran índices. Si el modelo no lo viera, diría que
     todo está bien apoyándose en uno que ya no existe. */
  const inv = INDICES.get('invitaciones') || [];
  ok(!inv.some((i) => i.nombre === 'invitaciones_email'),
    'sigue contando el índice de expresión que la 039 borra');
  const refl = INDICES.get('reflection_answers') || [];
  ok(!refl.some((i) => i.nombre === 'reflection_answers_equipo'),
    'sigue contando un índice parcial que la 036 borra');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
