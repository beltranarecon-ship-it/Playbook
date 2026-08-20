/* ============================================================
   eval-acta-chat.mjs — banco Node del puente al chat del acta
   (equipos/js/data/acta-chat.js). Sin red, sin DOM.

     node equipos/tools/eval-acta-chat.mjs

   Lo que vigila, por orden de importancia:

     1. Que NO salga ni un nombre de un crío en el envío (§2).
     2. Que un acta leída por un modelo entre marcada como dudosa, y no
        como si fuera un dato comprobado.
     3. Que no se case a nadie a lo loco: un dorsal que no es de nadie
        se dice, no se coloca en la fila de al lado.
     4. Que no pise lo que el entrenador ya había escrito.
   ============================================================ */

import {
  armarEnvio, extraerJSON, entero, paresDe, lado, rejillaLeida,
  volcar, resumen, avisos,
} from '../js/data/acta-chat.js';
import { filaVacia, descuadres } from '../js/data/acta.js';

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

const PARTIDO = { id: 'm1', rival: 'CB Rival', es_local: true, periodos: 6, marcador_cuartos: [] };
const PLANTILLA = [
  { id: 'p1', nombre: 'Ana Ruiz', dorsal: 4 },
  { id: 'p2', nombre: 'Bruno Sáez', dorsal: 7 },
  { id: 'p3', nombre: 'Carla Gil', dorsal: 9 },
];
const FILAS = () => PLANTILLA.map(filaVacia);

const RESPUESTA = JSON.stringify({
  periodos: 6,
  marcador: { favor: 38, contra: 30 },
  por_periodo: [
    { favor: 6, contra: 5 }, { favor: 8, contra: 4 }, { favor: 5, contra: 7 },
    { favor: 7, contra: 6 }, { favor: 6, contra: 4 }, { favor: 6, contra: 4 },
  ],
  faltas_equipo: [{ favor: 1, contra: 2 }],
  tiempos_muertos: [],
  jugadores: [
    { dorsal: 4, periodos: [1, 2, 4], puntos: 12, faltas: 2 },
    { dorsal: 7, periodos: [3, 5, 6], puntos: 10, faltas: 1 },
    { dorsal: 9, periodos: [1, 2, 3, 4, 5], puntos: 16, faltas: 0 },
  ],
  dudoso: ['los puntos del 7'],
});

/* ── 1. El envío ───────────────────────────────────────────── */

console.log('\n· el envío, que sale del club');

test('NO lleva ni un nombre de un jugador', () => {
  /* La razón entera del puente: los nombres de los menores no salen a
     ningún tercero (§2). Si esto falla, da igual todo lo demás. */
  const t = armarEnvio(PARTIDO, PLANTILLA, { nombreEquipo: 'Cadete A' });
  for (const j of PLANTILLA) {
    ok(!t.includes(j.nombre), `se ha colado «${j.nombre}»`);
    ok(!t.includes(j.nombre.split(' ')[0]), `se ha colado el nombre de pila de ${j.nombre}`);
  }
});

test('pero sí los dorsales, que son la llave del casado', () => {
  const t = armarEnvio(PARTIDO, PLANTILLA, { nombreEquipo: 'Cadete A' });
  ok(t.includes('4, 7, 9'), 'los dorsales van ordenados');
});

test('dice de qué lado del acta estamos', () => {
  /* En un acta oficial el local es siempre la columna de la izquierda:
     es el discriminador más fiable que hay, mucho más que el nombre del
     club, que en el papel viene abreviado de cualquier manera. */
  ok(armarEnvio(PARTIDO, PLANTILLA).includes('equipo LOCAL'));
  ok(armarEnvio({ ...PARTIDO, es_local: false }, PLANTILLA).includes('equipo VISITANTE'));
});

test('y el molde tiene tantas entradas como periodos', () => {
  const t = armarEnvio({ ...PARTIDO, periodos: 4 }, PLANTILLA);
  eq((t.match(/"por_periodo": \[(.*)\]/)[1].match(/favor/g) || []).length, 4);
});

