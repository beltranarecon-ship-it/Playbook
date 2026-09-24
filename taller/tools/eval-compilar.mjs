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
import { aroExacto } from '../js/canvas/anclas.js';
import { trasElTiro, frenteDelBloqueo } from '../js/pizarra/destino.js';
import { TRAS_EL_TIRO_MS } from '../js/pizarra/fases.js';
import { soloPrimeraRonda } from '../js/pizarra/motor/rondas.js';

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
/* Lo DIBUJADO por el entrenador. Desde el paso 5.5 la defensa se mueve
   sola y añade sus movimientos, marcados como automáticos: aquí se
   apartan, porque estas pruebas hablan de lo que se dibuja. */
const dibujados = (fase) => (fase.movimientos || []).filter((m) => !m.automatico);
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

test('EL PAPEL AL EMPEZAR: B1 DEFIENDE porque el balón es del A', () => {
  const { l } = escena();
  const a = compilar(jugadaCon(l, []));
  eq(a.jugadores.map((j) => j.tipo), ['atacante', 'atacante', 'defensor']);
});

test('Y QUIÉN DEFIENDE, EN TODAS LAS FASES: con eso el motor lee los papeles por fase', () => {
  const { l, a2 } = escena();
  const t1 = tramo(a2.id, P(0.7, 0.8), P(0.7, 0.5));
  const t2 = tramo(a2.id, P(0.7, 0.5), P(0.6, 0.3));
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t1] }, { id: 'f2', tramos: [t2] }]));
  eq(anim.fases.map((f) => f.defensores), [['B1'], ['B1']]);
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  ok(motor.usesPhaseRoles, 'el motor usa los papeles por fase');
  ok(motor.meta[1].defenders.has('B1') && !motor.meta[1].defenders.has('A2'));
});

test('SIN ATACANTE CLARO NO DEFIENDE NADIE, tampoco en la animación', () => {
  const { l, bal } = escena();
  const suelto = l.map((e) => (e.id === bal.id ? { ...e, portador_id: null } : e));
  const a = compilar(jugadaCon(suelto, [{ id: 'f1', tramos: [tramo(l[1].id, P(0.7, 0.8), P(0.7, 0.5))] }]));
  eq(a.jugadores.map((j) => j.tipo), ['atacante', 'atacante', 'atacante']);
  eq(a.fases[0].defensores, []);
  const forzado = compilar({ ...jugadaCon(l, []), defensa: { ataca: 'nadie' } });
  eq(forzado.jugadores.map((j) => j.tipo), ['atacante', 'atacante', 'atacante'], '«nadie defiende» de Ajustes:');
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
  eq(dibujados(f).length, 1);
  const m = dibujados(f)[0];
  eq(m.elemento_id, 'A2');
  eq(m.tipo_elemento, 'jugador');
  eq(m.tipo_movimiento, simbolo('corta'), 'el mismo símbolo que dibuja la flecha:');
  eq(m.path, t.trazo);
});

test('UN PASE ES UN PASE: viaja el balón, el que pasa no se mueve', () => {
  const { l, a1, a2, bal } = escena();
  const t = tramo(a1.id, P(0.3, 0.8), P(0.7, 0.8), { accion: 'pasa', corre_id: bal.id, receptor_id: a2.id, ritmo: 'pase', tipo: 'pass' });
  const f = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }])).fases[0];
  eq(dibujados(f), [], 'el pasador no tiene movimiento:');
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
  /* Con su instante: al llegar a sus manos. Esta prueba CAMBIA A PROPÓSITO
     en el paso 5.0 (antes no lo llevaba y el motor lo fechaba mal). */
  eq(f.recogidas, [{ jugador_id: 'A2', balon_id: bal.id, t_ms: delJugador.inicio_ms + delJugador.duracion_ms }]);
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
  eq(dibujados(f)[0].inicio_ms, f.pases[0].inicio_ms + f.pases[0].duracion_ms, 'y el receptor cuando llega:');
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
  eq(dibujados(a.fases[0]), []);
  ok(a.warnings.some((w) => /protagonista/.test(w)), 'tiene que decirlo');
});

