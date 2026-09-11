/* ============================================================
   eval-compilar.mjs — banco Node del paso de la jugada a la
   animación (taller/js/pizarra/motor/compilar.js). Sin red, sin DOM.

     node taller/tools/eval-compilar.mjs

   Lo que más se vigila aquí no es que salga un JSON bonito, sino que
   lo que sale lo ENTIENDA EL MOTOR DE HOY: el proyector, las
   miniaturas y el visor de Equipos leen este formato, y si el
   compilador escribe algo que ellos no saben leer, el ejercicio se
   guarda bien y se ve mal en todas partes a la vez.

   Por eso las últimas pruebas cargan la animación en el
   `AnimationEngine` DE VERDAD, con una vista sin DOM, y miran dónde
   está cada uno al empezar y al acabar.
   ============================================================ */

import {
  VERSION_JUGADA, PAUSA_POR_DEFECTO_MS, RECOGIDA_FRACCION, compilar, esDeLaPizarra,
} from '../js/pizarra/motor/compilar.js';
import { MOTOR_PIZARRA, soloColocacion, paraVer, perdioLaAnimacion } from '../js/pizarra/motor/marca.js';
import { anadir, asignarBalon, reiniciarIds } from '../js/pizarra/elementos.js';
import { nuevoTrazo } from '../js/pizarra/trazo.js';
import { carrilesDesde, tiemposDe } from '../js/pizarra/fases.js';
import { AnimationEngine } from '../js/canvas/engine.js';
import { CATALOGO_SISTEMA } from '../js/ia/acciones.js';

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
const cerca = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
const simbolo = (slug) => CATALOGO_SISTEMA.find((a) => a.slug === slug).simbolo;

/* Una escena como las que monta la Pizarra: A1 con balón, A2, B1. */
function escena() {
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.30, 0.80);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.70, 0.80);
  l = anadir(l, { kind: 'jugador', equipo: 'B' }, 0.50, 0.40);
  l = anadir(l, { kind: 'balon' }, 0.34, 0.80);
  const [a1, a2, b1, bal] = l;
  l = asignarBalon(l, bal.id, a1.id, 'entera');
  return { l, a1, a2, b1, bal: l.find((e) => e.id === bal.id) };
}

let n = 0;
const tramo = (elemento, desde, hasta, extra = {}) => ({
  id: `tr${++n}`,
  elemento_id: elemento,
  corre_id: extra.corre_id || elemento,
  receptor_id: extra.receptor_id || null,
  balon_id: extra.balon_id || null,
  accion: extra.accion || 'corta',
  variante: extra.variante || null,
  trazo: nuevoTrazo(desde, hasta),
  tipo: extra.tipo || 'cut',
  ritmo: extra.ritmo || 'normal',
  inicio_ms: null, duracion_ms: null, manual: false,
});
const jugadaCon = (l, fases) => ({ version: 3, pista: 'entera', canasta: 'norte', elementos: l, fases });
const P = (x, y) => ({ x, y });

/* ── 1. La escena ────────────────────────────────────────── */

test('SALE EL FORMATO QUE YA LEE EL MOTOR', () => {
  const { l } = escena();
  const a = compilar(jugadaCon(l, []));
  for (const k of ['pista', 'jugadores', 'balones', 'conos', 'materiales', 'fases', 'warnings']) {
    ok(k in a, `falta «${k}»`);
  }
  eq(a.pista, 'entera');
  eq(a.canasta, 'norte');
});

test('LOS JUGADORES SE LLAMAN A1, A2, B1 — nunca como por dentro', () => {
  /* El motor saca el número que pinta del propio nombre: con el id
     interno, el proyector pintaría un 7 donde el entrenador ve un 1. */
  const { l } = escena();
  const a = compilar(jugadaCon(l, []));
  eq(a.jugadores.map((j) => j.id), ['A1', 'A2', 'B1']);
  ok(!JSON.stringify(a).includes('jugador_'), 'se ha colado un id interno en la animación');
});

test('quién tiene el balón al empezar, en los dos sitios donde se mira', () => {
  const { l, bal } = escena();
  const a = compilar(jugadaCon(l, []));
  eq(a.jugadores.map((j) => j.tiene_balon), [true, false, false]);
  eq(a.balones[0].id, bal.id);
  eq(a.balones[0].portador_id, 'A1', 'el portador, con su nombre de fuera:');
});

