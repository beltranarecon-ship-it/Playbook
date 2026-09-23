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

import {
  interpretarConos, respectoAlTrazo, sorteandoDe, otroLado, trazoSorteando, sitioAlPasar,
  sinSorteos, volverASortear, intencionDe, cruceConPuerta, puertasDe, CONOS,
} from '../js/pizarra/conos.js';
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
  eq(sorteandoDe([rodeo]), [{ cono: 'c1', lado: 'izq', tipo: 'rodeo' }]);
  const zig = { tipo: 'zigzag', conos: ['c1', 'c2', 'c3'], lado: 'der', en: 0.2 };
  eq(sorteandoDe([zig]), [
    { cono: 'c1', lado: 'der', tipo: 'zigzag' }, { cono: 'c2', lado: 'izq', tipo: 'zigzag' }, { cono: 'c3', lado: 'der', tipo: 'zigzag' },
  ], 'el slalom alterna desde el lado de entrada:');
  eq(sorteandoDe([{ tipo: 'puerta', conos: ['c1', 'c2'], lado: null, en: 0.4 }]),
    [{ cono: 'c1', puerta: ['c1', 'c2'], tipo: 'puerta' }], 'una puerta, por su primer palo:');
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

/* ── 7. El trazo que sortea ──────────────────────────────── */

test('EL TRAZO SE CURVA PARA PASAR A 0,9 m DEL CONO, por el lado leído', () => {
  const c = cono('c1', 0.3, 0.5);
  const lecturas = interpretarConos(RECTO, [c], { pista: 'entera' });
  const t = trazoSorteando(RECTO, lecturas, [c], { pista: 'entera' });
  ok(t.length === RECTO.length + 1, `mete un nodo: ${t.length} nodos`);
  const r = respectoAlTrazo(t, c, 'entera');
  ok(Math.abs(r.metros - CONOS.paso) < 0.15, `pasa a ${r.metros.toFixed(2)} m del cono`);
  eq(r.lado, lecturas[0].lado, 'y por el mismo lado que decía la lectura:');
  eq([t[0].x, t[0].y], [RECTO[0].x, RECTO[0].y], 'el origen no se toca:');
  eq([t[t.length - 1].x, t[t.length - 1].y], [RECTO[1].x, RECTO[1].y], 'ni el destino:');
});

test('UN SLALOM METE UN NODO POR CONO, alternando lados', () => {
  const conos = [cono('c1', 0.3, 0.65), cono('c2', 0.0, 0.5), cono('c3', -0.3, 0.35)];
  const lecturas = interpretarConos(RECTO, conos, { pista: 'entera' });
  eq(lecturas[0].tipo, 'zigzag');
  const t = trazoSorteando(RECTO, lecturas, conos, { pista: 'entera' });
  eq(t.length, RECTO.length + 3, 'tres nodos nuevos:');
  const lados = conos.map((c) => respectoAlTrazo(t, c, 'entera').lado);
  ok(lados[0] !== lados[1] && lados[1] !== lados[2], `alterna: ${lados.join(', ')}`);
});

test('una puerta no curva el trazo: se pasa por dentro y ya', () => {
  const conos = [cono('c1', 1.2, 0.5), cono('c2', -1.2, 0.5)];
  const lecturas = interpretarConos(RECTO, conos, { pista: 'entera' });
  eq(lecturas[0].tipo, 'puerta');
  eq(trazoSorteando(RECTO, lecturas, conos, { pista: 'entera' }), RECTO);
});

test('sin lecturas, sin conos o con un trazo roto, el trazo se queda como estaba', () => {
  eq(trazoSorteando(RECTO, [], [], { pista: 'entera' }), RECTO);
  eq(trazoSorteando(RECTO, null, null, { pista: 'entera' }), RECTO);
  const c = cono('c1', 0.3, 0.5);
  eq(trazoSorteando(RECTO, interpretarConos(RECTO, [c]), [], { pista: 'entera' }), RECTO, 'sin saber dónde está el cono:');
  eq(trazoSorteando([N(0.5, 0.5)], [], []), [N(0.5, 0.5)]);
});

test('EL NODO QUE PONE UN CONO QUEDA MARCADO, y se puede quitar', () => {
  const c = cono('c1', 0.3, 0.5);
  const t = trazoSorteando(RECTO, interpretarConos(RECTO, [c], { pista: 'entera' }), [c], { pista: 'entera' });
  const puesto = t.filter((n) => n.por_cono);
  eq(puesto.length, 1);
  eq(puesto[0].por_cono, 'c1');
  ok(puesto[0].lado === 'izq' || puesto[0].lado === 'der', 'con su lado');
  eq(sinSorteos(t).length, RECTO.length, 'y quitándolo se vuelve al trazo dibujado:');
  eq(sinSorteos(t, new Set(['otro'])).length, t.length, 'quitando solo los de otro cono, no se toca:');
});

