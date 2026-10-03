/* ============================================================
   eval-fotograma.mjs — banco Node de lo que se ve en el instante t de
   una fase (taller/js/canvas/fotograma.js). Sin red, sin DOM.

     node taller/tools/eval-fotograma.mjs

   Es la cuenta que comparten el motor de reproducción y la defensa que
   se mueve sola: si se equivoca aquí, la Pizarra y el proyector enseñan
   cosas distintas, que es justo lo que el principio 4 no permite.
   ============================================================ */

import { metaDeFase, fotograma, copiarEscena } from '../js/canvas/fotograma.js';
import { easeInOut } from '../js/canvas/geometry.js';

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
const cerca = (a, b, tol = 1e-9) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const txt = (p) => (p ? `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})` : String(p));

const L = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
const JUG = [{ id: 'A1', equipo: 'A' }, { id: 'A2', equipo: 'A' }, { id: 'B1', equipo: 'B' }];
const BAL = [{ id: 'b1' }];
const ARO = { x: 0.5, y: 0.1 };
const escenaBase = () => ({
  P: { A1: { x: 0.2, y: 0.8 }, A2: { x: 0.8, y: 0.8 }, B1: { x: 0.5, y: 0.5 } },
  B: { b1: { x: 0.2, y: 0.8 } },
  owner: { b1: 'A1' },
});
const monta = (fase, escena = escenaBase()) => metaDeFase(
  { duracion_ms: 1000, ...fase },
  { jugadores: JUG, balones: BAL, escena, aro: () => ARO },
);
const ver = (r, inicio, t) => fotograma({ meta: r.meta, inicio, jugadores: JUG, balones: BAL, t });

/* ── 1. Lo dibujado ──────────────────────────────────────── */

test('UN MOVIMIENTO DIBUJADO SE RECORRE CON LA CURVA DE SIEMPRE', () => {
  const inicio = escenaBase();
  const r = monta({ movimientos: [{ elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: [L(0.8, 0.8), L(0.8, 0.2)], inicio_ms: 0, duracion_ms: 1000 }] });
  const f = ver(r, inicio, 250);
  const esperado = 0.8 - 0.6 * easeInOut(0.25);
  ok(Math.abs(f.players.A2.y - esperado) < 1e-6, `al cuarto: ${txt(f.players.A2)}, esperado y=${esperado}`);
  eq(r.meta.arrows.length, 1, 'y lleva su flecha:');
  eq(r.escena.P.A2, { x: 0.8, y: 0.2 }, 'y al acabar la fase, en su punta:');
});

test('LO QUE NO TRAE INSTANTE OCUPA LA FASE ENTERA, como lo guardado antes', () => {
  const inicio = escenaBase();
  const r = monta({ movimientos: [{ elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: [L(0.8, 0.8), L(0.8, 0.2)] }] });
  const f = ver(r, inicio, 500);
  ok(Math.abs(f.players.A2.y - (0.8 - 0.6 * easeInOut(0.5))) < 1e-6, txt(f.players.A2));
});

/* ── 2. Lo muestreado en el tiempo (la defensa, §8.4) ────── */

test('UN MOVIMIENTO MUESTREADO VA EN EL TIEMPO, SIN CURVA Y SIN FLECHA', () => {
  const inicio = escenaBase();
  const r = monta({
    movimientos: [{
      elemento_id: 'B1', tipo_elemento: 'jugador', tipo_movimiento: 'defensa', automatico: true,
      inicio_ms: 0, duracion_ms: 1000,
      muestras: [{ t: 0, x: 0.5, y: 0.5 }, { t: 500, x: 0.5, y: 0.4 }, { t: 1000, x: 0.5, y: 0.2 }],
    }],
  });
  const f = ver(r, inicio, 250);
  ok(Math.abs(f.players.B1.y - 0.45) < 1e-9, `a mitad de la primera muestra: ${txt(f.players.B1)}`);
  eq(r.meta.arrows.length, 0, 'lo automático no dibuja flecha (§8.4):');
  eq(r.escena.P.B1, { x: 0.5, y: 0.2 }, 'y acaba en su última muestra:');
});

/* ── 3. El balón ─────────────────────────────────────────── */