test('las posiciones de arranque salen como pares [x, y]', () => {
  const { l } = escena();
  const a = compilar(jugadaCon(l, []));
  eq(a.jugadores[0].posicion_inicial, [0.30, 0.80]);
});

test('conos y material son parte de la escena, quietos', () => {
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'cono' }, 0.2, 0.2);
  l = anadir(l, { kind: 'escalera' }, 0.5, 0.5);
  l = anadir(l, { kind: 'pelota' }, 0.8, 0.8);
  const a = compilar(jugadaCon(l, []));
  eq(a.conos.length, 1);
  eq(a.conos[0].posicion, [0.2, 0.2]);
  eq(a.materiales.map((m) => m.tipo), ['escalera', 'pelota']);
});

/* ── 2. Lo que hace cada tramo ───────────────────────────── */

test('UN CORTE ES UN MOVIMIENTO, con el símbolo del catálogo', () => {
  const { l, a2 } = escena();
  const t = tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3));
  const f = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0];
  eq(f.movimientos.length, 1);
  const m = f.movimientos[0];
  eq(m.elemento_id, 'A2');
  eq(m.tipo_elemento, 'jugador');
  eq(m.tipo_movimiento, simbolo('corta'), 'el mismo símbolo que dibuja la flecha:');
  eq(m.path, t.trazo);
});

test('UN PASE ES UN PASE: viaja el balón, el que pasa no se mueve', () => {
  const { l, a1, a2, bal } = escena();
  const t = tramo(a1.id, P(0.3, 0.8), P(0.7, 0.8), { accion: 'pasa', corre_id: bal.id, receptor_id: a2.id, ritmo: 'pase', tipo: 'pass' });
  const f = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0];
  eq(f.movimientos, [], 'el pasador no tiene movimiento:');
  eq(f.pases.length, 1);
  eq([f.pases[0].de_id, f.pases[0].a_id, f.pases[0].balon_id], ['A1', 'A2', bal.id]);
});

test('un pase AL SUELO no tiene receptor', () => {
  const { l, a1, bal } = escena();
  const t = tramo(a1.id, P(0.3, 0.8), P(0.5, 0.5), { accion: 'pasa', corre_id: bal.id, ritmo: 'pase' });
  eq(compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0].pases[0].a_id, null);
});

test('RECOGER: va el jugador, el balón hace el último trozo y cambia de dueño', () => {
  const { l, a2, bal } = escena();
  const t = tramo(a2.id, P(0.7, 0.8), P(0.5, 0.3), { accion: 'recoge', balon_id: bal.id });
  const f = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0];
  const delJugador = f.movimientos.find((m) => m.tipo_elemento === 'jugador');
  const delBalon = f.movimientos.find((m) => m.tipo_elemento === 'balon');
  ok(delJugador && delJugador.elemento_id === 'A2', 'va el jugador');
  ok(delBalon && delBalon.elemento_id === bal.id, 'y el balón llega a sus manos');
  ok(cerca(delBalon.inicio_ms + delBalon.duracion_ms, delJugador.inicio_ms + delJugador.duracion_ms, 1e-6),
    'el balón llega justo cuando llega él');
  ok(cerca(delBalon.duracion_ms, delJugador.duracion_ms * RECOGIDA_FRACCION, 1e-6), 'en el último cuarto de la carrera');
  eq(f.recogidas, [{ jugador_id: 'A2', balon_id: bal.id }]);
});

test('EL BALÓN QUE SE RECOGE VIAJA DESDE EL SUELO, no aparece en las manos', () => {
  /* El Tablero apunta dónde estaba el balón al dibujar el tramo; es lo
     único que se sabe seguro. */
  const { l, a2, bal } = escena();
  const t = { ...tramo(a2.id, P(0.7, 0.8), P(0.5, 0.3), { accion: 'recoge', balon_id: bal.id }), balon_desde: P(0.52, 0.27) };
  const delBalon = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0].movimientos.find((m) => m.tipo_elemento === 'balon');
  eq([delBalon.path[0].x, delBalon.path[0].y], [0.52, 0.27], 'sale de donde estaba:');
  eq([delBalon.path[1].x, delBalon.path[1].y], [0.5, 0.3], 'y llega a donde acaba el jugador:');
});

