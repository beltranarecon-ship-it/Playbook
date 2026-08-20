/* ============================================================
   eval-avisos.mjs — banco Node de los seis avisos (Tramo 4.8).
   equipos/js/data/avisos.js. Sin red, sin DOM, sin reloj real.

     node equipos/tools/eval-avisos.mjs

   Lo que vigila, por orden de importancia:

     1. Que NO llegue un aviso de algo que ya está hecho. Un aviso que
        sobra enseña a ignorar todos los demás, y entonces el que
        importa tampoco se lee.
     2. Que cada uno lleve su `url`: en el móvil más limitado, todo se
        hace abriendo el aviso (§5.8).
     3. Que la clave identifique el HECHO, para que el índice único de
        la 031 impida el duplicado aunque la función se reintente.
   ============================================================ */

import {
  TIPOS, iso, minutosDe, minutosDelDia, masDias, enVentana,
  avisosDe, faltaDelPartido, avisoDeCambio, HORA_TARDE, HORA_MANANA,
} from '../js/data/avisos.js';

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

/* Un jueves cualquiera. Se construyen en hora LOCAL a propósito: los
   avisos se mandan a la hora del club, no en UTC. */
const A = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0);
const HOY = '2026-10-15';
const EQUIPO = {
  id: 't1', name: 'Cadete A', dia_convocatoria: 5, hora_convocatoria: '18:00:00',
  coaches: ['u1', 'u2'],
};

/* ── 0. Reloj ──────────────────────────────────────────────── */

console.log('\n· el reloj, que se pasa por parámetro');

test('la ventana mira hacia atrás, no hacia delante', () => {
  /* La función corre cada pocos minutos: sin ventana, un aviso de las
     19:00 con la función corriendo a las 19:02 no se manda nunca. */
  ok(enVentana(19 * 60, 19 * 60 + 2, 15), 'las 19:00 vistas a las 19:02');
  ok(!enVentana(19 * 60, 19 * 60 + 20, 15), 'pero no veinte minutos después');
  ok(!enVentana(19 * 60, 18 * 60 + 55, 15), 'ni antes de que llegue la hora');
  ok(!enVentana(null, 100, 15), 'sin hora no hay ventana');
});

test('las horas y los días se leen bien', () => {
  eq(minutosDe('18:00:00'), 1080);
  eq(minutosDe('7:05'), 425);
  eq(minutosDe('a las ocho'), null);
  eq(masDias('2026-10-15', -1), '2026-10-14');
  eq(masDias('2026-10-31', 1), '2026-11-01');
  eq(minutosDelDia(A(2026, 10, 15, 19, 30)), 1170);
});

test('el cambio de hora no mueve un día', () => {
  /* Se calcula a mediodía justamente por esto: con las 00:00, la noche
     en que se cambia la hora el «día siguiente» sale igual o dos veces. */
  eq(masDias('2026-10-24', 1), '2026-10-25');
  eq(masDias('2026-10-25', 1), '2026-10-26');
  eq(masDias('2026-03-28', 1), '2026-03-29');
  eq(masDias('2026-03-29', 1), '2026-03-30');
});

/* ── 1. Pasar lista ────────────────────────────────────────── */

console.log('\n· pasar lista al empezar');

const sesion = (extra = {}) => ({
  id: 's1', team_id: 't1', fecha: HOY, hora_inicio: '18:30:00',
  estado: 'programada', evaluada_at: null, tiene_asistencia: false, ...extra,
});

test('llega a la hora de empezar, y con su url', () => {
  const a = avisosDe({ ahora: A(2026, 10, 15, 18, 32), sesiones: [sesion()], equipos: [EQUIPO] });
  const x = a.find((v) => v.tipo === 'lista');
  ok(x, JSON.stringify(a));
  eq(x.url, '/sesiones/s1/activa');
  eq(x.para, ['u1', 'u2']);
  eq(x.clave, 'lista:s1');
});

test('pero NO si ya se ha pasado', () => {
  /* Un aviso de algo hecho enseña a ignorar todos los demás. */
  const a = avisosDe({ ahora: A(2026, 10, 15, 18, 32), sesiones: [sesion({ tiene_asistencia: true })], equipos: [EQUIPO] });
  eq(a.filter((v) => v.tipo === 'lista'), []);
});

test('ni de una sesión cancelada', () => {
  const a = avisosDe({ ahora: A(2026, 10, 15, 18, 32), sesiones: [sesion({ estado: 'cancelada' })], equipos: [EQUIPO] });
  eq(a.filter((v) => v.tipo === 'lista'), []);
});

/* ── 2. Fin de bloque ──────────────────────────────────────── */

console.log('\n· fin de bloque, el respaldo del cronómetro');