test('una acción que no está en el catálogo no se inventa', () => {
  const { l, a2 } = escena();
  const a = compilar(jugadaCon(l, [{ id: 'f1', tramos: [tramo(a2.id, P(0.7, 0.8), P(0.7, 0.3), { accion: 'vuela' })] }]));
  eq(dibujados(a.fases[0]), []);
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
  eq(dibujados(a.fases[0]).length, 1, 'y la que tiene algo, entera:');
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

/* ── 7. Los tiros ────────────────────────────────────────── */

const [AX, AY] = aroExacto('entera', 'norte');
const tiroDe = (a1, bal, desenlace) => ({ ...tramo(a1.id, P(0.3, 0.8), P(AX, AY), { accion: 'tira', corre_id: bal.id, tipo: 'pass', ritmo: 'tiro' }), desenlace });

test('UN TIRO SE COMPILA: al aro, con su desenlace, y el balón cae aparte', () => {
  const { l, a1, bal } = escena();
  const a = compilar(jugadaCon(l, [{ id: 'f1', tramos: [tiroDe(a1, bal, 'entra')] }]));
  const f = a.fases[0];
  eq(f.tiros.length, 1);
  const t = f.tiros[0];
  eq([t.jugador_id, t.balon_id, t.canasta, t.desenlace], ['A1', bal.id, 'norte', 'entra']);
  const fin = t.path[t.path.length - 1];
  eq([fin.x, fin.y], [AX, AY], 'el trazo acaba en el aro, que es lo que mide el linter:');
  const cae = f.movimientos.find((m) => m.tipo_elemento === 'balon' && m.tipo_movimiento === 'caida');
  ok(cae, 'el balón cae bajo el aro');
  ok(cerca(cae.inicio_ms, t.inicio_ms + t.duracion_ms) && cae.duracion_ms === TRAS_EL_TIRO_MS, 'justo al llegar, en 0,3 s');
  ok(!a.warnings.some((w) => /tiro/i.test(w)), `ya no hay aviso de tiros: ${a.warnings}`);
});

test('EN EL MOTOR REAL, UN TIRO FALLADO REBOTA Y EL BALÓN QUEDA SUELTO', () => {
  const { l, a1, bal } = escena();
  const motor = enElMotor(compilar(jugadaCon(l, [{ id: 'f1', tramos: [tiroDe(a1, bal, 'falla')] }])));
  const f = enElInstante(motor, 0, motor.fases[0].duracion_ms);
  const esperado = trasElTiro({ pista: 'entera', canasta: 'norte', desde: P(0.3, 0.8), desenlace: 'falla' });
  ok(cerca(f.balls[bal.id].x, esperado.x, 1e-6) && cerca(f.balls[bal.id].y, esperado.y, 1e-6), `en el rebote: ${JSON.stringify(f.balls[bal.id])}`);
  ok(!f.carrying.has('A1'), 'y nadie lo lleva');
});

test('Y QUIEN RECOGE EL REBOTE SE LO QUEDA, cuando el balón ya ha caído', () => {
  const { l, a1, a2, bal } = escena();
  const rebote = trasElTiro({ pista: 'entera', canasta: 'norte', desde: P(0.3, 0.8), desenlace: 'falla' });
  const rec = { ...tramo(a2.id, P(0.7, 0.8), P(rebote.x, rebote.y + 0.03), { accion: 'recoge', balon_id: bal.id }), balon_desde: rebote };
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [tiroDe(a1, bal, 'falla'), rec] }]));
  const t = anim.fases[0].tiros[0];
  const r = anim.fases[0].movimientos.find((m) => m.elemento_id === 'A2');
  ok(r.inicio_ms >= t.inicio_ms + t.duracion_ms + TRAS_EL_TIRO_MS - 1e-6, `sale cuando ha caído: ${r.inicio_ms}`);
  const motor = enElMotor(anim);
  /* En el milisegundo final el balón aún está llegando a las manos (su
     último viaje acaba justo ahí), así que se mira lo que decide el motor:
     de quién es al acabar, y dónde está. */
  const duenos = motor.meta[0].duenos[bal.id];
  eq(duenos[duenos.length - 1].quien, 'A2', 'el último dueño:');
  const fin = enElInstante(motor, 0, motor.fases[0].duracion_ms);
  ok(cerca(fin.balls[bal.id].x, fin.players.A2.x, 1e-6) && cerca(fin.balls[bal.id].y, fin.players.A2.y, 1e-6),
    `y el balón acaba en sus manos: ${JSON.stringify(fin.balls[bal.id])} y A2 en ${JSON.stringify(fin.players.A2)}`);
});

/* ── 7. El bloqueo (§4.4, §6.3) ───────────────────────────── */

const bloqueoDe = (bloqueador, companero, desde, hasta) => ({
  ...tramo(bloqueador.id, desde, hasta, { accion: 'bloquea', tipo: 'bloqueo' }),
  companero_id: companero.id,
});