test('y sin saber dónde estaba, se queda en sus manos en vez de inventarlo', () => {
  const { l, a2, bal } = escena();
  const t = tramo(a2.id, P(0.7, 0.8), P(0.5, 0.3), { accion: 'recoge', balon_id: bal.id });
  const delBalon = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0].movimientos.find((m) => m.tipo_elemento === 'balon');
  eq([delBalon.path[0].x, delBalon.path[0].y], [0.5, 0.3]);
  eq([delBalon.path[1].x, delBalon.path[1].y], [0.5, 0.3]);
});

/* ── 3. Los tiempos (§11.2) ──────────────────────────────── */

test('CADA MOVIMIENTO LLEVA SU ARRANQUE Y SU DURACIÓN: los del §6.3', () => {
  /* El receptor espera a que llegue el balón. Es lo que el motor nuevo
     leerá; el de hoy lo ignora sin romperse. */
  const { l, a1, a2, bal } = escena();
  const pase = tramo(a1.id, P(0.3, 0.8), P(0.7, 0.8), { accion: 'pasa', corre_id: bal.id, receptor_id: a2.id, ritmo: 'pase' });
  const corre = tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3), { accion: 'bota' });
  const f = compilar(jugadaCon(l, [{ id: 'f1', tramos: [pase, corre] }])).fases[0];
  eq(f.pases[0].inicio_ms, 0, 'el pase sale ya:');
  eq(f.movimientos[0].inicio_ms, f.pases[0].inicio_ms + f.pases[0].duracion_ms, 'y el receptor cuando llega:');
});

test('la fase dura lo que dicen los carriles, y la pausa es la de siempre', () => {
  const { l, a2 } = escena();
  const t = tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3));
  const fase = { id: 'f1', tramos: [t] };
  const esperado = tiemposDe({ ...fase, carriles: carrilesDesde(fase.tramos) }, { pista: 'entera' }).duracion_ms;
  const f = compilar(jugadaCon(l, [fase])).fases[0];
  eq(f.duracion_ms, esperado);
  eq(f.pausa_post_ms, PAUSA_POR_DEFECTO_MS);
  eq(compilar(jugadaCon(l, [{ ...fase, pausa_post_ms: 900 }])).fases[0].pausa_post_ms, 900, 'y la puesta a mano manda:');
});

test('acciones y variantes de cada fase, sin repetir y en orden', () => {
  const { l, a1, a2 } = escena();
  const f = compilar(jugadaCon(l, [{ id: 'f1', tramos: [
    tramo(a2.id, P(0.7, 0.8), P(0.7, 0.6), { variante: 'recto' }),
    tramo(a1.id, P(0.3, 0.8), P(0.3, 0.6), { accion: 'bota', variante: 'normal' }),
    tramo(a2.id, P(0.7, 0.6), P(0.7, 0.4), { variante: 'recto' }),
  ] }])).fases[0];
  eq(f.acciones, ['corta', 'bota']);
  eq(f.variantes, [{ accion: 'corta', variante: 'recto' }, { accion: 'bota', variante: 'normal' }]);
});

/* ── 4. Lo que no se compila, dicho ──────────────────────── */

test('UN TRAMO SIN PROTAGONISTA NO SE COMPILA, pero se avisa', () => {
  const { l } = escena();
  const a = compilar(jugadaCon(l, [{ id: 'f1', tramos: [tramo('jugador_99', P(0.1, 0.1), P(0.2, 0.2))] }]));
  eq(a.fases[0].movimientos, []);
  ok(a.warnings.some((w) => /protagonista/.test(w)), 'tiene que decirlo');
});

test('una acción que no está en el catálogo no se inventa', () => {
  const { l, a2 } = escena();
  const a = compilar(jugadaCon(l, [{ id: 'f1', tramos: [tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3), { accion: 'vuela' })] }]));
  eq(a.fases[0].movimientos, []);
  ok(a.warnings.some((w) => /catálogo/.test(w)));
});

test('las zonas todavía no salen, y lo dice', () => {
  reiniciarIds();
  const a = compilar(jugadaCon([{ id: 'zona_1', kind: 'zona', x: 0.5, y: 0.5 }], []));
  ok(a.warnings.some((w) => /zonas/i.test(w)));
});

test('no toca la jugada que recibe', () => {
  const { l, a2 } = escena();
  const j = jugadaCon(l, [{ id: 'f1', tramos: [tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3))] }]);
  const copia = JSON.parse(JSON.stringify(j));
  compilar(j);
  eq(j, copia, 'la jugada ha cambiado:');
});

