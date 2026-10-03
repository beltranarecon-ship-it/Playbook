/* ============================================================
   eval-divisor.mjs — banco Node de lo que vale como ancho de un panel de
   la Pizarra (taller/js/pizarra/divisor.js). Sin red, sin DOM.

     node taller/tools/eval-divisor.mjs

   Lo que importa: que un ancho guardado en el navegador, venga como
   venga, no pueda dejar un panel ilegible ni comerse la pista.
   ============================================================ */

import { limitarAncho, anchoDeTexto, topeDeAncho, anchoGuardado, MIN_PISTA } from '../js/pizarra/divisor.js';

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

const L = { min: 200, max: 480, defecto: 300 };

/* ── limitarAncho ────────────────────────────────────────── */

test('un ancho dentro de sus límites se queda como está', () => {
  eq(limitarAncho(320, 200, 480), 320);
});

test('por debajo del suelo se sube, y por encima del techo se baja', () => {
  eq(limitarAncho(50, 200, 480), 200);
  eq(limitarAncho(900, 200, 480), 480);
});

test('con un tope menor que el suelo, manda el suelo', () => {
  // la ventana es tan estrecha que no cabe ni el mínimo: se prefiere
  // un panel legible a uno de 80 px
  eq(limitarAncho(300, 200, 120), 200);
});

/* ── anchoDeTexto ────────────────────────────────────────── */

test('lo guardado como texto se lee como número', () => {
  eq(anchoDeTexto('360', L), 360);
  eq(anchoDeTexto('360.7', L), 361);
});

test('lo que no es un número se cambia por el ancho de serie', () => {
  eq(anchoDeTexto(null, L), 300, 'nada guardado:');
  eq(anchoDeTexto(undefined, L), 300, 'sin almacén:');
  eq(anchoDeTexto('', L), 300, 'vacío:');
  eq(anchoDeTexto('ancho', L), 300, 'texto:');
  eq(anchoDeTexto('NaN', L), 300, 'NaN:');
  eq(anchoDeTexto('Infinity', L), 300, 'infinito:');
});

test('un número guardado fuera de límites se mete en ellos', () => {
  eq(anchoDeTexto('5', L), 200);
  eq(anchoDeTexto('99999', L), 480);
  eq(anchoDeTexto('-40', L), 200);
});

/* ── topeDeAncho ─────────────────────────────────────────── */

test('el tope deja a la pista lo que necesita', () => {
  // ventana 1400, el otro panel ocupa 300: quedan 1100 para este y la pista
  eq(topeDeAncho({ ventana: 1400, otro: 300, max: 480 }), 480, 'sobra sitio: manda el máximo:');
  eq(topeDeAncho({ ventana: 900, otro: 300, max: 480 }), 900 - 300 - MIN_PISTA, 'falta sitio: manda la pista:');
});

test('el tope nunca es negativo', () => {
  eq(topeDeAncho({ ventana: 300, otro: 300, max: 480 }), 0);
});

test('con una ventana ancha, el tope es el máximo del panel', () => {
  ok(topeDeAncho({ ventana: 4000, otro: 400, max: 560 }) === 560, 'el máximo del panel');
});

/* ── el almacén ──────────────────────────────────────────── */

test('sin almacén en el navegador, se usa el ancho de serie y no se rompe', () => {
  // en Node no hay localStorage: es exactamente el caso de un navegador
  // con el almacenamiento bloqueado
  eq(anchoGuardado('izq', L), 300);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