test('UN BLOQUEO SE COMPILA: el bloqueador va a su sitio y la barra sale al llegar', () => {
  const { l, a1, a2 } = escena();
  const b = bloqueoDe(a2, a1, P(0.7, 0.8), P(0.4, 0.7));
  const sale = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.4), { accion: 'bota', tipo: 'run' });
  const a = compilar(jugadaCon(l, [{ id: 'f1', tramos: [b, sale] }]));
  const f = a.fases[0];
  const mv = f.movimientos.find((m) => m.elemento_id === 'A2');
  eq(mv.tipo_movimiento, 'bloqueo', 'se desplaza con la flecha del bloqueo:');
  eq(f.bloqueos.length, 1);
  const bl = f.bloqueos[0];
  eq([bl.bloqueador_id, bl.bloqueado_id], ['A2', 'A1'], 'el bloqueado es el COMPAÑERO, que es lo que narra Equipos:');
  ok(cerca(bl.inicio_ms, mv.inicio_ms + mv.duracion_ms), `la barra sale al llegar: ${bl.inicio_ms}`);
  ok(cerca(bl.inicio_ms + bl.duracion_ms, f.duracion_ms), 'y, si no hace nada más, aguanta hasta el final de la fase');
  const bota = f.movimientos.find((m) => m.elemento_id === 'A1');
  ok(cerca(bota.inicio_ms, bl.inicio_ms), `el compañero sale cuando el bloqueador llega: ${bota.inicio_ms}`);
  const frente = frenteDelBloqueo(b.trazo);
  eq(bl.hacia, [frente.x, frente.y], 'la barra mira hacia donde llegaba:');
  eq(f.acciones, ['bloquea', 'bota']);
  ok(!a.warnings.length, `sin avisos: ${a.warnings}`);
});

test('BLOQUEO Y CONTINUACIÓN: LA BARRA SE VE hasta que el bloqueador rueda, cuando le pasan', () => {
  /* Con la barra en 0 ms el proyector no la enseñaba nunca: ahora el
     bloqueador aguanta hasta que su compañero le pasa (fases.js). */
  const { l, a1, a2 } = escena();
  const b = bloqueoDe(a2, a1, P(0.7, 0.8), P(0.4, 0.7));
  const rueda = tramo(a2.id, P(0.4, 0.7), P(0.5, 0.3));
  const bota = tramo(a1.id, P(0.3, 0.8), P(0.45, 0.5), { accion: 'bota', tipo: 'run' });
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [b, rueda, bota] }]));
  const f = anim.fases[0];
  const bl = f.bloqueos[0];
  const mv = f.movimientos.filter((m) => m.elemento_id === 'A2');
  eq(mv.length, 2);
  ok(bl.duracion_ms > 100, `la barra dura de verdad: ${bl.duracion_ms} ms`);
  ok(cerca(bl.inicio_ms + bl.duracion_ms, mv[1].inicio_ms), 'hasta que rueda:');
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  let fotogramas = 0;
  for (let t = 0; t <= f.duracion_ms; t += 1000 / 60) {
    motor.k = 0; motor.phaseElapsed = t;
    if (motor.bloqueosEn(0, t, motor._computePositions().players).length) fotogramas++;
  }
  ok(fotogramas >= 6, `y en el motor se ve en varios fotogramas a 60 por segundo: ${fotogramas}`);
});

test('UN BLOQUEO SIN COMPAÑERO SALE SIN BARRA, pero se desplaza y se avisa', () => {
  const { l, a2 } = escena();
  const b = { ...tramo(a2.id, P(0.7, 0.8), P(0.4, 0.7), { accion: 'bloquea', tipo: 'bloqueo' }), companero_id: 'no_esta' };
  const a = compilar(jugadaCon(l, [{ id: 'f1', tramos: [b] }]));
  eq(a.fases[0].bloqueos, []);
  ok(a.fases[0].movimientos.some((m) => m.elemento_id === 'A2'), 'el desplazamiento sí sale');
  ok(a.warnings.some((w) => /sin compañero/.test(w)), `y se dice: ${a.warnings}`);
});

test('EN EL MOTOR REAL, LA BARRA NO SE VE MIENTRAS EL BLOQUEADOR VA DE CAMINO', () => {
  const { l, a1, a2 } = escena();
  const b = bloqueoDe(a2, a1, P(0.7, 0.8), P(0.4, 0.7));
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [b, tramo(a1.id, P(0.3, 0.8), P(0.3, 0.4), { accion: 'bota', tipo: 'run' })] }]));
  const motor = enElMotor(anim);
  const bl = anim.fases[0].bloqueos[0];
  const antes = bl.inicio_ms - 50;
  eq(motor.bloqueosEn(0, antes, enElInstante(motor, 0, antes).players).length, 0, 'de camino, sin barra:');
  const t = bl.inicio_ms + 10;
  const f = enElInstante(motor, 0, t);
  const v = motor.bloqueosEn(0, t, f.players);
  eq(v.length, 1, 'plantado, con barra:');
  ok(cerca(v[0].a.x, 0.4, 1e-6) && cerca(v[0].a.y, 0.7, 1e-6), `en su sitio: ${JSON.stringify(v[0].a)}`);
});

test('Y EL BLOQUEO LLEVA A QUIÉN SE LE PONE: el motor mira al defensor donde esté', () => {
  const { l, a1, a2, b1 } = escena();
  const b = { ...bloqueoDe(a2, a1, P(0.7, 0.8), P(0.45, 0.45)), defensor_id: b1.id };
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [b] }]));
  const bl = anim.fases[0].bloqueos[0];
  eq(bl.defensor_id, 'B1', 'compilado por su nombre:');
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  const f = enElInstante(motor, 0, anim.fases[0].duracion_ms);
  const [barra] = motor.bloqueosEn(0, anim.fases[0].duracion_ms, f.players);
  eq(barra.b, f.players.B1, 'y la barra mira al defensor donde está ahora, no a un punto fijo:');
});

