/* ============================================================
   eval-rubrica.mjs — banco Node de la rúbrica (taller/js/rubrica.js).
   Sin red, sin DOM.

     node taller/tools/eval-rubrica.mjs

   Lo que vigila: que la serie histórica siga siendo una serie —el
   nivel de hoy y el de antes, no un número que se pisa— porque de ahí
   sale el MOVIMIENTO, y el movimiento es lo que mide el cumplimiento
   de un objetivo desde que se retiró el autodeclarado (decisión #26).

   Y que el orden de «a quién toca mirar» ponga delante al que lleva
   más tiempo sin mirarse: es lo único que evita que se evalúe siempre
   a los mismos cinco.
   ============================================================ */

import {
  NIVELES, NIVEL_MAX, esNivel, CONDUCTAS, claveAccion, claveConducta, esConducta,
  filasDeRubrica, estadoDe, movimiento, diasSinMirar, ordenSugerido,
  textoSinMirar, porDondeEmpezar,
} from '../js/rubrica.js';
import { TAGS } from '../js/ia/vocabulario.js';

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

const DIA = 86400000;
const HOY = new Date(2026, 9, 15, 20, 0, 0, 0).getTime();
const haceDias = (n) => new Date(HOY - n * DIA).toISOString();

/* ── 1. Los cuatro niveles ─────────────────────────────────── */

console.log('\n· los cuatro niveles');

test('son los cuatro de §3, en orden de exigencia', () => {
  eq(NIVELES.map((n) => n.nombre), ['No lo hace', 'Con ayuda', 'Solo', 'Con oposición']);
  eq(NIVEL_MAX, 3);
});

test('y no se admite nada fuera de la escala', () => {
  ok(esNivel(0) && esNivel(3));
  ok(!esNivel(4), 'no hay quinto nivel');
  ok(!esNivel(-1) && !esNivel(1.5) && !esNivel('2') && !esNivel(null));
});

/* ── 2. Las filas ──────────────────────────────────────────── */

console.log('\n· de dónde salen las filas');

test('las conductas son las cuatro de la decisión #25', () => {
  eq(CONDUCTAS.map((c) => c.clave), ['actitud', 'escucha', 'autonomia', 'companerismo']);
});

test('y las acciones son el vocabulario común, sin copiarlo', () => {
  const filas = filasDeRubrica();
  eq(filas.filter((f) => f.tipo === 'accion').length, TAGS.length,
    'una fila por etiqueta: la misma palabra que es pieza del catálogo y diana de un objetivo');
});

test('las conductas van primero: se miran en todos y en todas las sesiones', () => {
  const filas = filasDeRubrica();
  eq(filas.slice(0, 4).map((f) => f.clave),
    ['conducta:actitud', 'conducta:escucha', 'conducta:autonomia', 'conducta:companerismo']);
});

test('la clave dice de qué familia es', () => {
  eq(claveAccion('bote'), 'accion:bote');
  eq(claveConducta('actitud'), 'conducta:actitud');
  ok(esConducta('conducta:actitud'));
  ok(!esConducta('accion:bote'));
});

test('el club puede añadir filas, y no redefinir las del sistema', () => {
  const filas = filasDeRubrica([
    { clave: 'accion:tapón', nombre: 'Tapón', categoria: 'defensa', orden: 500 },
    { clave: 'conducta:actitud', nombre: 'OTRA COSA' },   // reservada
  ]);
  const propia = filas.find((f) => f.clave === 'accion:tapón');
  ok(propia && propia.origen === 'club', 'la nueva entra');
  eq(filas.find((f) => f.clave === 'conducta:actitud').nombre, 'Actitud y esfuerzo',
    'la del sistema no se pisa');
});

/* ── 3. La serie histórica ─────────────────────────────────── */

console.log('\n· la serie no se sobrescribe');

const SERIE = [
  { clave: 'accion:bote', nivel: 1, created_at: haceDias(60) },
  { clave: 'accion:bote', nivel: 2, created_at: haceDias(30) },
  { clave: 'accion:bote', nivel: 3, created_at: haceDias(2) },
  { clave: 'conducta:actitud', nivel: 2, created_at: haceDias(30) },
  { clave: 'accion:tiro', nivel: 2, created_at: haceDias(10) },
  { clave: 'accion:tiro', nivel: 1, created_at: haceDias(1) },   // bajó
];

test('el nivel de hoy es el último, y el de antes sigue estando', () => {
  const e = estadoDe(SERIE);
  eq(e['accion:bote'], { nivel: 3, anterior: 2, fecha: haceDias(2), veces: 3 });
});

test('con una sola valoración no hay «anterior» que inventar', () => {
  const e = estadoDe(SERIE);
  eq(e['conducta:actitud'].anterior, null);
  eq(e['conducta:actitud'].veces, 1);
});

test('el MOVIMIENTO es lo que mide el cumplimiento (decisión #26)', () => {
  const e = estadoDe(SERIE);
  eq(movimiento(e, 'accion:bote'), 1, 'subió un escalón');
  eq(movimiento(e, 'accion:tiro'), -1, 'bajó');
  eq(movimiento(e, 'conducta:actitud'), null, 'solo se ha mirado una vez');
  eq(movimiento(e, 'accion:pase'), null, 'nunca se ha mirado');
});

