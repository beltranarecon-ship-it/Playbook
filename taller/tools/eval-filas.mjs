/* ============================================================
   eval-filas.mjs — banco Node de las filas (taller/js/pizarra/filas.js).
   Sin red, sin DOM.

     node taller/tools/eval-filas.mjs

   Una fila es un cono con gente esperando detrás (§7.4.2). Lo que se
   prueba aquí es lo que decide si el entrenador ve la cola donde la
   puso: dónde espera cada uno —en metros y en la orientación que dice
   el tirador—, que el primero está en juego y los demás no (§7.1), y
   que la cola sigue a su cono.
   ============================================================ */

import {
  FILAS, normalizarGrados, orientacionImantada, orientacionHacia, puestosDeFila, finalDeFila, normalizarFila,
  deLaFila, hacerFila, deshacerFila, recolocarFila, orientarFila,
} from '../js/pizarra/filas.js';
import { anadir, reiniciarIds, mover } from '../js/pizarra/elementos.js';
import { metrosEntre, escalaDe } from '../js/canvas/escala.js';

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
const cerca = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const M = (a, b) => metrosEntre('entera', a, b);

/* ── 1. Los números y la orientación ─────────────────────── */

test('EL HUECO ES EL PASO CON EL QUE PINTA LA COLA EL PROYECTOR', () => {
  ok(cerca(FILAS.hueco, 1.95 * 0.65), `1,95 radios de ficha: ${FILAS.hueco}`);
  eq([FILAS.minimo, FILAS.maximo, FILAS.iman], [1, 12, 15]);
  ok(Object.isFrozen(FILAS));
});

test('EL TIRADOR SE IMANTA CADA 15°, y con Mayús va libre (§7.4.2)', () => {
  eq(orientacionImantada(37), 30);
  eq(orientacionImantada(38), 45);
  eq(orientacionImantada(37, { libre: true }), 37);
  eq(orientacionImantada(359), 0, 'y da la vuelta:');
  eq([normalizarGrados(-90), normalizarGrados(450), normalizarGrados(NaN)], [270, 90, 0]);
});

test('LA ORIENTACIÓN QUE MARCA UN PUNTO SE MIDE EN METROS, no en coordenadas', () => {
  const E = escalaDe('entera');
  const c = { x: 0.5, y: 0.5 };
  /* Un punto a 45° en metros: mismo desplazamiento en metros en x y en y. */
  const p = { x: 0.5 + 2 / E.x, y: 0.5 + 2 / E.y };
  ok(cerca(orientacionHacia(c, p, 'entera', { libre: true }), 45, 1e-9), 'a 45 grados de verdad');
  eq(orientacionHacia(c, { x: 0.6, y: 0.5 }, 'entera'), 0, 'a la derecha, 0°:');
  eq(orientacionHacia(c, { x: 0.5, y: 0.6 }, 'entera'), 90, 'hacia abajo del lienzo, 90°:');
  eq(orientacionHacia(c, c, 'entera'), null, 'sin dirección no hay orientación:');
});

/* ── 2. Dónde espera cada uno ────────────────────────────── */

test('EL PRIMERO ESPERA EN EL CONO Y LOS DEMÁS DETRÁS, a un hueco, en su orientación', () => {
  const cono = { x: 0.5, y: 0.5 };
  const p = puestosDeFila(cono, 3, 0, 'entera');
  eq(p.length, 3);
  eq(p[0], cono, 'el primero, en el cono:');
  ok(cerca(M(p[0], p[1]), FILAS.hueco, 1e-9) && cerca(M(p[1], p[2]), FILAS.hueco, 1e-9), 'a un hueco uno de otro');
  ok(p[1].x > cono.x && cerca(p[1].y, cono.y), 'a 0°, hacia la derecha');
  const abajo = puestosDeFila(cono, 2, 90, 'entera');
  ok(abajo[1].y > cono.y && cerca(abajo[1].x, cono.x), 'a 90°, hacia abajo');
});

test('EL FINAL DE LA COLA ES UN HUECO DETRÁS DEL ÚLTIMO: ahí va quien vuelve a la fila', () => {
  const cono = { x: 0.5, y: 0.5 };
  const f = finalDeFila(cono, 3, 90, 'entera');
  const p = puestosDeFila(cono, 3, 90, 'entera');
  ok(cerca(M(f, p[2]), FILAS.hueco, 1e-9), 'justo detrás del tercero');
  eq(finalDeFila(cono, 0, 90, 'entera'), cono, 'sin nadie, en el cono:');
});

