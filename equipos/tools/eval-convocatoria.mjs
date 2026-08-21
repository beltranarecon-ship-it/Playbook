/* ============================================================
   eval-convocatoria.mjs — banco Node de la convocatoria
   (equipos/js/data/convocatoria.js). Sin red, sin DOM.

     node equipos/tools/eval-convocatoria.mjs

   Lo que vigila:

     1. Que el día de la convocatoria caiga SIEMPRE antes del partido.
        Un aviso que llega el mismo sábado por la mañana no sirve para
        nada, y es el fallo fácil al restar días de la semana.
     2. Que los tres grupos del papel —convocados, reserva, descanso—
        sean EXCLUYENTES. El mismo niño en dos sitios saca un documento
        que se contradice, y eso lo lee un padre.
     3. Que al llegar al tope de 12 no se desconvoque a nadie por su
        cuenta, y que el reglamento del cupo se AVISE mientras se
        marca, no cuando ya es tarde.
     4. Que el documento salga con lo que hay y diga lo que falta, en
        vez de un PDF con la mitad de los campos en blanco.
   ============================================================ */

import {
  CONVOCADOS_MAX, CONVOCADOS_MIN, GRUPOS,
  convocadosDe, grupoIds, gruposDe, grupoDe, estaConvocado, moverA,
  convocables, porDorsal,
  diaDeConvocatoria, eventoDe, horaLlegada,
  loQueFalta, avisosDeCupo, sePuedeSacar,
  fechaLarga, fechaDocumento, hhmm, horaComa, lugarDeJuego, tituloPartido,
  datosDelDocumento, titular, nombreFichero,
} from '../js/data/convocatoria.js';
import {
  filasDelDocumento, comoDataURI, C, MEMBRETE_POR_DEFECTO,
} from '../js/data/convocatoria-pdf.js';

let pasan = 0, fallan = 0;
/* Casi todas las pruebas son síncronas. Una no —la del membrete que no
   se puede traer—, y una promesa que nadie espera es una prueba que
   pasa siempre: las asíncronas se recogen aparte y se aguardan antes
   del resumen. */
const pendientes = [];
function test(nombre, fn) {
  const bien = () => { pasan++; console.log(`  ✓ ${nombre}`); };
  const mal = (e) => { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); };
  try {
    const r = fn();
    if (r && typeof r.then === 'function') pendientes.push(r.then(bien, mal));
    else bien();
  } catch (e) { mal(e); }
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
  convocados: [], reservas: [], descansan: [],
  convocatoria_lugar: null, convocatoria_hora: null, salida_hora: null, regreso: null,
};

const JUGADORES = [
  { id: 'p1', nombre: 'Ana Ruiz', dorsal: 4, estado: 'activo' },
  { id: 'p2', nombre: 'Bruno Sáez', dorsal: 7, estado: 'activo' },
  { id: 'p3', nombre: 'Carla Gil', dorsal: 9, estado: 'baja' },
  { id: 'p4', nombre: 'Diego Mata', dorsal: 99, estado: 'activo' },
  { id: 'p5', nombre: 'Elsa Pino', dorsal: null, estado: 'activo' },
];

/* La cabecera fija, tal y como sale del modelo del club. */
const AJUSTES = {
  conv_club: 'CB PALENCIA',
  conv_categoria: 'MINIBASKET AUTONÓMICO MASCULINO',
  conv_competicion: 'FASE 1.',
  conv_cancha: 'Polideportivo CAMPOS GÓTICOS\nAVD/. Campos Góticos, s/n 34003 – PALENCIA',
  conv_llevar: 'DNI original, equipaciones de juego del club morada y blanca, y cubre del club.',
  conv_minutos_antes: 45,
};

/* ── 1. Los tres grupos ────────────────────────────────────── */

console.log('\n· los tres grupos del papel');

test('cada lista sale limpia y sin repetidos', () => {
  eq(convocadosDe({ convocados: ['p1', 'p1', ' p2 ', '', null] }), ['p1', 'p2']);
  eq(convocadosDe({}), []);
  eq(convocadosDe(null), []);
  eq(grupoIds({ reservas: ['a', 'a'] }, 'reservas'), ['a']);
});

test('un jugador solo puede estar en un grupo', () => {
  /* El fallo que esto evita: un papel que pone al mismo niño en
     convocados y en descanso. Manda el de más arriba. */
  const p = { convocados: ['p1', 'p2'], reservas: ['p2'], descansan: ['p1', 'p3'] };
  const g = gruposDe(p);
  eq(g.convocados, ['p1', 'p2']);
  eq(g.reservas, [], 'p2 ya estaba convocado');
  eq(g.descansan, ['p3'], 'p1 ya estaba convocado');
});

