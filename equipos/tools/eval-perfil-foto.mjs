/* ============================================================
   eval-perfil-foto.mjs — banco de las reglas de la foto de perfil
   (equipos/js/data/perfil-foto-reglas.js). Sin red, sin DOM.

     node equipos/tools/eval-perfil-foto.mjs

   ── QUÉ VIGILA ──────────────────────────────────────────────
   El detector de «la 041 no está puesta». Es la pieza peligrosa, y no
   por lo que deja de hacer, sino por lo que hace de más: si se apaga
   con un error que iba de otra cosa —una sesión caducada, por
   ejemplo—, la pantalla dice «falta una migración» ante un problema
   que no tiene nada que ver, y el entrenador va a buscarlo al sitio
   equivocado. Ya pasó en esta casa con las columnas de bloques.

   Y vigila el otro lado: que los TRES caminos por los que la 041 puede
   faltar se reconozcan. El tercero, el 42501, es el que se escapa: la
   006 revocó el UPDATE de tabla sobre `profiles`, así que una columna
   nueva sin su GRANT existe, se lee, y no se puede escribir.
   ============================================================ */

import {
  TIPOS_FOTO, TOPE_FOTO, validarFoto, rutaFoto,
  falta041, faltaBucket, estadoFoto,
} from '../js/data/perfil-foto-reglas.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};

const fichero = (type, size = 1000) => ({ type, size });

/* ── 1. Qué se acepta como foto ────────────────────────────── */

console.log('\n· qué vale como foto');

test('jpeg, png y webp entran, y con su extensión', () => {
  eq(validarFoto(fichero('image/jpeg')).ext, 'jpg');
  eq(validarFoto(fichero('image/png')).ext, 'png');
  eq(validarFoto(fichero('image/webp')).ext, 'webp');
  for (const t of Object.keys(TIPOS_FOTO)) ok(validarFoto(fichero(t)).ok, t);
});

test('lo que el bucket no acepta se rechaza AQUÍ y en castellano', () => {
  /* Si pasara, el rechazo llegaría del servidor en inglés y sin decir
     qué se esperaba. */
  for (const t of ['image/gif', 'application/pdf', 'image/svg+xml', 'text/plain', '']) {
    const r = validarFoto(fichero(t));
    eq(r.ok, false, t);
    ok(/tiene que ser/.test(r.error), `${t}: mensaje raro «${r.error}»`);
    eq(r.ext, null, t);
  }
});

test('el tope es el mismo que el del bucket', () => {
  eq(TOPE_FOTO, 5 * 1024 * 1024, 'no cuadra con el file_size_limit de la 041:');
  ok(validarFoto(fichero('image/jpeg', TOPE_FOTO)).ok, 'justo en el tope debería entrar');
  const r = validarFoto(fichero('image/jpeg', TOPE_FOTO + 1));
  eq(r.ok, false);
  ok(/5 MB/.test(r.error), `mensaje sin el tamaño: «${r.error}»`);
});

test('sin fichero no revienta', () => {
  for (const v of [null, undefined]) eq(validarFoto(v).ok, false, String(v));
});

/* ── 2. La ruta ES el permiso ──────────────────────────────── */

console.log('\n· la ruta dentro del bucket');

test('la primera carpeta es el uuid del dueño', () => {
  /* `storage_owner_id` (041) saca de ahí el uuid y lo compara con
     auth.uid(). Otra forma de ruta no es un detalle de estilo: es una
     subida denegada. */
  const uid = '11111111-2222-3333-4444-555555555555';
  const r = rutaFoto(uid, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', 'jpg');
  eq(r, `${uid}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg`);
  eq(r.split('/')[0], uid, 'el uuid no está en la primera carpeta:');
});

test('sin los tres datos no se inventa una ruta', () => {
  eq(rutaFoto(null, 'u', 'jpg'), null);
  eq(rutaFoto('id', null, 'jpg'), null);
  eq(rutaFoto('id', 'u', null), null);
});

/* ── 3. Los tres «no» de la 041 ────────────────────────────── */

console.log('\n· cuándo se apaga la foto');

test('la columna que no existe (42703)', () => {
  ok(falta041({ code: '42703', message: 'column profiles.foto_path does not exist' }));
});

test('PostgREST que no la encuentra (PGRST204)', () => {
  ok(falta041({ code: 'PGRST204', message: "Could not find the 'foto_path' column of 'profiles'" }));
});

test('la columna SIN GRANT (42501) — el que se escapa', () => {
  /* La 006 revocó el UPDATE de tabla. Si la 041 se aplica sin su
     `GRANT UPDATE (foto_path)`, todo se ve bien y guardar dice que no. */
  ok(falta041({
    code: '42501',
    message: 'permission denied for column foto_path of relation profiles',
  }));
});

console.log('\n· y cuándo NO se apaga, que es lo que importa');

test('un error que NO nombra la columna no apaga nada', () => {
  /* Éste es el fallo que se quiere evitar: apagar la foto por un
     problema ajeno y mandar al entrenador a buscar una migración. */
  eq(falta041({ code: '42501', message: 'permission denied for table profiles' }), false, '42501 pelado:');
  eq(falta041({ code: '42703', message: 'column profiles.full_name does not exist' }), false, 'otra columna:');
  eq(falta041({ code: 'PGRST301', message: 'JWT expired' }), false, 'sesión caducada:');
  eq(falta041({ message: 'Failed to fetch' }), false, 'sin red:');
  eq(falta041(null), false);
  eq(falta041(undefined), false);
  eq(falta041({}), false);
});

test('el bucket que falta se reconoce, y solo él', () => {
  ok(faltaBucket({ message: 'Bucket not found' }));
  eq(faltaBucket({ message: 'Object not found' }), false, 'un fichero que no está no es el bucket:');
  eq(faltaBucket(null), false);
});

/* ── 4. «No lo sé» no es «no está» ─────────────────────────── */

console.log('\n· qué enseñar en la zona de la foto');

test('mientras se carga, no se afirma nada', () => {
  eq(estadoFoto(undefined), 'cargando');
});

test('si el perfil no se ha podido leer, NO se culpa a la migración', () => {
  /* Es la red del pabellón, no una columna que falte. Decir «falta la
     041» ahí es mentir con mucha seguridad. */
  eq(estadoFoto(null), 'sin_perfil');
});

test('perfil sin la columna = falta la migración', () => {
  eq(estadoFoto({ id: 'x', full_name: 'Ana' }), 'sin_migracion');
});

test('con la columna, aunque esté vacía, la foto funciona', () => {
  /* `foto_path: null` es «no tiene foto», que es lo normal, no «no se
     puede tener». */
  eq(estadoFoto({ id: 'x', full_name: 'Ana', foto_path: null }), 'lista');
  eq(estadoFoto({ id: 'x', full_name: 'Ana', foto_path: 'a/b.jpg' }), 'lista');
});

test('un fallo de escritura ya visto apaga la zona aunque la columna esté', () => {
  eq(estadoFoto({ id: 'x', foto_path: null }, true), 'sin_migracion');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
