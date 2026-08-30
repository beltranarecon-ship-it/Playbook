/* ============================================================
   eval-marco-lectura.mjs — banco del adaptador que recoloca las
   fichas guardadas en un dibujo anterior de la pista.
   (taller/js/canvas/marco-lectura.js). Sin red, sin DOM.

     node taller/tools/eval-marco-lectura.mjs

   ── QUÉ ESTÁ EN JUEGO ───────────────────────────────────────
   Las coordenadas de una ficha son NORMALIZADAS. Al pasar a las pistas
   dibujadas a mano, el lienzo de la entera cambió de 19 × 32 m a
   18 × 27, y el mismo número pasó a señalar otro sitio: medido, 2,55 m
   en el centro del campo y 2,66 en la banda. Un jugador entero de
   distancia.

   Este módulo lo corrige AL LEER, sin tocar la base. Lo que hay que
   vigilar es lo de siempre en un remapeo:

     1. Que no toque lo que ya está bien. Recolocar dos veces una ficha
        es moverla el doble y no hay vuelta atrás.
     2. Que no se deje nada. Un cono sin convertir aparece suelto en
        mitad de la pista, y eso no lo avisa nadie.
     3. Que no toque números que no son sitios: duraciones, grados,
        dorsales.
   ============================================================ */

import { alMarcoActual, mapaDe, MARCO_ACTUAL } from '../js/canvas/marco-lectura.js';
import { limitesCancha } from '../js/canvas/medidas.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  if (JSON.stringify(real) !== JSON.stringify(esp)) {
    throw new Error(`${msg} esperado=${JSON.stringify(esp)} real=${JSON.stringify(real)}`);
  }
};
const cerca = (a, b, tol = 1e-4) => Math.abs(a - b) <= tol;

const LIM = (pista) => limitesCancha(pista);

/** Una ficha como las que hay guardadas: de todo y en todas partes. */
const ficha = (pista = 'entera') => ({
  pista,
  jugadores: [
    { id: 'A1', equipo: 'A', posicion_inicial: [0.5, 0.5], dorsal: 4 },
    { id: 'A2', equipo: 'A', posicion_inicial: [0.9, 0.2], dorsal: 7 },
  ],
  balones: [{ id: 'b1', posicion_inicial: [0.5, 0.5], portador_id: null }],
  conos: [{ id: 'c1', posicion: [0.1, 0.8], funcion: 'rodear', fila_config: null }],
  fases: [{
    duracion_ms: 1500, pausa_post_ms: 400,
    movimientos: [{
      elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte',
      path: [
        { x: 0.5, y: 0.5, tipo_nodo: 'lineal' },
        { x: 0.6, y: 0.3, tipo_nodo: 'bezier', handle_in: { x: 0.55, y: 0.4 }, handle_out: { x: 0.65, y: 0.25 } },
      ],
    }],
    pases: [{ de_id: 'A1', a_id: 'A2', balon_id: 'b1', duracion_ms: 450, path: [{ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.2 }] }],
  }],
  _elementos: [
    { kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.5, dorsal: 4 },
    { kind: 'cono', id: 'c1', x: 0.1, y: 0.8, funcion: 'rodear', fila_config: { n_jugadores: 4, direccion_grados: 90 } },
  ],
});

console.log('\n· no se toca lo que no hay que tocar');

test('sin marco declarado, NADA se mueve', () => {
  /* Sin la columna de la 038 no se puede distinguir una ficha vieja de
     una nueva, y recolocar una que ya estaba bien es peor que dejarla:
     se mueve el doble y no se vuelve. */
  for (const m of [undefined, null, NaN, 'dos', {}]) {
    const original = ficha();
    const r = alMarcoActual(original, m, LIM('entera'));
    eq(r.movidas, 0, `marco=${JSON.stringify(m)}:`);
    eq(r.animacion, original, 'ha devuelto algo distinto');
  }
});

test('una ficha que YA está en el marco de ahora no se toca', () => {
  const r = alMarcoActual(ficha(), MARCO_ACTUAL, LIM('entera'));
  eq(r.movidas, 0);
});

test('una pista desconocida se deja como está', () => {
  const f = ficha('trapecio');
  const r = alMarcoActual(f, 2, LIM('entera'));
  eq(r.movidas, 0);
});

test('una animación vacía o rara no revienta', () => {
  for (const v of [null, undefined, {}, [], 'texto', 42]) {
    const r = alMarcoActual(v, 2, LIM('entera'));
    eq(r.movidas, 0, JSON.stringify(v));
  }
});

console.log('\n· lo que sí se recoloca');

test('el original no se modifica: se devuelve una copia', () => {
  /* Si se tocara en sitio, un re-render volvería a convertir la misma
     ficha y la movería otra vez. */
  const f = ficha();
  alMarcoActual(f, 2, LIM('entera'));
  eq(f.jugadores[0].posicion_inicial, [0.5, 0.5], 'ha tocado el original:');
});

