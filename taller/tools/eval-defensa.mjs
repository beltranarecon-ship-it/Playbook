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
  colocar, explicarRegla, enCancha, seguirDefensa, SEGUIMIENTO,
  ACCIONES_DEFENSOR, SENALA, AYUDA_VUELVE, normalizarDeclaradas, declaradasDe, laContraria,
} from '../js/pizarra/motor/defensa.js';
import { metaDeFase, fotograma } from '../js/canvas/fotograma.js';
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
    [0.8, 6.75, 1.2, 1.0], 'y los que aceptó el entrenador:');
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
const fotogramaEn = (meta, inicio, jugadores, balones, t) => fotograma({ meta, inicio, jugadores, balones, t: Math.max(0, t) });
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

/* ── 8. La defensa se mueve sola (§8.4) ──────────────────── */

/* Una fase con A1 corriendo y B1 defendiéndole, lista para seguir. */
function paraSeguir({ camino, dur = 2000, tiros = [], defensa = null, empieza = null } = {}) {
  const jugadores = [{ id: 'A1', equipo: 'A' }, { id: 'B1', equipo: 'B' }];
  const balones = [{ id: 'b1' }];
  const papeles = { ataca: 'A', atacantes: ['A1'], defensores: ['B1'], pares: { B1: 'A1' }, situacion: 'igualdad', retrasa: null };
  const inicio = {
    P: { A1: { x: camino[0].x, y: camino[0].y }, B1: empieza || { x: camino[0].x, y: camino[0].y - 1.2 / escalaDe('entera').y } },
    B: { b1: { x: camino[0].x, y: camino[0].y } },
    owner: { b1: 'A1' },
  };
  const fase = {
    duracion_ms: dur,
    movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: camino.map((p) => ({ ...p, tipo_nodo: 'lineal' })), inicio_ms: 0, duracion_ms: dur }],
    pases: [], tiros, recogidas: [], bloqueos: [],
  };
  const r = metaDeFase(fase, { jugadores, balones, escena: inicio, aro: () => AR });
  const seguida = seguirDefensa({
    pista: 'entera', canasta: 'norte', defensa, papeles, jugadores, balones,
    meta: r.meta, inicio, duracion_ms: dur, tiros,
  });
  return { seguida, papeles, inicio, meta: r.meta, jugadores, balones, dur, fase };
}

test('VEINTE TRAMOS POR FASE, del principio al final (§8.4)', () => {
  const { seguida, dur } = paraSeguir({ camino: [{ x: 0.5, y: 0.7 }, { x: 0.5, y: 0.3 }] });
  const m = seguida.B1.muestras;
  eq(m.length, SEGUIMIENTO.muestras, 'veintiuna muestras son veinte tramos:');
  eq([m[0].t, m[m.length - 1].t], [0, dur]);
  eq(seguida.B1.fin, { x: m[m.length - 1].x, y: m[m.length - 1].y }, 'y acaba donde dice su última muestra:');
});

test('SIGUE A SU PAR CON RETARDO: apunta a donde estaba hace 0,25 s', () => {
  /* Su par se aleja despacio, así que al defensor le da tiempo a estar
     exactamente donde manda la regla: a 1,2 m de su par con balón, entre
     él y el aro. La pregunta es DE QUÉ par: del de hace 0,25 s. */
  const { seguida, meta, inicio, jugadores, balones } = paraSeguir({ camino: [{ x: 0.5, y: 0.40 }, { x: 0.5, y: 0.50 }] });
  const m = seguida.B1.muestras;
  /* A mitad de la fase, que es cuando su par va más deprisa: al final la
     curva de siempre le deja casi parado y el retardo no se notaría. */
  const fin = m[Math.floor(m.length / 2)];
  const par = (t) => fotogramaEn(meta, inicio, jugadores, balones, t).players.A1;
  const antes = M(fin, par(fin.t - SEGUIMIENTO.retardo_ms));
  const ahora = M(fin, par(fin.t));
  ok(cerca(antes, PARAMETROS.par_con_balon, 0.03), `a ${antes.toFixed(2)} m de donde estaba su par hace 0,25 s`);
  ok(Math.abs(ahora - PARAMETROS.par_con_balon) > 0.15, `y no de donde está ahora, que le queda a ${ahora.toFixed(2)} m`);
});

