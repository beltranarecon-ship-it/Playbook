/* ============================================================
   eval-plantilla.mjs — banco Node de la plantilla interrogable
   (equipos/js/data/plantilla.js). Sin red, sin DOM.

     node equipos/tools/eval-plantilla.mjs

   Lo que vigila: que los minutos activos de un jugador sean los SUYOS
   —los de las sesiones a las que vino, con la gente que hubo ese día—
   y que los filtros no confundan «no hay dato» con «va mal». Un filtro
   que mete a los que no se han mirado en el cajón de los que van mal
   convierte una lista de trabajo en una lista de acusados.
   ============================================================ */

import {
  minutosPorJugador, asistenciaPorPeriodo, ultimaSemana,
  pasaFiltros, textoAsistencia, textoMinutos,
  FILTROS_ESTADO, FILTROS_RENDIMIENTO,
} from '../js/data/plantilla.js';

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

/* Dos sesiones de 60 minutos con el mismo ejercicio: una con seis
   críos y otra con dieciocho. El ejercicio se monta con doce. */
const REQ = { densidad: 'alta', jugadores_max: 12 };
const requisitosDe = () => REQ;
const SESIONES = [
  { id: 's1', fecha: '2026-09-01', estado: 'realizada' },
  { id: 's2', fecha: '2026-09-08', estado: 'realizada' },
  { id: 's3', fecha: '2026-09-15', estado: 'cancelada' },
];
const BLOQUES = {
  s1: [{ duracion_min: 60, exercise_id: 'e1' }],
  s2: [{ duracion_min: 60, exercise_id: 'e1' }],
  s3: [{ duracion_min: 60, exercise_id: 'e1' }],
};
const A = (p, s, estado, fecha) => ({ player_id: p, session_id: s, estado, fecha });

/* ── 1. Los minutos son los suyos ──────────────────────────── */

console.log('\n· los minutos activos de cada uno');

test('el día que vinieron seis rinde más por crío que el que vinieron dieciocho', () => {
  const asistencia = [
    ...['p1', 'p2', 'p3', 'p4', 'p5', 'p6'].map((p) => A(p, 's1', 'presente', '2026-09-01')),
    ...Array.from({ length: 18 }, (_, i) => A(`q${i}`, 's2', 'presente', '2026-09-08')),
  ];
  const m = minutosPorJugador({ sesiones: SESIONES, bloquesPorSesion: BLOQUES, asistencia, requisitosDe });
  eq(m.p1.minutos, 60, 'con seis caben todos: los sesenta minutos');
  eq(m.q0.minutos, 40, 'con dieciocho en un montaje de doce: 60 × 12/18');
});

test('el que no vino no suma: contarle sería premiarle por faltar', () => {
  const asistencia = [
    A('p1', 's1', 'presente', '2026-09-01'),
    A('p2', 's1', 'ausente', '2026-09-01'),
    A('p2', 's2', 'presente', '2026-09-08'),
  ];
  const m = minutosPorJugador({ sesiones: SESIONES, bloquesPorSesion: BLOQUES, asistencia, requisitosDe });
  eq(m.p1.sesiones, 1);
  eq(m.p2.sesiones, 1, 'solo la segunda');
});

test('«tarde» sí entrenó', () => {
  const m = minutosPorJugador({
    sesiones: SESIONES, bloquesPorSesion: BLOQUES,
    asistencia: [A('p1', 's1', 'tarde', '2026-09-01')], requisitosDe,
  });
  eq(m.p1.sesiones, 1);
});

test('una sesión cancelada no da minutos a nadie', () => {
  const m = minutosPorJugador({
    sesiones: SESIONES, bloquesPorSesion: BLOQUES,
    asistencia: [A('p1', 's3', 'presente', '2026-09-15')], requisitosDe,
  });
  eq(m.p1, undefined);
});

test('sin nada no revienta', () => {
  eq(minutosPorJugador({}), {});
  eq(minutosPorJugador(), {});
});

/* ── 2. Asistencia por periodo ─────────────────────────────── */

console.log('\n· la asistencia, por semana o por temporada');

const ASIS = [
  A('p1', 's1', 'presente', '2026-09-01'),
  A('p1', 's2', 'ausente', '2026-09-08'),
  A('p1', 's4', 'presente', '2026-09-10'),
];

