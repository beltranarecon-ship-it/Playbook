/* ============================================================
   eval-dossier.mjs — banco Node del motor del dossier
   (equipos/js/data/dossier.js). Sin red, sin DOM, sin reloj.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-dossier.mjs
   ============================================================ */

import {
  construirDossier, resumenTemporada, fechaLegible, nombreFicheroDossier,
} from '../js/data/dossier.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}
function ok(cond, msg = 'falso') { if (!cond) throw new Error(msg); }
function contiene(txt, frag) {
  if (!txt.includes(frag)) throw new Error(`falta «${frag}» en el dossier`);
}
function noContiene(txt, frag) {
  if (txt.includes(frag)) throw new Error(`sobra «${frag}» en el dossier`);
}

// ── Fixture: un equipo con dos sesiones, un partido y una nota ──
const BASE = {
  equipo: { id: 'e1', name: 'Sofia Tártilan C', category: 'alevin' },
  temporada: { id: 't1', label: '2026/27' },
  rango: { desde: '2026-09-01', hasta: '2026-10-31' },
  jugadores: [
    { id: 'p1', nombre: 'Ana', dorsal: 4, estado: 'activo' },
    { id: 'p2', nombre: 'Bea', dorsal: 7, estado: 'activo' },
    { id: 'p3', nombre: 'Cris', dorsal: 9, estado: 'lesionado' },
    { id: 'p9', nombre: 'Zoe', dorsal: 12, estado: 'baja' },
  ],
  sesiones: [
    { id: 's2', fecha: '2026-09-16', estado: 'realizada', titulo: 'Tiro tras bote', carga_total: 300 },
    { id: 's1', fecha: '2026-09-09', estado: 'realizada', titulo: 'Salida de presión', carga_total: 260 },
    { id: 's3', fecha: '2026-09-23', estado: 'cancelada', titulo: null, cancel_motivo: 'Pabellón cerrado' },
    { id: 's4', fecha: '2026-10-07', estado: 'programada', titulo: 'Aún por hacer' },
  ],
  bloquesPorSesion: {
    s1: [
      { titulo: 'Calentamiento', duracion_min: 10, intensidad: 2 },
      { titulo: 'Rueda de pase', duracion_min: 20, intensidad: 4 },
    ],
  },
  asistenciaPorSesion: {
    s1: [
      { player_id: 'p1', nombre: 'Ana', estado: 'presente' },
      { player_id: 'p2', nombre: 'Bea', estado: 'ausente', motivo: 'Médico' },
      { player_id: 'p3', nombre: 'Cris', estado: 'lesionado' },
    ],
    s2: [
      { player_id: 'p1', nombre: 'Ana', estado: 'presente' },
      { player_id: 'p2', nombre: 'Bea', estado: 'presente' },
      { player_id: 'p3', nombre: 'Cris', estado: 'tarde' },
    ],
  },
  respuestasPorSesion: {
    s1: [
      { clave_snapshot: 'cumplimiento', etiqueta_snapshot: '¿Se cumplió el plan?', tipo_snapshot: 'estrellas', valor_num: 4 },
      { clave_snapshot: 'que_funciono', etiqueta_snapshot: '¿Qué funcionó?', tipo_snapshot: 'texto', valor_texto: 'La presión\ntras canasta' },
    ],
    s2: [
      { clave_snapshot: 'cumplimiento', etiqueta_snapshot: '¿Se cumplió el plan?', tipo_snapshot: 'estrellas', valor_num: 2 },
    ],
  },
  // el cumplimiento llega YA resuelto por v_session_cumplimiento (la vista es
  // la única puerta según el contrato); el motor no toca reflection_answers
  cumplimientoPorSesion: { s1: 4, s2: 2 },
  objetivos: [
    { id: 'o1', titulo: 'Salida de presión', categoria: 'táctico', estado: 'activo', fecha_inicio: '2026-09-01', fecha_fin: '2026-09-30', descripcion: 'Sin perder el balón' },
    { id: 'o2', titulo: 'Tiro libre', categoria: 'técnico', estado: 'conseguido', fecha_inicio: '2026-09-01', fecha_fin: '2026-09-15' },
  ],
  objetivosPorSesion: { s1: [{ id: 'o1', titulo: 'Salida de presión' }], s2: [{ id: 'o1', titulo: 'Salida de presión' }] },
  filasAsistencia: [
    { player_id: 'p1', estado: 'presente' }, { player_id: 'p1', estado: 'presente' },
    { player_id: 'p2', estado: 'ausente' }, { player_id: 'p2', estado: 'presente' },
    { player_id: 'p3', estado: 'lesionado' }, { player_id: 'p3', estado: 'tarde' },
  ],
  partidos: [
    { id: 'm1', fecha: '2026-10-04', rival: 'CB Palencia', es_local: true, estado: 'jugado', marcador_favor: 62, marcador_contra: 48, val_defensa: 4, val_ataque: 3, claves: 'Bien el rebote' },
    { id: 'm2', fecha: '2026-10-11', rival: 'Maristas', es_local: false, estado: 'programado' },
  ],
  notas: [
    { id: 'n2', fecha: '2026-09-20', titulo: 'Pabellón', cuerpo: 'Cambio a Góticos hasta Navidad' },
    { id: 'n1', fecha: null, titulo: null, cuerpo: 'Grupo muy joven: paciencia con el 1x1' },
  ],
};