test('UNA FILA EN CONDICIONES: lo que falte, con lo de serie, y sin pasarse', () => {
  eq(normalizarFila({}), { n: 3, equipo: 'A', papel: 'atacante', balon: false, orientacion: 90, vuelta: null, rondas: true, cadencia_ms: null });
  eq(normalizarFila({ n: 40, equipo: 'Z', papel: 'defensor', balon: 1, orientacion: -15, vuelta: 'cono_9', rondas: false, cadencia_ms: 1500.4 }),
    { n: 12, equipo: 'A', papel: 'defensor', balon: true, orientacion: 345, vuelta: 'cono_9', rondas: false, cadencia_ms: 1500 });
  eq(normalizarFila({ n: 0 }).n, 1, 'como poco, uno:');
  eq(normalizarFila(null), null);
});

/* ── 3. La cola en la pista ──────────────────────────────── */

function conCono() {
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'cono' }, 0.5, 0.5);
  return { l, cono: l[0] };
}

test('HACER FILA PONE A LOS QUE ESPERAN: el primero en juego, los demás sin dorsal (§7.1)', () => {
  const { l, cono } = conCono();
  const r = hacerFila(l, cono.id, { n: 3, equipo: 'B', orientacion: 90 }, 'entera');
  const suyos = deLaFila(r, cono.id);
  eq(suyos.length, 3);
  eq(suyos.map((j) => j.puesto), [0, 1, 2]);
  eq(suyos.map((j) => j.equipo), ['B', 'B', 'B']);
  eq(suyos.map((j) => j.en_juego), [true, false, false], 'solo el primero está en juego:');
  eq(suyos.map((j) => j.label), ['1', null, null], 'y solo él lleva dorsal:');
  eq(r.find((e) => e.id === cono.id).fila.n, 3, 'y el cono sabe que es fila:');
  ok(M(suyos[0], cono) < 1e-9, 'el primero, en el cono');
});

test('CON «UN BALÓN POR CABEZA», cada uno el suyo (§7.3)', () => {
  const { l, cono } = conCono();
  const r = hacerFila(l, cono.id, { n: 3, balon: true }, 'entera');
  const suyos = deLaFila(r, cono.id).map((j) => j.id);
  const balones = r.filter((e) => e.kind === 'balon');
  eq(balones.length, 3);
  eq(balones.map((b) => b.portador_id).sort(), [...suyos].sort(), 'uno para cada uno:');
});

test('REHACER LA FILA LA CAMBIA ENTERA, sin dejar a nadie colgado', () => {
  const { l, cono } = conCono();
  const r1 = hacerFila(l, cono.id, { n: 4, balon: true }, 'entera');
  const r2 = hacerFila(r1, cono.id, { n: 2, equipo: 'C' }, 'entera');
  eq(deLaFila(r2, cono.id).map((j) => j.equipo), ['C', 'C']);
  eq(r2.filter((e) => e.kind === 'balon').length, 0, 'y los balones de antes se van con los de antes:');
  eq(r2.filter((e) => e.kind === 'jugador').length, 2);
});

test('DESHACER LA FILA QUITA A LOS QUE ESPERAN Y SUS BALONES; el cono se queda', () => {
  const { l, cono } = conCono();
  const r = deshacerFila(hacerFila(l, cono.id, { n: 3, balon: true }, 'entera'), cono.id);
  eq(r.map((e) => e.kind), ['cono']);
  eq(r[0].fila, null);
});

test('LA COLA SIGUE A SU CONO, y cada balón a su jugador', () => {
  const { l, cono } = conCono();
  const r = hacerFila(l, cono.id, { n: 3, balon: true, orientacion: 0 }, 'entera');
  const movido = recolocarFila(mover(r, { [cono.id]: { x: 0.3, y: 0.7 } }), cono.id, 'entera');
  const suyos = deLaFila(movido, cono.id);
  ok(M(suyos[0], { x: 0.3, y: 0.7 }) < 1e-9, 'el primero, en el cono nuevo');
  ok(cerca(M(suyos[1], suyos[2]), FILAS.hueco, 1e-9), 'y los demás, en fila detrás');
  for (const b of movido.filter((e) => e.kind === 'balon')) {
    const j = movido.find((e) => e.id === b.portador_id);
    ok(M(b, j) < 1.0, 'cada balón, con su jugador');
  }
});

test('ORIENTAR LA FILA LA GIRA ALREDEDOR DEL CONO', () => {
  const { l, cono } = conCono();
  const r = orientarFila(hacerFila(l, cono.id, { n: 2, orientacion: 0 }, 'entera'), cono.id, 90, 'entera');
  eq(r.find((e) => e.id === cono.id).fila.orientacion, 90);
  const [, segundo] = deLaFila(r, cono.id);
  ok(segundo.y > cono.y && cerca(segundo.x, cono.x, 1e-9), 'el segundo, ahora debajo');
});

test('con un cono que no existe, o que no es fila, no pasa nada', () => {
  const { l, cono } = conCono();
  eq(hacerFila(l, 'nadie', { n: 2 }), l);
  eq(recolocarFila(l, cono.id), l, 'un cono sin fila no se recoloca:');
  eq(deLaFila(l, cono.id), []);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