test('MOVER EL CONO REHACE LA CURVA: se guardó la intención, no el trazo', () => {
  const c = cono('c1', 0.3, 0.5);
  const uno = volverASortear(RECTO, [c], { pista: 'entera' });
  const antes = respectoAlTrazo(uno.trazo, c, 'entera');
  /* El cono se va al otro lado del camino: la curva tiene que rehacerse
     por el lado nuevo, y sin acumular nodos. */
  const movido = { ...c, x: 0.5 - 0.3 / E.x };
  const dos = volverASortear(uno.trazo, [movido], { pista: 'entera' });
  eq(dos.trazo.filter((n) => n.por_cono).length, 1, 'un solo nodo puesto por el cono:');
  const despues = respectoAlTrazo(dos.trazo, movido, 'entera');
  ok(Math.abs(despues.metros - CONOS.paso) < 0.15, `sigue pasando a 0,9 m: ${despues.metros.toFixed(2)}`);
  ok(antes.lado !== despues.lado, `y por el otro lado: ${antes.lado} → ${despues.lado}`);
});

test('Y UN CLIC CAMBIA EL LADO: se fuerza y se rehace', () => {
  const c = cono('c1', 0.3, 0.5);
  const uno = volverASortear(RECTO, [c], { pista: 'entera' });
  const lado = uno.lecturas[0].lado;
  const dos = volverASortear(uno.trazo, [c], { pista: 'entera', lados: { c1: otroLado(lado) } });
  eq(respectoAlTrazo(dos.trazo, c, 'entera').lado, otroLado(lado), 'pasa por el otro lado:');
  eq(dos.trazo.filter((n) => n.por_cono).length, 1, 'y sigue habiendo un solo nodo suyo:');
});

test('y si el cono desaparece, el trazo vuelve a ser el que se dibujó', () => {
  const c = cono('c1', 0.3, 0.5);
  const uno = volverASortear(RECTO, [c], { pista: 'entera' });
  const dos = volverASortear(uno.trazo, [], { pista: 'entera' });
  eq(dos.trazo.length, RECTO.length);
  eq(dos.lecturas, []);
});

test('LO ANULADO NO SE VUELVE A LEER aunque el cono siga ahí', () => {
  const c = cono('c1', 0.3, 0.5);
  const r = volverASortear(RECTO, [c], { pista: 'entera', anulados: new Set(['c1']) });
  eq(r.lecturas, [], 'no se lee:');
  eq(r.trazo.length, RECTO.length, 'y el trazo pasa recto:');
});

test('DE LA INTENCIÓN SALE LO QUE HAY QUE RESPETAR: el lado de cada lectura y lo anulado', () => {
  const i = intencionDe([
    { cono: 'c1', lado: 'izq', tipo: 'rodeo' },
    { cono: 'z1', lado: 'der', tipo: 'zigzag' }, { cono: 'z2', lado: 'izq', tipo: 'zigzag' }, { cono: 'z3', lado: 'der', tipo: 'zigzag' },
    { cono: 'c9', anulado: true },
  ]);
  eq(i.lados, { c1: 'izq', z1: 'der' }, 'del slalom solo manda el primero:');
  eq([...i.anulados], ['c9']);
  const vacia = intencionDe(null);
  eq([vacia.lados, [...vacia.anulados], [...vacia.forzadas]], [{}, [], []]);
});

/* ── 8. Puertas (§7.4.1) ─────────────────────────────────── */

test('LAS PUERTAS DE UNA FASE: las que se cruzan, con sus palos, y sin las anuladas', () => {
  const conos = [cono('pa', -1.0, 0.5), cono('pb', 1.0, 0.5)];
  const cruzada = [{ sorteando: [{ cono: 'pa', puerta: ['pa', 'pb'], tipo: 'puerta' }] }];
  const p = puertasDe(cruzada, conos);
  eq(p.map((x) => x.ids), [['pa', 'pb']]);
  eq([p[0].a.x, p[0].b.x], [conos[0].x, conos[1].x], 'con dónde está cada palo:');
  eq(puertasDe([...cruzada, ...cruzada], conos).length, 1, 'una puerta que cruzan dos trazos es UNA puerta:');
  /* Anulada, en cualquiera de sus formas —también la que pudiera traer
     una jugada guardada con el tipo puesto—, no cuenta. */
  eq(puertasDe([{ sorteando: [{ cono: 'pa', anulado: true, grupo: 'pa' }, { cono: 'pb', anulado: true, grupo: 'pa' }] }], conos), []);
  eq(puertasDe([{ sorteando: [{ cono: 'pa', puerta: ['pa', 'pb'], tipo: 'puerta', anulado: true }] }], conos), []);
  eq(puertasDe(cruzada, [conos[0]]), [], 'sin uno de sus palos en la pista, tampoco:');
});

