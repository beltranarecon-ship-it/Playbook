/* ============================================================
   eval-reflexion.mjs — banco Node del motor de reflexión
   (equipos/js/data/reflexion.js). Sin red, sin DOM.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-reflexion.mjs
   ============================================================ */

import {
  plantillaEfectiva, filasRespuesta, mediaEstrellas, cumplimientoDe,
  hayRespuestas, claveDesdeEtiqueta, CLAVE_CUMPLIMIENTO,
  CLAVE_ESFUERZO, CLAVES_RESERVADAS, esfuerzoDe, faltaEsfuerzo,
} from '../js/data/reflexion.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}
function ok(cond, msg = '') { if (!cond) throw new Error(msg || 'falso'); }

// CHECK real de 015: clave ~ '^[a-z][a-z0-9_]{1,39}$'
const RX_CLAVE_BD = /^[a-z][a-z0-9_]{1,39}$/;

const Q = (clave, tipo, orden, etiqueta = clave, extra = {}) =>
  ({ id: 'q-' + clave, clave, etiqueta, tipo, orden, activa: true, ...extra });
const R = (clave, tipo, { num = null, txt = null, etiqueta = null } = {}) =>
  ({ clave_snapshot: clave, question_id: 'q-' + clave, etiqueta_snapshot: etiqueta, tipo_snapshot: tipo, valor_num: num, valor_texto: txt });

const PLANTILLA = [
  Q('cumplimiento', 'estrellas', 1, '¿Se cumplió el plan?'),
  Q('actitud', 'estrellas', 2, 'Actitud'),
  Q('que_funciono', 'texto', 3, '¿Qué funcionó?'),
];

console.log('· plantillaEfectiva');

test('una entrada por pregunta activa, en su orden', () => {
  const it = plantillaEfectiva([PLANTILLA[2], PLANTILLA[0], PLANTILLA[1]], []);
  eq(it.map((x) => x.clave), ['cumplimiento', 'actitud', 'que_funciono']);
  eq(it.every((x) => !x.huerfana), true);
});

test('las preguntas desactivadas no se preguntan', () => {
  const it = plantillaEfectiva([...PLANTILLA, Q('vieja', 'texto', 9, 'Vieja', { activa: false })], []);
  eq(it.map((x) => x.clave), ['cumplimiento', 'actitud', 'que_funciono']);
});

test('la respuesta casa por clave y trae su valor', () => {
  const it = plantillaEfectiva(PLANTILLA, [R('actitud', 'estrellas', { num: 4 })]);
  eq(it[1].valor_num, 4);
  eq(it[0].valor_num, null);
});

test('manda la etiqueta VIVA de la plantilla, no la congelada', () => {
  const it = plantillaEfectiva(PLANTILLA, [R('actitud', 'estrellas', { num: 4, etiqueta: 'Etiqueta antigua' })]);
  eq(it[1].etiqueta, 'Actitud');
});

test('respuesta huérfana (pregunta borrada/desactivada) se ve al final, marcada', () => {
  const it = plantillaEfectiva(PLANTILLA, [R('borrada', 'texto', { txt: 'Salió bien', etiqueta: '¿Qué destacas?' })]);
  eq(it.length, 4);
  eq([it[3].clave, it[3].etiqueta, it[3].huerfana, it[3].valor_texto], ['borrada', '¿Qué destacas?', true, 'Salió bien']);
});

test('huérfana sin etiqueta congelada cae a su clave', () => {
  const it = plantillaEfectiva([], [R('sin_etiqueta', 'texto', { txt: 'x' })]);
  eq(it[0].etiqueta, 'sin_etiqueta');
});

test('si la pregunta cambió de tipo, el valor viejo no se pinta pero se conserva aparte', () => {
  const cambiada = [Q('actitud', 'texto', 1, 'Actitud (ahora texto)')];
  const it = plantillaEfectiva(cambiada, [R('actitud', 'estrellas', { num: 5 })]);
  eq([it.length, it[0].tipo, it[0].valor_num, it[0].valor_texto], [1, 'texto', null, null]);
  eq(it[0].conflicto, { tipo: 'estrellas', valor_num: 5, valor_texto: null, etiqueta: null });
});

test('una respuesta en conflicto NO se borra al guardar la sesión sin tocarla', () => {
  // enero: 4★ en «actitud». marzo: la pregunta pasa a texto (o se recrea la
  // clave). abril: se abre la sesión de enero y se guarda sin escribir nada.
  const cambiada = [Q('actitud', 'texto', 1, 'Actitud'), Q('que_funciono', 'texto', 2, '¿Qué funcionó?')];
  const it = plantillaEfectiva(cambiada, [R('actitud', 'estrellas', { num: 4 })]);
  it[1].valor_texto = 'la presión';
  const { aGuardar, aBorrar } = filasRespuesta('s1', it);
  eq(aBorrar, []);                       // la valoración de enero sigue en pie
  eq(aGuardar.map((f) => f.clave_snapshot), ['que_funciono']);
});

