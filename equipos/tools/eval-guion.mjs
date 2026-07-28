/* ============================================================
   eval-guion.mjs — banco Node del motor de guion determinista
   (equipos/js/data/guion.js). Sin red, sin DOM.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-guion.mjs
   ============================================================ */

import { guionDeAnimacion, zonaDe, etiquetaJugador, resumenMaterial } from '../js/data/guion.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}
function contiene(txt, trozo) {
  if (!String(txt).includes(trozo)) throw new Error(`"${txt}" no contiene "${trozo}"`);
}
function noContiene(txt, trozo) {
  if (String(txt).includes(trozo)) throw new Error(`"${txt}" NO debería contener "${trozo}"`);
}

/* Anclas medidas de la pista entera / canasta norte, copiadas de
   taller/js/canvas/anclas.js para que el banco falle si alguien las
   mueve sin querer. */
const P = {
  aro: [0.499, 0.091],
  poste_bajo_izq: [0.376, 0.111],
  poste_bajo_der: [0.622, 0.111],
  codo_der: [0.622, 0.236],
  tiro_libre: [0.499, 0.236],
  base: [0.499, 0.306],
  esquina_izq: [0.087, 0.08],
};
const pt = ([x, y]) => ({ x, y });
const camino = (a, b) => [pt(a), pt(b)];

console.log('· zonaDe');

test('un punto sobre el ancla devuelve su nombre', () => {
  eq(zonaDe('entera', 'norte', pt(P.codo_der)), 'el codo derecho');
  eq(zonaDe('entera', 'norte', pt(P.esquina_izq)), 'la esquina izquierda');
  eq(zonaDe('entera', 'norte', pt(P.aro)), 'el aro');
});

test('un punto cercano cae en el ancla más próxima, no en cualquiera', () => {
  eq(zonaDe('entera', 'norte', { x: 0.62, y: 0.24 }), 'el codo derecho');
  eq(zonaDe('entera', 'norte', { x: 0.62, y: 0.19 }), 'el poste alto derecho');
});

test('en tierra de nadie NO se inventa zona', () => {
  // centro-izquierda de la pista de atrás: lejos de toda ancla de norte
  eq(zonaDe('entera', 'norte', { x: 0.2, y: 0.75 }), null);
});

test('sin punto o con pista desconocida devuelve null sin reventar', () => {
  eq(zonaDe('entera', 'norte', null), null);
  eq(zonaDe('pista_que_no_existe', 'norte', pt(P.aro)), null);
});

console.log('· etiquetaJugador');

test('manda el dorsal; si no lo hay, los dígitos del id', () => {
  eq(etiquetaJugador({ id: 'A3', dorsal: 12 }), '12');
  eq(etiquetaJugador({ id: 'A3' }), '3');
  eq(etiquetaJugador({ id: 'B10', dorsal: null }), '10');
});

test('dorsal 0 es un dorsal, no un hueco', () => {
  // ?? y no ||: el 0 es legítimo en baloncesto y no debe caer al id
  eq(etiquetaJugador({ id: 'A7', dorsal: 0 }), '0');
});

console.log('· guionDeAnimacion · casos base');

test('sin fases: vacío, pero el resumen sigue contando el material', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A2', equipo: 'A' }],
    balones: [{ id: 'balon_1', portador_id: 'A1' }],
    conos: [{ id: 'c1', funcion: 'rodear' }, { id: 'c2', funcion: 'fila', fila_config: {} }],
    fases: [],
  });
  eq(g.vacio, true);
  eq(g.fases, []);
  eq([g.resumen.jugadores, g.resumen.balones, g.resumen.conos, g.resumen.filas], [2, 1, 1, 1]);
});

test('animación nula o vacía no lanza', () => {
  eq(guionDeAnimacion(null).vacio, true);
  eq(guionDeAnimacion({}).vacio, true);
});

