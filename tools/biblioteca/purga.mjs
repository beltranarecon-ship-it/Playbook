#!/usr/bin/env node
/* ============================================================
   purga.mjs — BORRADO REAL de la biblioteca de ejercicios.

   Vacía public.exercises para partir de cero antes de importar la
   biblioteca nueva. Es IRREVERSIBLE en Supabase, así que el script
   vuelca antes una copia completa a disco: si el borrado sale mal, o
   si dentro de un mes resulta que algo era aprovechable, el material
   sigue existiendo fuera de la base de datos.

   Por qué hace falta la clave de servicio: la política RLS de DELETE
   sobre exercises (migración 001) es solo de admin. Con la clave
   anónima el borrado no da error — simplemente no borra nada, que es
   la peor forma de fallar. Con service_role se salta RLS y borra de
   verdad.

   Qué arrastra el borrado: NADA se rompe. El único FK que apunta aquí
   es session_blocks.exercise_id (013), declarado ON DELETE SET NULL.
   Los bloques de sesiones ya planificadas conservan su título — es un
   snapshot, no una lectura del ejercicio — y solo pierden el enlace a
   la ficha y a la animación. Ese impacto se cuenta y se enseña ANTES
   de tocar nada.

   Uso:
     node tools/biblioteca/purga.mjs              → inventario y copia, NO borra
     node tools/biblioteca/purga.mjs --confirmar  → borra de verdad

   La clave sale de la variable de entorno SUPABASE_SERVICE_ROLE, o de
   un fichero .env en la raíz del proyecto (que está en .gitignore).
   Nunca se escribe en disco ni se imprime.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..', '..');
const DIR_COPIAS = join(AQUI, 'copias');

const URL_BASE = 'https://tsskjoewviqixnwonpkx.supabase.co';
const PAGINA = 500;   // los ejercicios llevan póster y GIF en base64: páginas cortas

/* ---------- clave de servicio ---------------------------------- */

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

const CLAVE = claveDeServicio();
if (!CLAVE) {
  console.error(`
No hay clave de servicio.

Ponla en una variable de entorno o en un fichero .env en la raíz del
proyecto (ya está en .gitignore, no se sube a ningún sitio):

    SUPABASE_SERVICE_ROLE=eyJ...

La encuentras en Supabase → Project Settings → API → service_role.
Es una clave de administrador: no la pegues en el chat ni en el código.
`);
  process.exit(1);
}

/**
 * Comprueba que la clave es de SERVICIO antes de tocar nada.
 *
 * Sin esto el fallo es silencioso y engañoso: con la clave anónima, RLS
 * devuelve cero filas, el inventario dice "la tabla ya está vacía" y el
 * script sale con éxito. Quien se fíe da por purgada una biblioteca que
 * sigue entera, y luego importa encima. Es el mismo patrón que el DELETE
 * rechazado por RLS que tampoco da error.
 *
 * Hay dos familias de claves conviviendo en Supabase:
 *   · JWT clásico (eyJ...) — el rol viaja dentro y se puede leer.
 *   · Clave nueva — `sb_secret_...` es la de servicio y
 *     `sb_publishable_...` es la pública.
 */
function compruebaClave(k) {
  if (k.startsWith('sb_secret_')) return { ok: true, rol: 'secret key' };
  if (k.startsWith('sb_publishable_')) return { ok: false, rol: 'publishable key (pública)' };

  const partes = k.split('.');
  if (partes.length === 3) {
    try {
      const p = JSON.parse(Buffer.from(partes[1], 'base64').toString('utf8'));
      return { ok: p.role === 'service_role', rol: p.role || '(sin rol)' };
    } catch { /* no era un JWT legible */ }
  }
  return { ok: false, rol: 'formato no reconocido' };
}

const chequeo = compruebaClave(CLAVE);
if (!chequeo.ok) {
  console.error(`
Esa clave no es la de servicio: es "${chequeo.rol}".

Con ella el borrado NO funcionaría y —lo que es peor— tampoco daría
error: RLS devolvería cero filas, el inventario diría que la tabla ya
está vacía y te quedarías creyendo que se purgó algo.

La que hace falta está en Supabase → Project Settings → API, como
"service_role" (un JWT largo cuyo rol dice service_role) o como una
"secret key" que empieza por sb_secret_. Hay que pulsar Reveal.

OJO: la clave anónima y la publishable son PÚBLICAS por diseño — de
hecho una de ellas ya está en js/config.js. No sirven para esto.
`);
  process.exit(1);
}

const CABECERAS = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' };

/* ---------- utilidades de PostgREST ---------------------------- */

async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...opciones, headers: { ...CABECERAS, ...(opciones.headers || {}) } });
  if (!r.ok) {
    const cuerpo = await r.text();
    throw new Error(`${opciones.method || 'GET'} ${ruta} → ${r.status}: ${cuerpo.slice(0, 400)}`);
  }
  return r;
}

