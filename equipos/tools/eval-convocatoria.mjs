/* ============================================================
   eval-convocatoria.mjs — banco Node de la convocatoria
   (equipos/js/data/convocatoria.js). Sin red, sin DOM.

     node equipos/tools/eval-convocatoria.mjs

   Lo que vigila:

     1. Que el día de la convocatoria caiga SIEMPRE antes del partido.
        Un aviso que llega el mismo sábado por la mañana no sirve para
        nada, y es el fallo fácil al restar días de la semana.
     2. Que al llegar al tope no se desconvoque a nadie por su cuenta.
     3. Que el documento salga con lo que hay y diga lo que falta, en
        vez de un PDF con la mitad de los campos en blanco.
   ============================================================ */

import {
  CONVOCADOS_MAX, convocadosDe, estaConvocado, alternar, convocables,
  diaDeConvocatoria, eventoDe, loQueFalta, sePuedeSacar,
  fechaLarga, hhmm, datosDelDocumento, titular,
} from '../js/data/convocatoria.js';

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

/* Un sábado. 2026-08-22 es sábado. */
const PARTIDO = {
  id: 'm1', fecha: '2026-08-22', hora: '11:00:00', rival: 'CB Rival', es_local: true,
  lugar: 'Pabellón Municipal', estado: 'programado',
  convocados: [], convocatoria_lugar: null, convocatoria_hora: null,
};
const JUGADORES = [
  { id: 'p1', nombre: 'Ana Ruiz', dorsal: 4, estado: 'activo' },
  { id: 'p2', nombre: 'Bruno Sáez', dorsal: 7, estado: 'activo' },
  { id: 'p3', nombre: 'Carla Gil', dorsal: 9, estado: 'baja' },
];

/* ── 1. La lista ───────────────────────────────────────────── */

console.log('\n· a quién se convoca');

test('la lista sale limpia y sin repetidos', () => {
  eq(convocadosDe({ convocados: ['p1', 'p1', ' p2 ', '', null] }), ['p1', 'p2']);
  eq(convocadosDe({}), []);
  eq(convocadosDe(null), []);
});

test('marcar y desmarcar', () => {
  let p = { ...PARTIDO };
  p = { ...p, convocados: alternar(p, 'p1') };
  ok(estaConvocado(p, 'p1'));
  p = { ...p, convocados: alternar(p, 'p1') };
  ok(!estaConvocado(p, 'p1'));
});

test('al llegar al tope NO se desconvoca a nadie solo', () => {
  /* Quitar a un crío para meter a otro es una decisión del entrenador.
     Que la app elija a quién echar es el peor comportamiento posible. */
  eq(CONVOCADOS_MAX, 12);
  const llena = { convocados: Array.from({ length: 12 }, (_, i) => `x${i}`) };
  const tras = alternar(llena, 'nuevo');
  eq(tras.length, 12);
  ok(!tras.includes('nuevo'), 'el nuevo no entra');
  ok(tras.includes('x0'), 'y el primero sigue');
});

test('a un jugador de baja no se le convoca', () => {
  /* Que aparezca en la lista es la manera de convocarlo por error. */
  eq(convocables(JUGADORES).map((j) => j.id), ['p1', 'p2']);
});

/* ── 2. El día ─────────────────────────────────────────────── */

console.log('\n· qué día sale la convocatoria');

test('el viernes de un partido del sábado', () => {
  eq(diaDeConvocatoria(PARTIDO, { diaSemana: 5 }), '2026-08-21');
});

test('y el miércoles ANTERIOR si el día es miércoles', () => {
  eq(diaDeConvocatoria(PARTIDO, { diaSemana: 3 }), '2026-08-19');
});

test('nunca el mismo día del partido: se avisa antes o no se avisa', () => {
  /* Restando días de la semana es fácil que el sábado con día sábado
     dé el sábado. Un aviso que llega el mismo día no sirve de nada. */
  const mismo = diaDeConvocatoria(PARTIDO, { diaSemana: 6 });
  eq(mismo, '2026-08-15', 'el sábado ANTERIOR');
  ok(mismo < PARTIDO.fecha, `${mismo} tiene que ser antes de ${PARTIDO.fecha}`);
});

test('y siempre cae antes, sea cual sea el día elegido', () => {
  for (let d = 1; d <= 7; d++) {
    const f = diaDeConvocatoria(PARTIDO, { diaSemana: d });
    ok(f && f < PARTIDO.fecha, `día ${d} dio ${f}`);
  }
});

