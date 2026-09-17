/* ============================================================
   eval-defensa.mjs — banco Node de los papeles y los pares
   (taller/js/pizarra/motor/defensa.js). Sin red, sin DOM.

     node taller/tools/eval-defensa.mjs

   Lo que se vigila es que la pregunta «¿quién defiende a quién?» tenga
   UNA respuesta y que sea la que decidió el entrenador: ataca quien tiene
   el balón al empezar, y si no está claro, nadie defiende; los pares a
   mano, por dorsal y por cercanía, uno a uno; y la situación contada con
   los que están en juego.
   ============================================================ */

import {
  REGLAS, PARAMETROS, SITUACIONES, defensaPorDefecto, parametrosDe, normalizarDefensa,
  quienAtaca, emparejar, situacionDe, papelesDeJugada, tramosQueNoEncajan,
} from '../js/pizarra/motor/defensa.js';
import { anadir, asignarBalon, reiniciarIds } from '../js/pizarra/elementos.js';
import { posicionesDe } from '../js/canvas/anclas.js';

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

/** Una escena como las de la Pizarra, con nombres cortos para leer. */
function escena(fichas) {
  reiniciarIds();
  let l = [];
  const ids = {};
  for (const [nombre, kind, equipo, x, y, extra] of fichas) {
    l = anadir(l, { kind, equipo }, x, y);
    const e = l[l.length - 1];
    ids[nombre] = e.id;
    if (extra) l = l.map((z) => (z.id === e.id ? { ...z, ...extra } : z));
  }
  return { l, ids, dar: (balon, jugador) => { l = asignarBalon(l, ids[balon], ids[jugador], 'entera'); return l; } };
}
const nombres = (ids, lista) => lista.map((id) => Object.keys(ids).find((k) => ids[k] === id));
/* Los pares con nombres cortos y por orden de nombre, para comparar sin
   depender del orden en que se fueron decidiendo. */
const paresEn = (ids, pares) => Object.fromEntries(Object.entries(pares)
  .map(([d, a]) => [nombres(ids, [d])[0], a ? nombres(ids, [a])[0] : null])
  .sort(([x], [y]) => (x < y ? -1 : 1)));

/* ── 1. Quién ataca ──────────────────────────────────────── */

test('ATACA EL EQUIPO QUE TIENE EL BALÓN AL EMPEZAR', () => {
  const e = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['B1', 'jugador', 'B', 0.3, 0.6], ['bal', 'balon', null, 0.3, 0.6]]);
  eq(quienAtaca({ elementos: e.dar('bal', 'B1') }), 'B', 'lo tiene el B:');
  eq(quienAtaca({ elementos: e.dar('bal', 'A1') }), 'A', 'y si lo tiene el A:');
});

test('SIN ATACANTE CLARO NO DEFIENDE NADIE: balón suelto, sin balón, o balones en dos equipos', () => {
  const suelto = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['B1', 'jugador', 'B', 0.3, 0.6], ['bal', 'balon', null, 0.5, 0.5]]);
  eq(quienAtaca({ elementos: suelto.l }), null, 'suelto:');
  const sin = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['B1', 'jugador', 'B', 0.3, 0.6]]);
  eq(quienAtaca({ elementos: sin.l }), null, 'sin balón:');
  const dos = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['B1', 'jugador', 'B', 0.3, 0.6], ['b1', 'balon', null, 0.3, 0.8], ['b2', 'balon', null, 0.3, 0.6]]);
  dos.dar('b1', 'A1');
  eq(quienAtaca({ elementos: dos.dar('b2', 'B1') }), null, 'dos equipos con balón:');
  const mismo = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['A2', 'jugador', 'A', 0.6, 0.8], ['b1', 'balon', null, 0.3, 0.8], ['b2', 'balon', null, 0.6, 0.8]]);
  mismo.dar('b1', 'A1');
  eq(quienAtaca({ elementos: mismo.dar('b2', 'A2') }), 'A', 'dos balones del mismo equipo, ataca ese:');
});

test('LO QUE DIGAN LOS AJUSTES MANDA: un equipo, o «nadie defiende»', () => {
  const e = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['B1', 'jugador', 'B', 0.3, 0.6], ['bal', 'balon', null, 0.3, 0.6]]);
  const l = e.dar('bal', 'A1');
  eq(quienAtaca({ elementos: l, defensa: { ataca: 'B' } }), 'B');
  eq(quienAtaca({ elementos: l, defensa: { ataca: 'nadie' } }), null);
  eq(quienAtaca({ elementos: l, defensa: { ataca: 'C' } }), null, 'un equipo que no está en la pista no ataca:');
});

