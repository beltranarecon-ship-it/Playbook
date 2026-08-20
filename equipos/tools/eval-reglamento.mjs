/* ============================================================
   eval-reglamento.mjs — banco Node de la comprobación de reglamento
   (equipos/js/data/reglamento.js). Sin red, sin DOM.

     node equipos/tools/eval-reglamento.mjs

   Lo que vigila, por orden de importancia:

     1. Que NO se acuse a nadie de algo que el acta no demuestra. Un
        falso «alineación indebida» es mucho peor que no comprobar: se
        lo lleva el entrenador a una reunión y hace el ridículo.
     2. Que cuando la regla no CABE con esos inscritos se diga eso, y no
        se señale a un crío por una imposibilidad aritmética del equipo.
     3. Que lo que sí incumple se explique con nombre, periodos y regla,
        que es lo que hace falta para poder discutirlo.
   ============================================================ */

import {
  REGLAS, reglasDe, cabeLaRegla, comprobar, veredicto, textoReglas,
} from '../js/data/reglamento.js';
import { filaVacia } from '../js/data/acta.js';

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

const PARTIDO = { id: 'm1', periodos: 6, marcador_favor: 38, marcador_contra: 30, faltas_equipo: [] };

/* Una fila de acta con su rejilla. */
const F = (nombre, periodos, puntos = 0, faltas = 0) => ({
  ...filaVacia({ id: nombre, nombre, dorsal: 4 }),
  periodos, periodos_jugados: periodos.length, periodos_descansados: 6 - periodos.length,
  puntos, faltas,
});

/* Diez jugadores, reparto legal: los cinco primeros periodos tienen 25
   puestos y cada uno juega 2 o 3, descansando 2 o 3. */
const LEGAL = [
  F('A', [1, 2, 6]), F('B', [1, 2]), F('C', [1, 2, 3]), F('D', [1, 3]), F('E', [1, 3]),
  F('F', [4, 5]), F('G', [4, 5]), F('H', [3, 4, 5]), F('I', [2, 4, 5]), F('J', [3, 4, 5]),
];

/* ── 1. La tabla de reglas ─────────────────────────────────── */

console.log('\n· las reglas de cada categoría');

test('minibasket juega a seis periodos y reparte los cinco primeros', () => {
  const r = reglasDe('minibasket');
  eq(r.periodos, 6);
  eq(r.rotacion, { deLosPrimeros: 5, jugarMin: 2, descansarMin: 2 });
});

test('de infantil para arriba NO hay regla de reparto, y eso es la regla', () => {
  /* `rotacion: null` no es un hueco por rellenar: en cadete se juega a
     ganar y el reparto lo decide el entrenador. */
  eq(reglasDe('cadete').rotacion, null);
  eq(reglasDe('senior').rotacion, null);
});

test('una categoría que no conocemos no se inventa', () => {
  eq(reglasDe('preinfantil'), null);
  eq(reglasDe(null), null);
  const r = comprobar(PARTIDO, LEGAL, { categoria: 'preinfantil' });
  eq(r.incumple, [], 'y sobre todo NO acusa a nadie');
  ok(r.noSePuede[0].includes('preinfantil'), r.noSePuede[0]);
});

test('sin categoría se dice que las reglas dependen de ella', () => {
  const r = comprobar(PARTIDO, LEGAL, {});
  eq(r.incumple, []);
  ok(r.noSePuede[0].includes('categoría'), r.noSePuede[0]);
});

/* ── 2. ¿Cabía la regla? ───────────────────────────────────── */

console.log('\n· si la regla cabía, antes de acusar a nadie');

test('con ocho inscritos la regla es imposible, y se dice', () => {
  /* 25 puestos en los cinco primeros y un techo de 3 por jugador: con
     ocho solo se llega a 24. Alguien TIENE que pasarse. */
  const c = cabeLaRegla(8, reglasDe('minibasket'));
  ok(!c.posible);
  ok(c.porque.includes('25') && c.porque.includes('3'), c.porque);
});

test('con trece tampoco: no hay dos periodos para cada uno', () => {
  const c = cabeLaRegla(13, reglasDe('minibasket'));
  ok(!c.posible);
  ok(c.porque.includes('26') && c.porque.includes('25'), c.porque);
});

test('con nueve a doce sí cabe', () => {
  for (const n of [9, 10, 11, 12]) ok(cabeLaRegla(n, reglasDe('minibasket')).posible, `con ${n}`);
});

