#!/usr/bin/env node
/* ============================================================
   importar.mjs — mete la biblioteca construida en Supabase.

   Antes de escribir nada:
     · pasa el LINTER y se niega si hay un solo error
     · comprueba que la clave es de servicio (misma guarda que purga)
     · resuelve el autor real, porque exercises.created_by apunta a
       profiles(id) y con service_role no hay auth.uid()
     · aborta si detecta que la ficha ya está (por nombre), para que
       ejecutarlo dos veces no duplique la biblioteca entera

   Al terminar deja un MANIFIESTO con los ids insertados, que es lo
   que permite revertir la tanda de un comando sin tocar nada más.

     node tools/biblioteca/importar.mjs             → ensayo, no escribe
     node tools/biblioteca/importar.mjs --confirmar → importa de verdad
     node tools/biblioteca/importar.mjs --revertir <manifiesto.json>

   Y para AÑADIR una tanda nueva sin tocar lo que ya está (que es como
   crece la biblioteca, de once en once):
     node tools/biblioteca/importar.mjs --solo-nuevas             → ensayo
     node tools/biblioteca/importar.mjs --solo-nuevas --confirmar → escribe

   Y para corregir fichas YA importadas (una animación mal, una errata):
     node tools/biblioteca/importar.mjs --actualizar             → ensayo
     node tools/biblioteca/importar.mjs --actualizar --confirmar → escribe

   Actualizar casa por NOMBRE y hace PATCH: conserva el id de cada
   ejercicio, y con él los bloques de sesión que ya lo referencian.
   Borrar y reimportar sería más simple y rompería los planes hechos.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { biblioteca } from './construir.mjs';
import { lint } from './lint.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const DIR_MANIFIESTOS = join(AQUI, 'manifiestos');
const URL_BASE = 'https://tsskjoewviqixnwonpkx.supabase.co';
const LOTE = 20;   // las fichas llevan animación jsonb: lotes cortos

/* ---- clave ------------------------------------------------------ */

function claveDeServicio() {
  if (process.env.SUPABASE_SERVICE_ROLE) return process.env.SUPABASE_SERVICE_ROLE.trim();
  const env = join(RAIZ, '.env');
  if (existsSync(env)) {
    for (const linea of readFileSync(env, 'utf8').split(/\r?\n/)) {
      const m = linea.match(/^\s*SUPABASE_SERVICE_ROLE\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, '');
    }
  }
  return null;
}

function esDeServicio(k) {
  if (!k) return false;
  if (k.startsWith('sb_secret_')) return true;
  if (k.startsWith('sb_publishable_')) return false;
  const p = k.split('.');
  if (p.length !== 3) return false;
  try { return JSON.parse(Buffer.from(p[1], 'base64').toString('utf8')).role === 'service_role'; }
  catch { return false; }
}

const CLAVE = claveDeServicio();
if (!esDeServicio(CLAVE)) {
  console.error('\nFalta la clave de servicio en .env, o la que hay no lo es.');
  console.error('Con una clave pública el insert fallaría por RLS.\n');
  process.exit(1);
}