test('NO CORRE MÁS DE SU VELOCIDAD LATERAL, 2,5 m/s (§8.4)', () => {
  /* Su par se le va: 13,5 m en dos segundos. Por mucho que el objetivo
     vuele, él anda lo suyo y no más. */
  const { seguida } = paraSeguir({ camino: [{ x: 0.5, y: 0.25 }, { x: 0.5, y: 0.75 }] });
  const m = seguida.B1.muestras;
  let tope = 0;
  for (let i = 1; i < m.length; i++) {
    const cabe = SEGUIMIENTO.velocidad * ((m[i].t - m[i - 1].t) / 1000);
    const anda = M(m[i], m[i - 1]);
    ok(anda <= cabe + 1e-9, `en t=${m[i].t} anda ${anda.toFixed(3)} m, y solo puede ${cabe.toFixed(3)}`);
    tope = Math.max(tope, anda / cabe);
  }
  ok(tope > 0.99, `y corre todo lo que puede: como mucho, el ${(tope * 100).toFixed(0)} % de su paso`);
});

test('Y SI SU PAR LE PASA POR ENCIMA MÁS RÁPIDO, se lo lleva por delante pero sin saltos', () => {
  /* 13,5 m en dos segundos: el atacante corre más que nadie, así que se
     lleva al defensor por delante. Aun así, nunca se mueve más de lo que
     se ha movido su par. */
  const { seguida, meta, inicio, jugadores, balones } = paraSeguir({ camino: [{ x: 0.5, y: 0.75 }, { x: 0.5, y: 0.25 }] });
  const m = seguida.B1.muestras;
  for (let i = 1; i < m.length; i++) {
    const dt = (m[i].t - m[i - 1].t) / 1000;
    const par = fotogramaEn(meta, inicio, jugadores, balones, m[i].t).players.A1;
    const parAntes = fotogramaEn(meta, inicio, jugadores, balones, m[i - 1].t).players.A1;
    const tope = SEGUIMIENTO.velocidad * dt + M(par, parAntes);
    ok(M(m[i], m[i - 1]) <= tope + 1e-9, `en t=${m[i].t} anda ${M(m[i], m[i - 1]).toFixed(3)} m, y solo puede ${tope.toFixed(3)}`);
  }
});

test('NUNCA ATRAVIESA A SU PAR: si fueran a coincidir, se aparta a un metro', () => {
  /* El par corre justo hacia donde está el defensor. */
  const { seguida, meta, inicio, jugadores, balones } = paraSeguir({
    camino: [{ x: 0.5, y: 0.7 }, { x: 0.5, y: 0.3 }],
    empieza: { x: 0.5, y: 0.32 },
  });
  for (const q of seguida.B1.muestras) {
    const par = fotogramaEn(meta, inicio, jugadores, balones, q.t).players.A1;
    ok(M(q, par) >= SEGUIMIENTO.apartarse - 1e-6, `a ${M(q, par).toFixed(2)} m de su par en t=${q.t}`);
  }
});

test('DOS VECES LO MISMO DA LO MISMO: el seguimiento es determinista', () => {
  const a = paraSeguir({ camino: [{ x: 0.3, y: 0.8 }, { x: 0.7, y: 0.4 }] }).seguida;
  const b = paraSeguir({ camino: [{ x: 0.3, y: 0.8 }, { x: 0.7, y: 0.4 }] }).seguida;
  eq(a, b);
});

test('TRAS UN TIRO QUE FALLA, CIERRA EL REBOTE: pegado a su par hasta el final', () => {
  const tiro = { jugador_id: 'A1', balon_id: 'b1', canasta: 'norte', desenlace: 'falla', path: [{ x: 0.5, y: 0.6 }, { x: AR.x, y: AR.y }], inicio_ms: 0, duracion_ms: 900 };
  const { seguida, meta, inicio, jugadores, balones } = paraSeguir({
    camino: [{ x: 0.5, y: 0.6 }, { x: 0.5, y: 0.6 }], dur: 3000, tiros: [tiro],
  });
  const ultima = seguida.B1.muestras[seguida.B1.muestras.length - 1];
  const par = fotogramaEn(meta, inicio, jugadores, balones, ultima.t).players.A1;
  ok(cerca(M(ultima, par), PARAMETROS.cierra_rebote, 0.05), `a ${M(ultima, par).toFixed(2)} m de su par`);
  ok(enLaLinea(par, AR, ultima), 'y entre su par y el aro');
});