/* ── 2. Los pares ────────────────────────────────────────── */

test('POR DORSAL: el defensor 2 defiende al atacante 2, esté donde esté', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.2, 0.8], ['A2', 'jugador', 'A', 0.8, 0.8],
    ['B1', 'jugador', 'B', 0.75, 0.7], ['B2', 'jugador', 'B', 0.25, 0.7], ['bal', 'balon', null, 0.2, 0.8],
  ]);
  const r = emparejar({ elementos: e.dar('bal', 'A1') });
  eq(r.ataca, 'A');
  eq(nombres(e.ids, r.atacantes), ['A1', 'A2']);
  eq(nombres(e.ids, r.defensores), ['B1', 'B2']);
  eq(paresEn(e.ids, r.pares), { B1: 'A1', B2: 'A2' }, 'por número y no por cercanía:');
});

test('EL DORSAL QUE CUENTA ES EL QUE SE VE: puesto a mano, no el orden de colocación', () => {
  /* Un equipo del club con sus dorsales de verdad: el 7 defiende al 7
     aunque se colocara el primero. */
  const e = escena([
    ['A4', 'jugador', 'A', 0.2, 0.8, { dorsal: 4 }], ['A7', 'jugador', 'A', 0.8, 0.8, { dorsal: 7 }],
    ['B7', 'jugador', 'B', 0.25, 0.7, { dorsal: 7 }], ['B4', 'jugador', 'B', 0.75, 0.7, { dorsal: 4 }], ['bal', 'balon', null, 0.2, 0.8],
  ]);
  eq(paresEn(e.ids, emparejar({ elementos: e.dar('bal', 'A4') }).pares), { B4: 'A4', B7: 'A7' });
});

test('DOS «DEFIENDE A…» AL MISMO ATACANTE: el primero se lo queda y el otro se empareja solo', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.2, 0.8], ['A2', 'jugador', 'A', 0.8, 0.8],
    ['B1', 'jugador', 'B', 0.2, 0.7], ['B2', 'jugador', 'B', 0.8, 0.7], ['C1', 'jugador', 'C', 0.5, 0.2], ['bal', 'balon', null, 0.2, 0.8],
  ]);
  let l = e.dar('bal', 'A1');
  l = l.map((x) => (x.id === e.ids.B1 || x.id === e.ids.B2 ? { ...x, defiende_a: e.ids.A2 } : x));
  l = l.map((x) => (x.id === e.ids.C1 ? { ...x, defiende_a: e.ids.B1 } : x));   // a un defensor: no vale
  const r = emparejar({ elementos: l });
  const usados = Object.values(r.pares).filter(Boolean);
  eq(new Set(usados).size, usados.length, `ningún atacante dos veces: ${JSON.stringify(paresEn(e.ids, r.pares))}`);
  eq(paresEn(e.ids, r.pares).B1, 'A2', 'el primero con su «defiende a…»:');
  ok(!Object.values(r.pares).includes(e.ids.B1), 'y nadie defiende a un defensor');
});

test('«DEFIENDE A…» PUESTO A MANO MANDA sobre el dorsal', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.2, 0.8], ['A2', 'jugador', 'A', 0.8, 0.8],
    ['B1', 'jugador', 'B', 0.2, 0.7], ['B2', 'jugador', 'B', 0.8, 0.7], ['bal', 'balon', null, 0.2, 0.8],
  ]);
  let l = e.dar('bal', 'A1');
  l = l.map((x) => (x.id === e.ids.B1 ? { ...x, defiende_a: e.ids.A2 } : x));
  eq(paresEn(e.ids, emparejar({ elementos: l }).pares), { B1: 'A2', B2: 'A1' }, 'el B2 se queda con el que queda:');
});

test('SIN DORSAL QUE COINCIDA, EL ATACANTE LIBRE MÁS CERCANO, de dos en dos', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.2, 0.8], ['A2', 'jugador', 'A', 0.8, 0.8],
    ['C1', 'jugador', 'C', 0.5, 0.5], ['bal', 'balon', null, 0.2, 0.8],
    ['B1', 'jugador', 'B', 0.2, 0.75], ['B2', 'jugador', 'B', 0.78, 0.75],
  ]);
  const l = e.dar('bal', 'A1').map((x) => (x.id === e.ids.B2 ? { ...x, dorsal: 9 } : x));
  const r = emparejar({ elementos: l });
  /* C1 va antes en la escena y es el 1: se queda con A1 por dorsal. B1
     también es el 1, pero A1 ya tiene defensor. B2 lleva el 9: no coincide
     con nadie. Queda A2 libre, y la pareja más corta es B2–A2, aunque B1
     también la quisiera; B1 se queda sin par (superioridad). */
  eq(paresEn(e.ids, r.pares), { B1: null, B2: 'A2', C1: 'A1' });
});