test('LO QUE EL ENTRENADOR HA DICHO QUE HACE UN DEFENSOR LLEGA A LA ANIMACIÓN (§8.5)', () => {
  const { l, a1, a2, b1 } = escena();
  const t = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.4), { accion: 'bota', tipo: 'run' });
  const anim = compilar(jugadaCon(l, [{
    id: 'f1', tramos: [t],
    defensa: { [b1.id]: { accion: 'ayuda', objetivo_id: a2.id } },
  }]));
  eq(anim.fases[0].defensa, { B1: { accion: 'ayuda', objetivo_id: 'A2' } }, 'con los nombres de la animación:');
  /* Y la defensa la hace: va hacia el que tiene que tapar, cosa que sin
     decirlo no haría. */
  const suya = anim.fases[0].movimientos.find((m) => m.elemento_id === 'B1');
  const sinDecir = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }]))
    .fases[0].movimientos.find((m) => m.elemento_id === 'B1');
  const d = (p, q) => Math.hypot((p.x - q.x) * 18, (p.y - q.y) * 27);
  const A2 = { x: 0.7, y: 0.8 };
  const media = suya.muestras[10];
  ok(d(media, A2) < d(suya.muestras[0], A2) - 1, `se va hacia A2: ${d(media, A2).toFixed(2)} m frente a ${d(suya.muestras[0], A2).toFixed(2)}`);
  ok(d(media, A2) < d(sinDecir.muestras[10], A2) - 1, 'y más cerca de A2 que si no se hubiera dicho nada');
});

/* ── Los conos del camino (§7.4) ─────────────────────────── */

test('UN CONO QUE SE SORTEA SE COMPILA COMO «RODEAR»; uno anulado, como decoración', () => {
  const { l, a1 } = escena();
  const conos = [{ id: 'cono_x', kind: 'cono', x: 0.31, y: 0.6 }, { id: 'cono_y', kind: 'cono', x: 0.8, y: 0.2 }];
  const t = { ...tramo(a1.id, P(0.3, 0.8), P(0.3, 0.4)), sorteando: [{ cono: 'cono_x', lado: 'izq', tipo: 'rodeo' }] };
  const anim = compilar(jugadaCon([...l, ...conos], [{ id: 'f1', tramos: [t] }]));
  const f = (id) => anim.conos.find((c) => c.id === id).funcion;
  eq([f('cono_x'), f('cono_y')], ['rodear', 'decorativo']);
  const anulado = { ...t, sorteando: [{ cono: 'cono_x', anulado: true }] };
  const otra = compilar(jugadaCon([...l, ...conos], [{ id: 'f1', tramos: [anulado] }]));
  eq(otra.conos.find((c) => c.id === 'cono_x').funcion, 'decorativo', 'anulado no se rodea:');
});

test('LOS PALOS DE UNA PUERTA SE COMPILAN COMO «PUERTA»', () => {
  const { l, a1 } = escena();
  const conos = [{ id: 'pa', kind: 'cono', x: 0.25, y: 0.6 }, { id: 'pb', kind: 'cono', x: 0.35, y: 0.6 }];
  const t = { ...tramo(a1.id, P(0.3, 0.8), P(0.3, 0.4)), sorteando: [{ cono: 'pa', puerta: ['pa', 'pb'], tipo: 'puerta' }] };
  const anim = compilar(jugadaCon([...l, ...conos], [{ id: 'f1', tramos: [t] }]));
  eq(anim.conos.map((c) => c.funcion), ['puerta', 'puerta']);
});

test('EL DEFENSOR SOBRE UNA PUERTA SE QUEDA EN SU CARRIL TAMBIÉN EN EL PROYECTOR (§7.4.1)', () => {
  const { l, a1, b1 } = escena();
  /* B1 sobre la línea de la puerta que cruza A1. */
  const conB1 = l.map((e) => (e.id === b1.id ? { ...e, x: 0.3, y: 0.6 } : e));
  const conos = [{ id: 'pa', kind: 'cono', x: 0.3 - 1.4 / 18, y: 0.6 }, { id: 'pb', kind: 'cono', x: 0.3 + 1.4 / 18, y: 0.6 }];
  const t = { ...tramo(a1.id, P(0.3, 0.8), P(0.3, 0.3), { accion: 'bota', tipo: 'run' }), sorteando: [{ cono: 'pa', puerta: ['pa', 'pb'], tipo: 'puerta' }] };
  const anim = compilar(jugadaCon([...conB1, ...conos], [{ id: 'f1', tramos: [t] }]));
  const suya = anim.fases[0].movimientos.find((m) => m.elemento_id === 'B1');
  ok(suya.muestras.every((q) => Math.abs(q.y - 0.6) < 1e-6 && q.x >= 0.3 - 1.4 / 18 - 1e-6 && q.x <= 0.3 + 1.4 / 18 + 1e-6),
    `todas sus muestras sobre la puerta: ${JSON.stringify(suya.muestras.slice(0, 3))}`);
});