test('un nivel fuera de escala se cae, no se cuela', () => {
  const e = estadoDe([{ clave: 'accion:bote', nivel: 9, created_at: haceDias(1) }]);
  eq(e['accion:bote'], undefined);
});

test('sin serie no revienta', () => {
  eq(estadoDe([]), {});
  eq(estadoDe(null), {});
  eq(movimiento(null, 'x'), null);
});

/* ── 4. A quién toca mirar ─────────────────────────────────── */

console.log('\n· a quién toca mirar');

const JUGADORES = [
  { id: 'p1', nombre: 'Ana' },
  { id: 'p2', nombre: 'Bruno' },
  { id: 'p3', nombre: 'Carla' },
];
const POR_JUGADOR = {
  p1: [{ clave: 'accion:bote', nivel: 2, created_at: haceDias(3) }],
  p2: [{ clave: 'accion:bote', nivel: 1, created_at: haceDias(40) }],
  // p3 no se ha mirado nunca
};

test('días desde la última vez', () => {
  eq(diasSinMirar(POR_JUGADOR.p1, HOY), 3);
  eq(diasSinMirar(POR_JUGADOR.p2, HOY), 40);
  eq(diasSinMirar([], HOY), null);
  eq(diasSinMirar(undefined, HOY), null);
});

test('el que no se ha mirado NUNCA va el primero', () => {
  const orden = ordenSugerido(JUGADORES, POR_JUGADOR, HOY);
  eq(orden.map((x) => x.jugador.id), ['p3', 'p2', 'p1']);
  eq(orden[0].dias, null);
});

test('es un ORDEN, no una elección: están todos', () => {
  /* §5.7: la rúbrica la dispara el entrenador y elige a quien quiera,
     sin tope. Esto solo marca discretamente por dónde empezar. */
  eq(ordenSugerido(JUGADORES, POR_JUGADOR, HOY).length, JUGADORES.length);
});

test('se lee sin restar fechas de cabeza', () => {
  eq(textoSinMirar(null), 'sin mirar nunca');
  eq(textoSinMirar(0), 'mirado hoy');
  eq(textoSinMirar(1), 'mirado ayer');
  eq(textoSinMirar(12), 'hace 12 días');
});

/* ── 5. Por dónde empezar ──────────────────────────────────── */

console.log('\n· por dónde empezar con un jugador');

test('las conductas van siempre delante: se miran en todos', () => {
  const filas = filasDeRubrica().filter((f) => ['conducta:actitud', 'accion:bote', 'accion:tiro', 'accion:pase'].includes(f.clave));
  const estado = estadoDe([
    { clave: 'accion:bote', nivel: 3, created_at: haceDias(2) },
    { clave: 'conducta:actitud', nivel: 0, created_at: haceDias(60) },
  ]);
  const orden = porDondeEmpezar(estado, filas, { cuantas: 4 }).map((f) => f.clave);
  eq(orden[0], 'conducta:actitud');
  eq(orden[3], 'accion:bote', 'lo que ya está arriba, lo último');
});

test('y después lo que se ha ENTRENADO HOY, que es el eslabón del vocabulario', () => {
  /* Sin esta capa, con setenta filas sin mirar salían siempre las
     mismas seis y la rúbrica dejaba de servir a la segunda semana. */
  const filas = filasDeRubrica();
  const hoy = new Set(['accion:entrada', 'accion:rebote defensivo']);
  const orden = porDondeEmpezar({}, filas, { cuantas: 6, preferidas: hoy }).map((f) => f.clave);
  eq(orden.slice(0, 4), ['conducta:actitud', 'conducta:escucha', 'conducta:autonomia', 'conducta:companerismo']);
  eq(new Set(orden.slice(4, 6)), hoy, 'las dos que se han entrenado');
});

test('dentro de lo entrenado hoy, lo más bajo primero', () => {
  const filas = filasDeRubrica();
  const hoy = new Set(['accion:tiro', 'accion:pase', 'accion:bote']);
  const estado = estadoDe([
    { clave: 'accion:tiro', nivel: 3, created_at: haceDias(2) },
    { clave: 'accion:pase', nivel: 0, created_at: haceDias(2) },
  ]);
  const orden = porDondeEmpezar(estado, filas, { cuantas: 7, preferidas: hoy }).map((f) => f.clave);
  eq(orden.slice(4), ['accion:bote', 'accion:pase', 'accion:tiro'],
    'sin mirar, a cero, y por último la que ya está arriba');
});

test('si lo de hoy no llena la pantalla, se completa con el resto', () => {
  const orden = porDondeEmpezar({}, filasDeRubrica(), { cuantas: 6, preferidas: new Set(['accion:tiro']) });
  eq(orden.length, 6);
  eq(orden[4].clave, 'accion:tiro');
});

test('devuelve solo las que caben en pantalla', () => {
  eq(porDondeEmpezar({}, filasDeRubrica(), { cuantas: 6 }).length, 6);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