test('un equipo sin dorsales apuntados no rompe el envío', () => {
  const t = armarEnvio(PARTIDO, [{ id: 'x', nombre: 'Sin Dorsal', dorsal: null }]);
  ok(t.includes('(no los sé)'), t.slice(0, 400));
  ok(t.includes('1 jugador(es) sin dorsal'), 'y lo avisa');
});

/* ── 2. Leer lo que devuelve un chat de verdad ─────────────── */

console.log('\n· leer lo que pega el entrenador');

test('el JSON pelado', () => {
  eq(extraerJSON('{"a": 1}'), { a: 1 });
});

test('dentro de una valla de código', () => {
  eq(extraerJSON('```json\n{"a": 1}\n```'), { a: 1 });
});

test('con dos párrafos de cortesía delante y detrás', () => {
  eq(extraerJSON('¡Claro! Aquí tienes:\n\n{"a": 1}\n\nDime si quieres otra cosa.'), { a: 1 });
});

test('y lo que no es JSON no revienta', () => {
  eq(extraerJSON('no he podido leer el acta'), null);
  eq(extraerJSON(''), null);
  eq(extraerJSON(null), null);
});

test('«no lo sé» no es cero', () => {
  /* La diferencia entre «cero puntos» y «no se lee» es justo la que
     este puente tiene que respetar: un null que entra como 0 borra un
     dato bueno del entrenador sin decirlo. */
  eq(entero(null), null);
  eq(entero(''), null);
  eq(entero('no se lee'), null);
  eq(entero(true), null, 'un booleano tampoco es un número');
  eq(entero(0), 0);
  eq(entero('12'), 12);
  eq(entero('12,5'), 13, 'la coma decimal española');
  eq(entero(' 8 '), 8);
});

test('la lista por periodos sale con la longitud del partido', () => {
  const l = paresDe([{ favor: 6, contra: 5 }], 4);
  eq(l.length, 4);
  eq(l[0], { favor: 6, contra: 5 });
  eq(l[3], { favor: null, contra: null }, 'lo que no viene es null, no 0');
});

/* ── 3. El volcado ─────────────────────────────────────────── */

console.log('\n· volcar');

test('un acta entera entra de una vez', () => {
  const r = volcar(PARTIDO, FILAS(), RESPUESTA);
  eq(r.partido.marcador_favor, 38);
  eq(r.partido.marcador_contra, 30);
  eq(r.partido.marcador_cuartos.length, 6);
  eq(r.filas.find((f) => f.player_id === 'p1').periodos, [1, 2, 4]);
  eq(r.filas.find((f) => f.player_id === 'p1').periodos_jugados, 3);
  eq(r.filas.find((f) => f.player_id === 'p1').periodos_descansados, 3);
  eq(r.filas.find((f) => f.player_id === 'p3').puntos, 16);
});

test('y se recuerda que vino del chat', () => {
  eq(volcar(PARTIDO, FILAS(), RESPUESTA).partido.acta_origen, 'chat');
});

test('sin tocar lo que se le pasa', () => {
  /* Hasta que no se guarda no hay nada perdido: si el volcado mutara lo
     de pantalla, «deshacer» dejaría de existir. */
  const filas = FILAS();
  const copia = JSON.parse(JSON.stringify(filas));
  const partido = { ...PARTIDO };
  volcar(partido, filas, RESPUESTA);
  eq(filas, copia, 'las filas no se tocan');
  eq(partido.marcador_favor, undefined, 'el partido tampoco');
});

test('lo que no es JSON se dice, no se traga', () => {
  const r = volcar(PARTIDO, FILAS(), 'lo siento, no distingo los números');
  ok(r.error && r.error.includes('JSON'), JSON.stringify(r));
});

