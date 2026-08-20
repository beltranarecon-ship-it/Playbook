/* ============================================================
   eval-temporada-stats.mjs — banco Node de los acumulados de
   temporada (equipos/js/data/temporada-stats.js). Sin red, sin DOM.

     node equipos/tools/eval-temporada-stats.mjs

   Lo que vigila:

     1. Que un partido SIN acta no cuente como «jugó cero periodos».
        Ausencia no es cero, aquí igual que en la rúbrica.
     2. Que la tabla se ordene por PERIODOS. Ordenada por puntos, el
        que menos juega queda escondido en medio, que es justo el
        nombre que hay que ver.
     3. Que todo lo que se enseña diga sobre cuántos partidos va: una
        media sobre dos partidos y una sobre veinte se leen igual y no
        valen lo mismo.
   ============================================================ */

import {
  acumular, deJugador, tabla, reparto, textoAcumulado, textoReparto, conUnDecimal,
} from '../js/data/temporada-stats.js';

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

const PARTIDOS = [
  { id: 'm1', fecha: '2026-10-04', estado: 'jugado' },
  { id: 'm2', fecha: '2026-10-11', estado: 'jugado' },
  { id: 'm3', fecha: '2026-10-18', estado: 'jugado' },
  { id: 'm4', fecha: '2026-10-25', estado: 'aplazado' },
  { id: 'm5', fecha: '2026-11-01', estado: 'programado' },
];
const JUGADORES = [
  { id: 'p1', nombre: 'Ana' }, { id: 'p2', nombre: 'Bruno' },
  { id: 'p3', nombre: 'Carla' }, { id: 'p4', nombre: 'Diego' },
];
const E = (match_id, player_id, periodos_jugados, puntos = 0, faltas = 0) =>
  ({ match_id, player_id, periodos_jugados, puntos, faltas });

const FILAS = [
  E('m1', 'p1', 4, 10, 1), E('m1', 'p2', 3, 4), E('m1', 'p3', 2, 0, 2),
  E('m2', 'p1', 3, 8), E('m2', 'p2', 4, 6, 1), E('m2', 'p3', 2, 2),
  E('m3', 'p1', 4, 12, 2), E('m3', 'p2', 3, 5), E('m3', 'p3', 1, 0),
];

/* ── 1. Acumular ───────────────────────────────────────────── */

console.log('\n· acumular');

test('los periodos y los puntos se suman por jugador', () => {
  const a = deJugador(acumular(FILAS, PARTIDOS), 'p1');
  eq(a.partidos, 3);
  eq(a.periodos, 11);
  eq(a.puntos, 30);
  eq(a.faltas, 3);
});

test('y las medias dicen sobre cuántos partidos van', () => {
  const a = deJugador(acumular(FILAS, PARTIDOS), 'p3');
  eq(a.partidos, 3);
  eq(a.periodos, 5);
  ok(Math.abs(a.periodosPorPartido - 5 / 3) < 1e-9, String(a.periodosPorPartido));
});

test('el techo y el suelo de la temporada', () => {
  const a = deJugador(acumular(FILAS, PARTIDOS), 'p3');
  eq(a.masPeriodos, 2);
  eq(a.menosPeriodos, 1);
});

test('los últimos partidos salen del más reciente al más viejo', () => {
  const a = deJugador(acumular(FILAS, PARTIDOS), 'p1');
  eq(a.ultimos.map((x) => x.fecha), ['2026-10-18', '2026-10-11', '2026-10-04']);
});

/* ── 2. Ausencia no es cero ────────────────────────────────── */

console.log('\n· ausencia no es cero');

test('el que no aparece en ninguna acta no lleva un cero: no lleva nada', () => {
  /* Un cero dice «jugó y no hizo nada». No estar dice «no jugó», que es
     otra cosa y es la que suele ser verdad. */
  const a = deJugador(acumular(FILAS, PARTIDOS), 'p4');
  eq(a.partidos, 0);
  eq(a.periodos, 0);
  eq(textoAcumulado(a), 'Todavía no ha jugado ningún partido con acta apuntada.');
});

test('un partido aplazado o sin jugar no suma aunque tenga filas', () => {
  /* Una fila huérfana —de un partido que se aplazó después de
     apuntarlo— sumaría periodos de un partido que no se jugó. */
  const conBasura = [...FILAS, E('m4', 'p1', 6, 20), E('m5', 'p1', 6, 20)];
  const a = deJugador(acumular(conBasura, PARTIDOS), 'p1');
  eq(a.partidos, 3, 'siguen siendo tres');
  eq(a.periodos, 11);
});

