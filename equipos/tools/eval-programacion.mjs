/* ============================================================
   eval-programacion.mjs — banco de pruebas del motor de
   auto-generación (equipos/js/data/programacion.js).
   Ejecutar desde la raíz cbp-v2:  node equipos/tools/eval-programacion.mjs
   Patrón del banco del Taller: determinista, sin red, exit 1 si falla.
   ============================================================ */

import {
  recortarTemporada,
  diasEntre, isoWeekday, enPeriodo, duracionMin,
  expandirTemporada, planRegeneracion,
  temporadaCubre, estadoTemporada, proponerTemporada,
  parsearFecha, parsearPeriodos,
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
  eq(plan.aBorrar.map((b) => b.id), [existentes[0].id]);
  eq(plan.aInsertar, []); eq(plan.aActualizar, []);
});

caso('periodo añadido después → poda la intacta que ahora cae en él', () => {
  const oc0 = expandirTemporada(TEMporada, [SLOT_LUN]);
  const existentes = oc0.map((o) => sesionDe(o));
  const oc1 = expandirTemporada(TEMporada, [SLOT_LUN],
    [{ fecha_inicio: '2025-09-08', fecha_fin: '2025-09-08' }]);
  const plan = planRegeneracion(oc1, existentes);
  eq(plan.aBorrar.map((b) => b.id), [existentes[1].id]); // la del lunes 08
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

// ── exclusiones (018): lo descartado a mano NO resucita ───────
console.log('— exclusiones —');

caso('sin exclusiones, el plan es exactamente el de siempre', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, SLOT_MIE]);
  eq(planRegeneracion(oc, []), planRegeneracion(oc, [], { exclusiones: [] }));
  eq(planRegeneracion(oc, [], undefined).aInsertar.length, oc.length);
  eq(planRegeneracion(oc, [], null).aInsertar.length, oc.length);
  eq(planRegeneracion(oc, [], {}).aInsertar.length, oc.length);
});

caso('EL FALLO QUE CIERRA LA 018: borrada y sin excluir, vuelve a nacer', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  // se borró la primera: su fila ya no está en la BD
  const existentes = oc.slice(1).map((o) => sesionDe(o));
  const plan = planRegeneracion(oc, existentes);          // sin exclusiones
  eq(plan.aInsertar.length, 1, 'resucita');
  eq(plan.aInsertar[0].slot_date, oc[0].slot_date);
});

caso('con la exclusión anotada, esa ocurrencia ya no vuelve', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  const existentes = oc.slice(1).map((o) => sesionDe(o));
  const plan = planRegeneracion(oc, existentes,
    { exclusiones: [{ slot_id: oc[0].slot_id, slot_date: oc[0].slot_date }] });
  eq(plan.aInsertar, []);
  eq(plan.aBorrar, []);
  eq(plan.aActualizar, []);
});

caso('la exclusión es de UNA ocurrencia, no del slot entero', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  const plan = planRegeneracion(oc, [],
    { exclusiones: [{ slot_id: oc[0].slot_id, slot_date: oc[0].slot_date }] });
  eq(plan.aInsertar.length, oc.length - 1);
  eq(plan.aInsertar.some((o) => o.slot_date === oc[0].slot_date), false);
  eq(plan.aInsertar.some((o) => o.slot_date === oc[1].slot_date), true);
});

caso('una exclusión de otro slot el mismo día no se contagia', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, SLOT_MIE]);
  const plan = planRegeneracion(oc, [],
    { exclusiones: [{ slot_id: 'sl-mie', slot_date: oc.find((o) => o.slot_id === 'sl-mie').slot_date }] });
  eq(plan.aInsertar.filter((o) => o.slot_id === 'sl-lun').length,
     oc.filter((o) => o.slot_id === 'sl-lun').length);
  eq(plan.aInsertar.filter((o) => o.slot_id === 'sl-mie').length,
     oc.filter((o) => o.slot_id === 'sl-mie').length - 1);
});

