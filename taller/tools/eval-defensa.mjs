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
  colocar, explicarRegla, enCancha,
} from '../js/pizarra/motor/defensa.js';
import { metrosEntre, escalaDe } from '../js/canvas/escala.js';
import { limitesCancha } from '../js/canvas/medidas.js';
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

/* ── 6. Dónde se coloca cada uno (§8.3) ──────────────────── */

const AR = (() => { const a = posicionesDe('entera', 'norte').aro; return { x: a[0], y: a[1] }; })();
const M = (a, b) => metrosEntre('entera', a, b);
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
/* Una escena con papeles ya calculados, lista para colocar. */
function situada(fichas, { dar = [], defensa = null, papelesExtra = null } = {}) {
  const e = escena(fichas);
  let l = e.l;
  for (const [b, j] of dar) l = e.dar(b, j);
  const p = papelesDeJugada({ pista: 'entera', elementos: l, fases: [{}], defensa }).inicio;
  const donde = (n) => { const x = l.find((z) => z.id === e.ids[n]); return { x: x.x, y: x.y }; };
  const col = (extra = {}) => colocar({ pista: 'entera', canasta: 'norte', elementos: l, papeles: { ...p, ...(papelesExtra || {}) }, defensa, ...extra });
  return { ...e, l, p, donde, col, sitio: (n, extra) => col(extra)[e.ids[n]] };
}
/* ¿Está `q` sobre la recta a→b, entre los dos? En metros. */
const enLaLinea = (a, b, q) => cerca(M(a, q) + M(q, b), M(a, b), 1e-6);

test('ENTRE SU PAR Y EL ARO: 2,0 m sin balón y 1,2 m con balón, sobre la línea al aro', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['A2', 'jugador', 'A', 0.7, 0.5], ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.7, 0.6], ['bal', 'balon', null, 0.3, 0.5]], { dar: [['bal', 'A1']] });
  const b1 = s.sitio('B1'), b2 = s.sitio('B2');
  ok(cerca(M(b1, s.donde('A1')), 1.2) && enLaLinea(s.donde('A1'), AR, b1), `B1 a ${M(b1, s.donde('A1'))} m del que tiene el balón`);
  ok(cerca(M(b2, s.donde('A2')), 2.0) && enLaLinea(s.donde('A2'), AR, b2), `B2 a ${M(b2, s.donde('A2'))} m de su par sin balón`);
  eq([b1.aplica, b2.aplica], ['entre_par_y_aro', 'entre_par_y_aro']);
});

test('PRESIÓN AL BALÓN: a 1,0 m del que lo lleva y CORTÁNDOLE EL CAMINO al aro', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['A2', 'jugador', 'A', 0.7, 0.5], ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.7, 0.6], ['bal', 'balon', null, 0.3, 0.5]], { dar: [['bal', 'A1']], defensa: { preajuste: 'presion' } });
  const b1 = s.sitio('B1'), b2 = s.sitio('B2');
  ok(cerca(M(b1, s.donde('A1')), 1.0), `B1 a ${M(b1, s.donde('A1'))} m`);
  ok(enLaLinea(s.donde('A1'), AR, b1), 'sobre la línea al aro, no a un lado');
  eq([b1.regla, b1.aplica, b2.regla, b2.aplica], ['presion', 'presion', 'presion', 'entre_par_y_aro']);
});

test('NEGAR LA LÍNEA: un paso de 0,8 m hacia el balón, solo si su par está a menos de 7 m', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['A2', 'jugador', 'A', 0.55, 0.5], ['A3', 'jugador', 'A', 0.9, 0.9], ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.55, 0.6], ['B3', 'jugador', 'B', 0.9, 0.8], ['bal', 'balon', null, 0.3, 0.5]], { dar: [['bal', 'A1']], defensa: { preajuste: 'niega_linea' } });
  ok(M(s.donde('A2'), s.donde('A1')) < 7 && M(s.donde('A3'), s.donde('A1')) > 7, 'la escena es la que dice la prueba');
  const b2 = s.sitio('B2'), b3 = s.sitio('B3');
  ok(cerca(M(b2, s.donde('A2')), 0.8) && enLaLinea(s.donde('A2'), s.donde('A1'), b2), `B2 niega: ${JSON.stringify(b2)}`);
  eq([b2.aplica, b3.aplica, s.sitio('B1').aplica], ['niega_linea', 'entre_par_y_aro', 'entre_par_y_aro'], 'lejos del balón no niega, y al del balón no se le niega nada:');
});