console.log('· resumenTemporada');

test('cruza sesiones, asistencia, carga, cumplimiento y partidos', () => {
  const r = resumenTemporada(BASE);
  eq([r.sesiones.total, r.sesiones.realizadas, r.sesiones.canceladas, r.sesiones.pendientes], [4, 2, 1, 1]);
  eq(r.asistencia.listasPasadas, 2);
  eq(Math.round(r.asistencia.media), 67);        // (33 + 100) / 2
  eq(Math.round(r.carga.media), 280);            // (260 + 300) / 2
  eq(r.cumplimiento.media, 3);                   // (4 + 2) / 2
  eq(r.partidos.jugados, 1);
});

test('sin datos no divide por cero ni inventa medias', () => {
  const r = resumenTemporada({});
  eq([r.sesiones.total, r.asistencia.media, r.carga.media, r.cumplimiento.media], [0, null, null, null]);
  eq(r.partidos.jugados, 0);
});

console.log('· construirDossier');

const MD = construirDossier(BASE);

test('cabecera con equipo, temporada y periodo', () => {
  contiene(MD, '# Sofia Tártilan C · temporada 2026/27');
  contiene(MD, '1 de septiembre de 2026');
  contiene(MD, '31 de octubre de 2026');
});

test('resumen con los números clave', () => {
  contiene(MD, '**Asistencia media**: 67 %');
  contiene(MD, '**Cumplimiento del plan**: 3 / 5');
  contiene(MD, '1 jugados · 1-0');
});

test('objetivos agrupados por estado y con cuántas sesiones los trabajaron', () => {
  contiene(MD, '### En marcha');
  contiene(MD, 'trabajado en 2 sesiones');
  contiene(MD, '### Conseguidos');
  contiene(MD, 'trabajado en 0 sesiones');   // el conseguido no se tocó en el periodo
});

test('tabla de asistencia ordenada de más a menos, sin las bajas', () => {
  contiene(MD, '| Jugador/a | Asistencia |');
  contiene(MD, '| Ana | 100 % | 2/2 |');
  noContiene(MD, '| Zoe |');                 // baja sin datos: fuera
  const iAna = MD.indexOf('| Ana |'), iBea = MD.indexOf('| Bea |');
  ok(iAna < iBea, 'Ana (100 %) debería ir antes que Bea (50 %)');
});

test('cada sesión con su carga, asistencia, objetivos y reflexión', () => {
  contiene(MD, '### 2026-09-09 · Salida de presión');
  contiene(MD, '30 min · carga 100 · asistencia 1/3 (33 %)');
  contiene(MD, 'Objetivos: Salida de presión');
  contiene(MD, '¿Se cumplió el plan?: 4/5');
});

test('los textos multilínea se aplanan (no rompen el Markdown)', () => {
  contiene(MD, '¿Qué funcionó?: La presión · tras canasta');
});

test('quién faltó y por qué, que es lo que el entrenador busca', () => {
  contiene(MD, 'Faltaron: Bea (ausente: Médico) · Cris (lesionado)');
});

test('una sesión cancelada aparece con su motivo y sin datos falsos', () => {
  contiene(MD, '### 2026-09-23 · Sesión _(cancelada)_');
  contiene(MD, 'Motivo: Pabellón cerrado');
});

test('una sesión aún por jugar no entra en el relato', () => {
  noContiene(MD, 'Aún por hacer');
});

test('partidos con marcador, resultado, valoraciones y claves', () => {
  contiene(MD, '### 2026-10-04 · vs CB Palencia — **62-48** (victoria)');
  contiene(MD, 'Defensa 4/5 · Ataque 3/5');
  contiene(MD, 'Claves: Bien el rebote');
  contiene(MD, '**Medias de la competición**');
});

test('notas del cuerpo técnico, las fechadas antes que las de siempre', () => {
  contiene(MD, '## Notas del cuerpo técnico');
  contiene(MD, '**2026-09-20 · Pabellón** — Cambio a Góticos hasta Navidad');
  const iFechada = MD.indexOf('Cambio a Góticos'), iSiempre = MD.indexOf('Grupo muy joven');
  ok(iFechada < iSiempre, 'las notas con fecha van primero');
});

test('DETERMINISTA: mismas entradas, mismo texto (aunque cambie el orden)', () => {
  const revuelto = {
    ...BASE,
    sesiones: BASE.sesiones.slice().reverse(),
    partidos: BASE.partidos.slice().reverse(),
    notas: BASE.notas.slice().reverse(),
    // el orden de BD tampoco está garantizado para estos: si el motor no los
    // ordena él, dos exportaciones del mismo periodo salen distintas
    jugadores: BASE.jugadores.slice().reverse(),
    objetivos: BASE.objetivos.slice().reverse(),
    filasAsistencia: BASE.filasAsistencia.slice().reverse(),
  };
  eq(construirDossier(revuelto), MD);
});