caso('IDEMPOTENCIA: regenerar dos veces con exclusiones no hace nada nuevo', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  const exc = [{ slot_id: oc[0].slot_id, slot_date: oc[0].slot_date }];
  const primera = planRegeneracion(oc, [], { exclusiones: exc });
  const trasAplicar = primera.aInsertar.map((o) => sesionDe(o));
  const segunda = planRegeneracion(oc, trasAplicar, { exclusiones: exc });
  eq(segunda, { aInsertar: [], aActualizar: [], aBorrar: [] });
});

caso('si una excluida acabase teniendo fila, no se toca ni se poda', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  // misma clave, pero con hora distinta: sin la exclusión se parchearía
  const fila = sesionDe(oc[0], { hora_inicio: '11:11' });
  const plan = planRegeneracion(oc, [fila],
    { exclusiones: [{ slot_id: oc[0].slot_id, slot_date: oc[0].slot_date }] });
  eq(plan.aActualizar, []);
  eq(plan.aBorrar, []);
});

caso('exclusiones basura (sin slot o sin fecha) se ignoran sin romper', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN]);
  const plan = planRegeneracion(oc, [],
    { exclusiones: [null, {}, { slot_id: 'sl-lun' }, { slot_date: '2025-09-01' }] });
  eq(plan.aInsertar.length, oc.length);
});

caso('aBorrar lleva la fecha teórica, que es la guarda anti-carrera', () => {
  const oc = expandirTemporada(TEMporada, [SLOT_LUN, SLOT_MIE]);
  const existentes = oc.map((o) => sesionDe(o));
  const plan = planRegeneracion(expandirTemporada(TEMporada, [SLOT_MIE]), existentes);
  eq(plan.aBorrar.length, 2);
  for (const b of plan.aBorrar) {
    if (!b.id || !b.slot_date) throw new Error('falta id o slot_date: ' + JSON.stringify(b));
  }
  // y la fecha es la TEÓRICA de la ocurrencia, no otra cosa
  eq(plan.aBorrar.map((b) => b.slot_date), ['2025-09-01', '2025-09-08']);
});

// ── rango parcial: generar un tramo sin arrasar el resto ──────
console.log('— rango parcial —');

const T8SEM = { start_date: '2025-09-01', end_date: '2025-10-26' }; // 8 lunes

caso('recortarTemporada acota sin salirse nunca de la temporada', () => {
  eq(recortarTemporada(T8SEM, '2025-09-15', '2025-09-28'),
     { start_date: '2025-09-15', end_date: '2025-09-28' });
  // pedir más de lo que dura la temporada no la agranda
  eq(recortarTemporada(T8SEM, '2025-01-01', '2026-12-31'), T8SEM);
  // sin límites, la temporada entera
  eq(recortarTemporada(T8SEM), T8SEM);
});

caso('recortarTemporada da null si el tramo ni la roza', () => {
  eq(recortarTemporada(T8SEM, '2026-01-01', '2026-02-01'), null);
  eq(recortarTemporada(null, '2025-09-01', '2025-09-30'), null);
  eq(recortarTemporada({ start_date: null, end_date: null }), null);
});

caso('EL DESASTRE QUE SE EVITA: sin límites, generar un tramo poda el resto', () => {
  const todas = expandirTemporada(T8SEM, [SLOT_LUN]);
  const existentes = todas.map((o) => sesionDe(o));        // 8 preliminares intactas
  const soloSept = expandirTemporada(recortarTemporada(T8SEM, null, '2025-09-30'), [SLOT_LUN]);
  const plan = planRegeneracion(soloSept, existentes);      // ← sin desde/hasta
  eq(plan.aBorrar.length, 3, 'se cargaría los lunes de octubre');
});

caso('con desde/hasta, lo de fuera del tramo NI SE MIRA', () => {
  const todas = expandirTemporada(T8SEM, [SLOT_LUN]);
  const existentes = todas.map((o) => sesionDe(o));
  const soloSept = expandirTemporada(recortarTemporada(T8SEM, null, '2025-09-30'), [SLOT_LUN]);
  const plan = planRegeneracion(soloSept, existentes, { hasta: '2025-09-30' });
  eq(plan.aBorrar, []);
  eq(plan.aInsertar, []);
  eq(plan.aActualizar, []);
});

