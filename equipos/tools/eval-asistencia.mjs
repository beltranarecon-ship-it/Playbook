/* ============================================================
   eval-asistencia.mjs — banco Node del motor de asistencia
   (equipos/js/data/asistencia.js). Sin red, sin DOM.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-asistencia.mjs
   ============================================================ */

import {
  filasDensas, resumenAsistencia, estadisticasJugadores,
  filasParaGuardar, hayCambios, ESTADO_DEFECTO,
} from '../js/data/asistencia.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}

const J = (id, nombre, dorsal = null, estado = 'activo') => ({ id, nombre, dorsal, estado });
const ROSTER = [J('p1', 'Ana', 4), J('p2', 'Bea', 7), J('p3', 'Cris', 9)];

console.log('· filasDensas');

test('sin filas en BD: todo el roster activo arranca en el defecto', () => {
  const d = filasDensas(ROSTER, []);
  eq(d.map((f) => [f.player_id, f.estado, f.enBD]), [
    ['p1', ESTADO_DEFECTO, false], ['p2', ESTADO_DEFECTO, false], ['p3', ESTADO_DEFECTO, false],
  ]);
});

test('lo guardado manda sobre el defecto', () => {
  const d = filasDensas(ROSTER, [{ player_id: 'p2', estado: 'ausente', motivo: 'Médico' }]);
  eq(d[1].estado, 'ausente'); eq(d[1].motivo, 'Médico'); eq(d[1].enBD, true);
  eq(d[0].estado, ESTADO_DEFECTO);
});

test('un lesionado del roster arranca marcado lesionado', () => {
  const d = filasDensas([J('p1', 'Ana', 4, 'lesionado')], []);
  eq(d[0].estado, 'lesionado');
});

test('el estado guardado gana incluso al lesionado del roster', () => {
  const d = filasDensas([J('p1', 'Ana', 4, 'lesionado')], [{ player_id: 'p1', estado: 'presente' }]);
  eq(d[0].estado, 'presente');
});

test('una baja SIN historia no aparece', () => {
  const d = filasDensas([...ROSTER, J('p9', 'Zoe', 12, 'baja')], []);
  eq(d.length, 3);
});

test('una baja CON historia sí aparece, marcada', () => {
  const d = filasDensas([...ROSTER, J('p9', 'Zoe', 12, 'baja')], [{ player_id: 'p9', estado: 'presente' }]);
  eq(d.length, 4); eq([d[3].player_id, d[3].esBaja], ['p9', true]);
});

test('un estado corrupto en BD cae al inicial, no rompe', () => {
  const d = filasDensas(ROSTER, [{ player_id: 'p1', estado: 'fantasma' }]);
  eq(d[0].estado, ESTADO_DEFECTO);
});

test('fila en BD de un jugador que no está en el roster se ignora', () => {
  const d = filasDensas(ROSTER, [{ player_id: 'otro-equipo', estado: 'presente' }]);
  eq(d.length, 3);
});

console.log('· resumenAsistencia');

test('cuenta por estado y calcula el porcentaje de los que entrenaron', () => {
  const r = resumenAsistencia([
    { estado: 'presente' }, { estado: 'presente' }, { estado: 'tarde' },
    { estado: 'justificado' }, { estado: 'ausente' },
  ]);
  eq([r.total, r.presente, r.tarde, r.justificado, r.ausente], [5, 2, 1, 1, 1]);
  eq(r.entrenaron, 3);           // presente + tarde
  eq(r.pct, 60);                 // 3/5
});

test('lesionado y justificado suman falta AVISADA, no entrenaron', () => {
  const r = resumenAsistencia([{ estado: 'lesionado' }, { estado: 'justificado' }, { estado: 'presente' }]);
  eq([r.justificadas, r.entrenaron, r.pct], [2, 1, 33]);
});

test('lista vacía → todo a cero, sin dividir por cero', () => {
  const r = resumenAsistencia([]);
  eq([r.total, r.entrenaron, r.pct], [0, 0, 0]);
});

test('estados desconocidos no cuentan en el total', () => {
  const r = resumenAsistencia([{ estado: 'presente' }, { estado: 'ovni' }]);
  eq([r.total, r.pct], [1, 100]);
});

console.log('· estadisticasJugadores');

test('porcentaje por jugador sobre las sesiones con lista pasada', () => {
  const filas = [
    { player_id: 'p1', estado: 'presente' }, { player_id: 'p1', estado: 'ausente' },
    { player_id: 'p1', estado: 'presente' }, { player_id: 'p1', estado: 'tarde' },
    { player_id: 'p2', estado: 'ausente' }, { player_id: 'p2', estado: 'justificado' },
  ];
  const st = estadisticasJugadores(ROSTER, filas);
  eq(st.map((s) => [s.player_id, s.total, s.entrenaron, s.ausentes, s.pct]), [
    ['p1', 4, 3, 1, 75],
    ['p2', 2, 0, 1, 0],
    ['p3', 0, 0, 0, null],      // sin datos ≠ 0 %
  ]);
});

test('respeta el orden del roster que se le pasa', () => {
  const st = estadisticasJugadores([ROSTER[2], ROSTER[0]], []);
  eq(st.map((s) => s.player_id), ['p3', 'p1']);
});

console.log('· filasParaGuardar / hayCambios');

test('filas listas para el upsert, con motivo normalizado', () => {
  const d = filasDensas(ROSTER, []);
  d[0].motivo = '   ';
  d[1].motivo = '  Médico  ';
  const filas = filasParaGuardar('s1', d);
  eq(filas.length, 3);
  eq(filas[0], { session_id: 's1', player_id: 'p1', estado: 'presente', motivo: null });
  eq(filas[1].motivo, 'Médico');
});

test('sin tocar nada: no hay cambios', () => {
  const bd = [
    { player_id: 'p1', estado: 'presente', motivo: null },
    { player_id: 'p2', estado: 'ausente', motivo: 'Médico' },
    { player_id: 'p3', estado: 'presente', motivo: null },
  ];
  eq(hayCambios(filasDensas(ROSTER, bd), bd), false);
});

test('cambiar un estado, un motivo o el número de filas se detecta', () => {
  const bd = [
    { player_id: 'p1', estado: 'presente', motivo: null },
    { player_id: 'p2', estado: 'presente', motivo: null },
    { player_id: 'p3', estado: 'presente', motivo: null },
  ];
  const d = filasDensas(ROSTER, bd);
  d[0].estado = 'ausente';
  eq(hayCambios(d, bd), true);
  const d2 = filasDensas(ROSTER, bd); d2[1].motivo = 'Viaje';
  eq(hayCambios(d2, bd), true);
  eq(hayCambios(filasDensas(ROSTER, []), []), true);   // 3 filas nuevas vs 0 en BD
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