test('cada bloque avisa al acabarse, y la clave es ESE bloque', () => {
  /* Arranca a las 18:30 con 10 + 15: el primero acaba a las 18:40 y el
     segundo a las 18:55. */
  const s = sesion({
    arranque: A(2026, 10, 15, 18, 30).toISOString(),
    bloques: [
      { id: 'b1', titulo: 'Calentamiento', duracion_min: 10 },
      { id: 'b2', titulo: 'Flecha de tiro', duracion_min: 15 },
    ],
  });
  const a1 = avisosDe({ ahora: A(2026, 10, 15, 18, 41), ventanaMin: 5, sesiones: [s], equipos: [EQUIPO] });
  eq(a1.filter((v) => v.tipo === 'bloque').map((v) => v.clave), ['bloque:s1:b1']);
  ok(a1.find((v) => v.tipo === 'bloque').titulo.includes('Calentamiento'));

  const a2 = avisosDe({ ahora: A(2026, 10, 15, 18, 56), ventanaMin: 5, sesiones: [s], equipos: [EQUIPO] });
  eq(a2.filter((v) => v.tipo === 'bloque').map((v) => v.clave), ['bloque:s1:b2']);
});

test('sin arrancar la sesión no hay bloques que acabar', () => {
  const a = avisosDe({ ahora: A(2026, 10, 15, 18, 41), sesiones: [sesion({ bloques: [{ id: 'b1', duracion_min: 10 }] })], equipos: [EQUIPO] });
  eq(a.filter((v) => v.tipo === 'bloque'), []);
});

/* ── 3. Mañana sin programar ───────────────────────────────── */

console.log('\n· la de mañana sin plan');

test('la tarde anterior, y solo si sigue preliminar', () => {
  const manana = sesion({ id: 's2', fecha: '2026-10-16', estado: 'preliminar' });
  const a = avisosDe({ ahora: A(2026, 10, 15, 19, 2), sesiones: [manana], equipos: [EQUIPO] });
  const x = a.find((v) => v.tipo === 'sin_programar');
  ok(x, JSON.stringify(a));
  eq(x.url, '/sesiones/s2');
  eq(HORA_TARDE, 19 * 60);
});

test('una ya programada no molesta a nadie', () => {
  const manana = sesion({ id: 's2', fecha: '2026-10-16', estado: 'programada' });
  eq(avisosDe({ ahora: A(2026, 10, 15, 19, 2), sesiones: [manana], equipos: [EQUIPO] }).length, 0);
});

test('y por la mañana todavía no toca', () => {
  const manana = sesion({ id: 's2', fecha: '2026-10-16', estado: 'preliminar' });
  eq(avisosDe({ ahora: A(2026, 10, 15, 9, 0), sesiones: [manana], equipos: [EQUIPO] }).length, 0);
});

/* ── 4. Sin cerrar ─────────────────────────────────────────── */

console.log('\n· la de ayer sin cerrar');

test('al día siguiente, si no está evaluada', () => {
  const ayer = sesion({ id: 's3', fecha: '2026-10-14' });
  const a = avisosDe({ ahora: A(2026, 10, 15, 19, 5), sesiones: [ayer], equipos: [EQUIPO] });
  const x = a.find((v) => v.tipo === 'sin_cerrar');
  ok(x, JSON.stringify(a));
  eq(x.url, '/sesiones/s3/cierre');
});

test('y no si ya se cerró', () => {
  const ayer = sesion({ id: 's3', fecha: '2026-10-14', evaluada_at: '2026-10-14T20:00:00Z' });
  eq(avisosDe({ ahora: A(2026, 10, 15, 19, 5), sesiones: [ayer], equipos: [EQUIPO] }).length, 0);
});

/* ── 5. Convocatoria ───────────────────────────────────────── */

console.log('\n· la convocatoria sin rellenar');

const partido = (extra = {}) => ({
  id: 'm1', team_id: 't1', fecha: '2026-10-17', rival: 'CB Rival', es_local: true,
  estado: 'programado', convocados: [], marcador_favor: null, marcador_contra: null,
  acta_path: null, ...extra,
});

test('el día y a la hora que diga el equipo', () => {
  const m = partido({ dia_convocatoria_iso: HOY });
  const a = avisosDe({ ahora: A(2026, 10, 15, 18, 3), partidos: [m], equipos: [EQUIPO] });
  const x = a.find((v) => v.tipo === 'convocatoria');
  ok(x, JSON.stringify(a));
  eq(x.url, '/partidos/m1');
  eq(x.clave, 'convocatoria:m1');
});

test('si ya hay convocados, no se dice nada', () => {
  const m = partido({ dia_convocatoria_iso: HOY, convocados: ['p1', 'p2'] });
  eq(avisosDe({ ahora: A(2026, 10, 15, 18, 3), partidos: [m], equipos: [EQUIPO] }).length, 0);
});

