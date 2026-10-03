/* ============================================================
   eval-instante.mjs — banco Node de dónde está cada uno en el instante t
   (taller/js/canvas/instante.js). Sin red, sin DOM.

     node taller/tools/eval-instante.mjs

   Es la cuenta que comparten el motor de reproducción y el repaso de la
   Pizarra, y que la defensa usará para seguir al par. Si se equivoca
   aquí, se equivoca igual en los tres sitios, que es justo lo que se
   busca: que se equivoque en un solo sitio y aquí se vea.
   ============================================================ */

import { muestreador, posicionEn, duenoEn, tiempoDeRecorrido, muestreadorPorTiempo } from '../js/canvas/instante.js';
import { easeInOut } from '../js/canvas/geometry.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const cerca = (a, b, tol = 1e-9) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const txt = (p) => (p ? `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})` : String(p));
const L = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
const paso = (a, b, inicio, dur) => ({ sampler: muestreador([L(...a), L(...b)]), inicio, fin: inicio + dur, dur });

console.log('· el muestreador');

test('UN CAMINO DE LONGITUD CERO ES QUEDARSE QUIETO, no reventar', () => {
  const s = muestreador([L(0.4, 0.4), L(0.4, 0.4)]);
  for (const u of [0, 0.5, 1]) ok(cerca(s(u), { x: 0.4, y: 0.4 }), `a ${u}: ${txt(s(u))}`);
  ok(s.totalLen === 0, 'y dice que no mide nada');
});

test('un camino de verdad va de la salida a la llegada', () => {
  const s = muestreador([L(0.1, 0.1), L(0.9, 0.1)]);
  ok(cerca(s(0), { x: 0.1, y: 0.1 }, 1e-6) && cerca(s(1), { x: 0.9, y: 0.1 }, 1e-6), `${txt(s(0))} → ${txt(s(1))}`);
});

console.log('\n· dónde está alguien en t');

const dos = [paso([0, 0], [1, 0], 1000, 1000), paso([1, 0], [1, 1], 3000, 1000)];

test('ANTES DEL PRIMER TRAMO, EN SU SALIDA: no esperando de pie en la llegada', () => {
  ok(cerca(posicionEn(dos, 0), { x: 0, y: 0 }, 1e-6), txt(posicionEn(dos, 0)));
});

test('durante un tramo, sobre su camino y con la curva de siempre', () => {
  const p = posicionEn(dos, 1250);
  ok(Math.abs(p.x - easeInOut(0.25)) < 1e-6, `al 25 %: ${txt(p)}, esperado x=${easeInOut(0.25)}`);
});

test('ENTRE DOS TRAMOS, DONDE ACABÓ EL PRIMERO: no salta al segundo', () => {
  ok(cerca(posicionEn(dos, 2500), { x: 1, y: 0 }, 1e-6), txt(posicionEn(dos, 2500)));
});

test('después del último, en su llegada; y sin tramos, null', () => {
  ok(cerca(posicionEn(dos, 9999), { x: 1, y: 1 }, 1e-6), txt(posicionEn(dos, 9999)));
  ok(posicionEn([], 0) === null && posicionEn(null, 0) === null, 'sin tramos no hay posición');
});

console.log('\n· de quién es el balón en t');

test('EL ÚLTIMO CAMBIO DE MANOS QUE YA HA OCURRIDO', () => {
  const ev = [{ t: 1000, quien: 'A2' }, { t: 2000, quien: null }, { t: 3000, quien: 'A3' }];
  ok(duenoEn(ev, 500, 'A1') === 'A1', 'antes de todo, el del principio');
  ok(duenoEn(ev, 1000, 'A1') === 'A2', 'justo al llegar ya es suyo');
  ok(duenoEn(ev, 2500, 'A1') === null, 'tras un tiro, de nadie');
  ok(duenoEn(ev, 3500, 'A1') === 'A3', 'y al final, el último');
  ok(duenoEn(null, 5, undefined) === null, 'sin nada, de nadie');
});

console.log('\n· cuándo se llega a un punto del camino');

test('LA INVERSA DE LA CURVA: se llega a la fracción s del camino en tiempoDeRecorrido(s)', () => {
  for (const s of [0.01, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99]) {
    const u = tiempoDeRecorrido(s);
    ok(Math.abs(easeInOut(u) - s) < 1e-9, `s=${s}: u=${u} da ${easeInOut(u)}`);
  }
  ok(tiempoDeRecorrido(0.25) > 0.25, 'el primer cuarto tarda más de un cuarto: se sale despacio');
  ok(tiempoDeRecorrido(0) === 0 && tiempoDeRecorrido(1) === 1 && tiempoDeRecorrido(-3) === 0 && tiempoDeRecorrido(7) === 1, 'y en los extremos, los extremos');
});

console.log('\n· lo muestreado en el tiempo');

test('UN CAMINO MUESTREADO SE RECORRE EN EL TIEMPO Y SIN CURVA', () => {
  const f = muestreadorPorTiempo([{ t: 0, x: 0, y: 0 }, { t: 500, x: 0.5, y: 0 }, { t: 1000, x: 1, y: 0 }]);
  ok(f.lineal, 'se marca como lineal, para que nadie le meta la curva encima');
  ok(cerca(f(0), { x: 0, y: 0 }) && cerca(f(1), { x: 1, y: 0 }), 'de la primera a la última');
  ok(Math.abs(f(0.25).x - 0.25) < 1e-9, `a un cuarto del tiempo, un cuarto del camino: ${txt(f(0.25))}`);
});

test('CON MUESTRAS DESORDENADAS, ROTAS O DE UNA SOLA, no rompe', () => {
  const f = muestreadorPorTiempo([{ t: 1000, x: 1, y: 1 }, { t: 0, x: 0, y: 0 }, { t: 500, x: 9 }]);
  ok(cerca(f(0), { x: 0, y: 0 }) && cerca(f(1), { x: 1, y: 1 }), 'se ordenan y lo roto se cae');
  const una = muestreadorPorTiempo([{ t: 0, x: 0.3, y: 0.3 }]);
  ok(cerca(una(0.7), { x: 0.3, y: 0.3 }), 'con una sola muestra se queda quieto');
  ok(muestreadorPorTiempo([])(0.5), 'y sin muestras devuelve algo');
});

test('Y EN posicionEn NO SE LE APLICA LA CURVA, al revés que a lo dibujado', () => {
  const muestras = [{ t: 0, x: 0, y: 0 }, { t: 1000, x: 1, y: 0 }];
  const porTiempo = { sampler: muestreadorPorTiempo(muestras), inicio: 0, fin: 1000, dur: 1000 };
  const dibujado = paso([0, 0], [1, 0], 0, 1000);
  ok(Math.abs(posicionEn([porTiempo], 250).x - 0.25) < 1e-9, 'muestreado: un cuarto');
  ok(Math.abs(posicionEn([dibujado], 250).x - easeInOut(0.25)) < 1e-6, 'dibujado: con su curva');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