test('AYUDA Y FLOTA: se hunde hacia la línea balón→aro sin pasar de 3,5 m de su par', () => {
  const s = situada([['A1', 'jugador', 'A', 0.5, 0.45], ['A2', 'jugador', 'A', 0.1, 0.35], ['B1', 'jugador', 'B', 0.5, 0.40], ['B2', 'jugador', 'B', 0.12, 0.3], ['bal', 'balon', null, 0.5, 0.45]], { dar: [['bal', 'A1']], defensa: { preajuste: 'ayuda_y_flota' } });
  const b2 = s.sitio('B2');
  const normal = s.sitio('B2', { defensa: null });
  ok(M(b2, s.donde('A2')) <= 3.5 + 1e-6, `no pasa de 3,5 m: ${M(b2, s.donde('A2'))}`);
  ok(cerca(M(b2, s.donde('A2')), 3.5, 1e-3), 'y, como la línea queda lejos, se queda justo en el límite');
  ok(M(b2, s.donde('A1')) < M(normal, s.donde('A1')), 'y está más cerca del balón que sin flotar');
  /* Y se hunde HACIA LA LÍNEA balón→aro: más cerca de ella que su sitio de
     siempre, no en cualquier dirección que acerque al balón. */
  const aLaLinea = (q) => {
    const B = s.donde('A1');
    const e = escalaDe('entera');
    const ax = B.x * e.x, ay = B.y * e.y, dx = (AR.x - B.x) * e.x, dy = (AR.y - B.y) * e.y;
    const l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((q.x * e.x - ax) * dx + (q.y * e.y - ay) * dy) / l2));
    return Math.hypot(q.x * e.x - (ax + dx * t), q.y * e.y - (ay + dy * t));
  };
  ok(aLaLinea(b2) < aLaLinea(normal) - 0.5, `se hunde hacia la línea: ${aLaLinea(b2).toFixed(2)} m frente a ${aLaLinea(normal).toFixed(2)}`);
  eq([b2.aplica, s.sitio('B1').aplica], ['ayuda_y_flota', 'entre_par_y_aro'], 'y al del balón se le defiende como siempre:');
});

test('AYUDA Y FLOTA CON UN LÍMITE MÁS CORTO que los 2 m de siempre no se pasa', () => {
  const s = situada([['A1', 'jugador', 'A', 0.5, 0.45], ['A2', 'jugador', 'A', 0.1, 0.35], ['B1', 'jugador', 'B', 0.5, 0.40], ['B2', 'jugador', 'B', 0.12, 0.3], ['bal', 'balon', null, 0.5, 0.45]], { dar: [['bal', 'A1']], defensa: { preajuste: 'ayuda_y_flota', parametros: { flota_hasta: 1.5 } } });
  ok(M(s.sitio('B2'), s.donde('A2')) <= 1.5 + 1e-6, `a ${M(s.sitio('B2'), s.donde('A2'))} m de su par`);
});

test('LA REGLA PROPIA DE UN DEFENSOR MANDA sobre la del ejercicio', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['B1', 'jugador', 'B', 0.3, 0.6, { regla_defensa: 'presion' }], ['bal', 'balon', null, 0.3, 0.5]], { dar: [['bal', 'A1']] });
  eq([s.sitio('B1').regla, s.sitio('B1').aplica], ['presion', 'presion']);
});