test('sin defensores, sin escena o sin fase no se sigue a nadie', () => {
  eq(seguirDefensa({}), {});
  eq(seguirDefensa({ papeles: { defensores: ['B1'], pares: {} }, inicio: null, duracion_ms: 1000 }), {});
  eq(seguirDefensa({ papeles: { defensores: [], pares: {} }, inicio: { P: {} }, duracion_ms: 1000 }), {});
});

/* ── 9. Lo que un defensor hace DISTINTO (§8.5) ──────────── */

test('LO QUE SE PUEDE DECLARAR, Y A QUIÉN HAY QUE SEÑALAR', () => {
  eq(ACCIONES_DEFENSOR, ['ayuda', 'sobrepasado', 'cambia_marca', 'cierra_rebote', 'dos_contra_uno', 'roba']);
  eq(SENALA, { ayuda: 'atacante', cambia_marca: 'defensor', roba: 'atacante' }, 'las tres que piden a quién:');
  ok(AYUDA_VUELVE > 0.5 && AYUDA_VUELVE < 1, 'y el que ayuda vuelve antes de acabar la fase');
});

test('LO QUE NO SE ENTIENDE SE QUITA Y SE DICE', () => {
  const ids = new Set(['B1', 'A1']);
  const r = normalizarDeclaradas({
    B1: { accion: 'ayuda', objetivo_id: 'A1' },
    B2: { accion: 'sobrepasado' },                 // no está en la pista
    B1x: { accion: 'baila' },                      // no se conoce
  }, { ids });
  eq(r.declaradas, { B1: { accion: 'ayuda', objetivo_id: 'A1' } });
  eq(r.avisos.length, 2, 'y las dos que se caen se dicen:');
  eq(normalizarDeclaradas({ B1: { accion: 'ayuda' } }, { ids }).declaradas, {}, 'una ayuda sin a quién no vale:');
  eq(normalizarDeclaradas({ B1: { accion: 'cierra_rebote', objetivo_id: 'A1' } }, { ids }).declaradas,
    { B1: { accion: 'cierra_rebote', objetivo_id: null } }, 'y la que no señala a nadie no se lo queda:');
  eq(normalizarDeclaradas(null).declaradas, {}, 'una fase sin nada declarado es lo normal:');
  eq(normalizarDeclaradas('rota').avisos.length, 1);
  eq(declaradasDe({ defensa: { B1: { accion: 'sobrepasado' } } }), { B1: { accion: 'sobrepasado', objetivo_id: null } });
});

test('«CAMBIA CON…» INTERCAMBIA LOS PARES, Y SIGUE VALIENDO EN LAS FASES SIGUIENTES', () => {
  const e = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['A2', 'jugador', 'A', 0.7, 0.8],
    ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.7, 0.6], ['bal', 'balon', null, 0.3, 0.8]]);
  const l = e.dar('bal', 'A1');
  const p = papelesDeJugada({
    pista: 'entera', elementos: l,
    fases: [{}, { defensa: { [e.ids.B1]: { accion: 'cambia_marca', objetivo_id: e.ids.B2 } } }, {}],
  });
  eq(paresEn(e.ids, p.fases[0].pares), { B1: 'A1', B2: 'A2' }, 'antes del cambio, cada uno con el suyo:');
  eq(paresEn(e.ids, p.fases[1].pares), { B1: 'A2', B2: 'A1' }, 'en la fase del cambio, cruzados:');
  eq(paresEn(e.ids, p.fases[2].pares), { B1: 'A2', B2: 'A1' }, 'y en la siguiente siguen cruzados:');
  eq(paresEn(e.ids, p.inicio.pares), { B1: 'A1', B2: 'A2' }, 'lo de antes de empezar no se toca:');
  eq(p.fases[1].acciones[e.ids.B1].accion, 'cambia_marca', 'y los papeles llevan lo declarado:');
});