test('UN CONO DE FILA SIN RONDAS SE COMPILA CON SU COLA, y los que esperan no son jugadores de la animación', () => {
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
  const j = {
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'cono_1', kind: 'cono', x: 0.5, y: 0.6, fila: { n: 3, equipo: 'A', papel: 'atacante', balon: true, orientacion: 90, vuelta: null, rondas: false } },
      { id: 'jugador_2', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6, fila_de: 'cono_1', puesto: 0, en_juego: true },
      { id: 'jugador_3', kind: 'jugador', equipo: 'A', label: null, x: 0.5, y: 0.65, fila_de: 'cono_1', puesto: 1, en_juego: false },
      { id: 'jugador_4', kind: 'jugador', equipo: 'A', label: null, x: 0.5, y: 0.7, fila_de: 'cono_1', puesto: 2, en_juego: false },
      { id: 'balon_5', kind: 'balon', x: 0.54, y: 0.6, portador_id: 'jugador_2' },
      { id: 'balon_6', kind: 'balon', x: 0.54, y: 0.65, portador_id: 'jugador_3' },
      { id: 'balon_7', kind: 'balon', x: 0.54, y: 0.7, portador_id: 'jugador_4' },
    ],
    fases: [{ id: 'f1', tramos: [{ id: 'tr1', elemento_id: 'jugador_2', corre_id: 'jugador_2', accion: 'bota', tipo: 'run', trazo: [N(0.5, 0.6), N(0.5, 0.3)] }] }],
  };
  const anim = compilar(j);
  eq(anim.conos[0].funcion, 'fila');
  eq(anim.conos[0].fila_config, { n_jugadores: 2, direccion_grados: 90, equipo: 'A' }, 'con los dos que esperan:');
  eq(anim.jugadores.length, 1, 'el que sale es el único jugador:');
  eq(anim.balones.map((b) => b.id), ['balon_5'], 'y solo su balón:');
});

test('CON RONDAS (§7.4.2) LOS DE LA COLA SALEN UNO TRAS OTRO, sin número y marcados como repetición', () => {
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
  const j = {
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'cono_1', kind: 'cono', x: 0.5, y: 0.6, fila: { n: 3, equipo: 'A', papel: 'atacante', balon: true, orientacion: 90, vuelta: null } },
      { id: 'jugador_2', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6, fila_de: 'cono_1', puesto: 0, en_juego: true },
      { id: 'jugador_3', kind: 'jugador', equipo: 'A', label: null, x: 0.5, y: 0.65, fila_de: 'cono_1', puesto: 1, en_juego: false },
      { id: 'jugador_4', kind: 'jugador', equipo: 'A', label: null, x: 0.5, y: 0.7, fila_de: 'cono_1', puesto: 2, en_juego: false },
      { id: 'balon_5', kind: 'balon', x: 0.54, y: 0.6, portador_id: 'jugador_2' },
      { id: 'balon_6', kind: 'balon', x: 0.54, y: 0.65, portador_id: 'jugador_3' },
      { id: 'balon_7', kind: 'balon', x: 0.54, y: 0.7, portador_id: 'jugador_4' },
    ],
    fases: [{ id: 'f1', tramos: [{ id: 'tr1', elemento_id: 'jugador_2', corre_id: 'jugador_2', accion: 'bota', tipo: 'run', trazo: [N(0.5, 0.6), N(0.5, 0.3)] }] }],
  };
  const anim = compilar(j);
  eq(anim.conos[0].fila_config.n_jugadores, 0, 'nadie se queda en la cola del motor:');
  eq(anim.jugadores.map((x) => x.id), ['A1', 'A_jugador_3', 'A_jugador_4'], 'los que salen, con nombre propio y sin chocar:');
  eq(anim.jugadores.map((x) => x.dorsal), [null, '', ''], 'y sin número, como en la Pizarra:');
  eq(anim.balones.length, 3, 'cada uno con su balón:');
  const m = anim.fases[0].movimientos.filter((x) => x.tipo_elemento === 'jugador');
  eq(m.map((x) => [x.elemento_id, x.repeticion ?? 0]), [['A1', 0], ['A_jugador_3', 1], ['A_jugador_4', 2]]);
  ok(m[1].inicio_ms > m[0].inicio_ms && cerca(m[2].inicio_ms - m[1].inicio_ms, m[1].inicio_ms - m[0].inicio_ms, 1e-6),
    `salen escalonados, a turnos iguales: ${m.map((x) => x.inicio_ms)}`);
  ok(cerca(m[1].path[0].y, 0.65, 1e-9) && cerca(m[2].path[0].y, 0.7, 1e-9), 'cada uno sale de su sitio en la cola');
  eq(anim.rondas, 3, 'la animación sabe cuántas rondas son:');
  eq(enElMotor(anim).rondas, 1, 'pero el motor no ofrece saltar de ronda: van dentro de la fase');
  const una = soloPrimeraRonda(anim.fases);
  eq(una[0].movimientos.filter((x) => x.tipo_elemento === 'jugador').map((x) => x.elemento_id), ['A1'], 'la miniatura y el guion cuentan una:');
  ok(anim.fases[0].duracion_ms >= m[2].inicio_ms + m[2].duracion_ms, 'y la fase dura hasta que acaba el último');
  /* Y el motor de verdad lo reproduce así: cuando sale el segundo, el
     tercero sigue esperando en su sitio, y cada uno lleva su balón. */
  const motor = enElMotor(anim);
  const f = enElInstante(motor, 0, m[1].inicio_ms + m[1].duracion_ms / 2);
  ok(f.players.A_jugador_3.y < 0.65 && f.players.A_jugador_3.y > 0.3, `el segundo va de camino: ${JSON.stringify(f.players.A_jugador_3)}`);
  ok(cerca(f.players.A_jugador_4.y, 0.7), `el tercero espera: ${JSON.stringify(f.players.A_jugador_4)}`);
  ok(Math.abs(f.balls.balon_6.y - f.players.A_jugador_3.y) < 0.02, `y el balón del segundo va con él: ${JSON.stringify(f.balls.balon_6)}`);
  const fin = enElInstante(motor, 0, anim.fases[0].duracion_ms);
  ok(['A1', 'A_jugador_3', 'A_jugador_4'].every((id) => cerca(fin.players[id].y, 0.3)), 'al acabar, los tres han llegado');
});