test('INFERIORIDAD: NO RETRASA EL QUE MARCA AL BALÓN, aunque sea el más cercano al aro', () => {
  /* El defensor del portador está pegado al aro y el otro, lejos: aun así
     retrasa el otro, que es lo que decidió el entrenador. */
  const s = situada([
    ['A1', 'jugador', 'A', 0.5, 0.25], ['A2', 'jugador', 'A', 0.2, 0.7], ['A3', 'jugador', 'A', 0.8, 0.7],
    ['B1', 'jugador', 'B', 0.5, 0.18], ['B2', 'jugador', 'B', 0.2, 0.75], ['bal', 'balon', null, 0.5, 0.25],
  ], { dar: [['bal', 'A1']] });
  eq(s.p.situacion, 'inferioridad');
  ok(M(s.donde('B1'), AR) < M(s.donde('B2'), AR), 'el del balón es el más cercano al aro (si no, la prueba no prueba nada)');
  eq(s.p.retrasa, s.ids.B2, 'retrasa el que NO marca al balón:');
  const c = s.col();
  eq([c[s.ids.B1].aplica, c[s.ids.B2].aplica], ['entre_par_y_aro', 'retrasa']);
});

test('Y QUIEN RETRASA NO CAMBIA al volver a preguntar con la defensa ya colocada', () => {
  /* El papel se decide con la escena del principio: si se decidiera con
     donde está cada uno, colocar los movería y en la vuelta siguiente
     retrasaría el otro, en contra del §8.2. */
  const s = situada([
    ['A1', 'jugador', 'A', 0.5, 0.6], ['A2', 'jugador', 'A', 0.2, 0.45], ['A3', 'jugador', 'A', 0.8, 0.45],
    ['B1', 'jugador', 'B', 0.5, 0.55], ['B2', 'jugador', 'B', 0.25, 0.3], ['bal', 'balon', null, 0.5, 0.6],
  ], { dar: [['bal', 'A1']] });
  const primera = s.col();
  const movidos = s.l.map((e) => (primera[e.id] ? { ...e, x: primera[e.id].x, y: primera[e.id].y } : e));
  const segunda = colocar({ pista: 'entera', canasta: 'norte', elementos: movidos, papeles: s.p, defensa: null });
  eq(Object.fromEntries(Object.entries(segunda).map(([k, v]) => [k, v.aplica])),
    Object.fromEntries(Object.entries(primera).map(([k, v]) => [k, v.aplica])), 'los mismos papeles:');
});

test('EL QUE RETRASA NO SE PONE ENCIMA DEL DEFENSOR DEL BALÓN: si ya está marcado, protege el aro', () => {
  const s = situada([
    ['A1', 'jugador', 'A', 0.5, 0.28], ['A2', 'jugador', 'A', 0.2, 0.5], ['A3', 'jugador', 'A', 0.8, 0.5],
    ['B1', 'jugador', 'B', 0.5, 0.35], ['B2', 'jugador', 'B', 0.3, 0.55], ['bal', 'balon', null, 0.5, 0.28],
  ], { dar: [['bal', 'A1']] });
  const c = s.col();
  ok(M(s.donde('A1'), AR) < 6.75, 'el que lleva el balón está en zona de tiro (si no, la prueba no prueba nada)');
  ok(M(c[s.ids.B1], c[s.ids.B2]) > 1, `no se tapan: ${M(c[s.ids.B1], c[s.ids.B2]).toFixed(2)} m`);
  ok(enLaLinea(s.donde('A1'), AR, c[s.ids.B2]), 'el que retrasa se queda protegiendo, en la línea balón→aro');
});

test('INFERIORIDAD: RETRASA EL MÁS CERCANO AL ARO QUE NO MARCA AL BALÓN, y los demás siguen', () => {
  /* 3 contra 2: B1 marca a A1 (balón), B2 marca a A2 y está más cerca del aro. */
  const s = situada([['A1', 'jugador', 'A', 0.5, 0.6], ['A2', 'jugador', 'A', 0.2, 0.45], ['A3', 'jugador', 'A', 0.8, 0.45], ['B1', 'jugador', 'B', 0.5, 0.55], ['B2', 'jugador', 'B', 0.25, 0.3], ['bal', 'balon', null, 0.5, 0.6]], { dar: [['bal', 'A1']] });
  eq(s.p.situacion, 'inferioridad');
  const c = s.col();
  eq([c[s.ids.B1].aplica, c[s.ids.B2].aplica], ['entre_par_y_aro', 'retrasa']);
  const b2 = c[s.ids.B2];
  ok(enLaLinea(s.donde('A1'), AR, b2), 'sobre la línea balón→aro');
  ok(cerca(M(b2, AR), 6.75), `lejos del aro, en el borde de la zona de tiro: ${M(b2, AR)}`);
});

