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
if (repetidas.length) {
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
  type: f.type,
  category: f.category,
  difficulty: f.difficulty,
  intensidad: f.intensidad,
  duration_min: f.duration_min,
  duration_max: f.duration_max,
  description: f.description,
  tags: f.tags,
  created_by: autor,
  animacion: f.animacion,
  tipo_pista: f.tipo_pista,
  categoria_rama: f.categoria_rama,
  categoria_nivel: f.categoria_nivel,
  objetivos: f.objetivos,
  descripcion_texto: f.descripcion_texto,
  variantes: f.variantes,
  notas: f.notas,
  requisitos: f.requisitos,
  autor_nombre: f.autor_nombre,
  favorito: false,
  is_archived: false,
}));

if (!process.argv.includes('--confirmar')) {
  console.log('\n─── Ensayo: no se ha escrito nada ────────────────────\n');
  console.log(`  ${filas.length} fichas listas para importar.`);
  console.log('  Para importar de verdad:\n');
  console.log('      node tools/biblioteca/importar.mjs --confirmar\n');
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