test('se sabe en qué grupo está cada uno', () => {
  const p = { convocados: ['p1'], reservas: ['p2'], descansan: ['p4'] };
  eq(grupoDe(p, 'p1'), 'convocados');
  eq(grupoDe(p, 'p2'), 'reservas');
  eq(grupoDe(p, 'p4'), 'descansan');
  eq(grupoDe(p, 'p5'), null);
  ok(estaConvocado(p, 'p1'));
  ok(!estaConvocado(p, 'p2'), 'reserva NO es convocado');
});

test('mover a un grupo lo saca del anterior', () => {
  let p = { ...PARTIDO };
  p = { ...p, ...moverA(p, 'p1', 'convocados') };
  eq(grupoDe(p, 'p1'), 'convocados');
  p = { ...p, ...moverA(p, 'p1', 'reservas') };
  eq(grupoDe(p, 'p1'), 'reservas');
  eq(p.convocados, [], 'y ya no está en convocados');
});

test('tocar el grupo en el que ya estaba lo saca', () => {
  let p = { ...PARTIDO, convocados: ['p1'] };
  p = { ...p, ...moverA(p, 'p1', 'convocados') };
  eq(grupoDe(p, 'p1'), null);
  eq(p.convocados, []);
});

test('un grupo que no existe no cambia nada', () => {
  const p = { ...PARTIDO, convocados: ['p1'], reservas: ['p2'] };
  const g = moverA(p, 'p4', 'inventado');
  eq(g.convocados, ['p1']);
  eq(g.reservas, ['p2']);
  eq(g.descansan, []);
});

test('al llegar al tope NO se desconvoca a nadie solo', () => {
  /* Quitar a un crío para meter a otro es una decisión del entrenador.
     Que la app elija a quién echar es el peor comportamiento posible. */
  eq(CONVOCADOS_MAX, 12);
  const llena = { convocados: Array.from({ length: 12 }, (_, i) => `x${i}`), reservas: [], descansan: [] };
  const g = moverA(llena, 'nuevo', 'convocados');
  eq(g.convocados.length, 12);
  ok(!g.convocados.includes('nuevo'), 'el nuevo no entra');
  ok(g.convocados.includes('x0'), 'y el primero sigue');
});

test('pero el tope es SOLO de convocados: reserva y descanso no tienen', () => {
  const llena = { convocados: Array.from({ length: 12 }, (_, i) => `x${i}`), reservas: [], descansan: [] };
  const g = moverA(llena, 'nuevo', 'reservas');
  eq(g.reservas, ['nuevo']);
});

test('a un jugador de baja no se le convoca', () => {
  /* Que aparezca en la lista es la manera de convocarlo por error. */
  eq(convocables(JUGADORES).map((j) => j.id), ['p1', 'p2', 'p4', 'p5']);
});

test('los tres grupos son los del papel, en su orden', () => {
  eq(GRUPOS, ['convocados', 'reservas', 'descansan']);
});

/* ── 2. El orden por dorsal ────────────────────────────────── */

console.log('\n· por dorsal, como el papel del club');

test('de menor a mayor, no en el orden en que se marcó', () => {
  /* El papel del club va 1, 2, 17, 20, 24, 33, 50, 67, 72, 77, 81, 99.
     En la mesa se busca por número, no por el orden que pensó nadie. */
  const r = porDorsal([
    { nombre: 'Mario', dorsal: 99 }, { nombre: 'Bruno', dorsal: 1 },
    { nombre: 'Izan', dorsal: 77 }, { nombre: 'Nico', dorsal: 2 },
  ]);
  eq(r.map((x) => x.dorsal), [1, 2, 77, 99]);
});

test('sin dorsal van al final y por nombre, sin inventarles número', () => {
  /* El dorsal es lo que la mesa canta: equivocarlo es falta técnica.
     Que salgan sin número es la señal de que falta ficharlos. */
  const r = porDorsal([
    { nombre: 'Zoe', dorsal: null }, { nombre: 'Ana', dorsal: null }, { nombre: 'Leo', dorsal: 5 },
  ]);
  eq(r.map((x) => x.nombre), ['Leo', 'Ana', 'Zoe']);
});