test('una jugada vacía da una animación vacía y válida', () => {
  const a = compilar({});
  eq(a.fases, []);
  eq(a.jugadores, []);
  eq(a.pista, 'entera');
  eq(compilar(null).fases, []);
  eq(VERSION_JUGADA, 3);
});

/* ── 5. Y EL MOTOR DE HOY LO ENTIENDE ─────────────────────── */

/* La vista sin DOM que ya usa eval-animacion.mjs: con w = 0 el motor no
   pinta nada, y sin autoplay no arranca el reloj. */
const vistaMuda = () => ({ w: 0, basket: () => [0.5, 0.1] });
function enElMotor(animacion) {
  return new AnimationEngine(vistaMuda(), animacion, { autoplay: false, loop: false, paused: true });
}
function enElInstante(motor, k, ms) {
  motor.k = k; motor.phaseElapsed = ms;
  return motor._computePositions();
}

test('EL MOTOR REAL LA CARGA Y AL EMPEZAR CADA UNO ESTÁ EN SU SITIO', () => {
  const { l, a1, a2, bal } = escena();
  const j = jugadaCon(l, [{ id: 'f1', tramos: [
    tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3)),
    tramo(a1.id, P(0.3, 0.8), P(0.3, 0.5), { accion: 'bota', variante: 'normal' }),
  ] }]);
  const motor = enElMotor(compilar(j));
  eq(motor.phaseCount, 1);
  const f = enElInstante(motor, 0, 0);
  ok(cerca(f.players.A1.x, 0.30) && cerca(f.players.A1.y, 0.80), `A1 al empezar: ${JSON.stringify(f.players.A1)}`);
  ok(cerca(f.players.A2.y, 0.80), 'A2 al empezar');
  ok(cerca(f.players.B1.y, 0.40), 'y B1, que no hace nada, donde está');
  ok(f.balls[bal.id], 'el balón está');
});

test('Y AL ACABAR LA FASE, CADA UNO EN LA PUNTA DE SU TRAZO', () => {
  const { l, a1, a2 } = escena();
  const j = jugadaCon(l, [{ id: 'f1', tramos: [
    tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3)),
    tramo(a1.id, P(0.3, 0.8), P(0.3, 0.5), { accion: 'bota' }),
  ] }]);
  const motor = enElMotor(compilar(j));
  const f = enElInstante(motor, 0, motor.fases[0].duracion_ms);
  ok(cerca(f.players.A2.y, 0.30, 1e-6), `A2 en su punta: ${f.players.A2.y}`);
  ok(cerca(f.players.A1.y, 0.50, 1e-6), `A1 en la suya: ${f.players.A1.y}`);
});

test('TRAS UN PASE, EL BALÓN ES DEL RECEPTOR EN LA FASE SIGUIENTE', () => {
  /* El motor sigue el cambio de dueño con `a_id`: en la fase 2 el balón
     tiene que ir pegado a A2, no quedarse donde cayó. */
  const { l, a1, a2, bal } = escena();
  const j = jugadaCon(l, [
    { id: 'f1', tramos: [tramo(a1.id, P(0.3, 0.8), P(0.7, 0.8), { accion: 'pasa', corre_id: bal.id, receptor_id: a2.id, ritmo: 'pase' })] },
    { id: 'f2', tramos: [tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3), { accion: 'bota' })] },
  ]);
  const motor = enElMotor(compilar(j));
  eq(motor.phaseCount, 2);
  const fin = enElInstante(motor, 1, motor.fases[1].duracion_ms);
  ok(cerca(fin.players.A2.y, 0.30, 1e-6), 'A2 ha botado hasta su punta');
  ok(Math.abs(fin.balls[bal.id].y - 0.30) < 0.03, `y el balón va con él: ${JSON.stringify(fin.balls[bal.id])}`);
});

test('SIN FASES, EL MOTOR ENSEÑA LA COLOCACIÓN, no a todos en el centro', () => {
  /* Una colocación sin trazos se compila sin fases. El motor caía al
     valor de reserva de su cálculo y los pintaba a todos en el centro de
     la pista, uno encima de otro. */
  const { l } = escena();
  const anim = compilar(jugadaCon(l, []));
  eq(anim.fases, []);
  const motor = enElMotor(anim);
  eq(motor.phaseCount, 0);
  const f = enElInstante(motor, 0, 0);
  for (const j of anim.jugadores) {
    ok(cerca(f.players[j.id].x, j.posicion_inicial[0], 1e-9) && cerca(f.players[j.id].y, j.posicion_inicial[1], 1e-9),
      `${j.id} tiene que estar en ${j.posicion_inicial}: ${JSON.stringify(f.players[j.id])}`);
  }
  for (const b of anim.balones) {
    const p = f.balls[b.id];
    ok(p && Number.isFinite(p.x), `el balón ${b.id} tiene que estar`);
    ok(!(cerca(p.x, 0.5, 1e-9) && cerca(p.y, 0.5, 1e-9)), `y no en el centro: ${JSON.stringify(p)}`);
  }
});