caso('dentro del tramo la poda SIGUE funcionando', () => {
  const todas = expandirTemporada(T8SEM, [SLOT_LUN]);
  const existentes = todas.map((o) => sesionDe(o));
  // se mete un periodo sin entreno el 2º lunes: dentro del tramo, debe podarse
  const conPeriodo = expandirTemporada(recortarTemporada(T8SEM, null, '2025-09-30'), [SLOT_LUN],
    [{ fecha_inicio: '2025-09-08', fecha_fin: '2025-09-08' }]);
  const plan = planRegeneracion(conPeriodo, existentes, { hasta: '2025-09-30' });
  eq(plan.aBorrar.length, 1);
  eq(plan.aBorrar[0].slot_date, '2025-09-08');
});

caso('generar solo un tramo inserta solo ese tramo', () => {
  const tramo = expandirTemporada(recortarTemporada(T8SEM, '2025-10-01', '2025-10-31'), [SLOT_LUN]);
  const plan = planRegeneracion(tramo, [], { desde: '2025-10-01', hasta: '2025-10-31' });
  eq(plan.aInsertar.map((o) => o.slot_date),
     ['2025-10-06', '2025-10-13', '2025-10-20']);
});

caso('«a partir de hoy»: un día nuevo no genera hacia atrás', () => {
  const hoy = '2025-10-01';
  const desdeHoy = expandirTemporada(recortarTemporada(T8SEM, hoy, null), [SLOT_LUN]);
  eq(desdeHoy.every((o) => o.slot_date >= hoy), true);
  const plan = planRegeneracion(desdeHoy, [], { desde: hoy });
  eq(plan.aInsertar.length, 3);
  eq(plan.aInsertar.some((o) => o.slot_date < hoy), false);
});

caso('rango y exclusiones conviven', () => {
  const tramo = expandirTemporada(recortarTemporada(T8SEM, '2025-10-01', '2025-10-31'), [SLOT_LUN]);
  const plan = planRegeneracion(tramo, [], {
    desde: '2025-10-01', hasta: '2025-10-31',
    exclusiones: [{ slot_id: 'sl-lun', slot_date: '2025-10-13' }],
  });
  eq(plan.aInsertar.map((o) => o.slot_date), ['2025-10-06', '2025-10-20']);
});

// ── parsearFecha / parsearPeriodos (pegar el calendario escolar) ──
console.log('— parsearFecha —');

caso('dd/mm/aaaa es lo que escribe el entrenador', () => {
  eq(parsearFecha('12/10/2026'), '2026-10-12');
  eq(parsearFecha('1/5/2027'), '2027-05-01');       // sin ceros a la izquierda
});

caso('también con guion y con punto', () => {
  eq(parsearFecha('12-10-2026'), '2026-10-12');
  eq(parsearFecha('12.10.2026'), '2026-10-12');
});

caso('el ISO de siempre sigue valiendo', () => {
  eq(parsearFecha('2026-10-12'), '2026-10-12');
});

caso('una fecha que no existe se rechaza, no se corre de mes', () => {
  eq(parsearFecha('31/02/2026'), null);             // febrero no tiene 31
  eq(parsearFecha('29/02/2027'), null);             // 2027 no es bisiesto
  eq(parsearFecha('29/02/2028'), '2028-02-29');     // 2028 sí
  eq(parsearFecha('00/10/2026'), null);
  eq(parsearFecha('12/13/2026'), null);
});

caso('lo que no es una fecha da null', () => {
  eq(parsearFecha('Navidad'), null);
  eq(parsearFecha('12/10/26'), null);               // el año va entero
  eq(parsearFecha(''), null);
});

console.log('— parsearPeriodos —');

caso('un día suelto con su motivo', () => {
  const { filas, ignoradas } = parsearPeriodos('12/10/2026 Fiesta Nacional');
  eq(ignoradas, []);
  eq(filas, [{ fecha_inicio: '2026-10-12', fecha_fin: '2026-10-12', motivo: 'Fiesta Nacional' }]);
});