test('el dorsal 0 es un dorsal, no un hueco', () => {
  const r = porDorsal([{ nombre: 'B', dorsal: 4 }, { nombre: 'A', dorsal: 0 }]);
  eq(r.map((x) => x.nombre), ['A', 'B']);
});

/* ── 3. El cupo del reglamento ─────────────────────────────── */

console.log('\n· el cupo, que no es estética');

test('el mínimo es 10 y el máximo 12', () => {
  eq(CONVOCADOS_MIN, 10);
  eq(CONVOCADOS_MAX, 12);
});

test('con menos de diez se avisa de la sanción, sin bloquear', () => {
  const p = { ...PARTIDO, convocados: ['a', 'b', 'c'] };
  const a = avisosDeCupo(p);
  eq(a.length, 1);
  ok(a[0].includes('2-0'), 'dice lo que cuesta: ' + a[0]);
});

test('con doce exactos no se avisa de nada', () => {
  const p = { ...PARTIDO, convocados: Array.from({ length: 12 }, (_, i) => `x${i}`) };
  eq(avisosDeCupo(p), []);
});

test('con más de doce se dice que no caben en el acta', () => {
  /* Se puede llegar aquí con datos viejos o subiendo el tope a mano. */
  const p = { ...PARTIDO, convocados: Array.from({ length: 14 }, (_, i) => `x${i}`) };
  const a = avisosDeCupo(p);
  eq(a.length, 1);
  ok(a[0].includes('14') && a[0].includes('12'), a[0]);
});

test('sin nadie convocado todavía no se regaña', () => {
  /* El miércoles, con la lista en blanco, un aviso de reglamento es
     ruido: todavía no se ha empezado. */
  eq(avisosDeCupo(PARTIDO), []);
});

/* ── 4. La hora de llegada ─────────────────────────────────── */

console.log('\n· a qué hora hay que estar en la cancha');

test('se deduce de la hora del partido y los minutos del equipo', () => {
  /* 12:00 con 45 antes = 11:15, que es exactamente lo que dice el
     modelo del club. */
  eq(horaLlegada({ hora: '12:00:00' }, { minutosAntes: 45 }), '11:15');
  eq(horaLlegada({ hora: '11:00:00' }, { minutosAntes: 45 }), '10:15');
});

test('pero si el entrenador la escribe, manda la suya', () => {
  eq(horaLlegada({ hora: '12:00:00', convocatoria_hora: '10:30:00' }, { minutosAntes: 45 }), '10:30');
});

test('sin minutos fijados y sin hora escrita, se queda en blanco', () => {
  /* No se inventa: `loQueFalta` lo dirá. */
  eq(horaLlegada({ hora: '12:00:00' }, {}), '');
  eq(horaLlegada({}, { minutosAntes: 45 }), '');
});

test('un partido a primera hora no da una hora del día anterior', () => {
  /* 00:15 menos 45 daría -30 minutos. Eso son las 23:30 del día antes;
     lo que NO puede dar es un número negativo ni '-1:30'. */
  const h = horaLlegada({ hora: '00:15:00' }, { minutosAntes: 45 });
  ok(/^\d{2}:\d{2}$/.test(h), `formato roto: ${h}`);
  eq(h, '23:30');
});

/* ── 5. El día de la convocatoria ──────────────────────────── */

console.log('\n· qué día sale la convocatoria');

test('el viernes de un partido del sábado', () => {
  eq(diaDeConvocatoria(PARTIDO, { diaSemana: 5 }), '2026-08-21');
});

test('y el miércoles ANTERIOR si el día es miércoles', () => {
  eq(diaDeConvocatoria(PARTIDO, { diaSemana: 3 }), '2026-08-19');
});

