/* ============================================================
   eval-motor.mjs — banco Node del motor de animación con carriles
   (taller/js/canvas/engine.js). Sin red, sin DOM.

     node taller/tools/eval-motor.mjs

   El motor se prueba DE VERDAD, con una vista sin DOM: con `w = 0` no
   pinta nada y sin autoplay no arranca el reloj, así que se le puede
   poner en cualquier instante y preguntarle dónde está cada uno.

   ── LO PRIMERO: QUE LO GUARDADO SE VEA IGUAL ─────────────────
   Hay ejercicios guardados con este motor en la biblioteca, en planes
   y en el visor de Equipos. Los carriles no pueden cambiar cómo se ven,
   ni un píxel. Por eso la primera prueba compara la animación de
   muestra, instante a instante, con la fórmula del motor de antes.

   Lo que manda es `inicio_ms`: solo lo que lo trae lleva tiempo propio.
   Y hay que vigilarlo expresamente, porque la animación de muestra ya
   trae `duracion_ms` en un pase, y hacerle caso lo cambiaría.
   ============================================================ */

import { AnimationEngine } from '../js/canvas/engine.js';
import { makeSampler, easeInOut } from '../js/canvas/geometry.js';
import { SAMPLE_ANIMACION } from '../js/data/sample-animacion.js';

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
const cerca = (a, b, tol = 1e-9) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
const txt = (p) => (p ? `(${p.x.toFixed(4)}, ${p.y.toFixed(4)})` : String(p));

const vistaMuda = () => ({ w: 0, basket: (k) => (k === 'sur' ? [0.5, 0.9] : [0.5, 0.1]) });
const motor = (anim) => new AnimationEngine(vistaMuda(), anim, { autoplay: false, loop: false, paused: true });
function en(m, k, ms) { m.k = k; m.phaseElapsed = ms; return m._computePositions(); }

const L = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
const recta = (a, b) => [L(a[0], a[1]), L(b[0], b[1])];

/* Una animación con carriles, como las que escribe el compilador. */
function conCarriles(fases, jugadores = null, balones = null) {
  return {
    pista: 'entera',
    jugadores: jugadores || [
      { id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.2, 0.8] },
      { id: 'A2', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.8, 0.8] },
    ],
    balones: balones || [{ id: 'b1', posicion_inicial: [0.2, 0.8], portador_id: 'A1' }],
    conos: [],
    fases: fases.map((f, i) => ({ id: `f${i + 1}`, pausa_post_ms: 400, bloqueos: [], tiros: [], recogidas: [], pases: [], movimientos: [], ...f })),
    warnings: [],
  };
}

/* ── 1. Lo guardado se ve exactamente igual ──────────────── */

test('LA ANIMACIÓN DE MUESTRA SE VE IGUAL, instante a instante', () => {
  /* La fórmula del motor de antes: cada movimiento ocupa la fase entera
     y se muestrea en easeInOut(t / duración). */
  const m = motor(SAMPLE_ANIMACION);
  let comparados = 0;
  SAMPLE_ANIMACION.fases.forEach((fase, k) => {
    for (const u of [0, 0.13, 0.5, 0.77, 1]) {
      const f = en(m, k, u * fase.duracion_ms);
      for (const mv of fase.movimientos) {
        if (mv.tipo_elemento === 'balon') continue;
        const antes = makeSampler(mv.path)(easeInOut(u));
        ok(cerca(f.players[mv.elemento_id], antes), `fase ${k + 1}, ${mv.elemento_id} al ${u * 100}%: ${txt(f.players[mv.elemento_id])} y antes ${txt(antes)}`);
        comparados++;
      }
    }
  });
  ok(comparados >= 15, `solo se han comparado ${comparados} posiciones`);
});

test('Y SU PASE OCUPA LA FASE ENTERA, aunque traiga duracion_ms', () => {
  /* El pase de la muestra trae `duracion_ms: 500` en una fase de 1200.
     Si el motor le hiciera caso, el balón llegaría a mitad de fase: el
     ejercicio guardado se vería distinto. */
  const fase = SAMPLE_ANIMACION.fases[1];
  const pase = fase.pases[0];
  ok(pase.duracion_ms && pase.duracion_ms < fase.duracion_ms, 'la muestra sigue teniendo esa trampa');
  const m = motor(SAMPLE_ANIMACION);
  const mitad = en(m, 1, fase.duracion_ms / 2).balls[pase.balon_id];
  const antes = makeSampler(pase.path)(easeInOut(0.5));
  ok(cerca(mitad, antes), `a mitad de fase el balón tiene que ir a mitad de pase: ${txt(mitad)} y antes ${txt(antes)}`);
});

