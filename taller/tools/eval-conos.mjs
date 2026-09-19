/* ============================================================
   eval-conos.mjs — banco Node de qué hace cada cono con un trazo
   (taller/js/pizarra/conos.js). Sin red, sin DOM.

     node taller/tools/eval-conos.mjs

   El §7.4 es una tabla de números en metros: 1,5 m del trazo para
   rodear, 3 m entre los dos de una puerta, 1 m en los extremos. Lo que
   se prueba aquí es justo eso —que los números son esos y que se miden
   en metros, no en coordenadas—, porque es lo que decide si el
   entrenador ve un slalom donde puso un slalom.
   ============================================================ */

import { interpretarConos, respectoAlTrazo, sorteandoDe, otroLado, CONOS } from '../js/pizarra/conos.js';
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

const E = escalaDe('entera');                 // 18 × 27 m
const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
/* Un trazo recto de abajo arriba por el centro, de 0,8 a 0,2 (16,2 m). */
const RECTO = [N(0.5, 0.8), N(0.5, 0.2)];
/* Conos por metros desde el eje del trazo: a la derecha en la pista es
   x mayor. */
const cono = (id, metrosX, y, extra = {}) => ({ id, kind: 'cono', x: 0.5 + metrosX / E.x, y, ...extra });

/* ── 1. Los números del §7.4 ─────────────────────────────── */

test('LOS NÚMEROS SON LOS DEL §7.4, en metros', () => {
  eq([CONOS.rodeo, CONOS.puerta, CONOS.extremos], [1.5, 3.0, 1.0]);
  ok(Object.isFrozen(CONOS), 'y nadie los cambia por accidente');
});

test('UN CONO A MENOS DE 1,5 m DEL TRAZO SE RODEA; a más, no', () => {
  const cerca = interpretarConos(RECTO, [cono('c1', 1.2, 0.5)], { pista: 'entera' });
  eq(cerca.length, 1);
  eq([cerca[0].tipo, cerca[0].conos], ['rodeo', ['c1']]);
  eq(interpretarConos(RECTO, [cono('c1', 1.8, 0.5)], { pista: 'entera' }), [], 'a 1,8 m ya no:');
});

test('Y SE MIDE EN METROS, no en coordenadas: la pista no escala igual', () => {
  /* 1,2 m en horizontal son 0,067 en x; los mismos 0,067 en vertical son
     1,8 m. Si se midiera en [0,1], el de arriba también se rodearía. */
  const horizontal = cono('c1', 1.2, 0.5);
  const vertical = { id: 'c2', kind: 'cono', x: 0.5, y: 0.5 };
  const trazoLateral = [N(0.2, 0.5), N(0.8, 0.5)];   // recto de izquierda a derecha
  const arriba = { id: 'c3', kind: 'cono', x: 0.5, y: 0.5 + 0.067 };
  eq(interpretarConos(RECTO, [horizontal], { pista: 'entera' }).length, 1);
  eq(interpretarConos(trazoLateral, [arriba], { pista: 'entera' }).length, 0, 'a 1,8 m del trazo lateral, no:');
  ok(metrosEntre('entera', vertical, arriba) > 1.5, 'porque de verdad está a más de 1,5 m');
});

test('UN CONO PEGADO AL ORIGEN O AL DESTINO NO SE SORTEA: se sale o se llega', () => {
  const salida = { id: 'c1', kind: 'cono', x: 0.5 + 0.5 / E.x, y: 0.8 };
  const llegada = { id: 'c2', kind: 'cono', x: 0.5 + 0.5 / E.x, y: 0.2 };
  eq(interpretarConos(RECTO, [salida, llegada], { pista: 'entera' }), []);
});

test('UN CONO QUE ES FILA NUNCA SE SORTEA: es un sitio, no un obstáculo', () => {
  const fila = cono('c1', 1.0, 0.5, { fila: { n_jugadores: 3 } });
  eq(interpretarConos(RECTO, [fila], { pista: 'entera' }), []);
});

/* ── 2. El lado ──────────────────────────────────────────── */