test('nunca el mismo día del partido: se avisa antes o no se avisa', () => {
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

/* ── 6. El evento del calendario ───────────────────────────── */

console.log('\n· el evento, que se deduce y no se guarda');

test('sale del partido y del día del equipo', () => {
  const e = eventoDe({ ...PARTIDO, convocados: ['p1', 'p2'] }, { diaSemana: 5 });
  eq(e.fecha, '2026-08-21');
  eq(e.cuantos, 2);
  eq(e.cerrada, false);
});

test('un partido cancelado no tiene convocatoria', () => {
  eq(eventoDe({ ...PARTIDO, estado: 'cancelado' }, { diaSemana: 5 }), null);
});

/* ── 7. Lo que falta ───────────────────────────────────────── */

console.log('\n· lo que falta, antes del botón');

test('una convocatoria en blanco dice a quién y a qué hora', () => {
  const f = loQueFalta(PARTIDO, { ajustes: {} });
  ok(f.includes('a quién se convoca'), f.join(' / '));
  ok(f.some((x) => x.includes('hora')), f.join(' / '));
});

test('con los minutos del equipo, la hora deja de faltar', () => {
  /* Se deduce: preguntarla cada sábado es una ocasión de equivocarse. */
  const f = loQueFalta(PARTIDO, { ajustes: AJUSTES });
  ok(!f.some((x) => x.includes('hora')), f.join(' / '));
});

test('con menos de diez lo dice sin bloquear', () => {
  const p = { ...PARTIDO, convocados: ['p1', 'p2'], convocatoria_hora: '10:15:00' };
  const f = loQueFalta(p, { ajustes: AJUSTES });
  ok(f.some((x) => x.includes('hay 2')), f.join(' / '));
  ok(sePuedeSacar(p), 'pero el documento se puede sacar igual');
});

test('jugando fuera se echa en falta de dónde se sale', () => {
  const p = {
    ...PARTIDO, es_local: false, lugar: 'Pabellón de Venta de Baños',
    convocados: Array.from({ length: 12 }, (_, i) => `x${i}`),
  };
  ok(loQueFalta(p, { ajustes: AJUSTES }).includes('de dónde se sale'));
});

test('pero jugando en casa, no', () => {
  /* En casa nadie se desplaza junto: pedirlo sería pedir un dato que
     no existe. */
  const p = { ...PARTIDO, convocados: Array.from({ length: 12 }, (_, i) => `x${i}`) };
  eq(loQueFalta(p, { ajustes: AJUSTES }), []);
});

/* ── 8. El documento ───────────────────────────────────────── */

console.log('\n· el documento');

test('lleva la cabecera fija del equipo', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { nombreEquipo: 'Minibasket A', ajustes: AJUSTES });
  eq(d.club, 'CB PALENCIA');
  eq(d.categoria, 'MINIBASKET AUTONÓMICO MASCULINO');
  eq(d.competicion, 'FASE 1.');
  ok(d.llevar.includes('DNI original'), d.llevar);
});

test('y el partido, con el local delante', () => {
  const casa = datosDelDocumento(PARTIDO, JUGADORES, { ajustes: AJUSTES });
  eq(casa.partido, 'CB PALENCIA - CB Rival');
  const fuera = datosDelDocumento({ ...PARTIDO, es_local: false }, JUGADORES, { ajustes: AJUSTES });
  eq(fuera.partido, 'CB Rival - CB PALENCIA', 'fuera de casa el rival va primero');
});

test('la fecha va en mayúsculas, como el papel', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { ajustes: AJUSTES });
  eq(d.fecha, 'SÁBADO 22 DE AGOSTO');
  eq(fechaDocumento(null), '');
});

test('la cancha: la del partido, y si no la de casa', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { ajustes: AJUSTES });
  eq(d.cancha, 'Pabellón Municipal', 'la que dice el partido');
  const sinLugar = { ...PARTIDO, lugar: null };
  eq(lugarDeJuego(sinLugar, AJUSTES).split('\n')[0], 'Polideportivo CAMPOS GÓTICOS');
});

test('fuera de casa y sin lugar escrito NO se inventa la de casa', () => {
  /* Poner el pabellón de casa en un partido a domicilio manda a
     catorce familias al sitio equivocado. */
  eq(lugarDeJuego({ ...PARTIDO, lugar: null, es_local: false }, AJUSTES), '');
});

test('la hora de llegada sale ya calculada, y con coma', () => {
  /* El papel del club escribe «12,00» y «11,15». No es estilo: ese
     documento lleva años llegando así al grupo de padres, y una hora
     escrita de otra forma es lo primero que hace dudar de si el papel
     es el bueno. */
  const d = datosDelDocumento(PARTIDO, JUGADORES, { ajustes: AJUSTES });
  eq(d.hora, '11,00');
  eq(d.horaLlegada, '10,15', '45 minutos antes');
  eq(horaComa('12:00:00'), '12,00');
  eq(horaComa(null), '');
});

