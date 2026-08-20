/* ============================================================
   eval-inicio.mjs — banco Node de la pantalla de inicio (Tramo 4.11).
   equipos/js/data/inicio.js. Sin red, sin DOM, sin reloj real.

     node equipos/tools/eval-inicio.mjs

   Lo que vigila:

     1. Que «la semana que viene» sea de lunes a domingo y no una
        ventana de siete días. Con la ventana móvil, el domingo por la
        noche desaparecería de golpe media pantalla.
     2. Que las cinco secciones estén SIEMPRE, también vacías: una
        pantalla que cambia de forma cada día no se aprende nunca.
     3. Que lo que queda por cerrar salga primero de lo de la semana
        pasada: es lo único de ahí sobre lo que se puede hacer algo.
   ============================================================ */

import { iso, lunesDe, masDias, semanas, secciones, resumen } from '../js/data/inicio.js';

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

/* 2026-10-15 es jueves. */
const HOY = '2026-10-15';

/* ── 1. Las semanas ────────────────────────────────────────── */

console.log('\n· las semanas, de lunes a domingo');

test('el lunes de la semana de un jueves', () => {
  eq(lunesDe('2026-10-15'), '2026-10-12');
  eq(lunesDe('2026-10-12'), '2026-10-12', 'un lunes es su propio lunes');
  eq(lunesDe('2026-10-18'), '2026-10-12', 'y el domingo cierra esa semana');
});

test('las tres semanas caen donde tienen que caer', () => {
  const s = semanas(HOY);
  eq(s.esta, { desde: '2026-10-12', hasta: '2026-10-18' });
  eq(s.proxima, { desde: '2026-10-19', hasta: '2026-10-25' });
  eq(s.pasada, { desde: '2026-10-05', hasta: '2026-10-11' });
});

test('«la semana que viene» NO es «los próximos siete días»', () => {
  /* Visto un jueves y visto el domingo, «la semana que viene» tiene que
     ser la MISMA semana. Con una ventana móvil, el domingo por la noche
     desaparecería de golpe media pantalla. */
  eq(semanas('2026-10-15').proxima, semanas('2026-10-18').proxima);
});

test('y el cambio de hora no mueve el lunes', () => {
  eq(lunesDe('2026-10-26'), '2026-10-26');
  eq(masDias('2026-10-24', 2), '2026-10-26');
});

/* ── 2. Las cinco secciones ────────────────────────────────── */

console.log('\n· las cinco secciones');

const ses = (id, fecha, estado = 'programada', extra = {}) =>
  ({ id, team_id: 't1', fecha, hora_inicio: '18:30:00', estado, evaluada_at: null, ...extra });
const par = (id, fecha, extra = {}) =>
  ({ id, team_id: 't1', fecha, hora: '11:00:00', rival: 'CB Rival', estado: 'programado', ...extra });

test('están siempre las cinco, y en el orden de §5.11', () => {
  /* También vacías: una sección que desaparece cuando no hay nada hace
     que la pantalla cambie de forma cada día. */
  const s = secciones({ hoy: HOY });
  eq(s.map((x) => x.clave), ['hoy', 'sin_plan', 'con_plan', 'pasada', 'competicion']);
  eq(s.every((x) => Array.isArray(x.cosas)), true);
});

test('TODO lo que sale lleva dicho QUÉ es', () => {
  /* El fallo que este banco no cazaba: tres secciones salían sin `que`,
     la vista las daba por partidos, pintaba «@ undefined» y mandaba a
     /partidos/<id-de-sesión>. Una sesión y un partido se parecen
     bastante, y quien pinta no tiene otra forma de distinguirlos.

     Se comprueban las CINCO secciones a la vez a propósito: mirar solo
     las que mezclan tipos es exactamente lo que dejó pasar el fallo. */
  const s = secciones({
    hoy: HOY,
    sesiones: [
      ses('hoy', HOY),
      ses('sinplan', '2026-10-20', 'preliminar'),
      ses('conplan', '2026-10-21', 'programada'),
      ses('pasada', '2026-10-08', 'realizada'),
    ],
    partidos: [par('m1', HOY), par('m2', '2026-10-17')],
    convocatorias: [{ fecha: HOY, partido: par('m3', '2026-10-17'), cuantos: 0 }],
  });
  const legales = ['sesion', 'partido', 'convocatoria'];
  for (const sec of s) {
    for (const x of sec.cosas) {
      ok(legales.includes(x.que), `en «${sec.clave}» salió ${x.id || '?'} con que=${JSON.stringify(x.que)}`);
    }
  }
  // y las tres que fallaban, por su nombre
  for (const clave of ['sin_plan', 'con_plan', 'pasada']) {
    const cosas = s.find((x) => x.clave === clave).cosas;
    ok(cosas.length, `«${clave}» tenía que traer algo`);
    ok(cosas.every((x) => x.que === 'sesion'), `«${clave}» tiene que traer sesiones`);
  }
});