test('quien no se mueve en una fase, donde empezó; el balón con su dueño', () => {
  const m = motor(SAMPLE_ANIMACION);
  const f = en(m, 0, 700);
  ok(cerca(f.players.B1, { x: 0.40, y: 0.42 }), `B1 no hace nada: ${txt(f.players.B1)}`);
  const b = f.balls.balon_1;
  ok(Math.abs(b.x - (f.players.A1.x + 0.012)) < 1e-9 && Math.abs(b.y - f.players.A1.y) < 1e-9, 'el balón va pegado a A1, como siempre');
  ok(f.carrying.has('A1'), 'y A1 lo lleva');
});

/* ── 2. Los carriles ─────────────────────────────────────── */

test('CADA UNO ARRANCA CUANDO LE TOCA', () => {
  const m = motor(conCarriles([{
    duracion_ms: 3000,
    movimientos: [
      { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.2, 0.8], [0.2, 0.2]), inicio_ms: 0, duracion_ms: 1000 },
      { elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.8, 0.8], [0.8, 0.2]), inicio_ms: 2000, duracion_ms: 1000 },
    ],
  }]));
  const antes = en(m, 0, 1500);
  ok(cerca(antes.players.A1, { x: 0.2, y: 0.2 }), `A1 ya ha llegado: ${txt(antes.players.A1)}`);
  ok(cerca(antes.players.A2, { x: 0.8, y: 0.8 }), `A2 todavía espera EN SU SALIDA, no en su destino: ${txt(antes.players.A2)}`);
  const mitad = en(m, 0, 2500);
  ok(Math.abs(mitad.players.A2.y - 0.5) < 1e-9, `a mitad de su tramo: ${txt(mitad.players.A2)}`);
});

test('VARIOS TRAMOS DE UNO EN LA MISMA FASE, y entre ellos se queda quieto', () => {
  const m = motor(conCarriles([{
    duracion_ms: 4000,
    movimientos: [
      { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.2, 0.8], [0.5, 0.5]), inicio_ms: 0, duracion_ms: 1000 },
      { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.5, 0.5], [0.9, 0.1]), inicio_ms: 3000, duracion_ms: 1000 },
    ],
  }, { duracion_ms: 1000 }]));
  ok(cerca(en(m, 0, 2000).players.A1, { x: 0.5, y: 0.5 }), 'entre los dos, donde acabó el primero');
  ok(cerca(en(m, 0, 4000).players.A1, { x: 0.9, y: 0.1 }), 'al final, donde acaba el segundo');
  ok(cerca(en(m, 1, 0).players.A1, { x: 0.9, y: 0.1 }), 'y ahí empieza la fase siguiente, no en el final del primero');
});

test('DONDE ACABA CADA UNO SE DECIDE POR INSTANTE, no por el orden escrito', () => {
  /* El compilador escribe en el orden en que se dibujó; con carriles,
     lo último escrito no tiene por qué ser lo último en acabar. */
  const m = motor(conCarriles([{
    duracion_ms: 3000,
    movimientos: [
      { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.5, 0.5], [0.9, 0.1]), inicio_ms: 2000, duracion_ms: 1000 },
      { elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.2, 0.8], [0.5, 0.5]), inicio_ms: 0, duracion_ms: 1000 },
    ],
  }, { duracion_ms: 1000 }]));
  ok(cerca(en(m, 1, 0).players.A1, { x: 0.9, y: 0.1 }), 'la fase siguiente sale del tramo que acaba MÁS TARDE');
});

/* ── 3. El balón cambia de manos a mitad de fase ─────────── */