test('EL LADO ES POR DÓNDE PASA EL JUGADOR: con el cono a su derecha, pasa por su izquierda', () => {
  /* El trazo sube por el centro: quien corre mira hacia el aro norte, así
     que un cono con MÁS x le queda a la derecha… y lo rodea por la
     izquierda. */
  const aSuDerecha = interpretarConos(RECTO, [cono('c1', 1.0, 0.5)], { pista: 'entera' })[0];
  eq(aSuDerecha.lado, 'izq', 'cono a la derecha del que corre:');
  const aSuIzquierda = interpretarConos(RECTO, [cono('c2', -1.0, 0.5)], { pista: 'entera' })[0];
  eq(aSuIzquierda.lado, 'der');
  /* Y bajando, al revés: la izquierda y la derecha son las del jugador. */
  const BAJANDO = [N(0.5, 0.2), N(0.5, 0.8)];
  eq(interpretarConos(BAJANDO, [cono('c3', 1.0, 0.5)], { pista: 'entera' })[0].lado, 'der',
    'el mismo cono, corriendo al revés:');
  eq(otroLado('izq'), 'der');
  eq(otroLado('der'), 'izq');
});

test('Y SE SABE POR DÓNDE VA EL TRAZO: a cuántos metros pasa y en qué punto', () => {
  const r = respectoAlTrazo(RECTO, cono('c1', 1.0, 0.5), 'entera');
  ok(Math.abs(r.metros - 1.0) < 1e-6, `a un metro: ${r.metros}`);
  ok(Math.abs(r.en - 0.5) < 0.02, `por la mitad del trazo: ${r.en}`);
  eq(respectoAlTrazo([N(0.5, 0.5)], cono('c1', 1, 0.5), 'entera'), null, 'un trazo de un nodo no dice nada:');
  eq(respectoAlTrazo(RECTO, null, 'entera'), null);
});

/* ── 3. Slalom ───────────────────────────────────────────── */

test('TRES CONOS EN HILERA CERCA DEL TRAZO SON UN SLALOM, no tres rodeos', () => {
  /* En hilera son LOS CONOS: el que zigzaguea es el jugador. */
  const r = interpretarConos(RECTO, [
    cono('c1', 0.3, 0.65), cono('c2', 0.0, 0.5), cono('c3', -0.3, 0.35),
  ], { pista: 'entera' });
  eq(r.length, 1);
  eq([r[0].tipo, r[0].conos], ['zigzag', ['c1', 'c2', 'c3']], 'y en el orden en que se encuentran:');
});

test('y con DOS no hay slalom, aunque estén en hilera: son dos rodeos', () => {
  const r = interpretarConos(RECTO, [cono('c1', 0.3, 0.65), cono('c2', 0.0, 0.5)], { pista: 'entera' });
  eq(r.map((x) => x.tipo), ['rodeo', 'rodeo'], 'el §7.4 pide tres o más:');
});

test('tres conos que NO están en hilera son tres rodeos', () => {
  /* El de en medio, muy desviado: eso no es un slalom. */
  const r = interpretarConos(RECTO, [
    cono('c1', 0.5, 0.70), cono('c2', 1.4, 0.55), cono('c3', -1.4, 0.40),
  ], { pista: 'entera' });
  eq(r.map((x) => x.tipo), ['rodeo', 'rodeo', 'rodeo']);
});

/* ── 4. Puerta ───────────────────────────────────────────── */

test('DOS CONOS A MENOS DE 3 m CON EL TRAZO PASANDO ENTRE ELLOS SON UNA PUERTA', () => {
  const r = interpretarConos(RECTO, [cono('c1', 1.2, 0.5), cono('c2', -1.2, 0.5)], { pista: 'entera' });
  eq(r.length, 1);
  eq([r[0].tipo, r[0].conos, r[0].lado], ['puerta', ['c1', 'c2'], null], 'por una puerta se pasa por dentro:');
});

test('y a más de 3 m entre ellos ya no son puerta: son dos conos', () => {
  /* Uno a cada lado del camino pero separados a lo largo: 7,3 m entre
     ellos, cada uno a 1,4 m del trazo. */
  const r = interpretarConos(RECTO, [cono('c1', 1.4, 0.60), cono('c2', -1.4, 0.35)], { pista: 'entera' });
  eq(r.map((x) => x.tipo), ['rodeo', 'rodeo']);
});