test('una lista de ceros ya pintada NO cuenta como escrita', () => {
  /* La pantalla estira las tres listas a la longitud del partido para
     poder pintar los campos. Si eso ocupara sitio, el puente no
     rellenaría el marcador por periodos jamás. */
  const ceros = Array.from({ length: 6 }, () => ({ favor: 0, contra: 0 }));
  const r = volcar({ ...PARTIDO, marcador_cuartos: ceros }, FILAS(), RESPUESTA);
  eq(r.partido.marcador_cuartos[1], { favor: 8, contra: 4 });
});

/* ── 4. No pisar lo escrito ────────────────────────────────── */

console.log('\n· no pisa lo que ya estaba escrito');

test('un marcador puesto a mano se respeta', () => {
  const r = volcar({ ...PARTIDO, marcador_favor: 40 }, FILAS(), RESPUESTA);
  eq(r.partido.marcador_favor, 40);
  ok(r.ignorados.includes('el marcador nuestro'), JSON.stringify(r.ignorados));
});

test('y una fila ya rellenada también', () => {
  const filas = FILAS();
  filas[0].puntos = 99;
  const r = volcar(PARTIDO, filas, RESPUESTA);
  eq(r.filas[0].puntos, 99);
  ok(r.ignorados.includes('dorsal 4'), JSON.stringify(r.ignorados));
});

test('salvo que se pida machacar a propósito', () => {
  const filas = FILAS();
  filas[0].puntos = 99;
  const r = volcar({ ...PARTIDO, marcador_favor: 40 }, filas, RESPUESTA, { pisar: true });
  eq(r.partido.marcador_favor, 38);
  eq(r.filas[0].puntos, 12);
});

/* ── 5. El casado por dorsal ───────────────────────────────── */

console.log('\n· casar por dorsal, sin inventar');

test('un dorsal que no es de nadie se dice', () => {
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({
    jugadores: [{ dorsal: 23, periodos: [1], puntos: 4 }],
  }));
  eq(r.sinCasar, [{ dorsal: 23, por: 'no hay nadie con ese dorsal' }]);
  ok(!r.puestos.length, 'y no se le cuela a nadie');
});

test('un dorsal repetido en la plantilla tampoco se resuelve solo', () => {
  /* Meterle el acta al jugador equivocado es peor que dejar la fila
     vacía: el error viaja a la temporada entera (4.4). */
  const filas = [...FILAS(), { ...filaVacia({ id: 'p4', nombre: 'Otro', dorsal: 4 }) }];
  const r = volcar(PARTIDO, filas, JSON.stringify({
    jugadores: [{ dorsal: 4, periodos: [1], puntos: 4 }],
  }));
  eq(r.sinCasar, [{ dorsal: 4, por: 'lo llevan dos jugadores' }]);
  eq(r.filas[0].puntos, 0, 'no se le pone al primero por ser el primero');
});

test('y una fila sin dorsal se manda a mano', () => {
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({ jugadores: [{ puntos: 4 }] }));
  eq(r.sinCasar, [{ dorsal: null, por: 'no trae dorsal' }]);
});

/* ── 6. Ámbar en lo dudoso ─────────────────────────────────── */

console.log('\n· ámbar: lo que entra por aquí se mira');

test('todo lo volcado se marca para mirarlo', () => {
  const r = volcar(PARTIDO, FILAS(), RESPUESTA);
  ok(r.dudosos.includes('marcador.favor'), 'el marcador');
  ok(r.dudosos.includes('periodo.1.favor'), 'cada periodo');
  ok(r.dudosos.includes('jugador.p1.puntos'), 'cada jugador');
});

test('lo que el chat confiesa que no ha leído se repite en cristiano', () => {
  const r = volcar(PARTIDO, FILAS(), RESPUESTA);
  eq(r.confiesa, ['los puntos del 7']);
  ok(avisos(r).some((a) => a.includes('los puntos del 7')), JSON.stringify(avisos(r)));
});