test('llega a jugadores, balones, conos, nodos, tiradores y al tablero', () => {
  /* ── OJO CON EL CENTRO ────────────────────────────────────
     (0,5, 0,5) se convierte en (0,5, 0,5), y está BIEN: los dos
     lienzos son simétricos y la cancha está centrada, así que el
     centro del dibujo sigue siendo el centro. Lo que cambia sin
     convertir no es el número, son los METROS que representa.

     Por eso aquí se miran los puntos DESCENTRADOS, que son los que
     tienen que moverse, y se cuenta cuántos sitios se han tocado. */
  const r = alMarcoActual(ficha(), 2, LIM('entera'));
  const a = r.animacion;
  ok(r.movidas >= 10, `solo ha movido ${r.movidas} sitios`);
  ok(a.jugadores[1].posicion_inicial[1] !== 0.2, 'el jugador descentrado no se ha movido');
  ok(a.conos[0].posicion[1] !== 0.8, 'el cono no se ha movido');
  ok(a.fases[0].movimientos[0].path[1].y !== 0.3, 'el nodo no se ha movido');
  ok(a.fases[0].movimientos[0].path[1].handle_in.y !== 0.4, 'el tirador no se ha movido');
  ok(a.fases[0].pases[0].path[1].y !== 0.2, 'el nodo del pase no se ha movido');
  ok(a._elementos[1].y !== 0.8, 'el tablero no se ha movido');
});

test('un punto se queda donde estaba RESPECTO A LAS LÍNEAS', () => {
  /* La propiedad que de verdad importa, y la única forma honesta de
     comprobar el mapa: un jugador que estaba a un tercio del campo
     desde el fondo tiene que seguir a un tercio, aunque el número
     normalizado cambie y aunque el campo mida menos metros. */
  const L2 = { x: [2 / 19, 17 / 19], y: [2 / 32, 30 / 32] };
  const n = LIM('entera');
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const antes = { x: L2.x[0] + t * (L2.x[1] - L2.x[0]), y: L2.y[0] + t * (L2.y[1] - L2.y[0]) };
    const f = ficha();
    f.jugadores = [{ id: 'A1', equipo: 'A', posicion_inicial: [antes.x, antes.y] }];
    const [x, y] = alMarcoActual(f, 2, LIM('entera')).animacion.jugadores[0].posicion_inicial;
    const tx = (x - n.x[0]) / (n.x[1] - n.x[0]);
    const ty = (y - n.y[0]) / (n.y[1] - n.y[0]);
    ok(cerca(tx, t, 5e-4), `a ${t} del ancho acaba en ${tx.toFixed(4)}`);
    ok(cerca(ty, t, 5e-4), `a ${t} del largo acaba en ${ty.toFixed(4)}`);
  }
});

test('NO toca lo que no es un sitio', () => {
  const r = alMarcoActual(ficha(), 2, LIM('entera'));
  const a = r.animacion;
  eq(a.fases[0].duracion_ms, 1500, 'ha tocado la duración:');
  eq(a.fases[0].pausa_post_ms, 400);
  eq(a.fases[0].pases[0].duracion_ms, 450);
  eq(a.jugadores[0].dorsal, 4, 'ha tocado el dorsal:');
  eq(a._elementos[1].fila_config.direccion_grados, 90, 'ha tocado los grados:');
  eq(a._elementos[1].fila_config.n_jugadores, 4);
  eq(a.jugadores[0].id, 'A1');
});

console.log('\n· el mapa lleva las líneas a las líneas');

test('las bandas y los fondos caen donde deben', () => {
  /* Es el criterio del mapa: los LÍMITES DEL CAMPO se respetan, que es
     lo que estaba mirando quien colocó cada cono. */
  for (const pista of ['entera', 'entera_fiba', 'media', 'media_fiba']) {
    const f = mapaDe(pista, LIM(pista));
    ok(f, `${pista}: sin mapa`);
    const n = LIM(pista);
    const viejo = pista.startsWith('entera')
      ? { x: [2 / 19, 17 / 19], y: [2 / 32, 30 / 32] }
      : { x: [2 / 18, 16 / 18], y: [2 / 19, 17 / 19] };
    for (const eje of ['x', 'y']) {
      ok(cerca(f[eje](viejo[eje][0]), n[eje][0]), `${pista}.${eje} inicio`);
      ok(cerca(f[eje](viejo[eje][1]), n[eje][1]), `${pista}.${eje} final`);
      // y el medio se queda en el medio
      const medioV = (viejo[eje][0] + viejo[eje][1]) / 2;
      const medioN = (n[eje][0] + n[eje][1]) / 2;
      ok(cerca(f[eje](medioV), medioN), `${pista}.${eje} el centro no cae en el centro`);
    }
  }
});

test('nada se sale del lienzo', () => {
  const f = ficha();
  f.jugadores.push({ id: 'A3', equipo: 'A', posicion_inicial: [0.99, 0.01] });
  const r = alMarcoActual(f, 2, LIM('entera'));
  for (const j of r.animacion.jugadores) {
    const [x, y] = j.posicion_inicial;
    ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `${j.id} fuera: ${x}, ${y}`);
  }
});

console.log('\n· aplicarlo dos veces sería moverlo el doble');

test('convertir lo ya convertido cambia el resultado', () => {
  /* Por eso el marco se comprueba SIEMPRE y por eso, sin columna, no se
     toca nada: no hay forma de deshacerlo.

     Se mira un jugador DESCENTRADO: el del centro es punto fijo del
     mapa y con él esta prueba no probaría nada. */
  const una = alMarcoActual(ficha(), 2, LIM('entera')).animacion;
  const dos = alMarcoActual(una, 2, LIM('entera')).animacion;
  ok(JSON.stringify(una.jugadores[1].posicion_inicial)
    !== JSON.stringify(dos.jugadores[1].posicion_inicial),
    'sería idempotente y la columna sobraría');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
