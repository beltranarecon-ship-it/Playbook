#!/usr/bin/env node
/* ============================================================
   migrar-marco-3-base.mjs — convierte al marco 3 las coordenadas de
   los ejercicios que están SOLO en la base: los que creó el entrenador
   dentro de la app y no salen de las tandas.

     node tools/biblioteca/migrar-marco-3-base.mjs             → ensayo
     node tools/biblioteca/migrar-marco-3-base.mjs --confirmar → escribe

   ── POR QUÉ HACE FALTA ──────────────────────────────────────
   Las 204 fichas de la biblioteca se convirtieron en la FUENTE (las
   tandas) y vuelven a la base con `importar.mjs --actualizar`. Pero en
   la base hay más: los ejercicios que el entrenador dibujó en la app.
   Ésos no tienen fuente en el repositorio, así que hay que convertir
   su `animacion` donde está.

   Si no se hace, esas fichas se pintan desplazadas sobre el dibujo
   nuevo y no lo avisa nada.

   ── QUÉ SE TOCA ─────────────────────────────────────────────
   La regla es ESTRUCTURAL, no una lista de campos: se convierte todo
   objeto que tenga a la vez `x` e `y` numéricos. Eso cubre posiciones,
   nodos de trayectoria, pases, tiros, destinos y los tiradores del
   bezier (`handle_in`/`handle_out`, que son absolutos y van
   recortados a [0,1]: se comprobó en canvas/geometry.js).

   Una lista de campos se queda corta en cuanto alguien añade uno; la
   regla estructural, no. Y lo que NO es un par x/y —duraciones,
   `direccion_grados`, `n_jugadores`— no se toca, porque no son sitios.

   ── CÓMO SE EVITA APLICARLO DOS VECES ───────────────────────
   Por la columna `exercises.marco` (migración 038), no por un fichero
   en el portátil de nadie. Solo se convierten las filas que siguen en
   el marco 2, y al escribirlas se quedan en el 3.

   Se guarda un manifiesto con el `animacion` ANTERIOR de cada ficha
   tocada, para poder deshacerlo:

     node tools/biblioteca/migrar-marco-3-base.mjs --revertir <manifiesto.json>
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { limitesCancha } from '../../taller/js/canvas/medidas.js';
import { recta } from './marco-comun.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../..');
const MANIFIESTOS = join(AQUI, 'manifiestos');

/* ── El mapa, el mismo que el de las tandas ─────────────────── */
const ENTERA_2 = { x: [2 / 19, 17 / 19], y: [2 / 32, 30 / 32] };
const MEDIA_2 = { x: [2 / 18, 16 / 18], y: [2 / 19, 17 / 19] };
const VIEJO = {
  entera: ENTERA_2, entera_fiba: ENTERA_2,
  media: MEDIA_2, media_fiba: MEDIA_2,
};
const MAPA = Object.fromEntries(Object.keys(VIEJO).map((p) => {
  const n = limitesCancha(p);
  return [p, { x: recta(VIEJO[p].x, n.x), y: recta(VIEJO[p].y, n.y) }];
}));

const ajustar = (v) => Number(Math.min(1, Math.max(0, v)).toFixed(4));

/**
 * Convierte, en sitio, todo objeto con `x` e `y` numéricos.
 * @returns cuántos pares ha tocado
 */
function convertir(nodo, f, cuenta = { n: 0 }) {
  if (!nodo || typeof nodo !== 'object') return cuenta.n;
  if (Array.isArray(nodo)) {
    for (const v of nodo) convertir(v, f, cuenta);
    return cuenta.n;
  }
  if (typeof nodo.x === 'number' && typeof nodo.y === 'number') {
    nodo.x = ajustar(f.x(nodo.x));
    nodo.y = ajustar(f.y(nodo.y));
    cuenta.n += 1;
  }
  for (const v of Object.values(nodo)) convertir(v, f, cuenta);
  return cuenta.n;
}

/* ── Clave de servicio ───────────────────────────────────────
   Se lee de .env (que está en .gitignore) o del entorno. NUNCA se
   imprime, ni entera ni en trozos, ni siquiera al fallar. */