test('un número imposible se recorta Y se marca', () => {
  /* Recortar sin decirlo es inventarse un dato: el 8 de faltas se queda
     en 5 y hay que ir al papel a ver si era un 3. */
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({
    jugadores: [{ dorsal: 4, periodos: [1], puntos: 12, faltas: 8 }],
  }));
  eq(r.filas[0].faltas, 5);
  ok(r.dudosos.includes('jugador.p1.recortado'), JSON.stringify(r.dudosos));
});

test('y lo que no cuadra sale con los dos números', () => {
  /* El juez que no opina es la suma: el modelo puede estar segurísimo y
     haber leído mal, pero 12+10+16 no son 40. */
  const r = volcar({ ...PARTIDO }, FILAS(), RESPUESTA.replace('"favor":38', '"favor":40'));
  const d = descuadres(r.partido, r.filas);
  const txt = avisos(r, { descuadres: d });
  ok(txt.some((t) => t.includes('38') && t.includes('40')), JSON.stringify(txt));
});

/* ── 7. Cómo se cuenta ─────────────────────────────────────── */

console.log('\n· lo que se le dice al entrenador');

test('se dice qué ha entrado y cuánto se ha respetado', () => {
  const filas = FILAS();
  filas[0].puntos = 99;
  const r = volcar(PARTIDO, filas, RESPUESTA);
  const t = resumen(r);
  ok(t.includes('2 jugadores'), t);
  ok(t.includes('respetado'), t);
});

test('y si no había nada que volcar, se dice también', () => {
  eq(resumen(volcar(PARTIDO, FILAS(), '{}')), 'No he encontrado nada que volcar en esa respuesta.');
});

/* ── 8. Lo que devuelve un chat de verdad ──────────────────────

   Esta sección sale entera de un ataque adversario (cinco agentes
   contra el lector, cada uno con una lente distinta). Ninguno de estos
   casos se me había ocurrido escribiendo el módulo, y todos son cosas
   que un chat hace de verdad.
   ─────────────────────────────────────────────────────────────── */

console.log('\n· lo que devuelve un chat de verdad');

const ACTA_MINI = '{"periodos":6,"marcador":{"favor":38,"contra":30},"jugadores":[{"dorsal":4,"periodos":[1,2],"puntos":12,"faltas":2}],"dudoso":[]}';
const MOLDE = '{"periodos":6,"marcador":{"favor":0,"contra":0},"por_periodo":[{"favor":0,"contra":0}],"faltas_equipo":[],"jugadores":[{"dorsal":0,"periodos":[1,2],"puntos":0,"faltas":0}],"dudoso":[]}';
const valla = (x) => '```json\n' + x + '\n```';

test('si repite el formato antes de contestar, gana el acta y no la plantilla', () => {
  /* Un chat empieza a menudo con «el formato es este» y pega el molde.
     Cogiendo la primera valla se volcaba un acta a cero con pinta de
     leída, que es el peor resultado posible: parece que ha funcionado. */
  const t = 'Entendido, el formato es este:\n\n' + valla(MOLDE) + '\n\nY aquí va el acta:\n\n' + valla(ACTA_MINI);
  eq(extraerJSON(t).marcador.favor, 38);
});

test('una coma de más no tira el acta entera', () => {
  eq(extraerJSON(valla('{"marcador":{"favor":38,"contra":30},}')).marcador.favor, 38);
});

test('ni un comentario // explicando un campo', () => {
  eq(extraerJSON(valla('{\n  // el marcador final\n  "marcador":{"favor":38,"contra":30}\n}')).marcador.favor, 38);
});

test('y un acta envuelta en otro objeto se encuentra igual', () => {
  eq(extraerJSON('{"acta": ' + ACTA_MINI + '}').marcador.favor, 38);
});

test('pegar el molde en vez de la respuesta se DICE, no se vuelca', () => {
  /* Es el hueco de al lado: el modal tiene el envío arriba y la
     respuesta abajo. Volcarlo dejaba el acta a cero con pinta de leída. */
  const r = volcar(PARTIDO, FILAS(), MOLDE);
  ok(r.error && r.error.includes('formato'), JSON.stringify(r).slice(0, 200));
});