test('LOS CONOS DE UN SLALOM APRETADO NO SON PUERTAS: el trazo los recorre, no los cruza', () => {
  /* Cuatro conos en hilera a 2 m: cada par está a menos de 3 m, pero el
     trazo va A LO LARGO de la recta que los une. */
  const conos = [0, 1, 2, 3].map((k) => cono(`c${k}`, k % 2 ? 0.2 : -0.2, 0.65 - k * (2 / E.y)));
  const r = interpretarConos(RECTO, conos, { pista: 'entera' });
  ok(!r.some((x) => x.tipo === 'puerta'), `sin puertas: ${JSON.stringify(r.map((x) => x.tipo))}`);
  eq(r.map((x) => x.tipo), ['zigzag']);
});

test('UN TRAZO QUE ROZA UN PALO POR FUERA SE IMANTA A PASAR POR DENTRO', () => {
  /* Puerta de 2 m, de x=+0,3 a x=+2,3: el trazo recto pasa 0,3 m por
     fuera del primer palo. */
  const a = cono('a', 0.3, 0.5), b = cono('b', 2.3, 0.5);
  const r = interpretarConos(RECTO, [a, b], { pista: 'entera' });
  eq(r.map((x) => [x.tipo, !!x.imantada]), [['puerta', true]], 'es la puerta, imantada:');
  const t = trazoSorteando(RECTO, r, [a, b], { pista: 'entera' });
  ok(t.some((n) => n.puerta && n.por_cono === 'a'), 'mete un nodo marcado por la puerta');
  const cruce = cruceConPuerta(t, a, b, 'entera');
  ok(cruce && cruce.dentro, 'y ahora pasa por DENTRO');
});

test('y lejos de la puerta, no la hay: más allá de la banda es cosa de otro', () => {
  /* El trazo pasa 1,0 m por fuera del primer palo: fuera de la banda. */
  const a = cono('a', 1.0, 0.5), b = cono('b', 3.0, 0.5);
  const r = interpretarConos(RECTO, [a, b], { pista: 'entera' });
  ok(!r.some((x) => x.tipo === 'puerta'), `no hay puerta: ${JSON.stringify(r.map((x) => x.tipo))}`);
});

test('UNA PUERTA QUE YA SE CRUZA POR DENTRO NO SE TOCA', () => {
  const a = cono('a', -1.0, 0.5), b = cono('b', 1.0, 0.5);
  const r = interpretarConos(RECTO, [a, b], { pista: 'entera' });
  eq(r.map((x) => [x.tipo, !!x.imantada]), [['puerta', false]]);
  eq(trazoSorteando(RECTO, r, [a, b], { pista: 'entera' }), RECTO, 'el trazo queda como estaba:');
});

test('UNA PUERTA FORZADA POR FUERA SE SIGUE LEYENDO, sin imán, para marcarla en rojo', () => {
  const a = cono('a', 0.3, 0.5), b = cono('b', 2.3, 0.5);
  const r = interpretarConos(RECTO, [a, b], { pista: 'entera', forzadas: new Set(['a', 'b']) });
  eq(r.map((x) => [x.tipo, !!x.forzada, !!x.dentro]), [['puerta', true, false]], 'forzada y por fuera:');
  eq(trazoSorteando(RECTO, r, [a, b], { pista: 'entera' }), RECTO, 'y no se imanta:');
  eq([...intencionDe(sorteandoDe(r)).forzadas].sort(), ['a', 'b'], 'lo forzado queda en la intención:');
  /* Y lo forzado MANDA sobre el imán, diga la lectura lo que diga: el
     entrenador lo ha llevado por fuera a propósito. */
  const lectura = [{ tipo: 'puerta', conos: ['a', 'b'], lado: null, en: 0.5, imantada: true, forzada: true }];
  eq(trazoSorteando(RECTO, lectura, [a, b], { pista: 'entera' }), RECTO, 'forzada e imantada a la vez, no se toca:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