test('UN PASE: el balón viaja y al llegar es del receptor', () => {
  const inicio = escenaBase();
  const r = monta({ pases: [{ de_id: 'A1', a_id: 'A2', balon_id: 'b1', path: [L(0.2, 0.8), L(0.8, 0.8)], inicio_ms: 0, duracion_ms: 400 }] });
  const enVuelo = ver(r, inicio, 200);
  ok(enVuelo.duenos.b1 === 'A1', 'mientras vuela sigue siendo del que pasa');
  ok(!enVuelo.carrying.has('A1'), 'pero no lo lleva nadie en la mano');
  const despues = ver(r, inicio, 600);
  eq(despues.duenos.b1, 'A2');
  ok(despues.carrying.has('A2') && cerca(despues.balls.b1, { x: 0.812, y: 0.8 }, 1e-9), txt(despues.balls.b1));
  eq(r.escena.owner.b1, 'A2', 'y al acabar la fase es suyo:');
});

test('UN TIRO deja el balón sin dueño, y donde acaba su camino', () => {
  const inicio = escenaBase();
  const r = monta({ tiros: [{ jugador_id: 'A1', balon_id: 'b1', canasta: 'norte', desenlace: 'falla', path: [L(0.2, 0.8), L(0.5, 0.1)], inicio_ms: 0, duracion_ms: 900 }] });
  const f = ver(r, inicio, 950);
  eq(f.duenos.b1, null);
  ok(cerca(f.balls.b1, { x: 0.5, y: 0.1 }, 1e-9), txt(f.balls.b1));
  eq(r.escena.owner.b1, null);
});

test('UNA RECOGIDA: el balón es suyo EN SU INSTANTE, no al acabar la fase', () => {
  const inicio = escenaBase();
  inicio.owner.b1 = null;
  inicio.B.b1 = { x: 0.5, y: 0.3 };
  const r = monta({
    movimientos: [{ elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_sin_balon', path: [L(0.8, 0.8), L(0.55, 0.32)], inicio_ms: 0, duracion_ms: 600 }],
    recogidas: [{ jugador_id: 'A2', balon_id: 'b1', t_ms: 600 }],
  }, inicio);
  eq(ver(r, inicio, 500).duenos.b1, null, 'antes de llegar, de nadie');
  eq(ver(r, inicio, 700).duenos.b1, 'A2', 'y desde que llega, suyo');
});

/* ── 4. La escena pasa de una fase a la siguiente ────────── */

test('LA ESCENA QUE SALE DE UNA FASE ES LA QUE ENTRA EN LA SIGUIENTE', () => {
  const inicio = escenaBase();
  const uno = monta({ movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: [L(0.2, 0.8), L(0.4, 0.5)], inicio_ms: 0, duracion_ms: 800 }] });
  eq(uno.escena.P.A1, { x: 0.4, y: 0.5 });
  eq(uno.escena.B.b1, { x: 0.4, y: 0.5 }, 'el balón va con quien lo lleva:');
  const dos = monta({ movimientos: [] }, uno.escena);
  const f = fotograma({ meta: dos.meta, inicio: uno.escena, jugadores: JUG, balones: BAL, t: 0 });
  eq(f.players.A1, { x: 0.4, y: 0.5 }, 'quien no se mueve, donde le dejó la fase anterior:');
  ok(f.carrying.has('A1'), 'y sigue con el balón');
});

test('copiarEscena copia de verdad: tocar la copia no cambia el original', () => {
  const e = escenaBase();
  const c = copiarEscena(e);
  c.P.A1.x = 0.99; c.owner.b1 = null;
  eq(e.P.A1.x, 0.2);
  eq(e.owner.b1, 'A1');
});

test('sin nada montado no rompe: todos en su sitio de partida', () => {
  const inicio = escenaBase();
  const f = fotograma({ meta: null, inicio, jugadores: JUG, balones: BAL, t: 500 });
  eq(f.players.A1, { x: 0.2, y: 0.8 });
  ok(f.carrying.has('A1'), 'y quien tenía el balón lo sigue teniendo');
  const vacio = fotograma({});
  eq([vacio.players, vacio.balls], [{}, {}]);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