test('la temporada entera', () => {
  const r = asistenciaPorPeriodo(ASIS);
  eq(r.p1, { vino: 2, total: 3, pct: 67 });
});

test('y una ventana: lo de antes no cuenta', () => {
  const r = asistenciaPorPeriodo(ASIS, { desde: '2026-09-05', hasta: '2026-09-30' });
  eq(r.p1, { vino: 1, total: 2, pct: 50 });
});

test('«semana» son los últimos siete días, no la semana natural', () => {
  /* El lunes por la mañana una semana natural está vacía, y la
     pregunta —¿quién ha faltado últimamente?— se queda sin respuesta
     justo cuando se hace. */
  const { desde, hasta } = ultimaSemana(new Date(2026, 8, 14));
  eq(hasta, '2026-09-14');
  eq(desde, '2026-09-08');
});

test('sin sesiones, el porcentaje es null y no cero', () => {
  eq(asistenciaPorPeriodo([]), {});
  eq(textoAsistencia(null), 'sin sesiones');
  eq(textoAsistencia({ vino: 12, total: 14, pct: 86 }), '12 de 14 · 86 %');
});

/* ── 3. Los filtros ────────────────────────────────────────── */

console.log('\n· preguntarle a la plantilla');

const J = (id, estado = 'activo') => ({ id, nombre: id, estado });
const RES = {
  a: { subidas: 2, bajadas: 0, miradas: 5 },
  b: { subidas: 0, bajadas: 1, miradas: 3 },
  c: { subidas: 0, bajadas: 0, miradas: 0 },
};

test('por estado', () => {
  eq(FILTROS_ESTADO, ['activo', 'lesionado', 'baja']);
  ok(pasaFiltros(J('a'), { estados: ['activo'] }));
  ok(!pasaFiltros(J('a', 'baja'), { estados: ['activo'] }));
  ok(pasaFiltros(J('a', 'baja'), { estados: ['baja'] }), 'los archivados se pueden pedir');
  ok(pasaFiltros(J('a', 'baja'), {}), 'sin filtro, todos');
});

test('por rendimiento, con los tres cajones', () => {
  eq(FILTROS_RENDIMIENTO, ['subido', 'bajado', 'sin_mirar']);
  ok(pasaFiltros(J('a'), { rendimiento: ['subido'], resumenes: RES }));
  ok(!pasaFiltros(J('b'), { rendimiento: ['subido'], resumenes: RES }));
  ok(pasaFiltros(J('b'), { rendimiento: ['bajado'], resumenes: RES }));
  ok(pasaFiltros(J('c'), { rendimiento: ['sin_mirar'], resumenes: RES }));
});

test('«sin mirar» NO es «va mal»: son cajones distintos', () => {
  /* Meterlos juntos convertiría una lista de trabajo en una lista de
     acusados. */
  ok(!pasaFiltros(J('c'), { rendimiento: ['bajado'], resumenes: RES }));
  ok(!pasaFiltros(J('a'), { rendimiento: ['sin_mirar'], resumenes: RES }));
});

test('por asistencia baja, y sin datos no se cuela', () => {
  const asis = { a: { vino: 2, total: 10, pct: 20 }, b: { vino: 9, total: 10, pct: 90 } };
  ok(pasaFiltros(J('a'), { asistenciaMax: 50, asistencia: asis }));
  ok(!pasaFiltros(J('b'), { asistenciaMax: 50, asistencia: asis }));
  ok(!pasaFiltros(J('c'), { asistenciaMax: 50, asistencia: asis }), 'sin datos no es faltar');
});

test('los filtros se suman', () => {
  const asis = { a: { vino: 2, total: 10, pct: 20 } };
  ok(pasaFiltros(J('a'), { estados: ['activo'], rendimiento: ['subido'], asistenciaMax: 50, resumenes: RES, asistencia: asis }));
  ok(!pasaFiltros(J('a', 'lesionado'), { estados: ['activo'], rendimiento: ['subido'], asistenciaMax: 50, resumenes: RES, asistencia: asis }));
});

test('el texto de los minutos se lee sin traducir', () => {
  eq(textoMinutos({ minutos: 184, sesiones: 12 }), '184 min activos en 12 sesiones');
  eq(textoMinutos({ minutos: 15, sesiones: 1 }), '15 min activos en 1 sesión');
  eq(textoMinutos(null), 'sin minutos todavía');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