test('responder de nuevo sí sustituye la respuesta en conflicto', () => {
  const cambiada = [Q('actitud', 'texto', 1, 'Actitud')];
  const it = plantillaEfectiva(cambiada, [R('actitud', 'estrellas', { num: 4 })]);
  it[0].valor_texto = 'muy buena';
  const { aGuardar } = filasRespuesta('s1', it);
  eq([aGuardar.length, aGuardar[0].tipo_snapshot, aGuardar[0].valor_texto], [1, 'texto', 'muy buena']);
});

console.log('· filasRespuesta');

test('estrellas y texto válidos se guardan con su snapshot', () => {
  const it = plantillaEfectiva(PLANTILLA, []);
  it[0].valor_num = 4;
  it[2].valor_texto = '  La rueda de tiro  ';
  const { aGuardar, aBorrar } = filasRespuesta('s1', it);
  eq(aGuardar.length, 2);
  eq(aGuardar[0], {
    session_id: 's1', clave_snapshot: 'cumplimiento', question_id: 'q-cumplimiento',
    etiqueta_snapshot: '¿Se cumplió el plan?', tipo_snapshot: 'estrellas',
    valor_num: 4, valor_texto: null, player_id: null,
  });
  eq(aGuardar[1].valor_texto, 'La rueda de tiro');   // trim
  eq(aBorrar, [{ clave: 'actitud', player_id: null }]);   // sin responder → se borra
});

test('un texto en blanco NO es una respuesta: se borra la fila', () => {
  const it = plantillaEfectiva(PLANTILLA, [R('que_funciono', 'texto', { txt: 'algo' })]);
  it[2].valor_texto = '   ';
  eq(filasRespuesta('s1', it).aBorrar.some((x) => x.clave === 'que_funciono'), true);
});

test('estrellas fuera de rango o no enteras se descartan', () => {
  const base = plantillaEfectiva([PLANTILLA[0]], []);
  for (const malo of [0, 6, 2.5, '', null, 'cuatro']) {
    const it = [{ ...base[0], valor_num: malo }];
    eq(filasRespuesta('s1', it).aGuardar.length, 0, `valor ${malo}`);
  }
});

test('estrellas en texto (o al revés) no cuelan por el hueco del otro campo', () => {
  const it = [{ clave: 'que_funciono', etiqueta: 'x', tipo: 'texto', question_id: null, valor_num: 5, valor_texto: '' }];
  eq(filasRespuesta('s1', it), { aGuardar: [], aBorrar: [{ clave: 'que_funciono', player_id: null }] });
});

console.log('· lecturas derivadas');

test('mediaEstrellas ignora los textos y los sin responder', () => {
  const it = plantillaEfectiva(PLANTILLA, [
    R('cumplimiento', 'estrellas', { num: 5 }), R('actitud', 'estrellas', { num: 2 }),
    R('que_funciono', 'texto', { txt: 'bien' }),
  ]);
  eq(mediaEstrellas(it), 3.5);
  eq(mediaEstrellas([]), null);
});

test('una reflexión A MEDIAS no cuenta las preguntas en blanco como ceros', () => {
  // el caso normal: tres preguntas de estrellas y el coach responde una.
  // `Number(null)` es 0 y pasaba el filtro `Number.isFinite`, así que la
  // media caía a 1,7 en vez de 5 (y eso es lo que se pintaba en el cierre).
  const plantilla = [
    Q('cumplimiento', 'estrellas', 1), Q('intensidad_real', 'estrellas', 2),
    Q('actitud', 'estrellas', 3),
  ];
  const it = plantillaEfectiva(plantilla, [R('cumplimiento', 'estrellas', { num: 5 })]);
  eq(it.map((x) => x.valor_num), [5, null, null]);
  eq(mediaEstrellas(it), 5);
});

test('ni las cadenas vacías que llegan de un input sin tocar', () => {
  eq(mediaEstrellas([
    { tipo: 'estrellas', valor_num: 4 },
    { tipo: 'estrellas', valor_num: '' },
    { tipo: 'estrellas', valor_num: undefined },
  ]), 4);
  eq(mediaEstrellas([{ tipo: 'estrellas', valor_num: null }]), null);
});

test('cumplimientoDe lee solo la clave reservada, y solo si es estrellas', () => {
  eq(cumplimientoDe(plantillaEfectiva(PLANTILLA, [R('cumplimiento', 'estrellas', { num: 3 })])), 3);
  eq(cumplimientoDe(plantillaEfectiva(PLANTILLA, [R('actitud', 'estrellas', { num: 3 })])), null);
  eq(CLAVE_CUMPLIMIENTO, 'cumplimiento');
});

test('hayRespuestas distingue una reflexión escrita de una en blanco', () => {
  const vacia = plantillaEfectiva(PLANTILLA, []);
  eq(hayRespuestas(vacia), false);
  const llena = plantillaEfectiva(PLANTILLA, [R('actitud', 'estrellas', { num: 1 })]);
  eq(hayRespuestas(llena), true);
});