test('y SIN hora puesta no se avisa: mejor callarse que despertar a alguien', () => {
  const sinHora = { ...EQUIPO, hora_convocatoria: null };
  const m = partido({ dia_convocatoria_iso: HOY });
  eq(avisosDe({ ahora: A(2026, 10, 15, 18, 3), partidos: [m], equipos: [sinHora] }).length, 0);
});

/* ── 6. Post-partido ───────────────────────────────────────── */

console.log('\n· el post-partido');

test('la mañana siguiente, y solo si falta algo', () => {
  const m = partido({ fecha: '2026-10-14', estado: 'jugado' });
  const a = avisosDe({ ahora: A(2026, 10, 15, 10, 4), partidos: [m], equipos: [EQUIPO] });
  const x = a.find((v) => v.tipo === 'post_partido');
  ok(x, JSON.stringify(a));
  ok(x.cuerpo.includes('el resultado') && x.cuerpo.includes('el acta'), x.cuerpo);
  eq(HORA_MANANA, 10 * 60);
});

test('con todo puesto NO llega nada', () => {
  /* Este es el aviso que más fácil sobra, y el que más rápido enseña a
     ignorar la app si llega cuando ya está el trabajo hecho. */
  const m = partido({
    fecha: '2026-10-14', estado: 'jugado', marcador_favor: 38, marcador_contra: 30,
    val_global: 4, acta_path: 'x/y.jpg',
  });
  eq(avisosDe({ ahora: A(2026, 10, 15, 10, 4), partidos: [m], equipos: [EQUIPO] }).length, 0);
});

test('lo que falta se dice con nombre', () => {
  eq(faltaDelPartido({}), ['el resultado', 'la valoración', 'el acta']);
  eq(faltaDelPartido({ marcador_favor: 1, marcador_contra: 2, val_ataque: 3, acta_path: 'x' }), []);
});

/* ── 7. Cosas comunes ──────────────────────────────────────── */

console.log('\n· lo que comparten los seis');

test('los seis tipos existen y todos llevan url', () => {
  eq(TIPOS.length, 6);
  const s = sesion({
    arranque: A(2026, 10, 15, 18, 30).toISOString(),
    bloques: [{ id: 'b1', titulo: 'x', duracion_min: 2 }],
  });
  const a = avisosDe({ ahora: A(2026, 10, 15, 18, 33), ventanaMin: 5, sesiones: [s], equipos: [EQUIPO] });
  ok(a.length, 'algo tiene que salir');
  for (const x of a) ok(x.url && x.url.startsWith('/'), `${x.tipo} sin url: ${x.url}`);
});

test('un equipo sin entrenadores no genera avisos para nadie', () => {
  /* Sin esto se crearían filas de aviso sin destinatario, que no las lee
     nadie y ensucian la cola para siempre. */
  const huerfano = { ...EQUIPO, coaches: [] };
  eq(avisosDe({ ahora: A(2026, 10, 15, 18, 32), sesiones: [sesion()], equipos: [huerfano] }), []);
});

test('sin hora no se inventa nada', () => {
  eq(avisosDe({}), []);
  eq(avisosDe({ ahora: 'el jueves' }), []);
});

/* ── 8. De entrenador a entrenador (4.13) ──────────────────── */

console.log('\n· de un entrenador al otro');

test('avisa a los del equipo MENOS al que lo ha cambiado', () => {
  /* Avisar a alguien de lo que acaba de hacer él es la manera más
     rápida de que silencie la app. */
  const a = avisoDeCambio({
    quienCambia: 'u1', nombreQuienCambia: 'Beltrán', equipo: EQUIPO,
    que: 'el plan del martes', url: '/sesiones/s1', cuando: A(2026, 10, 15, 19, 20),
  });
  eq(a.para, ['u2']);
  ok(a.titulo.includes('Beltrán') && a.titulo.includes('el plan del martes'), a.titulo);
  eq(a.tipo, 'equipo');
});

test('dos cambios distintos son dos avisos', () => {
  /* Si compartieran clave, el segundo no llegaría y el otro entrenador
     se quedaría con la versión de antes creyendo que está al día. */
  const uno = avisoDeCambio({ quienCambia: 'u1', equipo: EQUIPO, que: 'el plan', cuando: A(2026, 10, 15, 19, 20) });
  const dos = avisoDeCambio({ quienCambia: 'u1', equipo: EQUIPO, que: 'el plan', cuando: A(2026, 10, 15, 20, 40) });
  ok(uno.clave !== dos.clave, `${uno.clave} vs ${dos.clave}`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