test('EN SITIOS SIMÉTRICOS DE LA PISTA EL EMPATE LO DECIDE EL ORDEN, no el último decimal', () => {
  /* Base y los dos escoltas de la pista entera: distancias que se
     diferencian en un ulp. */
  const pos = posicionesDe('entera', 'norte');
  const [bx, by] = pos.base, [dx, dy] = pos.escolta_der, [ix, iy] = pos.escolta_izq;
  for (const primero of ['der', 'izq']) {
    const fichas = [['A1', 'jugador', 'A', bx, by], ['bal', 'balon', null, bx, by]];
    const der = ['Bder', 'jugador', 'B', dx, dy, { dorsal: 8 }];
    const izq = ['Bizq', 'jugador', 'B', ix, iy, { dorsal: 9 }];
    const e = escena([...fichas, ...(primero === 'der' ? [der, izq] : [izq, der])]);
    const pares = paresEn(e.ids, emparejar({ elementos: e.dar('bal', 'A1') }).pares);
    eq(pares[primero === 'der' ? 'Bder' : 'Bizq'], 'A1', `con ${primero} primero:`);
  }
});

test('UNO A UNO: ningún atacante con dos defensores ni al revés, y en empate manda el orden', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.5, 0.5], ['bal', 'balon', null, 0.5, 0.5],
    ['B1', 'jugador', 'B', 0.4, 0.5, { dorsal: 7 }], ['B2', 'jugador', 'B', 0.6, 0.5, { dorsal: 8 }],
  ]);
  const r = emparejar({ elementos: e.dar('bal', 'A1') });
  eq(paresEn(e.ids, r.pares), { B1: 'A1', B2: null }, 'a la misma distancia, el primero de la escena:');
});

test('QUIEN NO ESTÁ EN JUEGO NO ATACA NI DEFIENDE', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.2, 0.8], ['A2', 'jugador', 'A', 0.8, 0.8, { en_juego: false }],
    ['B1', 'jugador', 'B', 0.2, 0.7], ['B2', 'jugador', 'B', 0.8, 0.7, { en_juego: false }], ['bal', 'balon', null, 0.2, 0.8],
  ]);
  const r = emparejar({ elementos: e.dar('bal', 'A1') });
  eq(nombres(e.ids, r.atacantes), ['A1']);
  eq(nombres(e.ids, r.defensores), ['B1']);
});

test('CON TRES EQUIPOS DEFIENDEN TODOS LOS QUE NO TIENEN EL BALÓN', () => {
  const e = escena([
    ['A1', 'jugador', 'A', 0.2, 0.8], ['B1', 'jugador', 'B', 0.2, 0.7], ['C1', 'jugador', 'C', 0.8, 0.7], ['bal', 'balon', null, 0.2, 0.8],
  ]);
  eq(nombres(e.ids, emparejar({ elementos: e.dar('bal', 'A1') }).defensores), ['B1', 'C1']);
});

test('SIN ATACANTE NO HAY PAPELES: ni defensores ni pares', () => {
  const e = escena([['A1', 'jugador', 'A', 0.2, 0.8], ['B1', 'jugador', 'B', 0.2, 0.7]]);
  eq(emparejar({ elementos: e.l }), { ataca: null, atacantes: [], defensores: [], pares: {} });
});

/* ── 3. La situación (§8.2) ──────────────────────────────── */

test('IGUALDAD, INFERIORIDAD Y SUPERIORIDAD, contando a los que juegan', () => {
  eq(situacionDe({ atacantes: ['a', 'b'], defensores: ['c', 'd'] }), 'igualdad');
  eq(situacionDe({ atacantes: ['a', 'b'], defensores: ['c'] }), 'inferioridad', 'menos defensores:');
  eq(situacionDe({ atacantes: ['a'], defensores: ['c', 'd'] }), 'superioridad', 'más defensores:');
  eq(situacionDe({ atacantes: ['a'], defensores: [] }), null, 'sin defensa no hay situación:');
  eq(situacionDe({ atacantes: ['a'], defensores: [], defensa: { situacion: 'igualdad' } }), null, 'ni aunque se haya forzado:');
  eq(situacionDe({ atacantes: ['a', 'b'], defensores: ['c'], defensa: { situacion: 'igualdad' } }), 'igualdad', 'la forzada manda:');
});

/* ── 4. Todo junto ───────────────────────────────────────── */

