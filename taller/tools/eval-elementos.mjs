/* ============================================================
   eval-elementos.mjs — banco Node del modelo de la pizarra y del
   acierto (taller/js/pizarra/elementos.js y seleccion.js).

     node taller/tools/eval-elementos.mjs

   Lo que más vigila son las dos reglas de las que cuelga todo lo
   demás:

   · Los DORSALES se renumeran contiguos por equipo, y quien no está en
     juego no lleva. La defensa se empareja por dorsal (§8.1): dos
     jugadores con el mismo número, o un suplente numerado, dejan al
     defensor sin saber a quién marcar.

   · El ACIERTO se mide en metros y gana el más cercano. Si ganara el
     último dibujado, coger «el de la izquierda» dependería del orden
     en que se colocaron, que nadie recuerda.
   ============================================================ */

import {
  EQUIPOS, crear, anadir, quitar, mover, renumerar, numeroDe,
  asignarBalon, soltarBalon, llevaBalon, seguirAlPortador, sitioDelBalon, SEPARACION_BALON,
  enJuego, jugadoresEnJuego, recuento, radioMetros, reiniciarIds,
} from '../js/pizarra/elementos.js';
import {
  acierto, aciertoZona, marcoDesde, enMarco, alPinchar, alMarcar,
} from '../js/pizarra/seleccion.js';
import { marcoDe } from '../js/canvas/medidas.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { reiniciarIds(); fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};

const jug = (equipo) => ({ kind: 'jugador', equipo });
const numeros = (l, equipo) => l.filter((e) => e.kind === 'jugador' && e.equipo === equipo).map(numeroDe);
const aLoAncho = (pista, p, m) => ({ x: p.x + m / marcoDe(pista).ancho, y: p.y });

/* ── 1. Dorsales ─────────────────────────────────────────── */

test('se numera 1..n por equipo, y cada equipo empieza por su 1', () => {
  let l = [];
  l = anadir(l, jug('A'), 0.1, 0.1);
  l = anadir(l, jug('A'), 0.2, 0.2);
  l = anadir(l, jug('B'), 0.3, 0.3);
  eq(numeros(l, 'A'), ['1', '2']);
  eq(numeros(l, 'B'), ['1']);
});

test('borrar del medio no deja huecos ni dos con el mismo número', () => {
  let l = [];
  for (let i = 0; i < 3; i++) l = anadir(l, jug('A'), 0.1 * i, 0.1);
  const segundo = l[1].id;
  l = quitar(l, segundo);
  l = anadir(l, jug('A'), 0.9, 0.9);
  eq(numeros(l, 'A'), ['1', '2', '3'], 'contiguos y sin repetir:');
  eq(new Set(numeros(l, 'A')).size, 3, 'no puede haber dos iguales');
});

test('NO hay tope de cinco por equipo', () => {
  let l = [];
  for (let i = 0; i < 9; i++) l = anadir(l, jug('A'), 0.05 * i, 0.1);
  eq(numeros(l, 'A').length, 9);
  eq(numeros(l, 'A')[8], '9');
});

test('quien no está en juego NO lleva dorsal, y los demás se recolocan', () => {
  let l = [];
  for (let i = 0; i < 3; i++) l = anadir(l, jug('A'), 0.1 * i, 0.1);
  l = enJuego(l, l[0].id, false);
  eq(numeroDe(l[0]), '', 'el que espera no lleva número:');
  eq([numeroDe(l[1]), numeroDe(l[2])], ['1', '2'], 'los que juegan se recolocan:');
  eq(jugadoresEnJuego(l).length, 2);
});

test('un dorsal puesto a mano manda y no se lo lleva la renumeración', () => {
  let l = anadir([], jug('A'), 0.1, 0.1);
  l = l.map((e) => ({ ...e, dorsal: '23' }));
  l = anadir(l, jug('A'), 0.2, 0.2);
  eq(numeroDe(l[0]), '23', 'el puesto a mano se respeta:');
  eq(numeroDe(l[1]), '2', 'y el automático sigue contando:');
});