console.log('· claveDesdeEtiqueta');

test('sin tildes, sin espacios, minúsculas', () => {
  eq(claveDesdeEtiqueta('¿Qué tal la Actitud?'), 'que_tal_la_actitud');
});

test('resuelve colisiones dentro del equipo', () => {
  eq(claveDesdeEtiqueta('Actitud', ['actitud']), 'actitud_2');
  eq(claveDesdeEtiqueta('Actitud', ['actitud', 'actitud_2']), 'actitud_3');
});

test('etiquetas raras siguen dando una clave válida para la BD', () => {
  for (const e of ['3 puntos', '¡¡¡!!!', 'a', '', '   ', 'ñ', '🏀 balón', 'x'.repeat(80)]) {
    const c = claveDesdeEtiqueta(e);
    ok(RX_CLAVE_BD.test(c), `«${e}» → «${c}» no casa con el CHECK de BD`);
  }
});

test('nunca genera una clave que empiece por número o guion bajo', () => {
  ok(/^[a-z]/.test(claveDesdeEtiqueta('2025 objetivos')));
  ok(/^[a-z]/.test(claveDesdeEtiqueta('_privado')));
});

test('la clave reservada solo se concede a estrellas (el CHECK de 015 la ata)', () => {
  // la pregunta por defecto se borró: la clave está libre, pero un texto
  // llamado "Cumplimiento" reventaría contra reflection_questions_cumplimiento_check
  eq(claveDesdeEtiqueta('Cumplimiento', [], { tipo: 'texto' }), 'cumplimiento_2');
  eq(claveDesdeEtiqueta('Cumplimiento', [], { tipo: 'estrellas' }), 'cumplimiento');
  eq(claveDesdeEtiqueta('Cumplimiento', []), 'cumplimiento');   // sin tipo: como antes
  ok(RX_CLAVE_BD.test(claveDesdeEtiqueta('Cumplimiento', [], { tipo: 'texto' })));
});

/* ── El esfuerzo obligatorio y las preguntas de jugador (3.11) ─ */

console.log('\n· el esfuerzo, y de quién es cada respuesta');

test('el esfuerzo es una clave reservada más, y de estrellas', () => {
  eq(CLAVE_ESFUERZO, 'esfuerzo');
  eq(CLAVES_RESERVADAS, ['cumplimiento', 'esfuerzo']);
  // una pregunta de TEXTO no puede llamarse como ninguna de las dos
  const c = claveDesdeEtiqueta('Esfuerzo', ['esfuerzo'], { tipo: 'texto' });
  ok(c !== 'esfuerzo', c);
});

test('se lee de la plantilla, y solo la del EQUIPO', () => {
  const items = [
    { clave: 'esfuerzo', tipo: 'estrellas', valor_num: 4 },
    { clave: 'esfuerzo', tipo: 'estrellas', valor_num: 1, player_id: 'p1' },
  ];
  eq(esfuerzoDe(items), 4, 'la de un jugador no es la de la sesión');
});

test('sin contestar, falta: es lo que impide cerrar (decisión #20)', () => {
  ok(faltaEsfuerzo([{ clave: 'esfuerzo', tipo: 'estrellas', valor_num: null }]));
  ok(!faltaEsfuerzo([{ clave: 'esfuerzo', tipo: 'estrellas', valor_num: 3 }]));
});

test('si la pregunta NO está en la plantilla, no falta nada', () => {
  /* Un equipo cuya plantilla se tocó a mano antes de la 027 no se
     queda sin poder cerrar sesiones. */
  ok(!faltaEsfuerzo([{ clave: 'actitud', tipo: 'estrellas', valor_num: null }]));
  ok(!faltaEsfuerzo([]));
});

test('una respuesta de jugador viaja con su jugador', () => {
  const it = [{ clave: 'como_ha_ido', tipo: 'texto', etiqueta: '¿Cómo ha ido?', valor_texto: 'bien', player_id: 'p1' }];
  const { aGuardar } = filasRespuesta('s1', it);
  eq(aGuardar[0].player_id, 'p1');
});

test('y se contesta DE QUIEN SE QUIERA, no de todos', () => {
  /* Es el criterio de la fila. Solo se guarda lo contestado: los
     jugadores sin respuesta no generan filas vacías. */
  const it = [
    { clave: 'como_ha_ido', tipo: 'texto', valor_texto: 'muy bien', player_id: 'p1' },
    { clave: 'como_ha_ido', tipo: 'texto', valor_texto: '', player_id: 'p2' },
    { clave: 'como_ha_ido', tipo: 'texto', valor_texto: null, player_id: 'p3' },
  ];
  const { aGuardar, aBorrar } = filasRespuesta('s1', it);
  eq(aGuardar.length, 1);
  eq(aGuardar[0].player_id, 'p1');
  eq(aBorrar.map((x) => x.player_id), ['p2', 'p3'], 'los vacíos se borran, cada uno el suyo');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