test('sin día fijado no hay convocatoria que enseñar', () => {
  eq(diaDeConvocatoria(PARTIDO, {}), null);
  eq(diaDeConvocatoria(PARTIDO, { diaSemana: 0 }), null);
  eq(diaDeConvocatoria({ fecha: null }, { diaSemana: 5 }), null);
});

/* ── 3. El evento del calendario ───────────────────────────── */

console.log('\n· el evento, que se deduce y no se guarda');

test('sale del partido y del día del equipo', () => {
  const e = eventoDe({ ...PARTIDO, convocados: ['p1', 'p2'] }, { diaSemana: 5 });
  eq(e.fecha, '2026-08-21');
  eq(e.cuantos, 2);
  eq(e.cerrada, false);
});

test('un partido cancelado no tiene convocatoria', () => {
  /* Y como el evento se deduce, se va solo: no hay nada que borrar ni
     que acordarse de borrar. */
  eq(eventoDe({ ...PARTIDO, estado: 'cancelado' }, { diaSemana: 5 }), null);
});

/* ── 4. Lo que falta ───────────────────────────────────────── */

console.log('\n· lo que falta, antes del botón');

test('una convocatoria en blanco dice las tres cosas', () => {
  eq(loQueFalta(PARTIDO), ['a quién se convoca', 'dónde se queda', 'a qué hora se queda']);
});

test('y con menos de cinco lo dice sin bloquear', () => {
  const p = { ...PARTIDO, convocados: ['p1', 'p2'], convocatoria_lugar: 'Pabellón', convocatoria_hora: '10:15:00' };
  const f = loQueFalta(p);
  eq(f.length, 1);
  ok(f[0].includes('hay 2') && f[0].includes('5'), f[0]);
  ok(sePuedeSacar(p), 'pero el documento se puede sacar igual');
});

test('una completa no falta nada', () => {
  const p = {
    ...PARTIDO, convocados: ['p1', 'p2', 'a', 'b', 'c'],
    convocatoria_lugar: 'Pabellón Municipal', convocatoria_hora: '10:15:00',
  };
  eq(loQueFalta(p), []);
});

/* ── 5. El documento ───────────────────────────────────────── */

console.log('\n· el documento');

test('lleva rival, día, hora y lista', () => {
  /* El criterio de la fila, literal. */
  const p = {
    ...PARTIDO, convocados: ['p2', 'p1'],
    convocatoria_lugar: 'Puerta del pabellón', convocatoria_hora: '10:15:00',
  };
  const d = datosDelDocumento(p, JUGADORES, { nombreEquipo: 'Cadete A' });
  eq(d.rival, 'CB Rival');
  eq(d.fecha, 'sábado 22 de agosto');
  eq(d.hora, '11:00');
  eq(d.convocados, [{ nombre: 'Bruno Sáez', dorsal: 7 }, { nombre: 'Ana Ruiz', dorsal: 4 }]);
  eq(d.quedada, { lugar: 'Puerta del pabellón', hora: '10:15' });
});

test('la lista va en el orden en que se marcó, no alfabético', () => {
  /* Ese orden lo ha pensado alguien. Ordenarlo por nombre lo borra. */
  const d = datosDelDocumento({ ...PARTIDO, convocados: ['p2', 'p1'] }, JUGADORES, {});
  eq(d.convocados.map((x) => x.nombre), ['Bruno Sáez', 'Ana Ruiz']);
});

test('un convocado que ya no está en la plantilla se cuenta, no se calla', () => {
  const d = datosDelDocumento({ ...PARTIDO, convocados: ['p1', 'fantasma'] }, JUGADORES, {});
  eq(d.convocados.length, 1);
  eq(d.faltan, 1);
});

test('el titular se lee de un vistazo', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { nombreEquipo: 'Cadete A' });
  eq(titular(d), 'vs CB Rival · sábado 22 de agosto · 11:00');
  const fuera = datosDelDocumento({ ...PARTIDO, es_local: false }, JUGADORES, {});
  ok(titular(fuera).startsWith('@ CB Rival'), titular(fuera));
});

test('las fechas y las horas se leen en castellano', () => {
  eq(fechaLarga('2026-08-22'), 'sábado 22 de agosto');
  eq(fechaLarga('2026-01-01'), 'jueves 1 de enero');
  eq(fechaLarga(null), '');
  eq(hhmm('11:00:00'), '11:00');
  eq(hhmm(null), '');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
