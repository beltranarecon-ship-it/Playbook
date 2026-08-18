/* ============================================================
   eval-rondas.mjs — banco Node de las rondas de fila
   (taller/js/ia/rondas.js). Sin red, sin DOM.

     node taller/tools/eval-rondas.mjs

   Lo que vigila: que repetir una ronda no pierda nada por el camino.
   Un movimiento que se quede sin sustituir deja a un jugador
   corriendo el turno de otro, y eso en pantalla es indistinguible de
   un ejercicio raro — no de un fallo.
   ============================================================ */

import {
  expandirRondas, desfaseEnFases, entregasEntreRondas, soloPrimeraRonda,
} from '../js/ia/rondas.js';

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

/** Una ronda de tres fases con el actor 'fila1' en todos los papeles. */
const ronda1 = () => [
  {
    id: 'fase_1', duracion_ms: 1500, pausa_post_ms: 400,
    movimientos: [{ elemento_id: 'fila1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: [{ x: 0.8, y: 0.5 }, { x: 0.4, y: 0.5 }] }],
    pases: [], tiros: [], recogidas: [], bloqueos: [], defensores: [],
  },
  {
    id: 'fase_2', duracion_ms: 1000, pausa_post_ms: 600,
    movimientos: [],
    pases: [], tiros: [{ jugador_id: 'fila1', balon_id: 'balon_1', canasta: 'norte', path: [{ x: 0.4, y: 0.5 }, { x: 0.2, y: 0.5 }] }],
    recogidas: [], bloqueos: [], defensores: [],
  },
  {
    id: 'fase_3', duracion_ms: 1200, pausa_post_ms: 200,
    movimientos: [
      { elemento_id: 'fila1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_sin_balon', path: [{ x: 0.4, y: 0.5 }, { x: 0.8, y: 0.6 }] },
      { elemento_id: 'balon_1', tipo_elemento: 'balon', tipo_movimiento: 'recogida', path: [{ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.6 }] },
    ],
    pases: [], tiros: [], recogidas: [{ jugador_id: 'fila1', balon_id: 'balon_1' }], bloqueos: [], defensores: [],
  },
];

const TRES = { actor: 'fila1', siguientes: ['fila1_2', 'fila1_3'] };

console.log('· repetir la ronda');

test('sin siguientes, la animación se queda como estaba', () => {
  const r = expandirRondas(ronda1(), { actor: 'fila1', siguientes: [] });
  eq(r.rondas, 1);
  eq(r.fases.length, 3);
  eq(r.fases.map((f) => f.ronda), [1, 1, 1]);
});

test('tres en la cola dan tres rondas, una detrás de otra', () => {
  const r = expandirRondas(ronda1(), TRES);
  eq(r.rondas, 3);
  eq(r.fases.length, 9, 'sin cadencia, las rondas no se solapan');
  eq(r.fases.map((f) => f.ronda), [1, 1, 1, 2, 2, 2, 3, 3, 3]);
});

test('cada ronda la corre QUIEN le toca, en todos los papeles', () => {
  // Es el fallo que no se vería: si una clave se queda sin sustituir,
  // en pantalla sale un jugador corriendo el turno de otro y parece un
  // ejercicio raro, no un error.
  const r = expandirRondas(ronda1(), TRES);
  const actorDe = (f) => new Set([
    ...f.movimientos.filter((m) => m.tipo_elemento === 'jugador').map((m) => m.elemento_id),
    ...f.tiros.map((t) => t.jugador_id),
    ...f.recogidas.map((x) => x.jugador_id),
  ]);
  const esperado = ['fila1', 'fila1_2', 'fila1_3'];
  for (const f of r.fases) {
    for (const a of actorDe(f)) eq(a, esperado[f.ronda - 1], `fase ${f.id} (ronda ${f.ronda})`);
  }
});

test('las fases se renumeran de corrido', () => {
  const r = expandirRondas(ronda1(), TRES);
  eq(r.fases.map((f) => f.id), ['fase_1', 'fase_2', 'fase_3', 'fase_4', 'fase_5', 'fase_6', 'fase_7', 'fase_8', 'fase_9']);
});

test('el balón no cambia de identidad al cambiar de ronda', () => {
  // El balón es el MISMO en las tres rondas: es un ejercicio de un
  // balón, y el que vuelve se lo entrega al siguiente.
  const r = expandirRondas(ronda1(), TRES);
  const ids = new Set(r.fases.flatMap((f) => [
    ...f.tiros.map((t) => t.balon_id),
    ...f.recogidas.map((x) => x.balon_id),
    ...f.movimientos.filter((m) => m.tipo_elemento === 'balon').map((m) => m.elemento_id),
  ]));
  eq([...ids], ['balon_1']);
});

console.log('\n· la cadencia');

test('sin cadencia, el desfase es una ronda entera', () => {
  eq(desfaseEnFases(ronda1(), null), 3);
  eq(desfaseEnFases(ronda1(), 0), 3);
});

test('la cadencia se redondea a la fase más cercana', () => {
  // fases de 1900, 1600 y 1400 ms → media 1633 ms
  eq(desfaseEnFases(ronda1(), 1.6), 1);
  eq(desfaseEnFases(ronda1(), 3.3), 2);
  eq(desfaseEnFases(ronda1(), 100), 3, 'nunca más de una ronda entera');
});

test('una cadencia diminuta no pone dos rondas a la vez', () => {
  // Dos rondas exactamente en la misma fase no son dos rondas: no se
  // distinguirían ni en el contador ni en pantalla.
  eq(desfaseEnFases(ronda1(), 0.1), 1);
});

test('con cadencia, las rondas se solapan y la animación se acorta', () => {
  const r = expandirRondas(ronda1(), { ...TRES, cadencia_s: 1.6 });
  eq(r.fases.length, 5, '3 fases + 2 rondas desfasadas una fase');
  eq(r.rondas, 3);
});

test('al solaparse, una fase lleva a los dos que están dentro', () => {
  const r = expandirRondas(ronda1(), { ...TRES, cadencia_s: 1.6 });
  const f2 = r.fases[1];
  const actores = f2.movimientos.filter((m) => m.tipo_elemento === 'jugador').map((m) => m.elemento_id);
  ok(actores.includes('fila1_2'), `la ronda 2 debería haber salido ya: ${JSON.stringify(actores)}`);
  ok(f2.tiros.some((t) => t.jugador_id === 'fila1'), 'y la ronda 1 debería estar tirando');
});

test('la fase solapada dura lo que la más larga', () => {
  // Cortar por la corta dejaría un tiro a medias.
  const r = expandirRondas(ronda1(), { ...TRES, cadencia_s: 1.6 });
  eq(r.fases[1].duracion_ms, 1500, 'el tiro dura 1000 y la carrera 1500');
});

test('el número de ronda es el del PRIMERO que ocupó la fase', () => {
  // «2 de 6» significa «va saliendo el segundo», no «hay dos a la vez».
  const r = expandirRondas(ronda1(), { ...TRES, cadencia_s: 1.6 });
  eq(r.fases.map((f) => f.ronda), [1, 1, 1, 2, 3]);
});

console.log('\n· la entrega del balón entre rondas');

test('el balón viaja de donde quedó a manos del siguiente', () => {
  // Sin esto salta de un fotograma al siguiente de un lado a otro.
  const r = expandirRondas(ronda1(), TRES);
  const entregas = entregasEntreRondas(r.fases, { inicioDe: () => ({ x: 0.8, y: 0.5 }) });
  eq(entregas.length, 2, 'una entrega entre cada dos rondas');
  const p = entregas[0].movimiento.path;
  eq(p[0], { x: 0.8, y: 0.6, tipo_nodo: 'lineal' }, 'sale de donde lo dejó el que volvió');
  eq(p[1], { x: 0.8, y: 0.5, tipo_nodo: 'lineal' }, 'y llega a quien sale ahora');
});

test('si el balón ya está donde toca, no se inventa un viaje', () => {
  const r = expandirRondas(ronda1(), TRES);
  const entregas = entregasEntreRondas(r.fases, { inicioDe: () => ({ x: 0.8, y: 0.6 }) });
  eq(entregas.length, 0);
});

test('sin saber dónde arranca el siguiente, no se entrega nada', () => {
  const r = expandirRondas(ronda1(), TRES);
  eq(entregasEntreRondas(r.fases, {}), []);
  eq(entregasEntreRondas(r.fases, { inicioDe: () => null }), []);
});

console.log('\n· la miniatura y el guion');

test('solo enseñan la primera ronda', () => {
  const r = expandirRondas(ronda1(), TRES);
  eq(soloPrimeraRonda(r.fases).length, 3);
  eq(soloPrimeraRonda(r.fases).every((f) => f.ronda === 1), true);
});

test('una animación sin rondas se devuelve entera', () => {
  // Las 204 fichas de la biblioteca no llevan rondas: el guion y la
  // miniatura tienen que seguir viéndolas completas.
  const sinRondas = ronda1();
  eq(soloPrimeraRonda(sinRondas).length, 3);
});

console.log('\n· lo que no debe romperse');

test('una ronda vacía no revienta ni inventa fases', () => {
  const r = expandirRondas([], TRES);
  eq(r.fases, []);
});

test('basura de entrada devuelve algo utilizable', () => {
  for (const v of [null, undefined, 'texto', 42, {}]) {
    const r = expandirRondas(v, TRES);
    ok(Array.isArray(r.fases), `con ${JSON.stringify(v)} debería devolver fases`);
  }
});

test('una fase sin sus listas no rompe la sustitución', () => {
  const r = expandirRondas([{ id: 'fase_1', duracion_ms: 1000, pausa_post_ms: 0 }], TRES);
  eq(r.fases.length, 3);
  for (const f of r.fases) {
    ok(Array.isArray(f.movimientos) && Array.isArray(f.pases), 'las listas tienen que existir');
  }
});

test('el actor de la ronda 1 no se toca', () => {
  // La ronda 1 se copia tal cual: es la que ya estaba comprobada.
  const base = ronda1();
  const r = expandirRondas(base, TRES);
  eq(r.fases[0].movimientos[0].elemento_id, 'fila1');
  eq(base[0].movimientos[0].elemento_id, 'fila1', 'y no se modifica la entrada');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