/* ── 6. Lo nuevo y lo de antes (§11.4) ───────────────────── */

test('LA ANIMACIÓN LLEVA LA MARCA DE LA PIZARRA, y la de antes no', () => {
  const { l } = escena();
  ok(esDeLaPizarra(compilar(jugadaCon(l, []))), 'lo compilado tiene que llevarla');
  ok(!esDeLaPizarra({ pista: 'entera', jugadores: [], balones: [], conos: [], fases: [] }), 'una del motor viejo no la lleva');
  for (const v of [null, undefined, 'x', 3, { motor: 2 }]) ok(!esDeLaPizarra(v), `${JSON.stringify(v)} no es de la Pizarra`);
});

test('UNA FASE SIN NADA DIBUJADO NO SE COMPILA, y las demás conservan su nombre', () => {
  /* La que abre «Siguiente fase» está vacía hasta que se dibuja en ella:
     compilada, era una pausa muda al final de cada vuelta. */
  const { l } = escena();
  const quien = l.find((e) => e.kind === 'jugador');
  const corte = {
    id: 'tz', elemento_id: quien.id, corre_id: quien.id, accion: 'corta', variante: null,
    trazo: nuevoTrazo({ x: quien.x, y: quien.y }, { x: quien.x, y: quien.y - 0.1 }), tipo: 'run', ritmo: 'normal',
  };
  const j = jugadaCon(l, []);
  j.fases = [{ id: 'f1', tramos: [] }, { id: 'f2', tramos: [corte] }, { id: 'f3', tramos: [] }];
  const a = compilar(j);
  eq(a.fases.map((f) => f.id), ['f2']);
  eq(a.fases[0].movimientos.length, 1, 'y la que tiene algo, entera:');
  eq(j.fases.length, 3, 'la jugada no se toca:');
});

test('una jugada sin nada dibujado es una colocación: sin fases, y con la escena', () => {
  const { l } = escena();
  const a = compilar(jugadaCon(l, []));
  eq(a.fases, []);
  ok(a.jugadores.length > 0, 'la colocación tiene que salir');
});

test('LO DE ANTES SE VE QUIETO: la colocación sí, las fases y las rondas no', () => {
  const vieja = {
    pista: 'entera', rondas: 3,
    jugadores: [{ id: 'A1', posicion_inicial: [0.3, 0.7] }], balones: [], conos: [],
    fases: [{ id: 'f1', movimientos: [{ elemento_id: 'A1' }] }],
  };
  const v = paraVer(vieja);
  eq(v.fases, []);
  eq(v.jugadores, vieja.jugadores, 'la colocación, entera:');
  ok(!('rondas' in v), 'sin rondas que repetir');
  eq(vieja.fases.length, 1, 'y la guardada no se toca:');
  eq(vieja.rondas, 3);
});

test('LO DE LA PIZARRA SE VE ENTERO, tal cual', () => {
  const { l } = escena();
  const a = compilar(jugadaCon(l, []));
  ok(paraVer(a) === a, 'la misma animación, sin copiarla');
  eq(a.motor, MOTOR_PIZARRA);
});

test('SOLO SE AVISA DE LO QUE SE MOVÍA: lo de antes sin fases no ha perdido nada', () => {
  ok(perdioLaAnimacion({ jugadores: [], fases: [{}] }), 'lo de antes que se movía');
  ok(!perdioLaAnimacion({ jugadores: [], fases: [] }), 'lo de antes quieto');
  const { l } = escena();
  ok(!perdioLaAnimacion(compilar(jugadaCon(l, []))), 'lo de la Pizarra');
  for (const v of [null, undefined, 'x', 3]) {
    ok(!perdioLaAnimacion(v), `${JSON.stringify(v)}`);
    eq(soloColocacion(v), v ?? null, `soloColocacion(${JSON.stringify(v)}):`);
  }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