test('un cambio consigo mismo o con quien no defiende no cambia nada', () => {
  const e = escena([['A1', 'jugador', 'A', 0.3, 0.8], ['A2', 'jugador', 'A', 0.7, 0.8],
    ['B1', 'jugador', 'B', 0.3, 0.6], ['B2', 'jugador', 'B', 0.7, 0.6], ['bal', 'balon', null, 0.3, 0.8]]);
  const l = e.dar('bal', 'A1');
  const con = (objetivo) => paresEn(e.ids, papelesDeJugada({
    pista: 'entera', elementos: l, fases: [{ defensa: { [e.ids.B1]: { accion: 'cambia_marca', objetivo_id: objetivo } } }],
  }).fases[0].pares);
  eq(con(e.ids.B1), { B1: 'A1', B2: 'A2' }, 'consigo mismo:');
  eq(con(e.ids.A2), { B1: 'A1', B2: 'A2' }, 'con un atacante:');
});

/* Una escena con una acción declarada para B1. */
function conDeclarada(accion, objetivo = null, extra = {}) {
  const fichas = [['A1', 'jugador', 'A', 0.5, 0.55], ['A2', 'jugador', 'A', 0.8, 0.5],
    ['B1', 'jugador', 'B', 0.5, 0.45], ['B2', 'jugador', 'B', 0.8, 0.45], ['bal', 'balon', null, 0.5, 0.55]];
  const e = escena(fichas);
  const l = e.dar('bal', 'A1');
  const declarada = { [e.ids.B1]: { accion, objetivo_id: objetivo ? e.ids[objetivo] : null } };
  const papeles = papelesDeJugada({ pista: 'entera', elementos: l, fases: [{ defensa: declarada }] }).fases[0];
  const donde = (n) => { const x = l.find((z) => z.id === e.ids[n]); return { x: x.x, y: x.y }; };
  const col = (opts = {}) => colocar({ pista: 'entera', canasta: 'norte', elementos: l, papeles, ...opts, ...extra });
  return { e, l, papeles, donde, col, sitio: (opts) => col(opts)[e.ids.B1] };
}

test('CIERRA EL REBOTE DICHO: entre su par y el aro desde el principio de la fase', () => {
  const c = conDeclarada('cierra_rebote');
  const s = c.sitio();
  eq(s.aplica, 'cierra_rebote');
  ok(cerca(M(s, c.donde('A1')), PARAMETROS.cierra_rebote, 1e-6), `a ${M(s, c.donde('A1')).toFixed(2)} m de su par`);
  ok(enLaLinea(c.donde('A1'), AR, s), 'y entre su par y el aro');
});

test('ES SOBREPASADO: le persigue POR DETRÁS, a un metro largo, al otro lado que el aro', () => {
  const c = conDeclarada('sobrepasado');
  const s = c.sitio();
  const par = c.donde('A1');
  eq(s.aplica, 'sobrepasado');
  ok(cerca(M(s, par), PARAMETROS.sobrepasado, 1e-6), `a ${M(s, par).toFixed(2)} m de su par`);
  ok(enLaLinea(AR, s, par), 'y su par queda ENTRE el aro y él, que es ir por detrás');
});

test('AYUDA: va a tapar al que se le señala, y al final de la fase vuelve con su par', () => {
  const c = conDeclarada('ayuda', 'A2');
  const yendo = c.sitio({ u: 0 });
  eq([yendo.aplica, yendo.objetivo], ['ayuda', c.e.ids.A2]);
  ok(cerca(M(yendo, c.donde('A2')), PARAMETROS.par_sin_balon, 1e-6), `a ${M(yendo, c.donde('A2')).toFixed(2)} m del que tapa`);
  ok(enLaLinea(c.donde('A2'), AR, yendo), 'entre él y el aro');
  const volviendo = c.sitio({ u: 0.9 });
  eq(volviendo.aplica, 'entre_par_y_aro', 'pasado el punto de vuelta, su regla de siempre:');
  ok(cerca(M(volviendo, c.donde('A1')), PARAMETROS.par_con_balon, 1e-6), 'y con su par, que lleva el balón');
});