test('bote + pase + tiro se leen como una jugada', () => {
  const g = guionDeAnimacion({
    pista: 'entera', canasta: 'norte',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    conos: [],
    fases: [
      {
        duracion_ms: 900, pausa_post_ms: 300,
        movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: camino(P.base, P.codo_der) }],
        pases: [], tiros: [], bloqueos: [],
      },
      {
        duracion_ms: 450, pausa_post_ms: 200,
        movimientos: [], bloqueos: [], tiros: [],
        pases: [{ de_id: 'A1', a_id: 'A5', balon_id: 'b1', path: camino(P.codo_der, P.poste_bajo_izq) }],
      },
      {
        duracion_ms: 700, pausa_post_ms: 400,
        movimientos: [], pases: [], bloqueos: [],
        tiros: [{ jugador_id: 'A5', balon_id: 'b1', canasta: 'norte', path: camino(P.poste_bajo_izq, P.aro) }],
      },
    ],
  });
  eq(g.fases.length, 3);
  eq(g.fases[0].lineas, ['El 1 bota hacia el codo derecho']);
  eq(g.fases[1].lineas, ['El 1 pasa al 5, que recibe en el poste bajo izquierdo']);
  eq(g.fases[2].lineas, ['El 5 tira desde el poste bajo izquierdo']);
});

console.log('· guionDeAnimacion · honestidad del verbo');

test('quien NO lleva balón corta, no bota', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [{
      duracion_ms: 800,
      movimientos: [{ elemento_id: 'A5', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.esquina_izq, P.poste_bajo_izq) }],
    }],
  });
  eq(g.fases[0].lineas, ['El 5 corta hacia el poste bajo izquierdo']);
});

test('tras el pase, el verbo cambia de dueño en la fase siguiente', () => {
  // A1 empieza con balón; en la fase 1 lo pasa a A5. En la fase 2 el que
  // bota es A5 y el que corta es A1 — la posesión se arrastra de verdad.
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [
      { duracion_ms: 450, pases: [{ de_id: 'A1', a_id: 'A5', balon_id: 'b1', path: camino(P.base, P.codo_der) }] },
      {
        duracion_ms: 800,
        movimientos: [
          { elemento_id: 'A5', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.codo_der, P.aro) },
          { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.base, P.esquina_izq) },
        ],
      },
    ],
  });
  eq(g.fases[1].lineas, ['El 5 bota hacia el aro', 'El 1 corta hacia la esquina izquierda']);
});

test('un tiro deja el balón en el aire: nadie bota en la fase siguiente', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [
      { duracion_ms: 700, tiros: [{ jugador_id: 'A1', balon_id: 'b1', canasta: 'norte', path: camino(P.tiro_libre, P.aro) }] },
      { duracion_ms: 600, movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.tiro_libre, P.esquina_izq) }] },
    ],
  });
  eq(g.fases[1].lineas, ['El 1 corta hacia la esquina izquierda']);
});

test('un defensor de ESTA fase ajusta el marcaje, no corta', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'B1', equipo: 'B' }],
    balones: [],
    fases: [{
      duracion_ms: 800, defensores: ['B1'],
      movimientos: [{ elemento_id: 'B1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.base, P.tiro_libre) }],
    }],
  });
  contiene(g.fases[0].lineas[0], 'ajusta el marcaje');
});

test('el movimiento del BALÓN no se narra dos veces', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [{
      duracion_ms: 500,
      movimientos: [
        { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: camino(P.base, P.codo_der) },
        { elemento_id: 'b1', tipo_elemento: 'balon', tipo_movimiento: 'carrera_con_balon', path: camino(P.base, P.codo_der) },
      ],
    }],
  });
  eq(g.fases[0].lineas.length, 1);
});

console.log('· guionDeAnimacion · castellano');

test('"a el" se contrae en "al" y los nombres propios no contraen', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A', nombre: 'Marcos' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [{ duracion_ms: 450, pases: [{ de_id: 'A1', a_id: 'A5', balon_id: 'b1', path: camino(P.base, P.codo_der) }] }],
  });
  contiene(g.fases[0].lineas[0], 'pasa a Marcos');
  noContiene(g.fases[0].lineas[0], 'a el');
});