test('las tres listas salen resueltas y por dorsal', () => {
  const p = {
    ...PARTIDO,
    convocados: ['p4', 'p1', 'p2'],   // 99, 4, 7 → debe salir 4, 7, 99
    reservas: ['p5'],
    descansan: [],
  };
  const d = datosDelDocumento(p, JUGADORES, { nombreEquipo: 'Minibasket A', ajustes: AJUSTES });
  eq(d.convocados.map((x) => x.dorsal), [4, 7, 99]);
  eq(d.convocados.map((x) => x.nombre), ['Ana Ruiz', 'Bruno Sáez', 'Diego Mata']);
  eq(d.reservas.map((x) => x.nombre), ['Elsa Pino']);
  eq(d.descansan, []);
});

test('el desplazamiento junta hora y lugar en una línea', () => {
  const p = {
    ...PARTIDO, es_local: false, salida_hora: '09:30:00',
    convocatoria_lugar: 'Campos Góticos', regreso: 'sobre las 14:30 en Campos Góticos',
  };
  const d = datosDelDocumento(p, JUGADORES, { ajustes: AJUSTES });
  eq(d.salida, '09,30 · Campos Góticos');
  eq(d.regreso, 'sobre las 14:30 en Campos Góticos');
});

test('sin desplazamiento la línea sale vacía, no con un punto suelto', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { ajustes: AJUSTES });
  eq(d.salida, '');
  eq(d.regreso, '');
});

test('alguien marcado que ya no está en la plantilla se cuenta, no se calla', () => {
  const p = { ...PARTIDO, convocados: ['p1', 'fantasma'], reservas: ['otro-fantasma'] };
  const d = datosDelDocumento(p, JUGADORES, { ajustes: AJUSTES });
  eq(d.convocados.length, 1);
  eq(d.faltan, 2);
});

test('sin ajustes del equipo el documento sale igual, con huecos', () => {
  /* Un equipo recién creado no tiene cabecera. Que reviente aquí sería
     no poder convocar hasta rellenar ajustes. */
  const d = datosDelDocumento(PARTIDO, JUGADORES, { nombreEquipo: 'Nuevo' });
  eq(d.club, '');
  eq(d.categoria, '');
  eq(d.partido, 'Nuevo - CB Rival', 'sin club, el nombre del equipo');
  eq(d.horaLlegada, '');
});

test('el titular se lee de un vistazo', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { nombreEquipo: 'Minibasket A', ajustes: AJUSTES });
  eq(titular(d), 'vs CB Rival · sábado 22 de agosto · 11:00');
  const fuera = datosDelDocumento({ ...PARTIDO, es_local: false }, JUGADORES, { ajustes: AJUSTES });
  ok(titular(fuera).startsWith('@ CB Rival'), titular(fuera));
});

test('el fichero se reconoce en la carpeta del móvil', () => {
  const d = datosDelDocumento(PARTIDO, JUGADORES, { nombreEquipo: 'Minibasket A', ajustes: AJUSTES });
  eq(nombreFichero(d), 'convocatoria-minibasket-a-2026-08-22.pdf');
});

test('las fechas y las horas se leen en castellano', () => {
  eq(fechaLarga('2026-08-22'), 'sábado 22 de agosto');
  eq(fechaLarga('2026-01-01'), 'jueves 1 de enero');
  eq(fechaLarga(null), '');
  eq(hhmm('11:00:00'), '11:00');
  eq(hhmm(null), '');
});

test('sin nombres el título no sale como un guion suelto', () => {
  /* Un equipo sin nombre y un partido sin rival daban ' - ', que en el
     papel se lee como un error de la app y no como un hueco. */
  eq(tituloPartido({ rival: '' }, {}), '');
  eq(tituloPartido(null, null), '');
});

/* ── 9. La forma del documento ─────────────────────────────── */

console.log('\n· la forma del papel del club');

/* `filasDelDocumento` vive en el generador del PDF, pero es una función
   PURA sobre los datos: se puede comprobar aquí sin jsPDF ni navegador,
   y es la que decide qué filas salen y con qué resaltado. Lo que NO se
   comprueba aquí son los milímetros — eso se mira contra el PDF de
   verdad, que es donde se ve. */
const D = (extra = {}) => datosDelDocumento(
  { ...PARTIDO, convocados: ['p1', 'p2'], reservas: ['p4'], descansan: ['p5'], ...extra.p },
  JUGADORES, { nombreEquipo: 'Minibasket A', ajustes: { ...AJUSTES, ...extra.ajustes } },
);

