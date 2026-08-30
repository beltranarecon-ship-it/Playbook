/* ============================================================
   eval-funciones.mjs — que las funciones de servidor lleguen a
   producción con lo que necesitan para arrancar. Sin red.

     node tools/eval-funciones.mjs

   ── DE DÓNDE SALE ESTO ──────────────────────────────────────
   `netlify/functions/package.json` declaraba sus dependencias desde el
   primer día, y `netlify.toml` no tenía comando de compilación. Sin
   comando, Netlify no instala nada: las funciones se desplegaban sin
   sus paquetes y reventaban al arrancar con

     Cannot find package '@supabase/supabase-js'

   En `invitar` se ve enseguida —un 502 al pulsar Invitar—. En `avisos`
   NO SE VE: es programada, corre cada diez minutos y su fallo solo
   aparece en el registro de Netlify. Los avisos push llevaban semanas
   sin salir y no había forma de enterarse desde la app.

   Es el peor tipo de fallo que tiene este proyecto: el que no avisa. Y
   no lo pilla ningún banco de lógica, porque el código estaba bien —lo
   que faltaba era una línea de configuración.

   ── QUÉ VIGILA ──────────────────────────────────────────────
     1. Que todo paquete que importa una función esté declarado como
        dependencia suya.
     2. Que `netlify.toml` instale de verdad esas dependencias.
     3. Que lo que importan de dentro del repositorio exista y sea
        PURO — una función no puede arrastrar el cliente del navegador.
   ============================================================ */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = join(RAIZ, 'netlify', 'functions');

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

const FUNCIONES = readdirSync(DIR).filter((f) => /\.mjs$/.test(f));
const PAQUETE = JSON.parse(readFileSync(join(DIR, 'package.json'), 'utf8'));
const TOML = readFileSync(join(RAIZ, 'netlify.toml'), 'utf8');

/** Los `import … from '…'` de un fichero, sin los de comentarios. */
const importsDe = (txt) => [...txt
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, ' ')
  .matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

console.log('\n· hay funciones que mirar');

test('se encuentran las funciones y su package.json', () => {
  ok(FUNCIONES.length >= 2, `solo ${FUNCIONES.length} funciones`);
  ok(PAQUETE.dependencies && Object.keys(PAQUETE.dependencies).length,
    'el package.json de las funciones no declara dependencias');
});

console.log('\n· lo que importan, declarado');

test('todo paquete importado está en las dependencias', () => {
  const declaradas = new Set(Object.keys(PAQUETE.dependencies || {}));
  const malos = [];
  for (const f of FUNCIONES) {
    for (const imp of importsDe(readFileSync(join(DIR, f), 'utf8'))) {
      if (imp.startsWith('.') || imp.startsWith('node:')) continue;
      // '@supabase/supabase-js/algo' → '@supabase/supabase-js'
      const paquete = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0];
      if (!declaradas.has(paquete)) malos.push(`${f} importa «${paquete}», que no está declarado`);
    }
  }
  ok(malos.length === 0, malos.join('\n      '));
});

test('lo que importan del repositorio existe', () => {
  const malos = [];
  for (const f of FUNCIONES) {
    for (const imp of importsDe(readFileSync(join(DIR, f), 'utf8'))) {
      if (!imp.startsWith('.')) continue;
      const ruta = resolve(DIR, imp);
      if (!existsSync(ruta)) malos.push(`${f} importa ${imp}, que no existe`);
    }
  }
  ok(malos.length === 0, malos.join('\n      '));
});

test('no arrastran nada del navegador', () => {
  /* Una función que importe el cliente de Supabase del navegador
     arrastra `window` y revienta en el servidor. Los módulos que
     comparten con la app tienen que ser PUROS. */
  const malos = [];
  for (const f of FUNCIONES) {
    for (const imp of importsDe(readFileSync(join(DIR, f), 'utf8'))) {
      if (!imp.startsWith('.')) continue;
      const ruta = resolve(DIR, imp);
      if (!existsSync(ruta)) continue;
      const txt = readFileSync(ruta, 'utf8');
      for (const suyo of importsDe(txt)) {
        if (/_client\.js$|supabase-client\.js$/.test(suyo)) {
          malos.push(`${f} → ${imp} arrastra ${suyo}, que es del navegador`);
        }
      }
      if (/\bwindow\.|\bdocument\./.test(txt.replace(/\/\*[\s\S]*?\*\//g, ' '))) {
        malos.push(`${f} → ${imp} usa window o document`);
      }
    }
  }
  ok(malos.length === 0, malos.join('\n      '));
});

console.log('\n· y alguien las instala');

test('netlify.toml instala las dependencias de las funciones', () => {
  /* La línea que faltaba. Sin ella el código está bien, los bancos
     están verdes y en producción no arranca nada. */
  ok(/^\s*command\s*=/m.test(TOML),
    'netlify.toml no tiene comando de compilación: Netlify no instalará NADA y las '
    + 'funciones se desplegarán sin sus paquetes. En `avisos` el fallo es invisible '
    + 'porque es programada.');
  const comando = (TOML.match(/^\s*command\s*=\s*"([^"]*)"/m) || [])[1] || '';
  ok(/npm.*install/.test(comando), `el comando no instala nada: «${comando}»`);
  ok(/netlify[/\\]functions/.test(comando),
    `el comando no apunta a las funciones: «${comando}»`);
});

test('la carpeta de funciones del toml es la que existe', () => {
  const decl = (TOML.match(/^\s*functions\s*=\s*"([^"]*)"/m) || [])[1];
  ok(decl, 'netlify.toml no declara la carpeta de funciones');
  ok(existsSync(join(RAIZ, decl)), `la carpeta «${decl}» no existe`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