test('RETRASA SALE AL QUE TIENE EL BALÓN EN CUANTO ENTRA EN ZONA DE TIRO, sin saltos', () => {
  const retrasaA = (y) => {
    const s = situada([['A1', 'jugador', 'A', AR.x, y], ['A2', 'jugador', 'A', 0.2, 0.2], ['B1', 'jugador', 'B', 0.5, 0.15], ['bal', 'balon', null, AR.x, y]], { dar: [['bal', 'A1']] });
    return { b: s.sitio('B1'), a1: s.donde('A1') };
  };
  const dentro = retrasaA(AR.y + 5 / escalaDe('entera').y);
  ok(dentro.b.aplica === 'retrasa' && cerca(M(dentro.b, dentro.a1), 1.2), `a 5 m del aro sale a por él: ${M(dentro.b, dentro.a1)}`);
  const antes = retrasaA(AR.y + (6.75 + 1e-4) / escalaDe('entera').y);
  const despues = retrasaA(AR.y + (6.75 - 1e-4) / escalaDe('entera').y);
  ok(M(antes.b, despues.b) < 0.01, `en el borde no da saltos: ${M(antes.b, despues.b)} m`);
});

test('CON UN SOLO DEFENSOR EN INFERIORIDAD, RETRASA ÉL', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.6], ['A2', 'jugador', 'A', 0.7, 0.6], ['B1', 'jugador', 'B', 0.3, 0.55], ['bal', 'balon', null, 0.3, 0.6]], { dar: [['bal', 'A1']] });
  eq(s.sitio('B1').aplica, 'retrasa');
});

test('SUPERIORIDAD: LA V SOBRE EL BALÓN, a 1,0 m del portador y 1,5 m entre los dos', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.45], ['B1', 'jugador', 'B', 0.3, 0.4], ['B2', 'jugador', 'B', 0.5, 0.5], ['B3', 'jugador', 'B', 0.8, 0.7], ['bal', 'balon', null, 0.3, 0.45]], { dar: [['bal', 'A1']] });
  eq(s.p.situacion, 'superioridad');
  const c = s.col();
  const [b1, b2, b3] = [c[s.ids.B1], c[s.ids.B2], c[s.ids.B3]];
  eq([b1.aplica, b2.aplica, b3.aplica], ['trampa', 'trampa', 'protege'], 'el suyo y el primero que sobra, a la V; el otro, atrás:');
  const C = s.donde('A1');
  ok(cerca(M(b1, C), 1.0) && enLaLinea(C, AR, b1), 'el suyo corta el camino al aro');
  ok(cerca(M(b2, C), 1.0) && cerca(M(b1, b2), 1.5), `el segundo cierra la V: ${M(b2, C)} y ${M(b1, b2)}`);
  ok(cerca(M(b3, C), 2.0) && M(b3, AR) < M(C, AR), `el que sobra protege a 2 m del balón, entre el balón y el aro: ${M(b3, C)}`);
  eq(b1.trampa, [s.ids.B1, s.ids.B2]);
});

test('LA SEPARACIÓN DE LA TRAMPA ES LA QUE SE PIDE, aunque no quepa en el círculo de presión', () => {
  const s = situada([['A1', 'jugador', 'A', 0.5, 0.45], ['B1', 'jugador', 'B', 0.5, 0.4], ['B2', 'jugador', 'B', 0.5, 0.6], ['bal', 'balon', null, 0.5, 0.45]], { dar: [['bal', 'A1']], defensa: { parametros: { trampa: 3 } } });
  const c = s.col();
  ok(cerca(M(c[s.ids.B1], c[s.ids.B2]), 3, 1e-6), `separados lo pedido: ${M(c[s.ids.B1], c[s.ids.B2])}`);
  const x = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: s.l, papeles: s.p, defensa: { parametros: { trampa: 3 } }, defensor: s.ids.B2 });
  ok(/3 m/.test(x.texto), `y el texto dice la de verdad: ${x.texto}`);
});