test('ni una fila de un partido que ya no existe', () => {
  const a = deJugador(acumular([...FILAS, E('borrado', 'p1', 6, 20)], PARTIDOS), 'p1');
  eq(a.periodos, 11);
});

test('sin partidos no revienta', () => {
  eq(acumular(FILAS, []).size, 0);
  eq(acumular(null, null).size, 0);
});

/* ── 3. La tabla ───────────────────────────────────────────── */

console.log('\n· la tabla, ordenada por lo que importa');

test('manda quién juega más, NO quién anota más', () => {
  /* Ordenada por puntos, el que menos juega queda escondido en medio.
     Aquí el último de la lista es el nombre que hay que ver. */
  const t = tabla(acumular(FILAS, PARTIDOS), JUGADORES);
  eq(t.map((x) => x.jugador.nombre), ['Ana', 'Bruno', 'Carla', 'Diego']);
  eq(t.map((x) => x.periodos), [11, 10, 5, 0]);
});

test('a igualdad de periodos baja el que ha estado en MENOS actas', () => {
  /* Los dos llevan 4 periodos, pero Ana solo ha estado en un partido y
     Bruno en dos. La tabla existe para que el último nombre sea el que
     hay que mirar, y haber estado en menos partidos está más cerca del
     problema que haber jugado poco en muchos. */
  const filas = [E('m1', 'p1', 4), E('m1', 'p2', 2), E('m2', 'p2', 2)];
  const t = tabla(acumular(filas, PARTIDOS), JUGADORES.slice(0, 2));
  eq(t.map((x) => [x.jugador.nombre, x.periodos, x.partidos]), [['Bruno', 4, 2], ['Ana', 4, 1]]);
});

test('el que no ha jugado sale igual, al final y a cero', () => {
  /* Que no aparezca sería peor: el que no juega es exactamente el que
     hay que tener delante. */
  const t = tabla(acumular(FILAS, PARTIDOS), JUGADORES);
  eq(t[3].jugador.nombre, 'Diego');
  eq(t[3].partidos, 0);
});

/* ── 4. El reparto ─────────────────────────────────────────── */

console.log('\n· el reparto');

test('la brecha va del que más juega al que menos', () => {
  const r = reparto(acumular(FILAS, PARTIDOS), JUGADORES);
  eq(r.n, 3, 'solo cuentan los que han jugado');
  eq(r.max, 11);
  eq(r.min, 5);
  eq(r.brecha, 6);
  eq(r.quienMenos.nombre, 'Carla');
});

test('y el que no ha jugado nada NO cuenta en la brecha', () => {
  /* Meter a Diego con 0 haría que la brecha midiera «hay uno que no ha
     venido», que es otra conversación y ya la lleva la asistencia. */
  const r = reparto(acumular(FILAS, PARTIDOS), JUGADORES);
  ok(r.min === 5, `min=${r.min}`);
});

test('un equipo repartido se dice en positivo', () => {
  const filas = [E('m1', 'p1', 3), E('m1', 'p2', 3), E('m1', 'p3', 2)];
  const t = textoReparto(reparto(acumular(filas, PARTIDOS), JUGADORES));
  ok(t.includes('repartido') && t.includes('1 periodo'), t);
});

test('y uno desigual dice el nombre y el número', () => {
  const t = textoReparto(reparto(acumular(FILAS, PARTIDOS), JUGADORES));
  ok(t.includes('6 periodos') && t.includes('Carla') && t.includes('5'), t);
});

test('con un solo jugador no hay reparto que contar', () => {
  eq(textoReparto(reparto(acumular([E('m1', 'p1', 4)], PARTIDOS), JUGADORES)), '');
  eq(reparto(acumular([], PARTIDOS), JUGADORES), null);
});

/* ── 5. Cómo se lee ────────────────────────────────────────── */

console.log('\n· cómo se lee');

test('el acumulado se lee en periodos y dice en cuántos partidos', () => {
  const a = deJugador(acumular(FILAS, PARTIDOS), 'p1');
  const t = textoAcumulado(a);
  ok(t.includes('11 periodos en 3 partidos'), t);
  ok(t.includes('3,7 por partido') || t.includes('3.7 por partido'), t);
  ok(t.includes('30 puntos'), t);
});

test('un decimal, y sin el «,0» cuando es redondo', () => {
  eq(conUnDecimal(3), '3');
  eq(conUnDecimal(3.666), '3.7');
  eq(conUnDecimal(null), '0');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
