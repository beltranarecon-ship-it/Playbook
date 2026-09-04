/* ============================================================
   eval-columnas-avisos.mjs — que la función programada de avisos NO
   pida columnas que no existen.

     node tools/eval-columnas-avisos.mjs

   ── POR QUÉ EXISTE ESTE BANCO ───────────────────────────────
   Porque ya pasó, y estuvo pasando meses sin que nadie lo viera.

   `netlify/functions/avisos.mjs` pedía `sessions.arranque`, una columna
   que NUNCA existió: el arranque vivía solo en el navegador, a
   propósito. Postgres, ante una columna desconocida, no la descarta —
   rechaza la consulta ENTERA—, y la función hacía `(sesionesR.data ||
   [])`, así que el error se convertía en «no hay sesiones» y el
   generador decidía cada diez minutos que no tocaba avisar de nada.
   Cuatro de los seis avisos no salieron nunca, sin una sola señal.

   El banco de `avisos.js` estaba en verde todo ese tiempo, y con razón:
   prueba al que DECIDE, alimentándolo con datos de mentira. Lo que no
   probaba nadie era la consulta que trae esos datos.

   Esto es lo que faltaba: leer los `select(...)` de la función y
   comprobar, contra las migraciones, que cada columna que pide existe.
   No hace falta base de datos ni red — las migraciones son el esquema.
   ============================================================ */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

/* ── El esquema, sacado de las migraciones ─────────────────── */

const sql = readdirSync(join(raiz, 'supabase/migrations'))
  .filter((f) => /^\d+_.*\.sql$/.test(f))
  .sort()
  .map((f) => readFileSync(join(raiz, 'supabase/migrations', f), 'utf8'))
  .join('\n');

/**
 * Las columnas de una tabla, juntando su CREATE TABLE y todos los
 * ALTER ... ADD COLUMN que le caigan después.
 *
 * No es un analizador de SQL y no pretende serlo: solo tiene que
 * responder «¿aparece esta columna en algún sitio de esta tabla?», y
 * para eso basta. Lo que se busca es la columna INVENTADA, y una
 * inventada no aparece en ninguna parte.
 */
function columnasDe(tabla) {
  const cols = new Set();

  const crea = new RegExp(
    `CREATE TABLE (?:IF NOT EXISTS )?public\\.${tabla}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i');
  const mCrea = crea.exec(sql);
  if (mCrea) {
    for (const linea of mCrea[1].split('\n')) {
      const limpia = linea.trim().replace(/--.*$/, '');
      const m = /^([a-z_][a-z0-9_]*)\s+/i.exec(limpia);
      if (!m) continue;
      const p = m[1].toUpperCase();
      if (['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK', 'EXCLUDE'].includes(p)) continue;
      cols.add(m[1]);
    }
  }

  const alter = new RegExp(
    `ALTER TABLE (?:ONLY )?public\\.${tabla}\\b([\\s\\S]*?);`, 'gi');
  let mAlt;
  while ((mAlt = alter.exec(sql)) !== null) {
    const add = /ADD COLUMN (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)/gi;
    let mCol;
    while ((mCol = add.exec(mAlt[1])) !== null) cols.add(mCol[1]);
  }
  return cols;
}

/* ── Lo que la función pide ────────────────────────────────── */

const fuente = readFileSync(join(raiz, 'netlify/functions/avisos.mjs'), 'utf8');

/** Cada `sb.from('tabla').select('a, b, c')` de la función. */
function consultasDe(texto) {
  const out = [];
  const re = /\.from\('([a-z_]+)'\)\s*\.select\('([^']*)'\)/g;
  let m;
  while ((m = re.exec(texto)) !== null) {
    const [, tabla, lista] = m;
    /* Los embeds —`team_coaches(coach_id)`— son otra tabla y se
       comprueban aparte: aquí se quitan para no confundir el nombre de
       la relación con una columna. */
    const sinEmbeds = lista.replace(/[a-z_]+\s*\([^)]*\)/g, '');
    const cols = sinEmbeds.split(',').map((c) => c.trim()).filter(Boolean);
    const embeds = [...lista.matchAll(/([a-z_]+)\s*\(([^)]*)\)/g)]
      .map((e) => ({ tabla: e[1], cols: e[2].split(',').map((c) => c.trim()).filter(Boolean) }));
    out.push({ tabla, cols, embeds });
  }
  return out;
}

const consultas = consultasDe(fuente);

/* ── Las pruebas ───────────────────────────────────────────── */

console.log('\n· se leen las consultas de la función');

test('la función hace las consultas que se esperan', () => {
  ok(consultas.length >= 4, `solo se han leído ${consultas.length} consultas`);
  for (const t of ['teams', 'sessions', 'matches', 'session_blocks']) {
    ok(consultas.some((c) => c.tabla === t), `no se ha encontrado la consulta a ${t}`);
  }
});

test('el lector de migraciones encuentra columnas de verdad', () => {
  /* Si esto fallara, todo lo de abajo pasaría por vacío y el banco
     diría que sí a cualquier cosa. */
  const s = columnasDe('sessions');
  for (const c of ['id', 'team_id', 'fecha', 'hora_inicio', 'estado', 'evaluada_at']) {
    ok(s.has(c), `no encuentra sessions.${c}, que existe desde la 010`);
  }
  ok(columnasDe('teams').has('name'), 'no encuentra teams.name');
});

test('y NO se inventa las que no están', () => {
  ok(!columnasDe('sessions').has('columna_que_no_existe'), 'dice que sí a cualquier cosa');
});

console.log('\n· cada columna que pide la función existe');

for (const c of consultas) {
  test(`${c.tabla}: ${c.cols.length} columna(s)`, () => {
    const hay = columnasDe(c.tabla);
    ok(hay.size > 0, `no se ha encontrado la tabla ${c.tabla} en las migraciones`);
    const faltan = c.cols.filter((col) => !hay.has(col));
    ok(!faltan.length,
      `${c.tabla} no tiene: ${faltan.join(', ')}. La consulta ENTERA falla, `
      + 'no solo esa columna, y la función se queda sin datos en silencio.');
  });

  for (const e of c.embeds) {
    test(`${c.tabla} → ${e.tabla}: ${e.cols.length} columna(s)`, () => {
      const hay = columnasDe(e.tabla);
      ok(hay.size > 0, `no se ha encontrado la tabla ${e.tabla} en las migraciones`);
      const faltan = e.cols.filter((col) => !hay.has(col));
      ok(!faltan.length, `${e.tabla} no tiene: ${faltan.join(', ')}`);
    });
  }
}

console.log('\n· y el error no se puede volver a tragar');

test('la función mira si alguna consulta ha fallado', () => {
  /* El `|| []` por sí solo no es el problema: el problema era que NADIE
     miraba `.error`. Sin esta comprobación, la próxima columna
     inventada vuelve a costar meses. */
  ok(/\.error/.test(fuente), 'la función no mira el error de ninguna consulta');
  ok(/rotas|consultas que fallan/.test(fuente),
    'no se ve el corte por consulta rota: un fallo volvería a pasar por «no hay nada que avisar»');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