test('CON UN SOLO DEFENSOR NO HAY TRAMPA, aunque se fuerce la superioridad', () => {
  const s = situada([['A1', 'jugador', 'A', 0.5, 0.45], ['B1', 'jugador', 'B', 0.5, 0.4], ['bal', 'balon', null, 0.5, 0.45]], { dar: [['bal', 'A1']], defensa: { situacion: 'superioridad' } });
  eq(s.p.situacion, 'superioridad');
  eq(s.sitio('B1').aplica, 'entre_par_y_aro', 'se queda con su regla:');
});

test('LOS QUE SOBRAN PROTEGEN A 2 M DEL BALÓN, repartidos para no taparse', () => {
  const s = situada([
    ['A1', 'jugador', 'A', 0.5, 0.45], ['B1', 'jugador', 'B', 0.5, 0.4],
    ['B2', 'jugador', 'B', 0.45, 0.6], ['B3', 'jugador', 'B', 0.7, 0.7], ['B4', 'jugador', 'B', 0.3, 0.7],
    ['bal', 'balon', null, 0.5, 0.45],
  ], { dar: [['bal', 'A1']] });
  const c = s.col();
  const protegen = ['B3', 'B4'].map((n) => c[s.ids[n]]);
  for (const q of protegen) {
    eq(q.aplica, 'protege');
    ok(cerca(M(q, s.donde('A1')), 2.0, 1e-6), `a 2 m del balón: ${M(q, s.donde('A1'))}`);
    ok(M(q, AR) < M(s.donde('A1'), AR), 'entre el balón y el aro');
  }
  ok(M(protegen[0], protegen[1]) > 1, `y separados entre ellos: ${M(protegen[0], protegen[1]).toFixed(2)} m`);
});

test('LA V SE ABRE HACIA EL MEDIO de la pista, venga del lado que venga', () => {
  const lim = limitesCancha('entera');
  const medioX = (lim.x[0] + lim.x[1]) / 2;
  for (const x of [0.15, 0.85]) {
    const s = situada([['A1', 'jugador', 'A', x, 0.4], ['B1', 'jugador', 'B', x, 0.35], ['B2', 'jugador', 'B', 0.5, 0.6], ['bal', 'balon', null, x, 0.4]], { dar: [['bal', 'A1']] });
    const b2 = s.sitio('B2');
    ok(Math.abs(b2.x - medioX) < Math.abs(x - medioX), `desde x=${x} el segundo de la V queda hacia dentro: ${b2.x}`);
  }
});

test('TODO SITIO CAE DENTRO DE LA CANCHA, y sin atacante o sin defensa no se coloca a nadie', () => {
  const s = situada([['A1', 'jugador', 'A', 0.02, 0.98], ['B1', 'jugador', 'B', 0.02, 0.9], ['bal', 'balon', null, 0.02, 0.98]], { dar: [['bal', 'A1']] });
  const b1 = s.sitio('B1');
  const lim = limitesCancha('entera');
  ok(b1.x >= lim.x[0] && b1.x <= lim.x[1] && b1.y >= lim.y[0] && b1.y <= lim.y[1], JSON.stringify(b1));
  const sin = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['B1', 'jugador', 'B', 0.3, 0.6]]);
  eq(sin.col(), {});
  eq(colocar({}), {});
  const e2 = enCancha('entera', { x: -1, y: 2 });
  ok(e2.x > lim.x[0] && e2.y < lim.y[1], 'enCancha recorta');
});

test('«SOLO» COLOCA A LOS QUE SE PIDEN, y con los demás en cuenta: el sitio es el mismo', () => {
  /* En superioridad el sitio de uno depende de los otros: pidiendo uno
     solo tiene que salir lo mismo que pidiéndolos todos. */
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.45], ['B1', 'jugador', 'B', 0.3, 0.4], ['B2', 'jugador', 'B', 0.5, 0.5], ['B3', 'jugador', 'B', 0.8, 0.7], ['bal', 'balon', null, 0.3, 0.45]], { dar: [['bal', 'A1']] });
  const todos = s.col();
  for (const quien of ['B1', 'B2', 'B3']) {
    const uno = s.col({ solo: [s.ids[quien]] });
    eq(Object.keys(uno), [s.ids[quien]], `${quien}: solo él`);
    eq(uno[s.ids[quien]], todos[s.ids[quien]], `${quien}: el mismo sitio y el mismo papel`);
  }
});