test('lo de hoy va arriba, y mezcla entreno, partido y convocatoria', () => {
  const s = secciones({
    hoy: HOY,
    sesiones: [ses('s1', HOY)],
    partidos: [par('m1', HOY)],
    convocatorias: [{ fecha: HOY, partido: par('m2', '2026-10-17'), cuantos: 0 }],
  });
  const hoy = s[0];
  eq(hoy.clave, 'hoy');
  eq(hoy.cosas.length, 3);
  eq(hoy.cosas.map((x) => x.que).sort(), ['convocatoria', 'partido', 'sesion']);
});

test('y lo de hoy va por hora', () => {
  const s = secciones({
    hoy: HOY,
    sesiones: [ses('tarde', HOY, 'programada', { hora_inicio: '19:30:00' }), ses('pronto', HOY, 'programada', { hora_inicio: '17:00:00' })],
  });
  eq(s[0].cosas.map((x) => x.id), ['pronto', 'tarde']);
});

test('una sesión cancelada no es «lo de hoy»', () => {
  const s = secciones({ hoy: HOY, sesiones: [ses('s1', HOY, 'cancelada')] });
  eq(s[0].cosas, []);
});

test('sin plan y con plan van separados, y solo de la semana que viene', () => {
  const s = secciones({
    hoy: HOY,
    sesiones: [
      ses('prox-sin', '2026-10-20', 'preliminar'),
      ses('prox-con', '2026-10-21', 'programada'),
      ses('esta-sin', '2026-10-16', 'preliminar'),   // esta semana: no cuenta
      ses('lejos', '2026-11-02', 'preliminar'),      // dentro de dos: tampoco
    ],
  });
  eq(s.find((x) => x.clave === 'sin_plan').cosas.map((x) => x.id), ['prox-sin']);
  eq(s.find((x) => x.clave === 'con_plan').cosas.map((x) => x.id), ['prox-con']);
});

test('de la semana pasada sale primero lo que queda por cerrar', () => {
  /* Es lo único de esa sección sobre lo que todavía se puede hacer
     algo; lo demás es histórico. */
  const s = secciones({
    hoy: HOY,
    sesiones: [
      ses('cerrada', '2026-10-07', 'realizada', { evaluada_at: '2026-10-07T20:00:00Z' }),
      ses('abierta', '2026-10-08', 'realizada'),
    ],
  });
  eq(s.find((x) => x.clave === 'pasada').cosas.map((x) => x.id), ['abierta', 'cerrada']);
});

test('la competición mira hacia delante, no hacia atrás', () => {
  /* Lo de ayer ya está en el calendario; aquí interesa lo que viene. */
  const s = secciones({
    hoy: HOY,
    partidos: [par('ayer', '2026-10-14'), par('manana', '2026-10-16'), par('lejos', '2026-11-20')],
  });
  eq(s.find((x) => x.clave === 'competicion').cosas.map((x) => x.id), ['manana', 'lejos']);
});

/* ── 3. El resumen ─────────────────────────────────────────── */

console.log('\n· el resumen de una línea');

test('cuenta lo de hoy, lo que falta por preparar y lo que falta por cerrar', () => {
  const s = secciones({
    hoy: HOY,
    sesiones: [ses('s1', HOY), ses('p1', '2026-10-20', 'preliminar'), ses('v1', '2026-10-08', 'realizada')],
  });
  const t = resumen(s);
  ok(t.includes('1 cosa hoy') && t.includes('1 sin plan') && t.includes('1 sin cerrar'), t);
});

test('y si no hay nada, no dice nada', () => {
  eq(resumen(secciones({ hoy: HOY })), '');
});

test('sin fecha no se inventa una pantalla', () => {
  eq(secciones({}), []);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
