/* ============================================================
   eval-duracion.mjs — banco Node de la duración real de un ejercicio
   (taller/js/duracion.js). Sin red, sin DOM.

     node taller/tools/eval-duracion.mjs

   Lo que vigila: que la propuesta salga de lo que pasó y no de lo que
   alguien estimó al escribir la ficha, y que un día raro —cuarenta
   minutos porque se hizo daño un crío— no arrastre la propuesta de
   todas las veces siguientes.
   ============================================================ */

import {
  MINIMO_VECES, ULTIMAS, mediana, duracionPropuesta, textoDuracion, agruparReales,
} from '../js/duracion.js';

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

/* ── 1. El criterio de aceptación ───────────────────────────── */

console.log('\n· la segunda vez propone lo que duró');

test('sin historia manda la ficha', () => {
  eq(duracionPropuesta([], 10), { minutos: 10, veces: 0, origen: 'ficha' });
});

test('con UNA vez ya se propone lo real', () => {
  /* «La segunda vez que se usa un ejercicio propone la duración real»:
     basta con haberlo dado una. */
  eq(MINIMO_VECES, 1);
  eq(duracionPropuesta([14], 10), { minutos: 14, veces: 1, origen: 'real' });
});

test('y lo real manda sobre lo que diga la ficha', () => {
  const p = duracionPropuesta([14, 13, 14], 10);
  eq(p.minutos, 14);
  eq(p.origen, 'real');
});

/* ── 2. El día raro ────────────────────────────────────────── */

console.log('\n· un día raro no arrastra a los demás');

test('la mediana ignora el cuarenta suelto', () => {
  /* Se hizo daño un crío y el bloque duró cuarenta minutos. Ese día no
     dice nada de cuánto dura el ejercicio. */
  eq(duracionPropuesta([12, 40, 13, 12], 10).minutos, 12.5 > 12 ? 13 : 12);
  eq(mediana([12, 40, 13, 12]), 12.5);
  // con la media saldría 19: casi el doble
  const media = [12, 40, 13, 12].reduce((a, b) => a + b) / 4;
  ok(media > 19 - 0.5 && media < 19 + 0.5, `la media sería ${media}`);
});

test('la mediana de dos es su punto medio', () => {
  eq(mediana([10, 14]), 12);
  eq(duracionPropuesta([10, 14], 8).minutos, 12);
});

test('y de una, ella misma', () => {
  eq(mediana([17]), 17);
});

/* ── 3. Solo las últimas ───────────────────────────────────── */

console.log('\n· solo las últimas');

test('se miran cinco, no toda la historia', () => {
  eq(ULTIMAS, 5);
  /* El ejercicio duraba veinte con el infantil hace un año y ahora
     dura doce con el cadete: la que importa es la de ahora. */
  const p = duracionPropuesta([12, 12, 13, 12, 12, 20, 20, 20, 20], 10);
  eq(p.veces, 5);
  eq(p.minutos, 12);
});

/* ── 4. Lo que no se cree ──────────────────────────────────── */

console.log('\n· lo que no se cree');

test('los ceros y las basuras no cuentan', () => {
  eq(duracionPropuesta([0, null, 'x', -3], 10), { minutos: 10, veces: 0, origen: 'ficha' });
  eq(mediana([]), null);
  eq(mediana(null), null);
});

test('sin ficha y sin historia, no hay número que dar', () => {
  eq(duracionPropuesta([], null), { minutos: null, veces: 0, origen: 'ficha' });
  eq(duracionPropuesta(null, 0), { minutos: null, veces: 0, origen: 'ficha' });
});

test('nunca se propone cero minutos', () => {
  eq(duracionPropuesta([0.4], 10).minutos, 10, 'menos de un minuto no es una duración');
});

/* ── 5. Agrupar lo que devuelve la consulta ─────────────────── */

console.log('\n· agrupar');

const FILAS = [
  { exercise_id: 'e1', duracion_real_min: 12, fecha: '2026-09-01' },
  { exercise_id: 'e1', duracion_real_min: 14, fecha: '2026-09-08' },
  { exercise_id: 'e2', duracion_real_min: 20, fecha: '2026-09-05' },
  { exercise_id: null, duracion_real_min: 8, fecha: '2026-09-08' },   // bloque libre
  { exercise_id: 'e3', duracion_real_min: null, fecha: '2026-09-08' }, // sin acabar
];

test('cada ejercicio con sus minutos, del más reciente al más antiguo', () => {
  eq(agruparReales(FILAS), { e1: [14, 12], e2: [20] });
});

test('los bloques libres y los que no se dieron se caen', () => {
  const g = agruparReales(FILAS);
  ok(!('e3' in g), 'sin duración real no cuenta');
  ok(!(null in g), 'un bloque libre no es un ejercicio');
});

test('sin filas no revienta', () => {
  eq(agruparReales([]), {});
  eq(agruparReales(null), {});
});

/* ── 6. Lo que se lee ──────────────────────────────────────── */

console.log('\n· de dónde sale el número');

test('se dice de dónde sale, que no es un detalle', () => {
  eq(textoDuracion({ minutos: 10, veces: 0, origen: 'ficha' }), '10 min de la ficha');
  eq(textoDuracion({ minutos: 14, veces: 1, origen: 'real' }), '14 min · lo que duró la última vez');
  eq(textoDuracion({ minutos: 12, veces: 3, origen: 'real' }), '12 min · lo que dura tus últimas 3 veces');
  eq(textoDuracion({ minutos: null }), 'sin duración');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