test('los cuatro equipos existen y uno inventado cae en el primero', () => {
  eq(EQUIPOS, ['A', 'B', 'C', 'D']);
  eq(crear({ kind: 'jugador', equipo: 'Z' }).equipo, 'A');
});

/* ── 2. El balón ─────────────────────────────────────────── */

test('asignar un balón lo pone AL LADO del jugador, no encima', () => {
  let l = anadir([], jug('A'), 0.3, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.9, 0.9);
  const [j, b] = l;
  l = asignarBalon(l, b.id, j.id);
  const balon = l.find((e) => e.kind === 'balon');
  eq(balon.portador_id, j.id);
  eq([balon.x, balon.y], [sitioDelBalon(j).x, sitioDelBalon(j).y]);
  ok(balon.x !== j.x, 'centrado le robaría el clic al jugador');
  eq(llevaBalon(l, j.id), true);
});

test('el balón al lado NO le roba el centro al jugador, y al revés', () => {
  // es la razón entera de que vaya al lado: con los dos a distancia
  // cero, el balón —que se dibuja después— ganaba siempre el empate y
  // un jugador con balón no se podía arrastrar
  const P = 'entera';
  let l = anadir([], jug('A'), 0.4, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.9, 0.9);
  l = asignarBalon(l, l[1].id, l[0].id, P);
  const j = l[0], b = l.find((e) => e.kind === 'balon');
  eq(acierto(l, { x: j.x, y: j.y }, { pista: P }).id, j.id, 'en el centro del jugador gana el jugador:');
  eq(acierto(l, { x: b.x, y: b.y }, { pista: P }).id, b.id, 'en el centro del balón gana el balón:');
});

test('si el jugador está pegado al borde derecho, el balón va al otro lado', () => {
  const j = { x: 0.995, y: 0.5 };
  ok(sitioDelBalon(j, 'entera').x < j.x, 'no puede salirse del lienzo');
});

test('un jugador lleva como mucho UNO: el anterior se suelta, no desaparece', () => {
  let l = anadir([], jug('A'), 0.3, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.9, 0.9);
  l = anadir(l, { kind: 'balon' }, 0.8, 0.8);
  const j = l[0], b1 = l[1], b2 = l[2];
  l = asignarBalon(l, b1.id, j.id);
  l = asignarBalon(l, b2.id, j.id);
  const balones = l.filter((e) => e.kind === 'balon');
  eq(balones.length, 2, 'los dos siguen en la pizarra:');
  eq(balones.filter((b) => b.portador_id === j.id).length, 1, 'pero solo uno es suyo:');
  eq(balones.find((b) => b.id === b1.id).portador_id, null, 'el primero se ha soltado:');
});

test('el balón asignado sigue al jugador, conservando el costado', () => {
  let l = anadir([], jug('A'), 0.3, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.9, 0.9);
  l = asignarBalon(l, l[1].id, l[0].id);
  l = mover(l, { [l[0].id]: { x: 0.7, y: 0.2 } });
  l = seguirAlPortador(l);
  const b = l.find((e) => e.kind === 'balon');
  const esperado = sitioDelBalon({ x: 0.7, y: 0.2 });
  eq([b.x, b.y], [esperado.x, esperado.y]);
});

test('borrar al portador deja el balón suelto, no colgando de un fantasma', () => {
  let l = anadir([], jug('A'), 0.3, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.9, 0.9);
  l = asignarBalon(l, l[1].id, l[0].id);
  const sitio = sitioDelBalon(l[0]);
  l = quitar(l, l[0].id);
  const b = l.find((e) => e.kind === 'balon');
  eq(b.portador_id, null);
  eq([b.x, b.y], [sitio.x, sitio.y], 'se queda donde estaba, no vuelve al origen:');
});