test('CON RONDAS, QUIEN NO PUEDE SALIR ESPERA EN SU SITIO, y el aviso llega al proyector', () => {
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
  const j = {
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'cono_1', kind: 'cono', x: 0.5, y: 0.6, fila: { n: 3, equipo: 'A', papel: 'atacante', balon: true, orientacion: 90, vuelta: null } },
      { id: 'jugador_2', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6, fila_de: 'cono_1', puesto: 0, en_juego: true },
      { id: 'jugador_3', kind: 'jugador', equipo: 'A', label: null, x: 0.5, y: 0.65, fila_de: 'cono_1', puesto: 1, en_juego: false },
      { id: 'jugador_4', kind: 'jugador', equipo: 'A', label: null, x: 0.5, y: 0.7, fila_de: 'cono_1', puesto: 2, en_juego: false },
      { id: 'balon_5', kind: 'balon', x: 0.54, y: 0.6, portador_id: 'jugador_2' },
      { id: 'balon_7', kind: 'balon', x: 0.54, y: 0.7, portador_id: 'jugador_4' },
    ],
    fases: [{ id: 'f1', tramos: [{ id: 'tr1', elemento_id: 'jugador_2', corre_id: 'jugador_2', accion: 'bota', tipo: 'run', trazo: [N(0.5, 0.6), N(0.5, 0.3)] }] }],
  };
  const anim = compilar(j);
  eq(anim.jugadores.map((x) => x.id), ['A1', 'A_jugador_3', 'A_jugador_4'], 'el segundo, sin balón, sigue en la pista:');
  eq(anim.conos[0].fila_config.n_jugadores, 0, 'y no en la cola que pinta el motor, que lo pondría en el cono:');
  eq(anim.fases[0].movimientos.filter((x) => x.tipo_elemento === 'jugador').map((x) => x.elemento_id), ['A1', 'A_jugador_4'], 'sale el tercero:');
  ok(anim.warnings.some((w) => /balón por cabeza/.test(w)), `y se avisa: ${anim.warnings}`);
});

/* ── La frase (§9) ───────────────────────────────────────── */

test('EL MOTOR ESPERA A LA VOZ AL ACABAR LA FASE, y sigue cuando acaba de leer (§9.3)', () => {
  const { l, a1, a2 } = escena();
  const anim = compilar(jugadaCon(l, [
    { id: 'f1', tramos: [tramo(a2.id, P(0.7, 0.8), P(0.7, 0.5))] },
    { id: 'f2', tramos: [tramo(a1.id, P(0.3, 0.8), P(0.3, 0.6), { accion: 'bota', tipo: 'run' })] },
  ]));
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0;
  try {
    const motor = enElMotor(anim);
    let hablando = true;
    motor.retener = () => hablando;
    motor.playing = true; motor.k = 0; motor.mode = 'pausePost'; motor.pauseElapsed = 10000; motor._last = 0;
    motor._tick(16);
    eq(motor.k, 0, 'mientras lee, se queda en su fase:');
    hablando = false;
    motor._tick(32);
    eq(motor.k, 1, 'y al acabar, pasa a la siguiente:');
  } finally { globalThis.requestAnimationFrame = raf; }
});