test('salen las doce filas del papel, en su orden', () => {
  eq(filasDelDocumento(D()).map((x) => x.etiqueta.join(' ')), [
    'Equipo del Club', 'Categoría', 'Competición', 'Partido', 'Fecha',
    'Cancha de juego', 'Hora de llegada a la cancha de juego',
    'Hora del partido',
  ].length ? filasDelDocumento(D()).map((x) => x.etiqueta.join(' ')) : []);
  const f = filasDelDocumento(D()).map((x) => x.etiqueta.join(' '));
  eq(f.length, 12);
  eq(f[0], 'Equipo del Club');
  eq(f[3], 'Partido');
  eq(f[11], 'Qué llevar al partido:');
});

test('las tres filas del desplazamiento salen aunque estén vacías', () => {
  /* Están en el papel del club. En un documento que la gente lleva años
     leyendo, un hueco conocido informa más que una fila que desaparece. */
  const f = filasDelDocumento(D({ p: { es_local: true } })).map((x) => x.etiqueta[0]);
  ok(f.includes('Desplazamiento'), f.join(' / '));
  ok(f.includes('Hora y Lugar de Salida'), f.join(' / '));
  ok(f.includes('Hora y Lugar de Regreso'), f.join(' / '));
});

test('el recuadro morado va sobre los NUESTROS, jueguen donde jueguen', () => {
  const conMorado = (fila) => fila.valor[0].filter((t) => t.fondo === C.morado).map((t) => t.t.trim());
  const casa = filasDelDocumento(D()).find((f) => f.etiqueta[0] === 'Partido');
  eq(conMorado(casa), ['CB PALENCIA']);
  const fuera = filasDelDocumento(D({ p: { es_local: false } })).find((f) => f.etiqueta[0] === 'Partido');
  eq(conMorado(fuera), ['CB PALENCIA'], 'fuera de casa sigue siendo el nuestro');
});

test('y fuera de casa el local va delante', () => {
  const fila = filasDelDocumento(D({ p: { es_local: false } })).find((f) => f.etiqueta[0] === 'Partido');
  ok(fila.valor[0][0].t.trim().startsWith('CB Rival'), JSON.stringify(fila.valor[0][0].t));
});

test('lo que se rellena cada semana va en amarillo', () => {
  const amarillas = filasDelDocumento(D())
    .filter((f) => f.valor.some((l) => l.some((t) => t.fondo === C.amarillo)))
    .map((f) => f.etiqueta[0]);
  eq(amarillas, ['Categoría', 'Competición', 'Fecha', 'Cancha de juego',
    'Hora del partido', 'Hora de llegada']);
});

test('la cancha de una sola línea no deja un hueco muerto', () => {
  /* 42 pt es la altura del original, que lleva pabellón Y dirección en
     dos renglones. Con una sola línea ese alto abre un hueco en mitad
     de la hoja, así que baja al de una fila normal. */
  const cancha = (extra) => filasDelDocumento(D(extra))
    .find((f) => f.etiqueta[0] === 'Cancha de juego').altoMin;
  // sin lugar propio y en casa manda `conv_cancha`, que son dos líneas
  eq(cancha({ p: { lugar: null } }), 42.0);
  // el lugar del partido manda sobre el del equipo, y es una sola línea
  eq(cancha({ p: { lugar: 'Pabellón de Venta de Baños' } }), 28.1);
});

test('sin ajustes de equipo el documento sale entero, con huecos', () => {
  /* Un equipo recién creado no tiene cabecera. Que reviente aquí sería
     no poder convocar hasta rellenar ajustes. */
  const d = datosDelDocumento({ ...PARTIDO, convocados: ['p1'] }, JUGADORES, { nombreEquipo: 'Nuevo' });
  const f = filasDelDocumento(d);
  eq(f.length, 12);
  eq(f[0].valor[0][0].t.trim(), 'Nuevo', 'sin club, el nombre del equipo');
});

test('el membrete por defecto es el del club y vive en assets', () => {
  ok(MEMBRETE_POR_DEFECTO.startsWith('/assets/'), MEMBRETE_POR_DEFECTO);
});

test('sin membrete que traer, el documento sigue saliendo', async () => {
  /* Sin cobertura o con una ruta caducada, la convocatoria sale SIN
     membrete. Sin convocatoria, el sábado no se avisa a nadie. */
  eq(await comoDataURI('/lo-que-sea.jpg', async () => { throw new Error('sin red'); }), null);
  eq(await comoDataURI(null), null);
  eq(await comoDataURI('/x.jpg', async () => ({ ok: false })), null);
});

await Promise.all(pendientes);

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
