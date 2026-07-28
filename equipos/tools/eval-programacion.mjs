/* ============================================================
   eval-programacion.mjs — banco de pruebas del motor de
   auto-generación (equipos/js/data/programacion.js).
   Ejecutar desde la raíz cbp-v2:  node equipos/tools/eval-programacion.mjs
   Patrón del banco del Taller: determinista, sin red, exit 1 si falla.
   ============================================================ */

import {
  diasEntre, isoWeekday, enPeriodo, duracionMin,
  expandirTemporada, planRegeneracion,
  temporadaCubre, estadoTemporada, proponerTemporada,
} from '../js/data/programacion.js';

let pasan = 0, fallan = 0;
const fallos = [];
function caso(nombre, fn) {
  try {
    fn();
    pasan++; console.log(`  PASS  ${nombre}`);
  } catch (e) {
    fallan++; fallos.push(nombre);
    console.log(`  FAIL  ${nombre}\n        ${e.message}`);
  }
}
function eq(real, esperado, msg = '') {
  const a = JSON.stringify(real), b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${msg} esperado=${b} real=${a}`);
}

// ── Fixtures ─────────────────────────────────────────────────
const TEMporada = { start_date: '2025-09-01', end_date: '2025-09-14' }; // lun→dom (2 semanas)
const SLOT_LUN = { id: 'sl-lun', weekday: 1, hora_inicio: '18:00', hora_fin: '19:30', lugar: 'Pabellón A', activo: true };
const SLOT_MIE = { id: 'sl-mie', weekday: 3, hora_inicio: '17:30', hora_fin: '19:00', lugar: null, activo: true };
const SLOT_DOM = { id: 'sl-dom', weekday: 7, hora_inicio: '10:00', hora_fin: '11:00', lugar: 'Exterior', activo: true };

const sesionDe = (o, extra = {}) => ({
  id: 'db-' + o.slot_id + '-' + o.slot_date,
  origen: 'auto', estado: 'preliminar',
  slot_id: o.slot_id, slot_date: o.slot_date, fecha: o.slot_date,
  hora_inicio: o.hora_inicio, hora_fin: o.hora_fin, lugar: o.lugar,
  slot_duracion_min: o.slot_duracion_min,
  ...extra,
});

console.log('— Primitivas —');

caso('diasEntre incluye ambos extremos', () => {
  eq(diasEntre('2025-09-01', '2025-09-03'),
     ['2025-09-01', '2025-09-02', '2025-09-03']);
});

caso('isoWeekday: 2025-09-01 es lunes (1) y 2025-09-07 domingo (7)', () => {
  eq(isoWeekday('2025-09-01'), 1);
  eq(isoWeekday('2025-09-07'), 7);
  eq(isoWeekday('2025-09-06'), 6); // sábado
});

caso('duracionMin 18:00→19:30 = 90 (y con segundos de Postgres)', () => {
  eq(duracionMin('18:00', '19:30'), 90);
  eq(duracionMin('18:00:00', '19:30:00'), 90);
});

caso('enPeriodo: dentro, extremos y fuera', () => {
  const p = [{ fecha_inicio: '2025-09-06', fecha_fin: '2025-09-09' }];
  eq(enPeriodo('2025-09-06', p), true);
  eq(enPeriodo('2025-09-09', p), true);
  eq(enPeriodo('2025-09-05', p), false);
});

console.log('— expandirTemporada —');

caso('slot de lunes genera exactamente los 2 lunes de la quincena', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  eq(oc.map((o) => o.slot_date), ['2025-09-01', '2025-09-08']);
  eq(oc[0].slot_duracion_min, 90);
  eq(oc[0].slot_id, 'sl-lun');
});

caso('slot de domingo (ISO 7, límite) genera los 2 domingos', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_DOM]);
  eq(oc.map((o) => o.slot_date), ['2025-09-07', '2025-09-14']);
});

caso('periodo sin entreno salta la ocurrencia que cae dentro', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN],
    [{ fecha_inicio: '2025-09-06', fecha_fin: '2025-09-09' }]);
  eq(oc.map((o) => o.slot_date), ['2025-09-01']); // el lunes 08 cae en el periodo
});

caso('slot inactivo no genera nada', () => {
  eq(expandirTemporada(TEMporada, [{ ...SLOT_LUN, activo: false }]), []);
});

caso('temporada sin fechas lanza error claro (no genera en silencio)', () => {
  let msg = '';
  try { expandirTemporada({ start_date: null, end_date: null }, [SLOT_LUN]); }
  catch (e) { msg = e.message; }
  if (!/temporada/i.test(msg)) throw new Error('no lanzó el error esperado: ' + msg);
});

caso('dos slots el mismo día generan dos ocurrencias por día', () => {
  const s2 = { ...SLOT_LUN, id: 'sl-lun2', hora_inicio: '20:00', hora_fin: '21:00' };
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, s2]);
  eq(oc.length, 4);
});

console.log('— planRegeneracion —');

caso('BD vacía → inserta todas las ocurrencias', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, SLOT_MIE]);
  const plan = planRegeneracion(oc, []);
  eq(plan.aInsertar.length, 4); // 2 lunes + 2 miércoles
  eq(plan.aActualizar, []);
  eq(plan.aBorrar, []);
});

caso('IDEMPOTENCIA: segunda pasada sobre lo insertado no hace nada', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, SLOT_MIE]);
  const existentes = oc.map((o) => sesionDe(o));
  const plan = planRegeneracion(oc, existentes);
  eq(plan.aInsertar, []); eq(plan.aActualizar, []); eq(plan.aBorrar, []);
});

caso('NO PISA: sesión promovida a programada no se toca aunque el slot cambie', () => {
  const oc0 = expandirTemporada(TEMporada, [SLOT_LUN]);
  const existentes = [sesionDe(oc0[0], { estado: 'programada' }), sesionDe(oc0[1])];
  const slotEditado = { ...SLOT_LUN, hora_inicio: '19:00', hora_fin: '20:30' };
  const plan = planRegeneracion(expandirTemporada(TEMporada, [slotEditado]), existentes);
  eq(plan.aBorrar, []);
  eq(plan.aInsertar, []);
  eq(plan.aActualizar.map((u) => u.id), [existentes[1].id]); // solo la intacta
  eq(plan.aActualizar[0].patch.hora_inicio, '19:00');
});

caso('MOVIDA A MANO (fecha≠slot_date): ni se borra, ni se pisa, ni se duplica', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  const movida = sesionDe(oc[0], { fecha: '2025-09-02' }); // arrastrada al martes
  const plan = planRegeneracion(oc, [movida, sesionDe(oc[1])]);
  eq(plan.aInsertar, []);   // su ocurrencia sigue ocupada → no duplica
  eq(plan.aBorrar, []);
  eq(plan.aActualizar, []); // no está intacta → no se propaga nada
});

caso('slot borrado → poda SOLO las preliminares intactas', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, SLOT_MIE]);
  const deLun = oc.filter((o) => o.slot_id === 'sl-lun');
  const deMie = oc.filter((o) => o.slot_id === 'sl-mie');
  const existentes = [
    sesionDe(deLun[0]),                            // intacta → se borra
    sesionDe(deLun[1], { estado: 'realizada' }),   // realizada → se conserva
    sesionDe(deMie[0]), sesionDe(deMie[1]),        // su slot sigue → intactas
  ];
  const plan = planRegeneracion(expandirTemporada(TEMporada, [SLOT_MIE]), existentes);
  eq(plan.aBorrar, [existentes[0].id]);
  eq(plan.aInsertar, []); eq(plan.aActualizar, []);
});

caso('periodo añadido después → poda la intacta que ahora cae en él', () => {
  const oc0 = expandirTemporada(TEMporada, [SLOT_LUN]);
  const existentes = oc0.map((o) => sesionDe(o));
  const oc1 = expandirTemporada(TEMporada, [SLOT_LUN],
    [{ fecha_inicio: '2025-09-08', fecha_fin: '2025-09-08' }]);
  const plan = planRegeneracion(oc1, existentes);
  eq(plan.aBorrar, [existentes[1].id]); // la del lunes 08
  eq(plan.aInsertar, []);
});

caso('las sesiones MANUALES son invisibles para el motor', () => {
  const manual = {
    id: 'db-manual', origen: 'manual', estado: 'programada',
    slot_id: null, slot_date: null, fecha: '2025-09-06',
    hora_inicio: '12:00', hora_fin: '13:00', lugar: null, slot_duracion_min: null,
  };
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  const plan = planRegeneracion(oc, [manual]);
  eq(plan.aInsertar.length, 2); // las 2 del lunes, la manual ni cuenta ni estorba
  eq(plan.aBorrar, []);
});

// ── Temporada: dónde cae hoy y cuál tocaría abrir ────────────
console.log('· temporada');

const T2526 = { label: '2025/26', start_date: '2025-09-01', end_date: '2026-06-30' };

caso('temporadaCubre: bordes inclusivos y fuera de rango', () => {
  eq(temporadaCubre(T2526, '2025-09-01'), true);
  eq(temporadaCubre(T2526, '2026-06-30'), true);
  eq(temporadaCubre(T2526, '2026-07-26'), false);
  eq(temporadaCubre(T2526, '2025-08-31'), false);
  eq(temporadaCubre({ label: 'x' }, '2026-01-01'), false);   // sin fechas
});

caso('estadoTemporada distingue vigente/terminada/futura/sin-fechas', () => {
  eq(estadoTemporada(T2526, '2026-01-15'), 'vigente');
  eq(estadoTemporada(T2526, '2026-07-26'), 'terminada');     // el caso real que rompía
  eq(estadoTemporada(T2526, '2025-07-01'), 'futura');
  eq(estadoTemporada({ label: 'x' }, '2026-01-01'), 'sin-fechas');
});

caso('proponerTemporada: de julio en adelante ya toca la siguiente', () => {
  eq(proponerTemporada('2026-07-26'), { label: '2026/27', start_date: '2026-09-01', end_date: '2027-06-30' });
  eq(proponerTemporada('2026-09-15'), { label: '2026/27', start_date: '2026-09-01', end_date: '2027-06-30' });
  eq(proponerTemporada('2026-06-30'), { label: '2025/26', start_date: '2025-09-01', end_date: '2026-06-30' });
  eq(proponerTemporada('2027-01-10'), { label: '2026/27', start_date: '2026-09-01', end_date: '2027-06-30' });
});

caso('una temporada terminada no genera nada donde el entrenador mira', () => {
  // reproducción del fallo reportado: slots de miércoles y viernes, temporada
  // 2025/26 ya cerrada, hoy 26-jul-2026 → 86 ocurrencias, todas en el pasado
  const mie = { id: 'a', weekday: 3, hora_inicio: '17:30', hora_fin: '19:00', lugar: 'Colegio' };
  const vie = { id: 'b', weekday: 5, hora_inicio: '17:30', hora_fin: '19:00', lugar: 'Colegio' };
  const oc = expandirTemporada(T2526, [mie, vie]);
  eq(oc.length, 86);
  eq(oc.filter((o) => o.slot_date >= '2026-07-26').length, 0);
  eq(estadoTemporada(T2526, '2026-07-26'), 'terminada');
});

// ── Resumen ──────────────────────────────────────────────────
console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) {
  console.log('Fallos: ' + fallos.join(' · '));
  process.exit(1);
}