test('la separación es la acordada y deja hueco entre los dos discos', () => {
  eq(SEPARACION_BALON, 0.75);
  ok(SEPARACION_BALON > radioMetros('jugador'),
    'tiene que salir del disco del jugador o vuelve el empate del acierto');
});

test('soltar el balón lo deja donde esté', () => {
  let l = anadir([], jug('A'), 0.3, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.9, 0.9);
  l = asignarBalon(l, l[1].id, l[0].id);
  l = soltarBalon(l, l[1].id);
  eq(llevaBalon(l, l[0].id), false);
});

/* ── 3. Nada se muta ─────────────────────────────────────── */

test('ninguna función toca la lista que recibe', () => {
  const l = anadir([], jug('A'), 0.3, 0.4);
  const copia = JSON.parse(JSON.stringify(l));
  anadir(l, jug('B'), 0.1, 0.1);
  quitar(l, l[0].id);
  mover(l, { [l[0].id]: { x: 0, y: 0 } });
  enJuego(l, l[0].id, false);
  eq(l, copia, 'la lista original ha cambiado:');
});

/* ── 4. El acierto ───────────────────────────────────────── */

test('se acierta dentro del radio del elemento y no fuera', () => {
  const P = 'entera';
  const l = [{ id: 'j1', kind: 'jugador', x: 0.5, y: 0.5 }];
  ok(acierto(l, { x: 0.5, y: 0.5 }, { pista: P }), 'en el centro:');
  ok(acierto(l, aLoAncho(P, { x: 0.5, y: 0.5 }, 0.6), { pista: P }), 'a 0,60 m (radio 0,65):');
  ok(!acierto(l, aLoAncho(P, { x: 0.5, y: 0.5 }, 0.8), { pista: P }), 'a 0,80 m ya no:');
});

test('el suelo del dedo agranda el acierto, pero nunca lo encoge', () => {
  const P = 'entera';
  const l = [{ id: 'p1', kind: 'pelota', x: 0.5, y: 0.5 }];   // radio 0,20 m
  ok(!acierto(l, aLoAncho(P, { x: 0.5, y: 0.5 }, 0.5), { pista: P }), 'sin suelo, a 0,50 m no llega:');
  ok(acierto(l, aLoAncho(P, { x: 0.5, y: 0.5 }, 0.5), { pista: P, minimoM: 0.9 }), 'con suelo de 0,90 m sí:');
  // y con un suelo menor que el radio real, manda el radio real
  const j = [{ id: 'j1', kind: 'jugador', x: 0.5, y: 0.5 }];
  ok(acierto(j, aLoAncho(P, { x: 0.5, y: 0.5 }, 0.6), { pista: P, minimoM: 0.1 }), 'el radio real sigue valiendo:');
});

test('gana el MÁS CERCANO, no el último dibujado', () => {
  const P = 'entera';
  const p = { x: 0.5, y: 0.5 };
  const l = [
    { id: 'cerca', kind: 'jugador', ...aLoAncho(P, p, 0.1) },
    { id: 'lejos', kind: 'jugador', ...aLoAncho(P, p, 0.5) },
  ];
  eq(acierto(l, p, { pista: P, minimoM: 1.5 }).id, 'cerca');
  eq(acierto([...l].reverse(), p, { pista: P, minimoM: 1.5 }).id, 'cerca', 'y da igual el orden:');
});

test('en empate exacto gana el de arriba', () => {
  const l = [
    { id: 'abajo', kind: 'jugador', x: 0.5, y: 0.5 },
    { id: 'arriba', kind: 'jugador', x: 0.5, y: 0.5 },
  ];
  eq(acierto(l, { x: 0.5, y: 0.5 }, { pista: 'entera' }).id, 'arriba');
});

test('lo que se arrastra no se acierta a sí mismo', () => {
  const l = [{ id: 'j1', kind: 'jugador', x: 0.5, y: 0.5 }];
  eq(acierto(l, { x: 0.5, y: 0.5 }, { pista: 'entera', excluir: ['j1'] }), null);
});