test('VA AL DOS CONTRA UNO: junto al que ya está, a 1,0 m del balón y 1,5 m de él', () => {
  /* B2 defiende a A2; se le manda a doblar sobre A1, que lleva el balón
     y al que ya defiende B1. */
  const e = escena([['A1', 'jugador', 'A', 0.5, 0.55], ['A2', 'jugador', 'A', 0.8, 0.5],
    ['B1', 'jugador', 'B', 0.5, 0.45], ['B2', 'jugador', 'B', 0.8, 0.45], ['bal', 'balon', null, 0.5, 0.55]]);
  const l = e.dar('bal', 'A1');
  const papeles = papelesDeJugada({
    pista: 'entera', elementos: l, fases: [{ defensa: { [e.ids.B2]: { accion: 'dos_contra_uno' } } }],
  }).fases[0];
  const sitios = colocar({ pista: 'entera', canasta: 'norte', elementos: l, papeles });
  const s = sitios[e.ids.B2], otro = sitios[e.ids.B1];
  const A1 = { x: 0.5, y: 0.55 };
  eq(s.aplica, 'dos_contra_uno');
  ok(cerca(M(s, A1), PARAMETROS.presion, 1e-6), `a ${M(s, A1).toFixed(2)} m del que lleva el balón`);
  ok(cerca(M(s, otro), PARAMETROS.trampa, 0.05), `y a ${M(s, otro).toFixed(2)} m del que ya estaba`);
  eq(nombres(e.ids, s.trampa), ['B1', 'B2'], 'la trampa la forman los dos:');
});

test('y sin nadie sobre el balón, el dos contra uno no se hace: se queda con su regla', () => {
  const e = escena([['A1', 'jugador', 'A', 0.5, 0.55], ['A2', 'jugador', 'A', 0.8, 0.5],
    ['B2', 'jugador', 'B', 0.8, 0.45], ['bal', 'balon', null, 0.5, 0.55]]);
  const l = e.dar('bal', 'A1');
  const papeles = papelesDeJugada({
    pista: 'entera', elementos: l, fases: [{ defensa: { [e.ids.B2]: { accion: 'dos_contra_uno' } } }],
  }).fases[0];
  const s = colocar({ pista: 'entera', canasta: 'norte', elementos: l, papeles })[e.ids.B2];
  ok(s && s.aplica !== 'dos_contra_uno', `se queda con lo suyo: ${s && s.aplica}`);
});

test('LO DICHO MANDA SOBRE EL CIERRE AUTOMÁTICO DEL REBOTE Y SOBRE LA SITUACIÓN', () => {
  const c = conDeclarada('sobrepasado');
  eq(c.sitio({ cerrandoRebote: true }).aplica, 'sobrepasado', 'tras un tiro fallado sigue haciendo lo suyo:');
  /* Y en inferioridad, el que retrasa no se pone encima de lo declarado. */
  const e = escena([['A1', 'jugador', 'A', 0.5, 0.55], ['A2', 'jugador', 'A', 0.8, 0.5],
    ['B1', 'jugador', 'B', 0.5, 0.45], ['bal', 'balon', null, 0.5, 0.55]]);
  const l = e.dar('bal', 'A1');
  const papeles = papelesDeJugada({
    pista: 'entera', elementos: l, fases: [{ defensa: { [e.ids.B1]: { accion: 'cierra_rebote' } } }],
  }).fases[0];
  eq(papeles.situacion, 'inferioridad');
  eq(colocar({ pista: 'entera', canasta: 'norte', elementos: l, papeles })[e.ids.B1].aplica, 'cierra_rebote');
});