test('y cuando no cabe NO se señala a ningún crío', () => {
  /* Es el fallo que este módulo no puede cometer: acusar a un niño de
     una imposibilidad aritmética del equipo entero. */
  const ocho = LEGAL.slice(0, 8);
  const r = comprobar(PARTIDO, ocho, { categoria: 'minibasket' });
  ok(!r.incumple.some((x) => x.regla === 'rotacion'), JSON.stringify(r.incumple));
  ok(r.avisa.some((x) => x.regla === 'rotacion' && x.texto.includes('no se puede cumplir')), JSON.stringify(r.avisa));
});

/* ── 3. La rotación ────────────────────────────────────────── */

console.log('\n· los dos periodos de los cinco primeros');

test('un reparto legal no dice nada', () => {
  const r = comprobar(PARTIDO, LEGAL, { categoria: 'minibasket' });
  eq(r.incumple.filter((x) => x.regla === 'rotacion'), []);
  eq(r.inscritos, 10);
});

test('el que juega uno solo de los cinco primeros sale con nombre y periodo', () => {
  /* «Alineación indebida» no se puede discutir con nadie; «jugó 1 de
     los 5 primeros, solo el P3, y el mínimo son 2» sí. */
  const filas = [...LEGAL];
  filas[1] = F('B', [1, 6]);
  const r = comprobar(PARTIDO, filas, { categoria: 'minibasket' });
  const x = r.incumple.find((i) => i.texto.startsWith('B '));
  ok(x, JSON.stringify(r.incumple));
  ok(x.texto.includes('1 de los 5') && x.texto.includes('solo el P1') && x.texto.includes('mínimo son 2'), x.texto);
});

test('y el que no descansa dos, también', () => {
  const filas = [...LEGAL];
  filas[0] = F('A', [1, 2, 3, 4]);
  const r = comprobar(PARTIDO, filas, { categoria: 'minibasket' });
  const x = r.incumple.find((i) => i.texto.includes('descansó'));
  ok(x && x.texto.includes('1 de los 5') && x.texto.includes('descansar 2'), JSON.stringify(r.incumple));
});

test('el sexto periodo no cuenta para la regla', () => {
  /* La regla habla de los CINCO primeros: el sexto es libre y jugarlo
     entero no incumple nada. */
  const filas = [...LEGAL];
  filas[0] = F('A', [1, 2, 6]);
  const r = comprobar(PARTIDO, filas, { categoria: 'minibasket' });
  ok(!r.incumple.some((i) => i.texto.startsWith('A ')), JSON.stringify(r.incumple));
});

test('en cadete no se mira el reparto', () => {
  const filas = [F('A', [1, 2, 3, 4, 5]), ...LEGAL.slice(1)];
  const r = comprobar({ ...PARTIDO, periodos: 4 }, filas, { categoria: 'cadete' });
  eq(r.incumple.filter((x) => x.regla === 'rotacion'), []);
});

test('sin rejilla no se contesta: se dice que falta', () => {
  /* Un acta dictada al chat (4.2) da el total y no los periodos.
     Contestar «todo bien» sería mentir. */
  const sinRejilla = LEGAL.map((f) => ({ ...f, periodos: [] }));
  const r = comprobar(PARTIDO, sinRejilla, { categoria: 'minibasket' });
  eq(r.incumple.filter((x) => x.regla === 'rotacion'), []);
  ok(r.noSePuede.some((t) => t.includes('rejilla')), JSON.stringify(r.noSePuede));
});

/* ── 4. Los inscritos ──────────────────────────────────────── */

console.log('\n· cuántos hay en el acta');

test('una fila en blanco no es un inscrito', () => {
  /* No es un jugador que no jugó: es un crío que no vino, y el
     reglamento no habla de los que no vinieron. */
  const conVacias = [...LEGAL, filaVacia({ id: 'z', nombre: 'No vino', dorsal: 20 })];
  eq(comprobar(PARTIDO, conVacias, { categoria: 'minibasket' }).inscritos, 10);
});

test('menos de los que pide la categoría se dice', () => {
  const r = comprobar(PARTIDO, LEGAL.slice(0, 6), { categoria: 'minibasket' });
  ok(r.incumple.some((x) => x.regla === 'inscritos' && x.texto.includes('6') && x.texto.includes('10')), JSON.stringify(r.incumple));
});

test('y más de los que caben, también', () => {
  const trece = [...LEGAL, F('K', [6]), F('L', [6]), F('M', [6])];
  const r = comprobar(PARTIDO, trece, { categoria: 'minibasket' });
  ok(r.incumple.some((x) => x.regla === 'inscritos' && x.texto.includes('13')), JSON.stringify(r.incumple));
});