function claveDeServicio() {
  if (process.env.SUPABASE_SERVICE_ROLE) return process.env.SUPABASE_SERVICE_ROLE.trim();
  const env = join(RAIZ, '.env');
  if (!existsSync(env)) return null;
  for (const linea of readFileSync(env, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*SUPABASE_SERVICE_ROLE\s*=\s*(.+?)\s*$/);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

const CLAVE = claveDeServicio();
if (!CLAVE) {
  console.error('\nFalta SUPABASE_SERVICE_ROLE en .env. Con la clave pública, la RLS bloquea el UPDATE.\n');
  process.exit(1);
}
const URL_BASE = (readFileSync(join(RAIZ, 'js/config.js'), 'utf8')
  .match(/https:\/\/[a-z0-9]+\.supabase\.co/) || [])[0];
if (!URL_BASE) { console.error('\nNo se encuentra la URL de Supabase en js/config.js.\n'); process.exit(1); }

const CABECERAS = { apikey: CLAVE, Authorization: `Bearer ${CLAVE}`, 'Content-Type': 'application/json' };
async function pedir(ruta, opciones = {}) {
  const r = await fetch(`${URL_BASE}/rest/v1/${ruta}`, { ...opciones, headers: { ...CABECERAS, ...(opciones.headers || {}) } });
  if (!r.ok) throw new Error(`${opciones.method || 'GET'} ${ruta} → ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r;
}

/* ── Revertir ────────────────────────────────────────────────── */
const iRev = process.argv.indexOf('--revertir');
if (iRev >= 0) {
  const ruta = process.argv[iRev + 1];
  if (!ruta) { console.error('\nFalta el manifiesto: --revertir <fichero.json>\n'); process.exit(1); }
  const man = JSON.parse(readFileSync(ruta, 'utf8'));
  for (const f of man.fichas) {
    await pedir(`exercises?id=eq.${f.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ animacion: f.antes, marco: 2 }),
    });
    console.log(`  ← ${f.name}`);
  }
  console.log(`\n✓ ${man.fichas.length} fichas devueltas al marco 2.\n`);
  process.exit(0);
}

/* ── Main ────────────────────────────────────────────────────── */
const confirmar = process.argv.includes('--confirmar');

/* Un `process.exit()` con una petición todavía abierta hace que libuv
   suelte un «Assertion failed» de su cocina justo debajo del mensaje.
   Se marca el código de salida y se DEVUELVE: el proceso termina solo
   cuando no queda nada pendiente, y lo último que se lee es la frase
   en castellano, que es lo que hay que leer. */
async function traerPendientes() {
  try {
    return await (await pedir('exercises?select=id,name,tipo_pista,animacion,marco&marco=eq.2')).json();
  } catch (e) {
    if (/marco/.test(e.message) && /column|42703|PGRST204/i.test(e.message)) {
      console.error('\nFalta la migración 038 (exercises.marco). Aplícala en Supabase antes de esto.\n');
      process.exitCode = 1;
      return null;
    }
    throw e;
  }
}

const filas = await traerPendientes();
if (filas === null) {
  // ya se ha dicho lo que pasa; el proceso sale con 1 al vaciarse
} else {

/* Las que vienen de la biblioteca se rehacen desde la fuente con
   importar.mjs, que ya escribe marco = 3. Tocarlas aquí además sería
   hacer el mismo trabajo dos veces por dos caminos distintos. */
const deLaBiblioteca = new Set(
  JSON.parse(readFileSync(join(AQUI, 'biblioteca.json'), 'utf8')).map((f) => f.name));
const ajenas = filas.filter((f) => !deLaBiblioteca.has(f.name));

console.log('\n─── Ejercicios que solo están en la base ──────────────\n');
console.log(`  ${filas.length} en marco 2 · ${filas.length - ajenas.length} vienen de la biblioteca (las rehace importar.mjs)`);
console.log(`  ${ajenas.length} hay que convertir aquí\n`);

const tocadas = [];
let sinPista = 0;
for (const f of ajenas) {
  const pista = f.animacion?.pista || f.tipo_pista;
  const mapa = MAPA[pista];
  if (!mapa) { sinPista += 1; console.log(`  ? ${f.name.slice(0, 44).padEnd(46)} pista desconocida «${pista}», se salta`); continue; }
  const antes = f.animacion;
  const despues = JSON.parse(JSON.stringify(antes ?? {}));
  const n = convertir(despues, mapa);
  console.log(`  ${n ? '→' : '='} ${f.name.slice(0, 44).padEnd(46)} ${String(n).padStart(4)} pares x/y  (${pista})`);
  if (n) tocadas.push({ id: f.id, name: f.name, antes, despues, pares: n });
}

const pares = tocadas.reduce((s, t) => s + t.pares, 0);
console.log(`\n  ${tocadas.length} fichas · ${pares} coordenadas${sinPista ? ` · ${sinPista} saltadas` : ''}`);

if (!confirmar) {
  console.log('\n  Ensayo: no se ha escrito nada. Para aplicarlo:\n');
  console.log('      node tools/biblioteca/migrar-marco-3-base.mjs --confirmar\n');
} else {

if (!existsSync(MANIFIESTOS)) mkdirSync(MANIFIESTOS, { recursive: true });
const sello = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const manifiesto = join(MANIFIESTOS, `marco3-base-${sello}.json`);
writeFileSync(manifiesto, JSON.stringify({
  sello, total: tocadas.length,
  fichas: tocadas.map(({ id, name, antes }) => ({ id, name, antes })),
}, null, 2), 'utf8');

for (const t of tocadas) {
  await pedir(`exercises?id=eq.${t.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ animacion: t.despues, marco: 3 }),
  });
  console.log(`  ✓ ${t.name}`);
}

console.log(`\n✓ ${tocadas.length} fichas al marco 3 · para deshacerlo:`);
console.log(`      node tools/biblioteca/migrar-marco-3-base.mjs --revertir ${manifiesto}\n`);

}   // fin del --confirmar
}   // fin de «la 038 está puesta»