test('EL BALÓN QUE LLEVA UN DEFENSOR NO MUEVE A LA DEFENSA', () => {
  /* Dos balones: el del ataque y uno que lleva un defensor (con quién
     ataca elegido en Ajustes, que si no no atacaría nadie). B2 tiene más
     cerca el del defensor, y aun así niega hacia el del ataque. */
  const s = situada([
    ['A1', 'jugador', 'A', 0.25, 0.5], ['A2', 'jugador', 'A', 0.55, 0.5],
    ['B2', 'jugador', 'B', 0.55, 0.62, { dorsal: 2 }], ['B3', 'jugador', 'B', 0.60, 0.52, { dorsal: 3 }],
    ['bal', 'balon', null, 0.25, 0.5], ['otro', 'balon', null, 0.60, 0.52],
  ], { dar: [['bal', 'A1'], ['otro', 'B3']], defensa: { preajuste: 'niega_linea', ataca: 'A' } });
  eq(s.p.ataca, 'A');
  const b2 = s.sitio('B2');
  ok(M(s.donde('B3'), s.donde('A2')) < M(s.donde('A1'), s.donde('A2')), 'el balón del defensor está MÁS CERCA de su par (si no, la prueba no prueba nada)');
  eq(b2.aplica, 'niega_linea');
  ok(enLaLinea(s.donde('A2'), s.donde('A1'), b2), 'niega hacia el balón del ataque');
});

test('CON VARIOS BALONES, CADA DEFENSOR MIRA EL DE SU PAR', () => {
  const s = situada([
    ['A1', 'jugador', 'A', 0.2, 0.5], ['A2', 'jugador', 'A', 0.8, 0.5], ['A3', 'jugador', 'A', 0.75, 0.55],
    ['B1', 'jugador', 'B', 0.2, 0.6], ['B2', 'jugador', 'B', 0.8, 0.6], ['B3', 'jugador', 'B', 0.75, 0.65],
    ['b1', 'balon', null, 0.2, 0.5], ['b2', 'balon', null, 0.8, 0.5],
  ], { dar: [['b1', 'A1'], ['b2', 'A2']], defensa: { preajuste: 'niega_linea' } });
  const b3 = s.sitio('B3');
  eq(b3.aplica, 'niega_linea');
  ok(enLaLinea(s.donde('A3'), s.donde('A2'), b3), 'A3 niega hacia A2, que lleva el balón más cercano, no hacia A1');
});

/* ── 7. Ver por qué está ahí (§8.7) ──────────────────────── */