test('DOS CONOS AL MISMO LADO NO SON PUERTA aunque estén cerca', () => {
  const r = interpretarConos(RECTO, [cono('c1', 1.0, 0.52), cono('c2', 1.2, 0.48)], { pista: 'entera' });
  ok(!r.some((x) => x.tipo === 'puerta'), `no hay puerta: ${JSON.stringify(r.map((x) => x.tipo))}`);
});

test('UNA PUERTA ANCHA CUENTA AUNQUE SUS PALOS ESTÉN LEJOS DEL TRAZO', () => {
  /* Los dos a 1,4 m del camino: ninguno se rodearía por su cuenta a esa
     distancia si estuviera solo… pero juntos son la puerta por la que se
     pasa. */
  const r = interpretarConos(RECTO, [cono('c1', 1.45, 0.5), cono('c2', -1.45, 0.5)], { pista: 'entera' });
  eq(r.map((x) => x.tipo), ['puerta']);
});

test('y un cono pegado a la puerta no se cuenta dos veces', () => {
  const r = interpretarConos(RECTO, [cono('c1', 1.2, 0.5), cono('c2', -1.2, 0.5)], { pista: 'entera' });
  const ids = r.flatMap((x) => x.conos);
  eq(new Set(ids).size, ids.length, 'ningún cono sale en dos lecturas:');
});

/* ── 5. Lo que se guarda ─────────────────────────────────── */

test('SE GUARDA LA INTENCIÓN, no la curva: qué cono y por qué lado', () => {
  const rodeo = { tipo: 'rodeo', conos: ['c1'], lado: 'izq', en: 0.5 };
  eq(sorteandoDe([rodeo]), [{ cono: 'c1', lado: 'izq' }]);
  const zig = { tipo: 'zigzag', conos: ['c1', 'c2', 'c3'], lado: 'der', en: 0.2 };
  eq(sorteandoDe([zig]), [
    { cono: 'c1', lado: 'der' }, { cono: 'c2', lado: 'izq' }, { cono: 'c3', lado: 'der' },
  ], 'el slalom alterna desde el lado de entrada:');
  eq(sorteandoDe([{ tipo: 'puerta', conos: ['c1', 'c2'], lado: null, en: 0.4 }]), [{ puerta: ['c1', 'c2'] }]);
  eq(sorteandoDe([]), []);
  eq(sorteandoDe(null), []);
});

/* ── 6. Lo que no rompe ──────────────────────────────────── */

test('sin conos, sin trazo o con basura no se inventa nada', () => {
  eq(interpretarConos(RECTO, []), []);
  eq(interpretarConos(RECTO, null), []);
  eq(interpretarConos([N(0.5, 0.5)], [cono('c1', 1, 0.5)]), [], 'un trazo de un solo nodo:');
  eq(interpretarConos(null, [cono('c1', 1, 0.5)]), []);
  eq(interpretarConos(RECTO, [null, { id: 'roto' }, { id: 'c9', x: 0.5, y: NaN }]), []);
});

test('LAS LECTURAS SALEN EN EL ORDEN EN QUE SE LAS ENCUENTRA', () => {
  const r = interpretarConos(RECTO, [
    cono('tarde', 1.0, 0.30), cono('pronto', -1.0, 0.70),
  ], { pista: 'entera' });
  eq(r.map((x) => x.conos[0]), ['pronto', 'tarde']);
  ok(r[0].en < r[1].en);
  /* Y una puerta que se cruza DESPUÉS de un rodeo sale después, aunque
     las puertas se busquen antes. */
  const mezcla = interpretarConos(RECTO, [
    cono('rodeo', 1.0, 0.70), cono('puerta_a', 1.2, 0.35), cono('puerta_b', -1.2, 0.35),
  ], { pista: 'entera' });
  eq(mezcla.map((x) => x.tipo), ['rodeo', 'puerta'], 'primero el rodeo, que cae antes:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