test('Y TODO LO DICHO SE EXPLICA (§8.7)', () => {
  const dice = (accion, objetivo) => {
    const c = conDeclarada(accion, objetivo);
    return explicarRegla({ pista: 'entera', canasta: 'norte', elementos: c.l, papeles: c.papeles, defensor: c.e.ids.B1 });
  };
  const reb = dice('cierra_rebote');
  eq(reb.aplica, 'cierra_rebote');
  ok(/^Cierra el rebote/.test(reb.texto), `dicho, no por un tiro fallado: ${reb.texto}`);
  ok(/persigue a su par por detrás/.test(dice('sobrepasado').texto));
  const ayuda = dice('ayuda', 'A2');
  ok(/ayuda/i.test(ayuda.texto) && /recupera|vuelve/.test(ayuda.texto), ayuda.texto);
  const e = escena([['A1', 'jugador', 'A', 0.5, 0.55], ['A2', 'jugador', 'A', 0.8, 0.5],
    ['B1', 'jugador', 'B', 0.5, 0.45], ['B2', 'jugador', 'B', 0.8, 0.45], ['bal', 'balon', null, 0.5, 0.55]]);
  const l = e.dar('bal', 'A1');
  const papeles = papelesDeJugada({ pista: 'entera', elementos: l, fases: [{ defensa: { [e.ids.B2]: { accion: 'dos_contra_uno' } } }] }).fases[0];
  const dos = explicarRegla({ pista: 'entera', canasta: 'norte', elementos: l, papeles, defensor: e.ids.B2 });
  ok(/dos contra uno/.test(dos.texto), dos.texto);
});

test('EL SEGUIMIENTO HACE LO DICHO: el que ayuda va, tapa y vuelve', () => {
  const jugadores = [{ id: 'A1', equipo: 'A' }, { id: 'A2', equipo: 'A' }, { id: 'B1', equipo: 'B' }];
  const balones = [{ id: 'b1' }];
  const papeles = {
    ataca: 'A', atacantes: ['A1', 'A2'], defensores: ['B1'], pares: { B1: 'A1' },
    situacion: 'inferioridad', retrasa: null, acciones: { B1: { accion: 'ayuda', objetivo_id: 'A2' } },
  };
  const inicio = {
    P: { A1: { x: 0.35, y: 0.55 }, A2: { x: 0.65, y: 0.55 }, B1: { x: 0.35, y: 0.45 } },
    B: { b1: { x: 0.35, y: 0.55 } }, owner: { b1: 'A1' },
  };
  const fase = { duracion_ms: 4000, movimientos: [], pases: [], tiros: [], recogidas: [], bloqueos: [] };
  const r = metaDeFase(fase, { jugadores, balones, escena: inicio, aro: () => AR });
  const s = seguirDefensa({ pista: 'entera', canasta: 'norte', papeles, jugadores, balones, meta: r.meta, inicio, duracion_ms: 4000 });
  const m = s.B1.muestras;
  const aA2 = (q) => M(q, { x: 0.65, y: 0.55 }), aA1 = (q) => M(q, { x: 0.35, y: 0.55 });
  const yendo = m[Math.floor(m.length * 0.6)];
  ok(aA2(yendo) < aA2(m[0]), `se acerca al que va a tapar: ${aA2(yendo).toFixed(2)} m frente a ${aA2(m[0]).toFixed(2)}`);
  const fin = m[m.length - 1];
  ok(aA1(fin) < aA1(yendo), `y al final vuelve con su par: ${aA1(fin).toFixed(2)} m frente a ${aA1(yendo).toFixed(2)}`);
});

/* ── 10. Cambian los papeles (§8.6) ──────────────────────── */

/* Dos contra dos, con A1 llevando el balón. */
function dosContraDos() {
  const e = escena([['A1', 'jugador', 'A', 0.3, 0.7], ['A2', 'jugador', 'A', 0.7, 0.7],
    ['B1', 'jugador', 'B', 0.3, 0.5], ['B2', 'jugador', 'B', 0.7, 0.5], ['bal', 'balon', null, 0.3, 0.7]]);
  const l = e.dar('bal', 'A1');
  return { e, l };
}
const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
const tiro = (quien, balon, desenlace) => ({
  id: `t_${quien}_${desenlace}`, elemento_id: quien, corre_id: balon, receptor_id: null,
  accion: 'tira', trazo: [N(0.3, 0.7), N(0.5, 0.1)], tipo: 'pass', desenlace,
});
const recoge = (quien, balon) => ({
  id: `r_${quien}`, elemento_id: quien, corre_id: quien, balon_id: balon,
  accion: 'recoge', trazo: [N(0.5, 0.3), N(0.5, 0.15)], tipo: 'cut',
});