test('LA REGLA SE EXPLICA CON LO QUE SE DIBUJA Y UNA FRASE, y lo dibujado va de verdad de un sitio a otro', () => {
  const s = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['A2', 'jugador', 'A', 0.7, 0.5], ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.7, 0.6], ['bal', 'balon', null, 0.3, 0.5]], { dar: [['bal', 'A1']] });
  const x = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: s.l, papeles: s.p, defensa: null, defensor: s.ids.B2 });
  eq(x.aplica, 'entre_par_y_aro');
  ok(/2 m/.test(x.texto), x.texto);
  eq(x.primitivas.map((q) => q.tipo), ['linea', 'punto']);
  /* La línea va de su par al aro, y el punto es donde le toca estar. */
  eq(x.primitivas[0].a, s.donde('A2'));
  eq([x.primitivas[0].b.x, x.primitivas[0].b.y], [AR.x, AR.y]);
  const sitio = s.sitio('B2');
  eq(x.primitivas[1].p, { x: sitio.x, y: sitio.y });
  const pre = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: s.l, papeles: s.p, defensa: { preajuste: 'presion' }, defensor: s.ids.B1 });
  ok(/Presión/.test(pre.texto) && pre.primitivas[0].a.x === s.donde('A1').x, `presión: ${pre.texto}`);
  const cerquita = situada([['A1', 'jugador', 'A', 0.3, 0.5], ['A2', 'jugador', 'A', 0.5, 0.5], ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.5, 0.6], ['bal', 'balon', null, 0.3, 0.5]], { dar: [['bal', 'A1']], defensa: { preajuste: 'niega_linea' } });
  const nie = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: cerquita.l, papeles: cerquita.p, defensa: { preajuste: 'niega_linea' }, defensor: cerquita.ids.B2 });
  eq(nie.aplica, 'niega_linea');
  eq([nie.primitivas[0].a, nie.primitivas[0].b], [cerquita.donde('A1'), cerquita.donde('A2')], 'negar: del balón a su par');
  eq(explicarRegla({ pista: 'entera', canasta: 'norte', elementos: s.l, papeles: s.p, defensor: s.ids.A1 }), null, 'un atacante no tiene regla:');
  const flota = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: s.l, papeles: s.p, defensa: { preajuste: 'ayuda_y_flota' }, defensor: s.ids.B2 });
  const circulo = flota.primitivas.find((q) => q.tipo === 'circulo');
  ok(circulo && circulo.metros === 3.5 && /3,5 m/.test(flota.texto), flota.texto);
  eq(circulo.centro, s.donde('A2'), 'el círculo va alrededor de su par:');
});

test('Y LO QUE SOBRA EN SUPERIORIDAD TAMBIÉN SE EXPLICA', () => {
  const s = situada([['A1', 'jugador', 'A', 0.5, 0.45], ['B1', 'jugador', 'B', 0.5, 0.4], ['B2', 'jugador', 'B', 0.45, 0.6], ['B3', 'jugador', 'B', 0.7, 0.7], ['bal', 'balon', null, 0.5, 0.45]], { dar: [['bal', 'A1']] });
  const x = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: s.l, papeles: s.p, defensor: s.ids.B3 });
  eq(x.aplica, 'protege');
  ok(/2 m del balón/.test(x.texto), x.texto);
  eq([x.primitivas[0].a, x.primitivas[0].b], [s.donde('A1'), { x: AR.x, y: AR.y }], 'la línea del balón al aro:');
});

test('Y LA SITUACIÓN TAMBIÉN SE EXPLICA: retrasa con su zona de tiro, la trampa con su V', () => {
  const inf = situada([['A1', 'jugador', 'A', 0.3, 0.6], ['A2', 'jugador', 'A', 0.7, 0.6], ['B1', 'jugador', 'B', 0.3, 0.55], ['bal', 'balon', null, 0.3, 0.6]], { dar: [['bal', 'A1']] });
  const r = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: inf.l, papeles: inf.p, defensor: inf.ids.B1 });
  ok(r.aplica === 'retrasa' && r.primitivas.some((q) => q.tipo === 'circulo' && q.metros === 6.75) && /6,75 m/.test(r.texto), r.texto);
  const sup = situada([['A1', 'jugador', 'A', 0.3, 0.45], ['B1', 'jugador', 'B', 0.3, 0.4], ['B2', 'jugador', 'B', 0.5, 0.5], ['bal', 'balon', null, 0.3, 0.45]], { dar: [['bal', 'A1']] });
  const t = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: sup.l, papeles: sup.p, defensor: sup.ids.B2 });
  ok(t.aplica === 'trampa' && t.primitivas.filter((q) => q.tipo === 'linea').length === 2 && /1,5 m/.test(t.texto), t.texto);
  /* Las dos líneas de la V salen del que lleva el balón y llegan a cada
     uno de los dos que le atrapan. */
  const c = sup.col();
  for (const q of t.primitivas.filter((z) => z.tipo === 'linea')) eq(q.a, sup.donde('A1'), 'sale del portador:');
  const puntas = t.primitivas.filter((z) => z.tipo === 'linea').map((z) => `${z.b.x},${z.b.y}`).sort();
  eq(puntas, [c[sup.ids.B1], c[sup.ids.B2]].map((z) => `${z.x},${z.y}`).sort(), 'y llega a los dos:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