test('LOS PAPELES DE UNA JUGADA: al empezar y uno por fase', () => {
  const e = escena([['A1', 'jugador', 'A', 0.2, 0.8], ['A2', 'jugador', 'A', 0.8, 0.8], ['B1', 'jugador', 'B', 0.2, 0.7], ['bal', 'balon', null, 0.2, 0.8]]);
  const p = papelesDeJugada({ pista: 'entera', elementos: e.dar('bal', 'A1'), fases: [{ tramos: [] }, { tramos: [] }], defensa: null });
  eq(p.fases.length, 2);
  eq(p.inicio.situacion, 'inferioridad');
  eq(nombres(e.ids, p.fases[1].defensores), ['B1']);
  eq(papelesDeJugada(null).fases, [], 'sin jugada, sin fases y sin romperse');
});

test('LOS TRAMOS DE UN DEFENSOR QUE NO SON DE DEFENSA SE SEÑALAN, y los demás no', () => {
  const e = escena([['A1', 'jugador', 'A', 0.2, 0.8], ['B1', 'jugador', 'B', 0.2, 0.7], ['bal', 'balon', null, 0.2, 0.8]]);
  const jugada = {
    pista: 'entera', elementos: e.dar('bal', 'A1'),
    fases: [{ tramos: [
      { id: 't1', elemento_id: e.ids.B1, accion: 'corta' },
      { id: 't2', elemento_id: e.ids.B1, accion: 'recoge' },
      { id: 't3', elemento_id: e.ids.A1, accion: 'corta' },
    ] }],
  };
  const malos = tramosQueNoEncajan(jugada, papelesDeJugada(jugada), (slug) => slug === 'recoge');
  eq(malos.map((m) => m.tramo.id), ['t1']);
});

/* ── 5. Los ajustes guardados ────────────────────────────── */

test('UNA DEFENSA SIN TOCAR ES LA DE SERIE, y los números de serie son los acordados', () => {
  eq(defensaPorDefecto(), { preajuste: 'entre_par_y_aro', parametros: {}, situacion: null, ataca: null });
  eq(REGLAS, ['entre_par_y_aro', 'niega_linea', 'ayuda_y_flota', 'presion']);
  eq(SITUACIONES, ['igualdad', 'inferioridad', 'superioridad']);
  eq([PARAMETROS.par_con_balon, PARAMETROS.par_sin_balon, PARAMETROS.niega_hasta, PARAMETROS.flota_hasta, PARAMETROS.presion, PARAMETROS.trampa],
    [1.2, 2.0, 7.0, 3.5, 1.0, 1.5], 'los del §8.3:');
  eq([PARAMETROS.niega_paso, PARAMETROS.retrasa_zona_tiro, PARAMETROS.sobrepasado, PARAMETROS.cierra_rebote],
    [0.8, 6.75, 1.2, 0.8], 'y los que aceptó el entrenador:');
  ok(Object.isFrozen(PARAMETROS), 'nadie los cambia por accidente');
  eq(parametrosDe({ parametros: { presion: 0.5 } }).presion, 0.5, 'los del ejercicio mandan:');
  eq(parametrosDe(null).presion, 1.0);
});

test('LO QUE LLEGA MAL SE QUITA Y SE DICE; lo que falta, no se dice', () => {
  eq(normalizarDefensa(undefined), { defensa: defensaPorDefecto(), avisos: [] });
  const r = normalizarDefensa({ preajuste: 'zona_2_3', parametros: { presion: -1, trampa: 2, raro: 3 }, situacion: 'caos', ataca: 'Z' });
  eq(r.defensa, { preajuste: 'entre_par_y_aro', parametros: { trampa: 2 }, situacion: null, ataca: null });
  eq(r.avisos.length, 5, `cinco cosas mal, cinco avisos: ${r.avisos}`);
  eq(normalizarDefensa('hola').avisos.length, 1);
  const heredadas = normalizarDefensa({ parametros: { toString: 5, constructor: 2 } });
  eq([heredadas.defensa.parametros, heredadas.avisos.length], [{}, 2], 'las claves que todo objeto hereda no cuelan:');
  for (const roto of ['presion=1', 7, true, [1]]) {
    const r2 = normalizarDefensa({ parametros: roto });
    eq([r2.defensa.parametros, r2.avisos.length], [{}, 1], `unos números que no son un objeto (${JSON.stringify(roto)}) se dicen:`);
  }
  eq(normalizarDefensa({ preajuste: 'presion', situacion: 'superioridad', ataca: 'nadie' }).defensa,
    { preajuste: 'presion', parametros: {}, situacion: 'superioridad', ataca: 'nadie' }, 'lo bueno se conserva:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