const CABECERAS = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' };

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...opciones, headers: { ...CABECERAS, ...(opciones.headers || {}) } });
  if (!r.ok) throw new Error(`${opciones.method || 'GET'} ${ruta} → ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return r;
}

/* ---- revertir --------------------------------------------------- */

const iRev = process.argv.indexOf('--revertir');
if (iRev >= 0) {
  const ruta = process.argv[iRev + 1];
  if (!ruta) { console.error('Falta la ruta del manifiesto.'); process.exit(1); }
  const man = JSON.parse(readFileSync(ruta, 'utf8'));
  console.log(`\nRevirtiendo ${man.ids.length} fichas de ${man.generado}…`);
  for (let i = 0; i < man.ids.length; i += LOTE) {
    const trozo = man.ids.slice(i, i + LOTE);
    await pedir(`exercises?id=in.(${trozo.join(',')})`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  }
  console.log('Hecho. La biblioteca vuelve a estar como antes de esa importación.\n');
  process.exit(0);
}

/* ---- 1 · construir y revisar ------------------------------------ */

console.log('\n─── Revisión previa ──────────────────────────────────\n');

const fichas = biblioteca();
const r = lint(fichas);
console.log(`  ${fichas.length} fichas · ${r.nErrores} error(es) · ${r.nAvisos} aviso(s)`);

if (r.nErrores) {
  console.error('\n  No se importa nada con errores. Corrígelos y vuelve a intentarlo:\n');
  for (const f of r.porFicha) for (const e of f.errores) console.error(`    ${f.nombre}: ${e}`);
  for (const e of r.conjunto.errores) console.error(`    CONJUNTO: ${e}`);
  process.exit(1);
}

/* Campos que se escriben, en un solo sitio: los usan el alta y la
   actualización, y si divergen la corrección deja fichas a medias. */
const CAMPOS = [
  'type', 'category', 'difficulty', 'intensidad', 'duration_min', 'duration_max',
  'description', 'tags', 'animacion', 'tipo_pista', 'categoria_rama',
  'categoria_nivel', 'objetivos', 'descripcion_texto', 'variantes', 'notas',
  'requisitos', 'autor_nombre', 'marco',
];

/* En qué dibujo de pista están las coordenadas que salen de las tandas.
   Va como constante y no como campo de la ficha porque no es algo que
   cada ficha decida: lo decide el repositorio entero, y las tandas ya
   están selladas como marco 3 (tools/biblioteca/marco-comun.mjs).

   Escribirlo importa: `migrar-marco-3-base.mjs` solo convierte filas en
   marco 2. Si el importador dejara el marco viejo, esa herramienta
   volvería a aplicar el mapa encima de coordenadas ya convertidas y las
   movería el doble. La columna la trae la migración 038. */
const MARCO_ACTUAL = 3;

/* `?? null` y no `f[k]` a secas: JSON.stringify BORRA las claves con
   valor undefined, así que un campo que la ficha ya no tiene no viajaba
   en el PATCH y se quedaba con su valor viejo en la base para siempre.
   Se veía como una actualización que decía "97 con cambios" una y otra
   vez después de haber escrito — el actualizador no podía VACIAR nada.
   Salió al mover el contenido de `variantes` a `requisitos.niveles`. */
const contenidoDe = (f) => Object.fromEntries(
  CAMPOS.map((k) => [k, k === 'marco' ? MARCO_ACTUAL : (f[k] ?? null)]));

/* Comparación estable para saber qué ha cambiado de verdad.
   PostgreSQL guarda `jsonb` con las claves REORDENADAS (las suyas, no
   las nuestras), así que un JSON.stringify a pelo dice que las 97
   fichas han cambiado siempre y la actualización deja de informar de
   nada. Se ordenan las claves recursivamente antes de comparar; los
   arrays conservan su orden, que en una animación sí significa algo. */
function estable(v) {
  if (Array.isArray(v)) return v.map(estable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, estable(v[k])]));
  }
  return v;
}
const igual = (a, b) => JSON.stringify(estable(a ?? null)) === JSON.stringify(estable(b ?? null));

/* ---- 2 bis · actualizar fichas ya importadas ---------------------
   Casa por NOMBRE y hace PATCH campo a campo. El id se conserva, y con
   él los bloques de sesión que ya apuntan a ese ejercicio: borrar y
   reimportar sería más corto y dejaría los planes hechos apuntando a
   ejercicios que ya no existen.

   No toca `favorito` ni `is_archived`: son decisiones del entrenador
   sobre SU biblioteca, no contenido de la ficha. */

if (process.argv.includes('--actualizar')) {
  const escribir = process.argv.includes('--confirmar');
  /* `marco` entró en CAMPOS con la migración 038. Sin ella, PostgREST
     rechaza el SELECT entero y Node escupe su volcado, que no le dice
     a nadie qué hacer. Se traduce. */
  let enBase;
  try {
    enBase = await (await pedir(`exercises?select=id,name,${CAMPOS.join(',')}`)).json();
  } catch (e) {
    if (/marco/.test(e.message)) {
      console.error('\n  Falta la migración 038 (exercises.marco). Aplícala en Supabase antes de esto.\n');
      /* Hay que PARAR aquí. Sin el corte, la ejecución seguía hacia la
         ruta de ALTA de más abajo y acababa diciendo «204 fichas ya
         existen, importar duplicaría la biblioteca» — un susto y un
         camino que no tenía nada que ver con lo que se pidió.

         El respiro antes de salir no es superstición: `process.exit()`
         con el socket de la petición todavía cerrándose hace que libuv
         suelte un «Assertion failed» de su cocina justo debajo del
         mensaje, y lo último que se lee deja de ser la frase útil. */
      await new Promise((r) => setTimeout(r, 120));
      process.exit(1);
    }
    throw e;
  }
  {
  const porNombre = new Map(enBase.map((e) => [e.name, e]));

  const cambian = [];
  const nuevas = [];
  for (const f of fichas) {
    const fila = porNombre.get(f.name);
    if (!fila) { nuevas.push(f.name); continue; }
    const nuevo = contenidoDe(f);
    const distintos = CAMPOS.filter((k) => !igual(nuevo[k], fila[k]));
    if (distintos.length) cambian.push({ id: fila.id, nombre: f.name, distintos, nuevo });
  }

  console.log(`\n─── Actualización ────────────────────────────────────\n`);
  console.log(`  ${enBase.length} en la base · ${cambian.length} con cambios · ${fichas.length - cambian.length - nuevas.length} idénticas`);
  if (nuevas.length) {
    console.log(`\n  ${nuevas.length} ficha(s) NO están en la base (usa --solo-nuevas --confirmar para darlas de alta):`);
    for (const n of nuevas.slice(0, 10)) console.log(`    · ${n}`);
  }
  if (cambian.length) {
    console.log('\n  Cambian:');
    for (const c of cambian) console.log(`    · ${c.nombre.padEnd(38)} ${c.distintos.join(', ')}`);
  }

  if (!escribir) {
    console.log('\n  Ensayo: no se ha escrito nada. Para aplicarlo:\n');
    console.log('      node tools/biblioteca/importar.mjs --actualizar --confirmar\n');
    process.exit(0);
  }
  if (!cambian.length) { console.log('\n  Nada que actualizar.\n'); process.exit(0); }

  let hechas = 0;
  for (const c of cambian) {
    await pedir(`exercises?id=eq.${c.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(c.nuevo),
    });
    hechas++;
    if (hechas % 10 === 0 || hechas === cambian.length) console.log(`  ${hechas}/${cambian.length}`);
  }
  console.log(`\n  ${hechas} ficha(s) actualizadas, con sus ids intactos.\n`);
  process.exit(0);
  }   // fin de «la 038 está puesta»
}