test('ANTES DEL PASE LO LLEVA EL QUE PASA; AL LLEGAR, EL RECEPTOR', () => {
  const m = motor(conCarriles([{
    duracion_ms: 3000,
    pases: [{ id: 'p1', de_id: 'A1', balon_id: 'b1', a_id: 'A2', path: recta([0.2, 0.8], [0.8, 0.8]), inicio_ms: 1000, duracion_ms: 500 }],
    movimientos: [
      { elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon', path: recta([0.8, 0.8], [0.8, 0.2]), inicio_ms: 1500, duracion_ms: 1500 },
    ],
  }]));
  const antes = en(m, 0, 500);
  ok(antes.carrying.has('A1') && !antes.carrying.has('A2'), 'antes del pase lo lleva A1');
  ok(Math.abs(antes.balls.b1.x - (0.2 + 0.012)) < 1e-9, `y va pegado a A1: ${txt(antes.balls.b1)}`);
  const enVuelo = en(m, 0, 1250);
  ok(!enVuelo.carrying.size, 'en vuelo no lo lleva nadie');
  const despues = en(m, 0, 2250);
  ok(despues.carrying.has('A2'), 'al llegar es de A2');
  ok(Math.abs(despues.balls.b1.y - despues.players.A2.y) < 1e-9, `y va con A2 mientras corre: balón ${txt(despues.balls.b1)}, A2 ${txt(despues.players.A2)}`);
  ok(despues.players.A2.y < 0.8, 'A2 ya está corriendo');
});

test('y en la fase siguiente el balón sigue siendo del receptor', () => {
  const m = motor(conCarriles([
    { duracion_ms: 2000, pases: [{ id: 'p1', de_id: 'A1', balon_id: 'b1', a_id: 'A2', path: recta([0.2, 0.8], [0.8, 0.8]), inicio_ms: 0, duracion_ms: 600 }] },
    { duracion_ms: 1000 },
  ]));
  const f = en(m, 1, 500);
  ok(f.carrying.has('A2'), 'A2 lo lleva en la fase 2');
  eq(m.restStart[1].owner.b1, 'A2');
});

test('un pase AL SUELO deja el balón donde cae, sin dueño', () => {
  const m = motor(conCarriles([
    { duracion_ms: 2000, pases: [{ id: 'p1', de_id: 'A1', balon_id: 'b1', a_id: null, path: recta([0.2, 0.8], [0.5, 0.5]), inicio_ms: 0, duracion_ms: 600 }] },
    { duracion_ms: 1000 },
  ]));
  const f = en(m, 0, 1500);
  ok(cerca(f.balls.b1, { x: 0.5, y: 0.5 }), `se queda donde cayó: ${txt(f.balls.b1)}`);
  ok(!f.carrying.size, 'y no lo lleva nadie');
  ok(cerca(en(m, 1, 0).balls.b1, { x: 0.5, y: 0.5 }), 'también al empezar la fase siguiente');
});

test('RECOGER: el balón es suyo al llegar a sus manos, no antes', () => {
  const m = motor(conCarriles([{
    duracion_ms: 2000,
    movimientos: [
      { elemento_id: 'A2', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_sin_balon', path: recta([0.8, 0.8], [0.5, 0.3]), inicio_ms: 0, duracion_ms: 2000 },
      { elemento_id: 'b1', tipo_elemento: 'balon', tipo_movimiento: 'recogida', path: recta([0.52, 0.28], [0.5, 0.3]), inicio_ms: 1500, duracion_ms: 500 },
    ],
    recogidas: [{ jugador_id: 'A2', balon_id: 'b1' }],
  }], null, [{ id: 'b1', posicion_inicial: [0.52, 0.28], portador_id: null }]));
  const antes = en(m, 0, 1000);
  ok(cerca(antes.balls.b1, { x: 0.52, y: 0.28 }), `a mitad de carrera el balón sigue en el suelo: ${txt(antes.balls.b1)}`);
  ok(!antes.carrying.has('A2'), 'y no es suyo todavía');
  eq(m.restStart.length, 1);
  const alFinal = en(m, 0, 2000);
  ok(Math.abs(alFinal.balls.b1.x - 0.5) < 0.02, `al final, en sus manos: ${txt(alFinal.balls.b1)}`);
});

/* ── 4. Lo que no puede romperse ─────────────────────────── */

test('UN CAMINO DE LONGITUD CERO NO REVIENTA EL MOTOR', () => {
  /* makeSampler se sale de su propia tabla con longitud cero. En el
     motor eso es quedarse quieto. */
  const m = motor(conCarriles([{
    duracion_ms: 1000,
    movimientos: [{ elemento_id: 'A1', tipo_elemento: 'jugador', tipo_movimiento: 'corte', path: recta([0.3, 0.3], [0.3, 0.3]), inicio_ms: 0, duracion_ms: 1000 }],
  }]));
  let f;
  try { f = en(m, 0, 500); } catch (e) { throw new Error(`ha reventado: ${e.message}`); }
  ok(cerca(f.players.A1, { x: 0.3, y: 0.3 }), `se queda quieto: ${txt(f.players.A1)}`);
});

test('LA INTERFAZ PÚBLICA SIGUE ENTERA: la usan proyector, miniatura y visor', () => {
  const m = motor(SAMPLE_ANIMACION);
  for (const k of ['load', 'play', 'pause', 'toggle', 'restart', 'nextPhase', 'prevPhase', 'siguienteRonda',
    'rondaAnterior', 'seek', 'setSpeed', 'setLoop', 'on', 'render', 'destroy', 'accionesDeFase']) {
    ok(typeof m[k] === 'function', `falta ${k}()`);
  }
  eq(m.phaseCount, 3);
  ok(typeof m.progress() === 'number' && typeof m.tNorm() === 'number', 'progress y tNorm');
});

test('seek sigue colocando la fase y el instante', () => {
  const m = motor(SAMPLE_ANIMACION);
  m.seek(0.5);
  ok(m.k >= 0 && m.k < m.phaseCount, 'una fase válida');
  const f = m._computePositions();
  ok(f.players.A1 && Number.isFinite(f.players.A1.x), 'y dónde está cada uno');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