test('las zonas NO entran en el reparto de los clics', () => {
  const l = [{ id: 'z', kind: 'zona', tipo: 'rect', x: 0.1, y: 0.1, x2: 0.9, y2: 0.9 }];
  eq(acierto(l, { x: 0.5, y: 0.5 }, { pista: 'entera' }), null, 'por el camino normal, no:');
  eq(aciertoZona(l, { x: 0.5, y: 0.5 }, 'entera').id, 'z', 'por el suyo, sí:');
});

test('un punto imposible no rompe nada', () => {
  eq(acierto([{ id: 'a', kind: 'jugador', x: 0.5, y: 0.5 }], null, {}), null);
  eq(acierto([{ id: 'a', kind: 'jugador', x: 0.5, y: 0.5 }], { x: NaN, y: 0 }, {}), null);
});

test('los radios salen de las medidas de verdad', () => {
  eq(radioMetros('jugador'), 0.65);
  eq(radioMetros('balon'), 0.35);
  eq(radioMetros('cono'), 0.45);
});

/* ── 5. El marco ─────────────────────────────────────────── */

test('el marco se normaliza en cualquier dirección de arrastre', () => {
  eq(marcoDesde({ x: 0.8, y: 0.9 }, { x: 0.2, y: 0.1 }), { x0: 0.2, x1: 0.8, y0: 0.1, y1: 0.9 });
});

test('cae dentro lo que tiene el CENTRO dentro, no lo que se roza', () => {
  const l = [
    { id: 'dentro', kind: 'jugador', x: 0.5, y: 0.5 },
    { id: 'justo_fuera', kind: 'jugador', x: 0.61, y: 0.5 },
  ];
  eq(enMarco(l, { x0: 0.4, x1: 0.6, y0: 0.4, y1: 0.6 }), ['dentro']);
});

test('el marco no se lleva las zonas', () => {
  const l = [{ id: 'z', kind: 'zona', tipo: 'rect', x: 0.5, y: 0.5, x2: 0.6, y2: 0.6 }];
  eq(enMarco(l, { x0: 0, x1: 1, y0: 0, y1: 1 }), []);
});

/* ── 6. Cómo cambia la selección ─────────────────────────── */

test('sin Shift se sustituye; con Shift se suma y se resta', () => {
  eq([...alPinchar(new Set(['a', 'b']), 'c')], ['c']);
  eq([...alPinchar(new Set(['a']), 'b', { shift: true })].sort(), ['a', 'b']);
  eq([...alPinchar(new Set(['a', 'b']), 'a', { shift: true })], ['b'], 'volver a pinchar lo quita:');
});

test('pinchar el suelo deselecciona, salvo con Shift', () => {
  eq([...alPinchar(new Set(['a', 'b']), null)], []);
  eq([...alPinchar(new Set(['a', 'b']), null, { shift: true })].sort(), ['a', 'b']);
});

test('un marco con Shift suma a lo que ya había', () => {
  eq([...alMarcar(new Set(['a']), ['b', 'c'])].sort(), ['b', 'c']);
  eq([...alMarcar(new Set(['a']), ['b'], { shift: true })].sort(), ['a', 'b']);
});

/* ── 7. El recuento de la barra ──────────────────────────── */

test('el recuento no cuenta a los que esperan', () => {
  let l = [];
  for (let i = 0; i < 3; i++) l = anadir(l, jug('A'), 0.1 * i, 0.1);
  l = anadir(l, { kind: 'balon' }, 0.5, 0.5);
  l = anadir(l, { kind: 'cono' }, 0.6, 0.6);
  eq(recuento(l), { jugadores: 3, balones: 1, conos: 1, material: 0, zonas: 0 });
  l = enJuego(l, l[0].id, false);
  eq(recuento(l).jugadores, 2);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