/* ── 5. Lo que se avisa sin acusar ─────────────────────────── */

console.log('\n· lo que se avisa, que no es lo mismo que incumplir');

test('una columna que no suma cinco es un acta mal copiada, no una falta', () => {
  const filas = [...LEGAL];
  filas[0] = F('A', [2, 6]);          // el P1 se queda con cuatro
  const r = comprobar(PARTIDO, filas, { categoria: 'minibasket' });
  ok(r.avisa.some((x) => x.regla === 'en_pista' && x.texto.includes('P1 (4)')), JSON.stringify(r.avisa));
  ok(!r.incumple.some((x) => x.regla === 'en_pista'), 'y no se acusa por ello');
});

test('llegar al bonus se cuenta, no se castiga', () => {
  const p = { ...PARTIDO, faltas_equipo: [{ favor: 5, contra: 2 }, { favor: 1, contra: 6 }] };
  const r = comprobar(p, LEGAL, { categoria: 'minibasket' });
  ok(r.avisa.some((x) => x.texto.includes('Llegamos al bonus') && x.texto.includes('P1')), JSON.stringify(r.avisa));
  ok(r.avisa.some((x) => x.texto.includes('El rival') && x.texto.includes('P2')), JSON.stringify(r.avisa));
  eq(r.incumple.filter((x) => x.regla === 'faltas_equipo'), []);
});

/* ── 6. La regla de los 50 puntos ──────────────────────────── */

console.log('\n· el tope de diferencia');

test('más de 50 de diferencia no lo puede decir un acta de minibasket', () => {
  const r = comprobar({ ...PARTIDO, marcador_favor: 82, marcador_contra: 20 }, LEGAL, { categoria: 'minibasket' });
  ok(r.incumple.some((x) => x.regla === 'tope' && x.texto.includes('62') && x.texto.includes('50')), JSON.stringify(r.incumple));
});

test('exactamente 50 sí', () => {
  const r = comprobar({ ...PARTIDO, marcador_favor: 70, marcador_contra: 20 }, LEGAL, { categoria: 'minibasket' });
  eq(r.incumple.filter((x) => x.regla === 'tope'), []);
});

test('y da igual quién gane', () => {
  const r = comprobar({ ...PARTIDO, marcador_favor: 20, marcador_contra: 82 }, LEGAL, { categoria: 'minibasket' });
  ok(r.incumple.some((x) => x.regla === 'tope'), JSON.stringify(r.incumple));
});

test('en cadete no hay tope', () => {
  const r = comprobar({ ...PARTIDO, periodos: 4, marcador_favor: 90, marcador_contra: 20 }, LEGAL, { categoria: 'cadete' });
  eq(r.incumple.filter((x) => x.regla === 'tope'), []);
});

/* ── 7. El titular ─────────────────────────────────────────── */

console.log('\n· lo que se lee de un vistazo');

test('cumple, incumple, a medias y sin nada se distinguen', () => {
  eq(veredicto(comprobar(PARTIDO, LEGAL, { categoria: 'minibasket' })).estado, 'cumple');

  const malo = [...LEGAL]; malo[1] = F('B', [1, 6]);
  eq(veredicto(comprobar(PARTIDO, malo, { categoria: 'minibasket' })).estado, 'incumple');

  const sinRejilla = LEGAL.map((f) => ({ ...f, periodos: [] }));
  eq(veredicto(comprobar(PARTIDO, sinRejilla, { categoria: 'minibasket' })).estado, 'a_medias');

  eq(veredicto(comprobar(PARTIDO, [], { categoria: 'minibasket' })).estado, 'sin');
  eq(veredicto(comprobar(PARTIDO, LEGAL, {})).estado, 'sin');
});

test('y las reglas usadas se pueden enseñar', () => {
  const t = textoReglas(reglasDe('minibasket'), 'minibasket');
  ok(t.includes('5 en pista') && t.includes('2 jugados y 2 descansados de los 5 primeros')
    && t.includes('10 a 12 inscritos') && t.includes('tope de 50'), t);
  eq(textoReglas(null, 'x'), '');
});

test('todas las categorías del club tienen reglas', () => {
  /* Si alguien añade una categoría a la app y se olvida de aquí, la
     pantalla dirá «no tengo las reglas» y nadie sabrá por qué. */
  for (const c of ['babybasket', 'premini', 'minibasket', 'alevin', 'infantil', 'cadete', 'junior', 'senior']) {
    ok(REGLAS[c], `falta ${c}`);
  }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
