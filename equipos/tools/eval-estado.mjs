/* ============================================================
   eval-estado.mjs — banco Node del estado deducido del reloj
   (equipos/js/data/estado-sesion.js). Sin red, sin DOM.

     node equipos/tools/eval-estado.mjs

   Lo que vigila: que «activa» empiece y acabe cuando toca, y sobre
   todo que NO se quede colgada. Es el motivo por el que no se guarda
   (§11, decisión #17): con una columna, el día que nadie la cambiase
   la sesión se quedaría activa para siempre.
   ============================================================ */

import {
  ACTIVA, ANTES_MIN, DESPUES_MIN, ESTADOS,
  ventanaActiva, esActiva, estadoEfectivo, minutosDesdeInicio, laDeAhora,
} from '../js/data/estado-sesion.js';

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

/* Un martes de entrenamiento, de 18:00 a 19:30. Todo en hora LOCAL,
   que es la del pabellón. */
const SESION = {
  id: 's1', estado: 'programada', fecha: '2026-09-15',
  hora_inicio: '18:00:00', hora_fin: '19:30:00', slot_duracion_min: 90,
};
const enPunto = (h, m = 0) => new Date(2026, 8, 15, h, m, 0, 0).getTime();

/* ── 1. La ventana ─────────────────────────────────────────── */

console.log('\n· cuándo está pasando');

test('empieza antes de la hora, porque el entrenador llega antes', () => {
  const v = ventanaActiva(SESION);
  eq(v.desde, enPunto(17, 60 - ANTES_MIN), 'quince minutos antes de las seis');
  eq(v.hasta, enPunto(19, 30 + DESPUES_MIN), 'y media hora después del final');
});

test('a las seis menos veinte todavía no', () => {
  ok(!esActiva(SESION, enPunto(17, 40)));
});

test('a las seis menos cuarto ya sí, y a las siete también', () => {
  ok(esActiva(SESION, enPunto(17, 45)), 'justo al abrirse');
  ok(esActiva(SESION, enPunto(18, 0)), 'a la hora');
  ok(esActiva(SESION, enPunto(19, 0)), 'a mitad');
  ok(esActiva(SESION, enPunto(20, 0)), 'media hora después, cerrando');
});

test('y a las ocho y cinco se acabó: NO se queda colgada (§11)', () => {
  ok(!esActiva(SESION, enPunto(20, 5)));
  ok(!esActiva(SESION, enPunto(23, 0)));
  // al día siguiente tampoco, que es el caso que de verdad importa
  ok(!esActiva(SESION, new Date(2026, 8, 16, 18, 30).getTime()));
});

test('sin hora de inicio no hay reloj al que agarrarse', () => {
  eq(ventanaActiva({ ...SESION, hora_inicio: null }), null);
  ok(!esActiva({ ...SESION, hora_inicio: null }, enPunto(18, 30)));
});

test('sin hora de fin manda la duración del hueco', () => {
  const v = ventanaActiva({ ...SESION, hora_fin: null, slot_duracion_min: 60 });
  eq(v.hasta, enPunto(19, 0 + DESPUES_MIN), 'una hora de pista');
});

test('y sin ninguna de las dos, hora y media, que es lo que dura un entreno', () => {
  const v = ventanaActiva({ ...SESION, hora_fin: null, slot_duracion_min: null });
  eq(v.hasta, enPunto(19, 30 + DESPUES_MIN));
});

test('una hora de fin del revés no se cree', () => {
  const v = ventanaActiva({ ...SESION, hora_fin: '17:00:00' });
  eq(v.hasta, enPunto(19, 30 + DESPUES_MIN), 'se cae a la duración del hueco');
});

/* ── 2. Qué sesiones puede tocar el reloj ───────────────────── */

console.log('\n· a cuáles llega el reloj');

test('una preliminar también: el martes se entrena, esté el plan escrito o no', () => {
  ok(esActiva({ ...SESION, estado: 'preliminar' }, enPunto(18, 30)));
});

test('una realizada y una cancelada son finales', () => {
  ok(!esActiva({ ...SESION, estado: 'realizada' }, enPunto(18, 30)), 'ya pasó');
  ok(!esActiva({ ...SESION, estado: 'cancelada' }, enPunto(18, 30)), 'no va a pasar');
});

/* ── 3. El estado que se enseña ─────────────────────────────── */

console.log('\n· el estado efectivo');

test('son cinco y el quinto no está en la base de datos', () => {
  eq(ESTADOS, ['preliminar', 'programada', ACTIVA, 'realizada', 'cancelada']);
  eq(ACTIVA, 'activa');
});

test('el guardado manda salvo cuando el reloj dice que está pasando', () => {
  eq(estadoEfectivo(SESION, enPunto(12, 0)), 'programada');
  eq(estadoEfectivo(SESION, enPunto(18, 30)), 'activa');
  eq(estadoEfectivo(SESION, enPunto(22, 0)), 'programada', 'vuelve a lo guardado');
  eq(estadoEfectivo({ ...SESION, estado: 'realizada' }, enPunto(18, 30)), 'realizada');
});

test('lo guardado no cambia nunca por esto', () => {
  const s = { ...SESION };
  estadoEfectivo(s, enPunto(18, 30));
  eq(s.estado, 'programada', 'el objeto sale como entró');
});

test('sin sesión no revienta', () => {
  eq(estadoEfectivo(null), 'preliminar');
  eq(estadoEfectivo({}), 'preliminar');
});

/* ── 4. Cuánto lleva ───────────────────────────────────────── */

console.log('\n· cuánto queda o cuánto lleva');

test('negativo mientras falta, positivo desde que empieza', () => {
  eq(minutosDesdeInicio(SESION, enPunto(17, 45)), -15);
  eq(minutosDesdeInicio(SESION, enPunto(18, 0)), 0);
  eq(minutosDesdeInicio(SESION, enPunto(18, 42)), 42);
});

test('sin hora, null', () => {
  eq(minutosDesdeInicio({ ...SESION, hora_inicio: null }, enPunto(18, 0)), null);
});

/* ── 5. «Lo de hoy» ────────────────────────────────────────── */

console.log('\n· la de ahora');

const TRES = [
  { ...SESION, id: 'manana', hora_inicio: '10:00:00', hora_fin: '11:00:00' },
  { ...SESION, id: 'tarde', hora_inicio: '18:00:00', hora_fin: '19:30:00' },
  { ...SESION, id: 'noche', hora_inicio: '21:00:00', hora_fin: '22:00:00' },
];

test('la que está pasando gana a la siguiente', () => {
  eq(laDeAhora(TRES, enPunto(18, 30))?.id, 'tarde');
});

test('y si no hay ninguna, la próxima que vaya a pasar', () => {
  eq(laDeAhora(TRES, enPunto(12, 0))?.id, 'tarde');
  eq(laDeAhora(TRES, enPunto(20, 30))?.id, 'noche');
});

test('acabado el día, ninguna', () => {
  eq(laDeAhora(TRES, enPunto(23, 30)), null);
});

test('las canceladas no cuentan, ni una lista vacía revienta', () => {
  eq(laDeAhora([{ ...SESION, estado: 'cancelada' }], enPunto(18, 30)), null);
  eq(laDeAhora([], enPunto(18, 30)), null);
  eq(laDeAhora(null, enPunto(18, 30)), null);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