caso('un rango con las dos fechas separadas por espacio', () => {
  const { filas } = parsearPeriodos('23/12/2026 10/01/2027 Navidad');
  eq(filas, [{ fecha_inicio: '2026-12-23', fecha_fin: '2027-01-10', motivo: 'Navidad' }]);
});

caso('el rango admite guion, raya y las palabras a / al / hasta', () => {
  for (const sep of ['-', '–', '—', 'a', 'al', 'hasta']) {
    const { filas } = parsearPeriodos(`20/03/2027 ${sep} 30/03/2027 Semana Santa`);
    eq(filas, [{ fecha_inicio: '2027-03-20', fecha_fin: '2027-03-30', motivo: 'Semana Santa' }], `sep=${sep}`);
  }
});

caso('un motivo que empieza por "a" no se confunde con el separador', () => {
  const { filas } = parsearPeriodos('12/10/2026 aniversario del club');
  eq(filas, [{ fecha_inicio: '2026-10-12', fecha_fin: '2026-10-12', motivo: 'aniversario del club' }]);
});

caso('sin motivo, el motivo es null (no cadena vacía)', () => {
  const { filas } = parsearPeriodos('12/10/2026');
  eq(filas[0].motivo, null);
});

caso('las fechas al revés se enderezan en vez de rechazarse', () => {
  const { filas } = parsearPeriodos('10/01/2027 23/12/2026 Navidad');
  eq(filas, [{ fecha_inicio: '2026-12-23', fecha_fin: '2027-01-10', motivo: 'Navidad' }]);
});

caso('las líneas en blanco no estorban', () => {
  const { filas, ignoradas } = parsearPeriodos('\n  \n12/10/2026 Fiesta\n\n');
  eq(filas.length, 1);
  eq(ignoradas, []);
});

caso('lo que no se entiende se DEVUELVE, no se traga en silencio', () => {
  const { filas, ignoradas } = parsearPeriodos(
    '12/10/2026 Fiesta\nNavidad entera\n31/02/2026 Inventada');
  eq(filas.length, 1);
  eq(ignoradas.length, 2);
  eq(ignoradas[0].porque, 'no empieza por una fecha');
  eq(ignoradas[1].porque, 'esa fecha no existe');
  eq(ignoradas[1].linea, '31/02/2026 Inventada');
});

caso('el calendario real de la temporada 2026/27 entra entero', () => {
  const { filas, ignoradas } = parsearPeriodos([
    '12/10/2026 Fiesta Nacional de España',
    '30/10/2026 Día del Docente',
    '02/11/2026 Todos los Santos',
    '07/12/2026 Día de la Constitución',
    '08/12/2026 Inmaculada Concepción',
    '23/12/2026 10/01/2027 Vacaciones de Navidad',
    '08/02/2027 Carnaval',
    '09/02/2027 Carnaval',
    '20/03/2027 30/03/2027 Vacaciones de Semana Santa',
    '23/04/2027 Día de Castilla y León',
    '01/05/2027 Día del Trabajo',
  ].join('\n'));
  eq(ignoradas, []);
  eq(filas.length, 11);
  eq(filas[5], { fecha_inicio: '2026-12-23', fecha_fin: '2027-01-10', motivo: 'Vacaciones de Navidad' });
  eq(filas[10], { fecha_inicio: '2027-05-01', fecha_fin: '2027-05-01', motivo: 'Día del Trabajo' });
  // y de verdad bloquean: el 24 de diciembre cae dentro
  eq(enPeriodo('2026-12-24', filas), true);
  eq(enPeriodo('2026-12-22', filas), false);
});

caso('texto vacío o nulo no revienta', () => {
  eq(parsearPeriodos(''), { filas: [], ignoradas: [] });
  eq(parsearPeriodos(null), { filas: [], ignoradas: [] });
  eq(parsearPeriodos(undefined), { filas: [], ignoradas: [] });
});

// ── Resumen ──────────────────────────────────────────────────
console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) {
  console.log('Fallos: ' + fallos.join(' · '));
  process.exit(1);
}