/* ---- 2 · autor --------------------------------------------------
   `exercises.created_by` apunta a profiles(id). Con service_role no
   hay auth.uid(), así que hay que decir explícitamente de quién son.
   Se coge el perfil más antiguo, que es el del entrenador que montó
   el proyecto; si hay varios, se puede fijar con --autor <uuid>. */

const iAutor = process.argv.indexOf('--autor');
let autor = iAutor >= 0 ? process.argv[iAutor + 1] : null;

if (!autor) {
  const perfiles = await (await pedir('profiles?select=id,full_name,created_at&order=created_at.asc&limit=5')).json();
  if (!perfiles.length) {
    console.error('\n  No hay ningún perfil en la base: no se puede asignar autoría.\n');
    process.exit(1);
  }
  autor = perfiles[0].id;
  console.log(`  Autor: ${perfiles[0].full_name || '(sin nombre)'} · ${autor}`);
  if (perfiles.length > 1) console.log(`  (hay ${perfiles.length} perfiles; usa --autor <uuid> para elegir otro)`);
}

/* ---- 3 · ¿ya están? --------------------------------------------- */

const existentes = await (await pedir('exercises?select=name')).json();
const yaEstan = new Set(existentes.map((e) => e.name));
const repetidas = fichas.filter((f) => yaEstan.has(f.name));