test('UNA CANASTA PASA EL ATAQUE AL OTRO EQUIPO DESDE LA FASE SIGUIENTE (§8.6)', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'entra')] }, { tramos: [] }],
  });
  eq(p.fases[0].ataca, 'A', 'en la fase del tiro todavía ataca quien tiraba:');
  eq(p.fases[0].canasta, 'norte');
  eq(p.fases[1].ataca, 'B', 'y en la siguiente, el otro:');
  eq(p.fases[1].canasta, 'sur', 'atacando al otro aro:');
  eq(paresEn(e.ids, p.fases[1].pares), { A1: 'B1', A2: 'B2' }, 'con el emparejamiento invertido:');
  eq(nombres(e.ids, p.fases[1].defensores).sort(), ['A1', 'A2'], 'y los que atacaban, defendiendo:');
});

test('Y EN MEDIA PISTA SE SIGUE ATACANDO AL MISMO ARO, que no hay otro', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'media', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'entra')] }, { tramos: [] }],
  });
  eq([p.fases[1].ataca, p.fases[1].canasta], ['B', 'norte']);
  eq(laContraria('media', 'norte'), 'norte', 'y la contraria de una sola es ella misma:');
  eq(laContraria('entera', 'sur'), 'norte');
});

test('EL REBOTE DEFENSIVO TAMBIÉN: quien recoge un tiro fallado pasa a atacar', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'falla'), recoge(e.ids.B2, e.ids.bal)] }, { tramos: [] }],
  });
  eq(p.fases[0].ataca, 'A', 'la fase del rebote no cambia a mitad (§8.2):');
  eq([p.fases[1].ataca, p.fases[1].canasta], ['B', 'sur']);
});

test('y un rebote OFENSIVO no cambia nada: sigue atacando el mismo', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'falla'), recoge(e.ids.A2, e.ids.bal)] }, { tramos: [] }],
  });
  eq([p.fases[1].ataca, p.fases[1].canasta], ['A', 'norte']);
  eq(paresEn(e.ids, p.fases[1].pares), { B1: 'A1', B2: 'A2' }, 'y los pares siguen como estaban:');
});

test('UN TIRO FALLADO QUE NADIE COGE DEJA LAS COSAS COMO ESTABAN', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'falla')] }, { tramos: [] }],
  });
  eq([p.fases[1].ataca, p.fases[1].canasta], ['A', 'norte']);
});

test('SI EL ENTRENADOR HA DICHO QUIÉN ATACA, NO CAMBIA NADIE', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l, defensa: { ataca: 'A' },
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'entra')] }, { tramos: [] }],
  });
  eq([p.fases[1].ataca, p.fases[1].canasta], ['A', 'norte'], 'manda lo que se ha dicho:');
});

test('con un solo equipo en la pista, una canasta no le quita el ataque a nadie', () => {
  const e = escena([['A1', 'jugador', 'A', 0.3, 0.7], ['A2', 'jugador', 'A', 0.7, 0.7], ['bal', 'balon', null, 0.3, 0.7]]);
  const l = e.dar('bal', 'A1');
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'entra')] }, { tramos: [] }],
  });
  eq([p.fases[1].ataca, p.fases[1].canasta], ['A', 'norte']);
});

test('Y LA DEFENSA DE LA FASE SIGUIENTE SE COLOCA MIRANDO AL ARO NUEVO', () => {
  const { e, l } = dosContraDos();
  const p = papelesDeJugada({
    pista: 'entera', canasta: 'norte', elementos: l,
    fases: [{ tramos: [tiro(e.ids.A1, e.ids.bal, 'entra')] }, { tramos: [] }],
  });
  const papeles = p.fases[1];
  /* Los que atacaban ahora defienden; se colocan entre su par y el aro
     SUR, que es al que se ataca ahora. */
  const sitios = colocar({ pista: 'entera', canasta: papeles.canasta, elementos: l, papeles });
  const aroSur = (() => { const a = posicionesDe('entera', 'sur').aro; return { x: a[0], y: a[1] }; })();
  const a1 = sitios[e.ids.A1];
  const suPar = { x: 0.3, y: 0.5 };   // B1
  ok(a1, 'el que atacaba tiene sitio de defensor');
  ok(enLaLinea(suPar, aroSur, a1), `entre su par y el aro sur: ${JSON.stringify(a1)}`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