test('el nombre propio manda sobre el dorsal', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A', dorsal: 7, nombre: 'Nadia' }],
    balones: [],
    fases: [{ duracion_ms: 600, movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.base, P.aro) }] }],
  });
  eq(g.fases[0].lineas, ['Nadia corta hacia el aro']);
});

test('dos jugadores con el MISMO número se desambiguan por equipo', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'B1', equipo: 'B' }],
    balones: [],
    fases: [{
      duracion_ms: 600,
      movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.base, P.aro) }],
    }],
  });
  eq(g.fases[0].lineas, ['El 1 del equipo 1 corta hacia el aro']);
});

test('sin choque de números NO se cuela el equipo (ruido innecesario)', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'B2', equipo: 'B' }],
    balones: [],
    fases: [{
      duracion_ms: 600,
      movimientos: [{ elemento_id: 'B2', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: camino(P.base, P.aro) }],
    }],
  });
  eq(g.fases[0].lineas, ['El 2 corta hacia el aro']);
});

test('sin zona reconocible se calla el destino en vez de inventarlo', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }],
    balones: [],
    fases: [{
      duracion_ms: 600,
      movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: [pt([0.5, 0.5]), pt([0.2, 0.75])] }],
    }],
  });
  eq(g.fases[0].lineas, ['El 1 corta']);
});

console.log('· guionDeAnimacion · robustez');

test('un pase sin de_id (animación editada a mano) se narra en pasiva', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [{ duracion_ms: 450, pases: [{ a_id: 'A5', balon_id: 'b1', path: camino(P.base, P.codo_der) }] }],
  });
  contiene(g.fases[0].lineas[0], 'El balón va al 5');
});

test('un id que no existe en la plantilla no rompe el guion', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [{ duracion_ms: 450, pases: [{ de_id: 'A1', a_id: 'FANTASMA', balon_id: 'b1', path: camino(P.base, P.codo_der) }] }],
  });
  contiene(g.fases[0].lineas[0], 'a otro jugador');
});

test('el mismo guion dos veces da EXACTAMENTE lo mismo (determinista)', () => {
  const anim = {
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [
      { duracion_ms: 800, bloqueos: [{ bloqueador_id: 'A5', bloqueado_id: 'A1' }], movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: camino(P.base, P.codo_der) }] },
    ],
  };
  eq(guionDeAnimacion(anim), guionDeAnimacion(anim));
});

test('el bloqueo se cuenta antes que el movimiento que lo aprovecha', () => {
  const g = guionDeAnimacion({
    pista: 'entera',
    jugadores: [{ id: 'A1', equipo: 'A' }, { id: 'A5', equipo: 'A' }],
    balones: [{ id: 'b1', portador_id: 'A1' }],
    fases: [{
      duracion_ms: 800,
      bloqueos: [{ bloqueador_id: 'A5', bloqueado_id: 'A1' }],
      movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: camino(P.base, P.codo_der) }],
    }],
  });
  eq(g.fases[0].lineas, ['El 5 bloquea para el 1', 'El 1 bota hacia el codo derecho']);
});

test('la duración suma movimiento + pausa de cada fase', () => {
  const g = guionDeAnimacion({
    pista: 'entera', jugadores: [], balones: [],
    fases: [{ duracion_ms: 900, pausa_post_ms: 300 }, { duracion_ms: 700, pausa_post_ms: 100 }],
  });
  eq(g.resumen.duracionSeg, 2);
  eq(g.fases[0].ms, 1200);
});

console.log('· resumenMaterial');

test('singular y plural, y lo que vale cero no se escribe', () => {
  eq(resumenMaterial({ jugadores: 1, balones: 1, conos: 0, filas: 2 }), '1 jugador · 1 balón · 2 filas');
  eq(resumenMaterial({ jugadores: 5, balones: 3, conos: 4, filas: 0 }), '5 jugadores · 3 balones · 4 conos');
  eq(resumenMaterial(null), '');
});

console.log(`\n${pasan} pasan · ${fallan} fallan`);
process.exit(fallan ? 1 : 0);