test('sin reloj dentro: solo hay fecha de generación si se le pasa', () => {
  noContiene(MD, 'Dossier generado el');
  const conFecha = construirDossier(BASE, { generadoEl: '2026-10-31' });
  contiene(conFecha, '_Dossier generado el 31 de octubre de 2026 desde Playbook CBP._');
});

test('detalle:false quita el desglose de bloques pero mantiene los totales', () => {
  const corto = construirDossier(BASE, { detalle: false });
  noContiene(corto, 'Bloques: Calentamiento');
  contiene(corto, '30 min · carga 100');
});

test('un equipo recién creado da un dossier válido, no un error', () => {
  const vacio = construirDossier({
    equipo: { name: 'Nuevo' }, temporada: { label: '2026/27' },
    rango: { desde: '2026-09-01', hasta: '2026-09-30' },
  });
  contiene(vacio, '# Nuevo · temporada 2026/27');
  contiene(vacio, 'sin listas pasadas todavía');
  contiene(vacio, 'ninguno jugado en el periodo');
  ok(vacio.endsWith('\n'), 'debe terminar en salto de línea');
});

console.log('· honestidad de los números (regresiones de la revisión adversarial)');

test('una sesión CANCELADA no promedia aunque tenga lista pasada', () => {
  // se pasa lista y DESPUÉS se cancela: las filas se quedan en BD. La ficha
  // del equipo ya las excluía; el dossier las contaba y daba otra media.
  const conCancelada = {
    ...BASE,
    asistenciaPorSesion: {
      ...BASE.asistenciaPorSesion,
      s3: [   // s3 está 'cancelada' en el fixture
        { player_id: 'p1', estado: 'ausente' },
        { player_id: 'p2', estado: 'ausente' },
        { player_id: 'p3', estado: 'ausente' },
      ],
    },
  };
  const r = resumenTemporada(conCancelada);
  eq(r.asistencia.listasPasadas, 2, 'la cancelada no cuenta como lista pasada');
  eq(Math.round(r.asistencia.media), 67, 'la media no debe hundirse por una cancelada');
});

test('las filas de una sesión cancelada no entran en la tabla por jugador', () => {
  const md = construirDossier({
    ...BASE,
    filasAsistencia: [
      { session_id: 's1', player_id: 'p1', estado: 'presente' },
      { session_id: 's3', player_id: 'p1', estado: 'ausente' },   // cancelada
    ],
  });
  contiene(md, '| Ana | 100 % | 1/1 |');
});

test('el cumplimiento sale de la vista, no de reflection_answers', () => {
  // sin cumplimientoPorSesion no hay media, aunque las respuestas estén ahí
  const r = resumenTemporada({ ...BASE, cumplimientoPorSesion: {} });
  eq(r.cumplimiento.media, null);
  eq(r.cumplimiento.evaluadas, 0);
});

test('una lectura fallida se admite; NO se escribe un cero falso', () => {
  const roto = construirDossier({
    ...BASE, partidos: [], asistenciaPorSesion: {}, filasAsistencia: [],
    disponible: { partidos: false, asistencia: false },
  });
  contiene(roto, '**Partidos**: no se pudo leer (dato ausente, no cero)');
  contiene(roto, '**Asistencia**: no se pudo leer (dato ausente, no cero)');
  noContiene(roto, 'ninguno jugado en el periodo');
  contiene(roto, '## Lo que este dossier no pudo leer');
  contiene(roto, '- los partidos');
});

test('sin `disponible` el dossier se comporta igual que siempre', () => {
  noContiene(MD, 'Lo que este dossier no pudo leer');
  contiene(MD, '**Asistencia media**: 67 %');
});

test('un | en el nombre no parte la fila de la tabla', () => {
  const md = construirDossier({
    ...BASE,
    jugadores: [{ id: 'p1', nombre: 'Ana | Capitana', dorsal: 4, estado: 'activo' }],
    filasAsistencia: [{ player_id: 'p1', estado: 'presente' }],
  });
  const fila = md.split('\n').find((l) => l.startsWith('| Ana'));
  contiene(fila, '| Ana \\| Capitana |');
  eq(fila.split(/(?<!\\)\|/).length - 2, 5, 'la fila debe tener 5 celdas, no 6');
});

console.log('· utilidades');

test('fechaLegible no usa Date (inmune a zonas horarias)', () => {
  eq(fechaLegible('2026-01-01'), '1 de enero de 2026');
  eq(fechaLegible('2026-12-31'), '31 de diciembre de 2026');
  eq(fechaLegible(null), '—');
});

test('nombre de fichero estable, sin tildes ni espacios', () => {
  eq(nombreFicheroDossier({ name: 'Sofia Tártilan C' }, { desde: '2026-09-01', hasta: '2026-10-31' }),
     'dossier-sofia-tartilan-c-2026-09-01_2026-10-31.md');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
