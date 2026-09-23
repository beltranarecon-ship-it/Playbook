/* ============================================================
   eval-rondas.mjs — banco Node de lo que queda de las rondas
   (taller/js/pizarra/motor/rondas.js). Sin red, sin DOM.

     node taller/tools/eval-rondas.mjs

   Del módulo viejo —expandir la fila, la cadencia, la entrega del
   balón entre rondas— no queda nada: lo rehace la Pizarra en la capa 6
   (§7.4.2). Aquí solo se vigila lo único que sobrevive, y que se sigue
   usando con lo guardado antes: que la miniatura y el guion cuenten UNA
   ronda y no seis.
   ============================================================ */

import { soloPrimeraRonda } from '../js/pizarra/motor/rondas.js';

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

const fase = (ronda, n) => ({ id: `f${n}`, ronda, movimientos: [], pases: [] });

console.log('· una ronda, no seis');

test('SOLO LA PRIMERA RONDA: lo demás es la misma jugada repetida', () => {
  const fases = [fase(1, 1), fase(1, 2), fase(2, 3), fase(2, 4), fase(3, 5), fase(3, 6)];
  eq(soloPrimeraRonda(fases).map((f) => f.id), ['f1', 'f2']);
});

test('una animación SIN rondas se devuelve entera', () => {
  /* Casi todo lo guardado es así: si se filtrara por `ronda`, la
     miniatura de un ejercicio normal saldría vacía. */
  const fases = [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }];
  eq(soloPrimeraRonda(fases).map((f) => f.id), ['f1', 'f2', 'f3']);
});

test('mezcladas, se queda con las que dicen de qué ronda son', () => {
  eq(soloPrimeraRonda([fase(1, 1), { id: 'suelta' }, fase(2, 2)]).map((f) => f.id), ['f1']);
});

test('LAS RONDAS DE LA PIZARRA van dentro de cada fase: se quita lo marcado como repetición', () => {
  const f = {
    id: 'f1',
    movimientos: [{ elemento_id: 'A1' }, { elemento_id: 'A_j3', repeticion: 1 }, { elemento_id: 'A_j4', repeticion: 2 }],
    pases: [{ de_id: 'A1' }, { de_id: 'A_j3', repeticion: 1 }],
    tiros: [], recogidas: [{ jugador_id: 'A_j3', repeticion: 1 }], bloqueos: [],
  };
  const [una] = soloPrimeraRonda([f]);
  eq(una.movimientos.map((m) => m.elemento_id), ['A1']);
  eq([una.pases.length, una.recogidas.length], [1, 0]);
  eq(f.movimientos.length, 3, 'sin tocar la animación de verdad:');
  const limpia = { id: 'f2', movimientos: [{ elemento_id: 'A1' }] };
  ok(soloPrimeraRonda([limpia])[0] === limpia, 'y una fase sin repeticiones sale tal cual');
});

test('sin fases no revienta', () => {
  eq(soloPrimeraRonda(null), []);
  eq(soloPrimeraRonda(undefined), []);
  eq(soloPrimeraRonda([]), []);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