test('los dos lados se entienden aunque el chat los llame de otra manera', () => {
  eq(lado({ nosotros: 6, ellos: 5 }, 'favor'), 6);
  eq(lado({ nosotros: 6, ellos: 5 }, 'contra'), 5);
  eq(lado([6, 5], 'favor'), 6, 'y como par ordenado');
  /* «local» y «visitante» dicen dónde se juega, no de quién es. */
  eq(lado({ local: 6, visitante: 5 }, 'favor', true), 6);
  eq(lado({ local: 6, visitante: 5 }, 'favor', false), 5, 'de visitantes, lo nuestro es lo otro');
});

test('la rejilla se entiende escrita en texto, pero un número suelto NO se adivina', () => {
  eq(rejillaLeida([1, 2, 4], 6), [1, 2, 4]);
  eq(rejillaLeida('1, 2, 4', 6), [1, 2, 4]);
  eq(rejillaLeida(['1', '2'], 6), [1, 2]);
  eq(rejillaLeida('', 6), []);
  /* Un «4» puede ser «jugó el cuarto» o «jugó cuatro periodos», y
     colocarlo mal es peor que dejarlo vacío y decirlo. */
  eq(rejillaLeida(4, 6), null);
  eq(rejillaLeida('1-4', 6), null, 'un rango es ambiguo');
});

test('una rejilla que no se entiende deja la fila, pero lo dice', () => {
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({
    marcador: { favor: 12, contra: 8 },
    jugadores: [{ dorsal: 4, periodos: 3, puntos: 12, faltas: 1 }],
  }));
  eq(r.filas[0].puntos, 12, 'los puntos sí entran');
  eq(r.filas[0].periodos, []);
  ok(avisos(r).some((a) => a.includes('formato que no entiendo')), JSON.stringify(avisos(r)));
});

test('un dorsal repetido en la RESPUESTA no se traga en silencio', () => {
  /* Antes ganaba el primero y el segundo se contaba como «respetado lo
     que ya estaba escrito», que dice justo lo contrario de lo que pasa. */
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({
    jugadores: [
      { dorsal: 4, periodos: [1, 2], puntos: 2, faltas: 0 },
      { dorsal: 4, periodos: [1, 2, 3], puntos: 18, faltas: 3 },
    ],
  }));
  eq(r.filas[0].puntos, 2);
  ok(r.sinCasar.some((x) => x.dorsal === 4 && x.por.includes('dos veces')), JSON.stringify(r.sinCasar));
  ok(!r.ignorados.length, 'y no se cuenta como respetado');
});

test('los jugadores como objeto se entienden; en otra forma se dice', () => {
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({
    jugadores: { 4: { periodos: [1], puntos: 6 }, 7: { periodos: [2], puntos: 4 } },
  }));
  eq(r.filas[0].puntos, 6);
  eq(r.filas[1].puntos, 4);

  const r2 = volcar(PARTIDO, FILAS(), JSON.stringify({ marcador: { favor: 9, contra: 8 }, jugadores: 'los de siempre' }));
  ok(avisos(r2).some((a) => a.includes('no ha entrado ninguno')), JSON.stringify(avisos(r2)));
});

test('si el chat cree que se jugaron otros periodos, se dice', () => {
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({
    periodos: 4, marcador: { favor: 20, contra: 18 },
  }));
  ok(avisos(r).some((a) => a.includes('4 periodos') && a.includes('6')), JSON.stringify(avisos(r)));
});

test('y un dorsal perdido con la plantilla a medias explica el porqué', () => {
  /* Sin esto, el entrenador busca el fallo en el acta cuando está en su
     propia plantilla: hay críos a los que no les ha puesto el dorsal. */
  const r = volcar(PARTIDO, FILAS(), JSON.stringify({ jugadores: [{ dorsal: 23, puntos: 4 }] }));
  const t = avisos(r, { sinDorsal: 2 });
  ok(t.some((a) => a.includes('2 jugadores sin dorsal')), JSON.stringify(t));
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
