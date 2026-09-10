/* ============================================================
   eval-guardar-columnas.mjs — banco Node de guardar aunque falte una
   columna nueva (taller/js/supabase/columnas.js). Sin red: la función
   que guarda es de mentira y contesta como PostgREST.

     node taller/tools/eval-guardar-columnas.mjs

   Lo que se vigila es que NUNCA SE PIERDA UN EJERCICIO porque la app
   vaya por delante de la base de datos, y a la vez que un error que no
   es de columnas no se tape reintentando a ciegas.
   ============================================================ */

import { COLUMNAS_NUEVAS, sinColumnaQueFalta, guardarSinLasQueFalten } from '../js/supabase/columnas.js';

let pasan = 0, fallan = 0;
const pendientes = [];
function test(nombre, fn) {
  pendientes.push((async () => {
    try { await fn(); pasan++; console.log(`  ✓ ${nombre}`); }
    catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
  })());
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};

/* Como contesta PostgREST cuando falta una columna. */
const faltaColumna = (c) => ({ message: `Could not find the '${c}' column of 'exercises' in the schema cache` });

/* Una base de datos de mentira: rechaza cualquier fila que traiga una
   columna que no tiene, nombrando SOLO LA PRIMERA, como PostgREST. */
function baseSin(...faltan) {
  const llamadas = [];
  const hacer = async (fila) => {
    llamadas.push(Object.keys(fila));
    const c = faltan.find((x) => x in fila);
    return c ? { data: null, error: faltaColumna(c) } : { data: { id: 'e1' }, error: null };
  };
  return { hacer, llamadas };
}
const fila = () => ({ name: 'Rueda de pases', animacion: { fases: [] }, marco: 3, jugada: { version: 3 } });

/* ── 1. Con la base al día, no se toca nada ──────────────── */

test('CON LAS COLUMNAS PUESTAS SE GUARDA A LA PRIMERA Y ENTERO', async () => {
  const b = baseSin();
  const r = await guardarSinLasQueFalten(b.hacer, fila());
  eq(r.data, { id: 'e1' });
  eq(r.quitadas, []);
  eq(b.llamadas.length, 1, 'una sola llamada:');
  ok(b.llamadas[0].includes('jugada') && b.llamadas[0].includes('marco'), 'con todo');
});

/* ── 2. Con la app por delante, no se pierde nada ────────── */

test('SIN LA 043 SE GUARDA SIN `jugada`, y lo demás entero', async () => {
  const b = baseSin('jugada');
  const r = await guardarSinLasQueFalten(b.hacer, fila());
  eq(r.data, { id: 'e1' }, 'se ha guardado:');
  eq(r.quitadas, ['jugada'], 'y dice qué no ha podido guardar:');
  eq(b.llamadas[1].sort(), ['animacion', 'marco', 'name'], 'el reintento lleva todo lo demás:');
});

test('SIN NINGUNA DE LAS DOS: dos errores, dos reintentos, y se guarda', async () => {
  /* PostgREST nombra solo una columna en cada error: con un reintento,
     el segundo fallo se tragaba el ejercicio. */
  const b = baseSin('marco', 'jugada');
  const r = await guardarSinLasQueFalten(b.hacer, fila());
  eq(r.data, { id: 'e1' });
  eq(r.quitadas, ['marco', 'jugada']);
  eq(b.llamadas.length, 3);
});

test('sin la 038 pero con la 043, como hasta ahora: sin `marco`', async () => {
  const b = baseSin('marco');
  const r = await guardarSinLasQueFalten(b.hacer, fila());
  eq(r.quitadas, ['marco']);
  ok(b.llamadas[1].includes('jugada'), 'la jugada sí se guarda');
});

/* ── 3. Un error que no es de columnas NO se tapa ─────────── */

test('UN ERROR DE PERMISOS NO SE REINTENTA: se devuelve tal cual', async () => {
  let n = 0;
  const r = await guardarSinLasQueFalten(async () => { n++; return { data: null, error: { message: 'new row violates row-level security policy' } }; }, fila());
  eq(n, 1, 'una sola llamada:');
  ok(/row-level/.test(r.error.message), 'con el error de verdad');
  eq(r.quitadas, []);
});

test('si el error nombra una columna que la fila no lleva, no se inventa nada', async () => {
  let n = 0;
  const r = await guardarSinLasQueFalten(async () => { n++; return { data: null, error: faltaColumna('jugada') }; }, { name: 'x' });
  eq(n, 1);
  ok(r.error, 'el error sigue ahí');
});

test('NUNCA SE REINTENTA MÁS VECES QUE COLUMNAS NUEVAS HAY', async () => {
  let n = 0;
  await guardarSinLasQueFalten(async () => { n++; return { data: null, error: faltaColumna('marco') }; }, fila());
  ok(n <= COLUMNAS_NUEVAS.length + 1, `${n} llamadas`);
});

/* ── 4. Las piezas ───────────────────────────────────────── */

test('sinColumnaQueFalta no toca la fila que recibe', () => {
  const f = fila();
  const r = sinColumnaQueFalta(faltaColumna('jugada'), f);
  ok(!('jugada' in r.fila), 'la devuelta va sin ella');
  ok('jugada' in f, 'y la original la conserva');
});

test('con la palabra ENTERA: «marcos» no es la columna `marco`', () => {
  eq(sinColumnaQueFalta({ message: 'error en los marcos del documento' }, fila()), null);
});

test('sin error, sin mensaje o sin fila, no hay nada que quitar', () => {
  eq(sinColumnaQueFalta(null, fila()), null);
  eq(sinColumnaQueFalta({}, fila()), null);
  eq(sinColumnaQueFalta(faltaColumna('jugada'), null), null);
});

test('las columnas nuevas son las dos que se aplican a mano', () => {
  eq(COLUMNAS_NUEVAS, ['marco', 'jugada']);
});

await Promise.all(pendientes);
console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