/** Cuenta exacta sin traerse las filas (Content-Range: 0-0/N). */
async function contar(tabla, filtro = '') {
  const r = await pedir(`${tabla}?select=id&limit=1${filtro}`, { headers: { Prefer: 'count=exact' } });
  const rango = r.headers.get('content-range') || '';
  const n = Number(rango.split('/')[1]);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lee TODAS las filas paginando. Igual que leerTodo() del front: se
 * avanza por las filas REALMENTE devueltas, porque el servidor puede
 * topar antes del tamaño pedido, y con un orden estable — sin él, dos
 * páginas pueden repetir u omitir filas.
 */
async function leerTodo(tabla, columnas) {
  const out = [];
  for (let desde = 0; ;) {
    const r = await pedir(`${tabla}?select=${columnas}&order=created_at.asc,id.asc&offset=${desde}&limit=${PAGINA}`);
    const filas = await r.json();
    out.push(...filas);
    if (filas.length < PAGINA) return out;
    desde += filas.length;
  }
}

/* ---------- 1 · inventario ------------------------------------- */

console.log('\n─── Inventario ───────────────────────────────────────\n');

const total = await contar('exercises');
const archivados = await contar('exercises', '&is_archived=eq.true');

if (total === 0) {
  console.log('La tabla exercises ya está vacía. No hay nada que borrar.\n');
  process.exit(0);
}

console.log(`  Ejercicios en la biblioteca ......... ${total}`);
console.log(`    de los cuales archivados .......... ${archivados}`);

/* Impacto en sesiones ya planificadas. session_blocks puede no existir
   si la migración 013 no está aplicada: eso no es un error aquí. */
let bloquesAfectados = [];
try {
  const r = await pedir('session_blocks?select=id,session_id,titulo,exercise_id&exercise_id=not.is.null&order=id.asc');
  bloquesAfectados = await r.json();
} catch {
  console.log('  (session_blocks no consultable — se omite el impacto en sesiones)');
}

if (bloquesAfectados.length) {
  const sesiones = new Set(bloquesAfectados.map((b) => b.session_id));
  console.log(`\n  Bloques de sesión que apuntan a un ejercicio ... ${bloquesAfectados.length}`);
  console.log(`  Sesiones afectadas ............................ ${sesiones.size}`);
  console.log('\n  Esos bloques CONSERVAN su título (es un snapshot) y solo');
  console.log('  pierden el enlace a la ficha y a la animación:');
  for (const b of bloquesAfectados.slice(0, 12)) console.log(`    · ${b.titulo || '(sin título)'}`);
  if (bloquesAfectados.length > 12) console.log(`    · … y ${bloquesAfectados.length - 12} más`);
} else {
  console.log('\n  Ninguna sesión planificada usa estos ejercicios.');
}

/* ---------- 2 · copia de seguridad ----------------------------- */

console.log('\n─── Copia de seguridad ───────────────────────────────\n');

const filas = await leerTodo('exercises', '*');
if (filas.length !== total) {
  console.error(`\nABORTADO: se esperaban ${total} filas y se han leído ${filas.length}.`);
  console.error('No se borra nada con una copia incompleta.\n');
  process.exit(1);
}

mkdirSync(DIR_COPIAS, { recursive: true });
const sello = new Date().toISOString().replace(/[:.]/g, '-');
const destino = join(DIR_COPIAS, `exercises-${sello}.json`);
writeFileSync(destino, JSON.stringify({
  tabla: 'exercises',
  generado: new Date().toISOString(),
  filas: filas.length,
  bloques_afectados: bloquesAfectados,
  datos: filas,
}, null, 2), 'utf8');

const mb = (Buffer.byteLength(readFileSync(destino)) / 1024 / 1024).toFixed(1);
console.log(`  ${filas.length} ejercicios guardados (${mb} MB)`);
console.log(`  ${destino}`);

/* ---------- 3 · borrado ---------------------------------------- */

const confirmado = process.argv.includes('--confirmar');

if (!confirmado) {
  console.log('\n─── No se ha borrado nada ────────────────────────────\n');
  console.log('  Esto ha sido un ensayo: inventario y copia, sin tocar la base.');
  console.log('  Para borrar de verdad, con la copia ya hecha:\n');
  console.log('      node tools/biblioteca/purga.mjs --confirmar\n');
  process.exit(0);
}

console.log('\n─── Borrado ──────────────────────────────────────────\n');

/* PostgREST exige un filtro en el DELETE: sin él responde 400 en vez de
   vaciar la tabla entera por accidente. `id=not.is.null` los coge todos. */
const r = await pedir('exercises?id=not.is.null', {
  method: 'DELETE',
  headers: { Prefer: 'return=minimal,count=exact' },
});
const borradas = Number((r.headers.get('content-range') || '').split('/')[1]);

const quedan = await contar('exercises');
console.log(`  Filas borradas ...... ${Number.isFinite(borradas) ? borradas : '(sin recuento)'}`);
console.log(`  Quedan en la tabla .. ${quedan}`);

if (quedan > 0) {
  console.error('\n  ATENCIÓN: la tabla no ha quedado vacía. Revisa la clave y la política RLS.\n');
  process.exit(1);
}

console.log(`\n  Biblioteca vacía. La copia sigue en:\n  ${destino}\n`);
