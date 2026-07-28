/* ============================================================
   eval-partidos.mjs — banco Node del motor de partidos
   (equipos/js/data/partidos.js). Sin red, sin DOM.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-partidos.mjs
   ============================================================ */

import {
  resultadoPartido, diferencia, balancePartidos, mediaValoracion,
  hayValoracion, mediasPorEje, marcadorValido, validaPartido,
} from '../js/data/partidos.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}
function aprox(real, esperado, msg = '') {
  if (Math.abs(real - esperado) > 1e-9) throw new Error(`${msg} esperado≈${esperado} real=${real}`);
}

const P = (favor, contra, extra = {}) => ({
  rival: 'Rival', fecha: '2026-10-03', estado: 'jugado',
  marcador_favor: favor, marcador_contra: contra, ...extra,
});

console.log('· resultado y diferencia');

test('victoria, derrota y empate desde el punto de vista propio', () => {
  eq(resultadoPartido(P(62, 48)), 'victoria');
  eq(resultadoPartido(P(48, 62)), 'derrota');
  eq(resultadoPartido(P(50, 50)), 'empate');
});

test('un partido no jugado nunca tiene resultado, aunque traiga números', () => {
  eq(resultadoPartido(P(62, 48, { estado: 'programado' })), null);
  eq(resultadoPartido(P(62, 48, { estado: 'aplazado' })), null);
  eq(resultadoPartido(P(62, 48, { estado: 'cancelado' })), null);
});

test('marcador incompleto o corrupto → sin resultado, sin romper', () => {
  eq(resultadoPartido(P(62, null)), null);
  eq(resultadoPartido(P(null, null)), null);
  eq(resultadoPartido(P('ochenta', 40)), null);
  eq(resultadoPartido(null), null);
});

test('diferencia con signo; null si falta marcador', () => {
  eq(diferencia(P(62, 48)), 14);
  eq(diferencia(P(48, 62)), -14);
  eq(diferencia(P(48, null)), null);
});

test('marcadorValido acota 0-300 y exige enteros', () => {
  eq(marcadorValido(0, 0), true);
  eq(marcadorValido(300, 300), true);
  eq(marcadorValido(301, 10), false);
  eq(marcadorValido(-1, 10), false);
  eq(marcadorValido(62.5, 10), false);
  eq(marcadorValido('62', '48'), true);   // vienen de inputs de texto
});

console.log('· balance de temporada');

test('cuenta victorias/derrotas/empates y puntos, ignorando lo no jugado', () => {
  const b = balancePartidos([
    P(62, 48), P(40, 55), P(50, 50), P(70, 30),
    P(80, 10, { estado: 'programado' }),        // no cuenta
    P(null, null, { estado: 'aplazado' }),      // no cuenta
  ]);
  eq([b.jugados, b.victorias, b.derrotas, b.empates], [4, 2, 1, 1]);
  eq([b.favor, b.contra], [222, 183]);
  aprox(b.difMedia, (222 - 183) / 4);
  eq(b.pctVictorias, 50);
});

test('sin partidos jugados: todo a cero y sin dividir por cero', () => {
  const b = balancePartidos([P(80, 10, { estado: 'programado' })]);
  eq([b.jugados, b.difMedia, b.pctVictorias, b.racha], [0, null, null, null]);
  eq(balancePartidos([]).jugados, 0);
  eq(balancePartidos(null).jugados, 0);
});

test('racha = resultados iguales consecutivos más recientes', () => {
  // orden ascendente por fecha: la racha se lee desde el final
  eq(balancePartidos([P(40, 55), P(62, 48), P(70, 60), P(55, 50)]).racha, { tipo: 'victoria', n: 3 });
  eq(balancePartidos([P(62, 48), P(40, 55)]).racha, { tipo: 'derrota', n: 1 });
});

test('los partidos no jugados no cortan la racha', () => {
  const b = balancePartidos([P(62, 48), P(0, 0, { estado: 'cancelado' }), P(70, 60)]);
  eq(b.racha, { tipo: 'victoria', n: 2 });
});

console.log('· valoraciones');

const V = (o) => ({ ...P(60, 50), ...o });

test('media de las valoraciones puestas, ignorando las vacías', () => {
  aprox(mediaValoracion(V({ val_defensa: 4, val_ataque: 2 })), 3);
  eq(mediaValoracion(V({})), null);
});

test('valores fuera de 1-5 no contaminan la media', () => {
  aprox(mediaValoracion(V({ val_defensa: 4, val_ataque: 0, val_global: 9 })), 4);
});

test('hayValoracion distingue un partido valorado de uno solo con marcador', () => {
  eq(hayValoracion(V({})), false);
  eq(hayValoracion(V({ val_actitud: 1 })), true);
  eq(hayValoracion(V({ val_actitud: 0 })), false);
});

test('mediasPorEje da media y cuántos partidos la sostienen', () => {
  const ms = mediasPorEje([
    V({ val_defensa: 5, val_ataque: 3 }),
    V({ val_defensa: 3 }),
    V({}),
  ]);
  const def = ms.find((e) => e.clave === 'val_defensa');
  const ata = ms.find((e) => e.clave === 'val_ataque');
  const act = ms.find((e) => e.clave === 'val_actitud');
  eq([def.n, def.media], [2, 4]);
  eq([ata.n, ata.media], [1, 3]);
  eq([act.n, act.media], [0, null]);
});

console.log('· validaPartido');

test('exige rival y fecha', () => {
  eq(validaPartido({ fecha: '2026-10-03' }), 'Falta el rival.');
  eq(validaPartido({ rival: '  ' , fecha: '2026-10-03' }), 'Falta el rival.');
  eq(validaPartido({ rival: 'CB Palencia' }), 'Falta la fecha.');
});

test('un jugado sin marcador se rechaza (lo mismo que el CHECK de 016)', () => {
  eq(validaPartido({ rival: 'X', fecha: '2026-10-03', estado: 'jugado' }),
     'Un partido jugado necesita marcador.');
});

test('medio marcador puesto se avisa antes de que lo rechace la BD', () => {
  eq(validaPartido({ rival: 'X', fecha: '2026-10-03', estado: 'programado', marcador_favor: 60 }),
     'El marcador tiene que ser dos números enteros entre 0 y 300.');
});

test('un partido correcto pasa (con y sin marcador)', () => {
  eq(validaPartido({ rival: 'X', fecha: '2026-10-03', estado: 'programado' }), null);
  eq(validaPartido({ rival: 'X', fecha: '2026-10-03', estado: 'jugado', marcador_favor: 60, marcador_contra: 55 }), null);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