test('CADA FASE LLEVA SU FRASE AUTOMÁTICA, la reescrita y el hueco del audio (§9)', () => {
  const { l, a1, a2 } = escena();
  const j = jugadaCon(l, [
    { id: 'f1', tramos: [tramo(a2.id, P(0.7, 0.8), P(0.7, 0.5))], texto: 'El 2 se abre.' },
    { id: 'f2', tramos: [tramo(a1.id, P(0.3, 0.8), P(0.3, 0.6), { accion: 'bota', tipo: 'run' })] },
  ]);
  const anim = compilar(j);
  eq(anim.fases.map((f) => [typeof f.frase, f.texto, f.audio_url]), [['string', 'El 2 se abre.', null], ['string', null, null]]);
  ok(/^A2 corta/.test(anim.fases[0].frase), `la automática sale de lo dibujado: ${anim.fases[0].frase}`);
  ok(/^A1 bota/.test(anim.fases[1].frase), anim.fases[1].frase);
});

/* ── Robar (§8.6) ────────────────────────────────────────── */

test('ROBO EN EL BOTE: el balón pasa a ser del que roba A MITAD DE FASE', () => {
  const { l, a1, b1, bal } = escena();
  /* El que roba, a un paso: llega enseguida y se ve el cambio dentro de
     la fase. Desde el otro lado de la pista no le daría tiempo. */
  const puestos = l.map((e) => (e.id === b1.id ? { ...e, x: 0.32, y: 0.78 } : e));
  const t = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.5), { accion: 'bota', tipo: 'run' });
  const anim = compilar(jugadaCon(puestos, [
    { id: 'f1', tramos: [t], defensa: { [b1.id]: { accion: 'roba', objetivo_id: a1.id } } },
    { id: 'f2', tramos: [] },
  ]));
  const f = anim.fases[0];
  const rec = (f.recogidas || []).find((x) => x.jugador_id === 'B1');
  ok(rec, 'se anota como una recogida del que roba');
  /* A MITAD DE FASE, no al final: el que roba tarda lo que tarde en
     llegar, y desde ahí el balón es suyo. */
  ok(rec.t_ms > 0 && rec.t_ms < f.duracion_ms - 1, `antes de acabar la fase: ${rec.t_ms} de ${f.duracion_ms}`);
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  const antes = enElInstante(motor, 0, Math.max(0, rec.t_ms - 50));
  const despues = enElInstante(motor, 0, Math.min(f.duracion_ms, rec.t_ms + 50));
  eq(antes.duenos[bal.id], 'A1', 'antes es del que botaba:');
  eq(despues.duenos[bal.id], 'B1', 'y después, del que roba:');
});

test('Y CUANTO MÁS LEJOS ESTÁ EL QUE ROBA, MÁS TARDA EN LLEGAR', () => {
  const con = (donde) => {
    const { l, a1, b1 } = escena();
    const puestos = l.map((e) => (e.id === b1.id ? { ...e, ...donde } : e));
    const t = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.5), { accion: 'bota', tipo: 'run' });
    const anim = compilar(jugadaCon(puestos, [{ id: 'f1', tramos: [t], defensa: { [b1.id]: { accion: 'roba', objetivo_id: a1.id } } }]));
    return (anim.fases[0].recogidas || []).find((x) => x.jugador_id === 'B1');
  };
  const cerca = con({ x: 0.32, y: 0.78 });
  const lejos = con({ x: 0.75, y: 0.35 });
  ok(cerca.t_ms < lejos.t_ms - 100, `de cerca ${cerca.t_ms} ms, de lejos ${lejos.t_ms} ms`);
});

test('TRAS UNA CANASTA, EL TIRO DE LA FASE SIGUIENTE VA AL OTRO ARO (§8.6)', () => {
  const { l, a1, b1, bal } = escena();
  const anota = { ...tramo(a1.id, P(0.3, 0.8), P(0.5, 0.1), { accion: 'tira', tipo: 'pass', corre_id: bal.id }), desenlace: 'entra' };
  const recogen = tramo(b1.id, P(0.5, 0.4), P(0.5, 0.15), { accion: 'recoge', tipo: 'cut', balon_id: bal.id });
  const devuelve = { ...tramo(b1.id, P(0.5, 0.15), P(0.5, 0.9), { accion: 'tira', tipo: 'pass', corre_id: bal.id }), desenlace: 'entra' };
  const anim = compilar(jugadaCon(l, [
    { id: 'f1', tramos: [anota, recogen] },
    { id: 'f2', tramos: [devuelve] },
  ]));
  eq(anim.fases[0].tiros[0].canasta, 'norte', 'el primero, al aro de siempre:');
  eq(anim.fases[1].tiros[0].canasta, 'sur', 'y el de la fase siguiente, al contrario:');
});