console.log(`  En la base hay ya ${existentes.length} ejercicio(s)`);

/* `--solo-nuevas`: da de alta las que faltan y no toca las que ya
   están. Es el modo de seguir escribiendo tandas: la biblioteca crece
   en tandas de diez u once fichas, y sin esto la única salida era
   purgar las 97 y reimportarlo todo — perdiendo los ids y, con ellos,
   los bloques de sesión que ya apuntan a esos ejercicios.

   Sigue dejando manifiesto, así que una tanda recién dada de alta se
   revierte igual con --revertir. Para CORREGIR fichas que ya están,
   sigue siendo --actualizar. */
const soloNuevas = process.argv.includes('--solo-nuevas');
if (soloNuevas && repetidas.length) {
  const antes = fichas.length;
  const nuevas = fichas.filter((f) => !yaEstan.has(f.name));
  fichas.length = 0;
  fichas.push(...nuevas);
  console.log(`  ${repetidas.length} ya estaban y no se tocan · ${fichas.length} de ${antes} son nuevas`);
  if (!fichas.length) { console.log('\n  Nada nuevo que dar de alta.\n'); process.exit(0); }
}

if (!soloNuevas && repetidas.length) {
  console.error(`\n  ${repetidas.length} ficha(s) YA existen por nombre. Importar duplicaría la biblioteca.`);
  console.error('  Purga primero, o borra esas fichas a mano:\n');
  for (const f of repetidas.slice(0, 10)) console.error(`    · ${f.name}`);
  if (repetidas.length > 10) console.error(`    · … y ${repetidas.length - 10} más`);
  console.error('');
  process.exit(1);
}

/* ---- 4 · filas --------------------------------------------------
   `description` es lo que enseña la tarjeta de la biblioteca Y lo que
   puntúa el motor de sugerencias, así que se escribe explícita en vez
   de derivarla. `category` lleva el BLOQUE DE CONTENIDO, no la rama:
   es lo que el filtro de la biblioteca espera de verdad. */

const filas = fichas.map((f) => ({
  name: f.name,
  ...contenidoDe(f),
  created_by: autor,
  favorito: false,
  is_archived: false,
}));

if (!process.argv.includes('--confirmar')) {
  console.log('\n─── Ensayo: no se ha escrito nada ────────────────────\n');
  console.log(`  ${filas.length} fichas listas para importar.`);
  console.log('  Para importar de verdad:\n');
  // el mismo comando que se acaba de lanzar, más --confirmar: sin el
  // --solo-nuevas el alta abortaría por nombres repetidos, y copiar la
  // línea de aquí es justo lo que se hace
  console.log(`      node tools/biblioteca/importar.mjs${soloNuevas ? ' --solo-nuevas' : ''} --confirmar\n`);
  process.exit(0);
}

/* ---- 5 · importar ------------------------------------------------ */

console.log('\n─── Importando ───────────────────────────────────────\n');

const ids = [];
for (let i = 0; i < filas.length; i += LOTE) {
  const trozo = filas.slice(i, i + LOTE);
  const res = await pedir('exercises?select=id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(trozo),
  });
  const creadas = await res.json();
  ids.push(...creadas.map((x) => x.id));
  console.log(`  ${ids.length}/${filas.length}`);
}

mkdirSync(DIR_MANIFIESTOS, { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
const manifiesto = join(DIR_MANIFIESTOS, `import-${sello}.json`);
writeFileSync(manifiesto, JSON.stringify({ generado: new Date().toISOString(), autor, total: ids.length, ids }, null, 2), 'utf8');

console.log(`\n  ${ids.length} fichas importadas.`);
console.log(`  Manifiesto: ${manifiesto}`);
console.log('\n  Para deshacer esta importación entera:');
console.log(`      node tools/biblioteca/importar.mjs --revertir "${manifiesto}"\n`);