test('Y AL ROBAR SE LE PASA EL BALÓN AL OTRO EQUIPO: cambian los papeles en la fase siguiente', () => {
  const { l, a1, b1 } = escena();
  const t = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.5), { accion: 'bota', tipo: 'run' });
  const sigue = tramo(b1.id, P(0.5, 0.4), P(0.5, 0.7), { accion: 'bota', tipo: 'run' });
  const anim = compilar(jugadaCon(l, [
    { id: 'f1', tramos: [t], defensa: { [b1.id]: { accion: 'roba', objetivo_id: a1.id } } },
    { id: 'f2', tramos: [sigue] },
  ]));
  eq(anim.fases[0].defensa, { B1: { accion: 'roba', objetivo_id: 'A1' } }, 'la animación lo cuenta:');
  eq(anim.fases[1].defensores.sort(), ['A1', 'A2'], 'en la fase 2 defienden los que atacaban:');
  ok(!anim.warnings.length, `y sin avisos: ${anim.warnings}`);
});

test('INTERCEPTAR UN PASE: el balón se queda a medio camino y es del que lo corta', () => {
  const { l, a1, a2, b1, bal } = escena();
  const pase = tramo(a1.id, P(0.3, 0.8), P(0.7, 0.8), { accion: 'pasa', tipo: 'pass', corre_id: bal.id, receptor_id: a2.id });
  const anim = compilar(jugadaCon(l, [
    { id: 'f1', tramos: [pase], defensa: { [b1.id]: { accion: 'roba', objetivo_id: a2.id } } },
    { id: 'f2', tramos: [tramo(b1.id, P(0.5, 0.4), P(0.5, 0.8), { accion: 'bota', tipo: 'run' })] },
  ]));
  const p = anim.fases[0].pases[0];
  eq([p.a_id, p.interceptado], ['B1', true], 'el pase acaba en el que roba:');
  const fin = p.path[p.path.length - 1];
  ok(fin.x < 0.7 - 1e-6, `y se corta antes de llegar: ${JSON.stringify(fin)}`);
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  eq(enElInstante(motor, 0, anim.fases[0].duracion_ms).duenos[bal.id], 'B1');
  eq(anim.fases[1].defensores.sort(), ['A1', 'A2'], 'y en la fase siguiente atacan los otros:');
});

test('robar a quien no tiene balón se dice y no rompe la animación', () => {
  const { l, a2, b1 } = escena();
  const t = tramo(a2.id, P(0.7, 0.8), P(0.7, 0.4));
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t], defensa: { [b1.id]: { accion: 'roba', objetivo_id: a2.id } } }]));
  ok(anim.warnings.some((w) => /no tiene balón/.test(w)), `se avisa: ${anim.warnings}`);
  ok(anim.fases[0].movimientos.length, 'y la fase se compila igual');
});

/* ── 8. La defensa se mueve sola (§8.4) ──────────────────── */

test('LA DEFENSA SALE EN LA ANIMACIÓN: muestreada, automática y sin flecha', () => {
  const { l, a1 } = escena();
  const t = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.4), { accion: 'bota', tipo: 'run' });
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t] }]));
  const f = anim.fases[0];
  const suya = f.movimientos.find((m) => m.elemento_id === 'B1');
  ok(suya && suya.automatico === true, 'la defensa va marcada como automática');
  eq(suya.muestras.length, 21, 'con sus veinte tramos:');
  eq([suya.inicio_ms, suya.duracion_ms], [0, f.duracion_ms], 'y dura toda la fase:');
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  eq(motor.meta[0].arrows.length, 1, 'en el motor, solo la flecha del que bota:');
  const medio = enElInstante(motor, 0, f.duracion_ms / 2);
  const fin = enElInstante(motor, 0, f.duracion_ms);
  ok(medio.players.B1.y > fin.players.B1.y, 'y B1 se mueve siguiendo a A1');
});

test('Y CADA FASE EMPIEZA DONDE ACABÓ LA DEFENSA EN LA ANTERIOR', () => {
  const { l, a1 } = escena();
  const t1 = tramo(a1.id, P(0.3, 0.8), P(0.3, 0.5), { accion: 'bota', tipo: 'run' });
  const t2 = tramo(a1.id, P(0.3, 0.5), P(0.5, 0.3), { accion: 'bota', tipo: 'run' });
  const anim = compilar(jugadaCon(l, [{ id: 'f1', tramos: [t1] }, { id: 'f2', tramos: [t2] }]));
  const uno = anim.fases[0].movimientos.find((m) => m.elemento_id === 'B1');
  const dos = anim.fases[1].movimientos.find((m) => m.elemento_id === 'B1');
  const ultima = uno.muestras[uno.muestras.length - 1];
  eq([dos.muestras[0].x, dos.muestras[0].y], [ultima.x, ultima.y], 'la segunda fase arranca donde acabó la primera:');
  const motor = new AnimationEngine({ w: 0, basket: () => [0.5, 0.1] }, anim, { autoplay: false, loop: false, paused: true });
  const alEmpezar = enElInstante(motor, 1, 0);
  ok(cerca(alEmpezar.players.B1.x, ultima.x) && cerca(alEmpezar.players.B1.y, ultima.y), 'y el motor la pinta ahí');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
