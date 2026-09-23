/* ============================================================
   eval-rondas-fila.mjs — banco Node de las rondas de una fila
   (taller/js/pizarra/rondas-fila.js). Sin red, sin DOM.

     node taller/tools/eval-rondas-fila.mjs

   Una fila que sale por rondas es UNA animación en la que los de la
   cola salen uno tras otro (§7.4.2; lo decidió el entrenador el
   2026-09-23). Lo que se prueba aquí es lo que decide si en el
   proyector se ve el ejercicio que el entrenador tiene en la cabeza:
   que cada uno repite lo del primero con SU balón y desde SU sitio, un
   turno más tarde; que quien le devuelve el pase o le pasa desde fuera
   lo hace con cada uno; y que lo que no puede salir no sale y se dice.
   ============================================================ */

import { conRondas, AVISOS_RONDAS } from '../js/pizarra/rondas-fila.js';
import { hacerFila, deLaFila, puestosDeFila, finalDeFila, FILAS } from '../js/pizarra/filas.js';
import { anadir, asignarBalon, reiniciarIds } from '../js/pizarra/elementos.js';
import { carrilesDesde, tiemposDe, TRAS_EL_TIRO_MS } from '../js/pizarra/fases.js';
import { metrosEntre } from '../js/canvas/escala.js';

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
const M = (a, b) => metrosEntre('entera', a, b);

const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
const P = (x, y) => ({ x, y });
const tr = (id, elemento_id, corre_id, accion, desde, hasta, extra = {}) => ({
  id, elemento_id, corre_id, receptor_id: null, accion, tipo: 'run', trazo: [N(desde.x, desde.y), N(hasta.x, hasta.y)], ...extra,
});
const ARO = P(0.5, 0.08);

/* Un cono con su cola, mirando hacia abajo; y quien haga falta fuera. */
function conFila({ n = 3, balon = true, rondas, cadencia_ms, x = 0.5, y = 0.6 } = {}) {
  reiniciarIds();
  let l = anadir([], { kind: 'cono' }, x, y);
  const conoId = l[0].id;
  l = hacerFila(l, conoId, { n, balon, orientacion: 90, ...(rondas === false ? { rondas: false } : {}), ...(cadencia_ms ? { cadencia_ms } : {}) }, 'entera');
  return { l, conoId };
}
const balonDe = (l, id) => (l.find((b) => b.kind === 'balon' && b.portador_id === id) || {}).id || null;
const cola = (l, conoId) => deLaFila(l, conoId);
const tiemposDeFase = (f) => tiemposDe({ ...f, carriles: carrilesDesde(f.tramos) }, { pista: 'entera' });
const copias = (r, i = 0) => r.fases[i].tramos.filter((t) => r.rondas[t.id]);

/* ── 1. Cuándo hay rondas ─────────────────────────────────── */

console.log('· cuándo hay rondas');

test('SIN FILAS, CON LAS RONDAS APAGADAS O SIN NADA DIBUJADO, NO CAMBIA NADA', () => {
  reiniciarIds();
  const suelto = anadir(anadir([], { kind: 'jugador' }, 0.5, 0.5), { kind: 'cono' }, 0.4, 0.4);
  const fases = [{ id: 'f1', tramos: [tr('tr1', suelto[0].id, suelto[0].id, 'corta', P(0.5, 0.5), P(0.5, 0.3))] }];
  const r = conRondas(fases, suelto);
  ok(r.fases === fases, 'las mismas fases, sin copiarlas');
  eq([r.balones, r.rondas, r.avisos], [[], {}, []]);

  const { l, conoId } = conFila({ rondas: false });
  const [a] = cola(l, conoId);
  const f2 = [{ id: 'f1', tramos: [tr('tr1', a.id, a.id, 'bota', a, P(0.5, 0.3))] }];
  ok(conRondas(f2, l).fases === f2, 'una fila con las rondas apagadas sale como se dibujó');

  const { l: l3 } = conFila();
  const vacias = [{ id: 'f1', tramos: [] }];
  eq(conRondas(vacias, l3).rondas, {}, 'sin nada dibujado con el primero no hay nada que repetir:');
});

/* ── 2. Cada uno repite lo del primero ────────────────────── */

console.log('· cada uno repite lo del primero');

function botaYTira(opciones = {}) {
  const { l, conoId } = conFila(opciones);
  const q = cola(l, conoId);
  const suyo = balonDe(l, q[0].id);
  const fin = P(0.5, 0.3);
  const fases = [{
    id: 'f1',
    tramos: [
      tr('tr1', q[0].id, q[0].id, 'bota', q[0], fin),
      tr('tr2', q[0].id, suyo, 'tira', fin, ARO, { tipo: 'shot', desenlace: 'entra' }),
    ],
  }];
  return { l, conoId, q, fases, fin };
}

test('CADA UNO DE LA COLA REPITE LO DEL PRIMERO, CON SU BALÓN', () => {
  const { l, q, fases } = botaYTira();
  const r = conRondas(fases, l);
  const c = copias(r);
  eq(c.map((t) => t.id), ['tr1_r1', 'tr2_r1', 'tr1_r2', 'tr2_r2'], 'dos que esperan, dos tramos cada uno:');
  eq(c.map((t) => t.elemento_id), [q[1].id, q[1].id, q[2].id, q[2].id], 'los hace cada uno:');
  eq(c.map((t) => t.corre_id), [q[1].id, balonDe(l, q[1].id), q[2].id, balonDe(l, q[2].id)], 'y el tiro, con su balón:');
  eq(r.rondas.tr2_r2, { ronda: 2, de: 'tr2', fila: l[0].id }, 'cada copia dice de dónde sale:');
  eq(r.avisos, []);
  eq(r.fases[0].tramos.slice(0, 2), fases[0].tramos, 'lo dibujado sigue igual y va delante');
});

test('SALEN UN TURNO MÁS TARDE QUE EL ANTERIOR: lo que dura la ronda, con el balón cayendo', () => {
  const { l, fases } = botaYTira();
  const r = conRondas(fases, l);
  const t0 = tiemposDeFase(fases[0]);
  const turno = t0.tramos.tr2.fin_ms + TRAS_EL_TIRO_MS - t0.tramos.tr1.inicio_ms;
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  for (const k of [1, 2]) {
    for (const id of ['tr1', 'tr2']) {
      const x = c[`${id}_r${k}`];
      ok(x.manual === true, `${id}_r${k} con arranque propio`);
      ok(cerca(x.inicio_ms, t0.tramos[id].inicio_ms + k * turno), `${id}_r${k}: ${x.inicio_ms} en vez de ${t0.tramos[id].inicio_ms + k * turno}`);
    }
  }
  const t1 = tiemposDeFase(r.fases[0]);
  ok(t1.duracion_ms >= c.tr2_r2.inicio_ms + t0.tramos.tr2.duracion_ms, 'la fase dura hasta el último');
});

test('CON CADENCIA, CADA UNO SALE A LA CADENCIA, aunque el anterior no haya acabado', () => {
  const { l, fases } = botaYTira({ cadencia_ms: 1500 });
  const r = conRondas(fases, l);
  const t0 = tiemposDeFase(fases[0]);
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  ok(cerca(c.tr1_r1.inicio_ms, 1500) && cerca(c.tr1_r2.inicio_ms, 3000), `${c.tr1_r1.inicio_ms}, ${c.tr1_r2.inicio_ms}`);
  ok(cerca(c.tr2_r2.inicio_ms, t0.tramos.tr2.inicio_ms + 3000), 'y lo demás de la ronda, con sus mismos tiempos');
});

test('CADA UNO SALE DE SU SITIO EN LA COLA y llega a donde llegó el primero', () => {
  const { l, conoId, q, fases, fin } = botaYTira();
  const r = conRondas(fases, l);
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  const sitios = puestosDeFila(l.find((e) => e.id === conoId), 3, 90, 'entera');
  ok(M(c.tr1_r1.trazo[0], sitios[1]) < 1e-9 && M(c.tr1_r2.trazo[0], sitios[2]) < 1e-9, 'de su puesto, no del cono');
  const u = (t) => t.trazo[t.trazo.length - 1];
  ok(M(u(c.tr1_r1), fin) < 1e-9 && M(u(c.tr1_r2), fin) < 1e-9, 'y acaba donde acabó el primero');
  ok(M(c.tr2_r2.trazo[0], fin) < 1e-9, 'el tiro sale de donde acabó su bote');
  eq(q.map((j) => j.puesto), [0, 1, 2]);
});

test('RECOGER SU PROPIO TIRO: cada uno va a por SU balón', () => {
  const { l, q, fases, fin } = botaYTira();
  const suyo = balonDe(l, q[0].id);
  fases[0].tramos.push(tr('tr3', q[0].id, q[0].id, 'recoge', fin, P(0.5, 0.12), { balon_id: suyo, balon_desde: P(0.5, 0.12) }));
  const r = conRondas(fases, l);
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  eq([c.tr3_r1.balon_id, c.tr3_r2.balon_id], [balonDe(l, q[1].id), balonDe(l, q[2].id)]);
});

/* ── 3. El balón ──────────────────────────────────────────── */

console.log('· el balón');

test('SI LA RONDA NECESITA BALÓN Y ALGUNO NO LO TIENE, ESA RONDA NO SALE, y se dice', () => {
  const { l: base, conoId } = conFila({ balon: false });
  const q = cola(base, conoId);
  reiniciarIds();
  let l = anadir(base, { kind: 'balon' }, q[0].x, q[0].y);
  const b0 = l[l.length - 1].id;
  l = asignarBalon(l, b0, q[0].id, 'entera');
  /* Solo el TERCERO tiene balón: sale él, en su turno, y el segundo no. */
  l = anadir(l, { kind: 'balon' }, q[2].x, q[2].y);
  const b2 = l[l.length - 1].id;
  l = asignarBalon(l, b2, q[2].id, 'entera');
  const fases = [{ id: 'f1', tramos: [tr('tr1', q[0].id, q[0].id, 'bota', q[0], P(0.5, 0.3))] }];
  const r = conRondas(fases, l);
  eq(copias(r).map((t) => t.id), ['tr1_r2'], 'bota con él: sin balón no se repite:');
  eq(r.avisos, [AVISOS_RONDAS.sinBalon]);
});

test('LO QUE NO NECESITA BALÓN SE REPITE AUNQUE NO LO TENGAN', () => {
  const { l, conoId } = conFila({ balon: false });
  const q = cola(l, conoId);
  const fases = [{ id: 'f1', tramos: [tr('tr1', q[0].id, q[0].id, 'corta', q[0], P(0.5, 0.3))] }];
  const r = conRondas(fases, l);
  eq(copias(r).map((t) => t.elemento_id), [q[1].id, q[2].id]);
  eq(r.avisos, []);
});

test('PASA Y VA: EL QUE LE DEVUELVE EL PASE SE LO DEVUELVE A CADA UNO, con su balón', () => {
  const { l: base, conoId } = conFila();
  reiniciarIds();
  const l = anadir(base, { kind: 'jugador', equipo: 'A' }, 0.8, 0.4);
  const R = l[l.length - 1];
  const q = cola(l, conoId);
  const suyo = balonDe(l, q[0].id);
  const fin = P(0.5, 0.3);
  const fases = [{
    id: 'f1',
    tramos: [
      tr('tr1', q[0].id, suyo, 'pasa', q[0], R, { tipo: 'pass', receptor_id: R.id }),
      tr('tr2', q[0].id, q[0].id, 'corta', q[0], fin),
      tr('tr3', R.id, suyo, 'pasa', R, fin, { tipo: 'pass', receptor_id: q[0].id }),
      tr('tr4', q[0].id, suyo, 'tira', fin, ARO, { tipo: 'shot', desenlace: 'entra' }),
    ],
  }];
  const r = conRondas(fases, l);
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  eq(Object.keys(c).length, 8, 'los cuatro tramos, en las dos rondas:');
  for (const k of [1, 2]) {
    const j = q[k].id, b = balonDe(l, j);
    eq([c[`tr1_r${k}`].corre_id, c[`tr1_r${k}`].receptor_id], [b, R.id], `ronda ${k}: le pasa SU balón:`);
    eq([c[`tr3_r${k}`].elemento_id, c[`tr3_r${k}`].corre_id, c[`tr3_r${k}`].receptor_id], [R.id, b, j], `ronda ${k}: y se lo devuelve a él:`);
    ok(M(c[`tr3_r${k}`].trazo[0], R) < 1e-9, 'desde donde está el que devuelve');
  }
  eq(r.balones, [], 'con balón propio no hace falta el carro:');
});

test('EL QUE PASA DESDE FUERA TIENE UN BALÓN PARA CADA UNO: el carro', () => {
  const { l: base, conoId } = conFila({ balon: false });
  reiniciarIds();
  let l = anadir(base, { kind: 'jugador', equipo: 'B' }, 0.8, 0.3);
  const R = l[l.length - 1];
  l = anadir(l, { kind: 'balon' }, R.x, R.y);
  const C = l[l.length - 1].id;
  l = asignarBalon(l, C, R.id, 'entera');
  const q = cola(l, conoId);
  const fin = P(0.5, 0.3);
  const fases = [{
    id: 'f1',
    tramos: [
      tr('tr1', q[0].id, q[0].id, 'corta', q[0], fin),
      tr('tr2', R.id, C, 'pasa', R, fin, { tipo: 'pass', receptor_id: q[0].id }),
      tr('tr3', q[0].id, C, 'tira', fin, ARO, { tipo: 'shot', desenlace: 'entra' }),
    ],
  }];
  const r = conRondas(fases, l);
  eq(r.balones.map((b) => [b.id, b.kind, b.portador_id]), [[`${C}_r1`, 'balon', R.id], [`${C}_r2`, 'balon', R.id]],
    'uno más por ronda, en las manos del que pasa:');
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  eq([c.tr2_r1.corre_id, c.tr2_r1.receptor_id, c.tr3_r1.corre_id], [`${C}_r1`, q[1].id, `${C}_r1`]);
  eq([c.tr2_r2.corre_id, c.tr2_r2.receptor_id, c.tr3_r2.corre_id], [`${C}_r2`, q[2].id, `${C}_r2`]);
  eq(r.avisos, [], 'la ronda no necesita el balón de la cola:');
});

test('LO QUE LOS DEMÁS HACEN POR SU CUENTA NO SE REPITE', () => {
  const { l: base, conoId } = conFila();
  reiniciarIds();
  const l = anadir(base, { kind: 'jugador', equipo: 'A' }, 0.2, 0.4);
  const S = l[l.length - 1];
  const q = cola(l, conoId);
  const fases = [{
    id: 'f1',
    tramos: [
      tr('tr1', S.id, S.id, 'corta', S, P(0.2, 0.2)),
      tr('tr2', q[0].id, q[0].id, 'bota', q[0], P(0.5, 0.3)),
    ],
  }];
  const r = conRondas(fases, l);
  eq(copias(r).map((t) => t.id), ['tr2_r1', 'tr2_r2']);
});

/* ── 4. Volver, varias colas, varias fases ───────────────── */

console.log('· volver, varias colas, varias fases');

test('VUELVE A LA FILA: CADA UNO SE PONE DETRÁS DEL QUE VOLVIÓ ANTES', () => {
  const { l, conoId } = conFila({ n: 3 });
  const q = cola(l, conoId);
  const cono = l.find((e) => e.id === conoId);
  const fin = P(0.5, 0.3);
  const fases = [{
    id: 'f1',
    tramos: [
      tr('tr1', q[0].id, q[0].id, 'bota', q[0], fin),
      tr('tr2', q[0].id, q[0].id, 'vuelve_a_fila', fin, finalDeFila(cono, 3, 90, 'entera')),
    ],
  }];
  const r = conRondas(fases, l);
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  const u = (t) => t.trazo[t.trazo.length - 1];
  ok(cerca(M(u(c.tr2_r1), cono), FILAS.hueco * 4, 1e-6), `el segundo, un hueco detrás del primero: ${M(u(c.tr2_r1), cono)}`);
  ok(cerca(M(u(c.tr2_r2), cono), FILAS.hueco * 5, 1e-6), 'y el tercero, detrás del segundo');
  ok(M(c.tr2_r1.trazo[0], fin) < 1e-9, 'saliendo de donde acabó su bote');
});

test('DOS COLAS QUE JUEGAN ENTRE SÍ SALEN A LA PAR, tantas rondas como la más corta', () => {
  reiniciarIds();
  let l = anadir([], { kind: 'cono' }, 0.3, 0.6);
  const ca = l[0].id;
  l = anadir(l, { kind: 'cono' }, 0.7, 0.6);
  const cb = l[1].id;
  l = hacerFila(l, ca, { n: 3, balon: true, orientacion: 90 }, 'entera');
  l = hacerFila(l, cb, { n: 4, balon: false, orientacion: 90 }, 'entera');
  const qa = cola(l, ca), qb = cola(l, cb);
  const suyo = balonDe(l, qa[0].id);
  const fases = [{
    id: 'f1',
    tramos: [
      tr('tr1', qa[0].id, suyo, 'pasa', qa[0], qb[0], { tipo: 'pass', receptor_id: qb[0].id }),
      tr('tr2', qb[0].id, suyo, 'tira', qb[0], ARO, { tipo: 'shot', desenlace: 'entra' }),
    ],
  }];
  const r = conRondas(fases, l);
  const c = Object.fromEntries(copias(r).map((t) => [t.id, t]));
  eq(Object.keys(c).sort(), ['tr1_r1', 'tr1_r2', 'tr2_r1', 'tr2_r2'], 'dos rondas: la cola de tres manda:');
  for (const k of [1, 2]) {
    eq([c[`tr1_r${k}`].elemento_id, c[`tr1_r${k}`].receptor_id], [qa[k].id, qb[k].id], `ronda ${k}: el ${k + 1}.º con el ${k + 1}.º:`);
    eq(c[`tr2_r${k}`].corre_id, balonDe(l, qa[k].id), 'y tira el balón que le han pasado:');
  }
  eq(r.avisos, [AVISOS_RONDAS.desiguales]);
});

test('QUIEN DE LA COLA YA TIENE ALGO DIBUJADO HACE LO SUYO, y los demás salen en su turno', () => {
  const { l, conoId, q, fases } = botaYTira();
  fases[0].tramos.push(tr('tr9', q[1].id, q[1].id, 'corta', q[1], P(0.9, 0.9)));
  const r = conRondas(fases, l);
  eq(copias(r).map((t) => t.elemento_id), [q[2].id, q[2].id], 'solo el tercero:');
  const t0 = tiemposDeFase(fases[0]);
  const turno = t0.tramos.tr2.fin_ms + TRAS_EL_TIRO_MS - t0.tramos.tr1.inicio_ms;
  ok(cerca(copias(r)[0].inicio_ms, 2 * turno), 'en su turno, el segundo');
  eq(deLaFila(l, conoId).length, 3);
});

test('EN VARIAS FASES, CADA UNO SIGUE DESDE DONDE LE DEJÓ SU RONDA', () => {
  const { l, conoId } = conFila();
  const q = cola(l, conoId);
  const suyo = balonDe(l, q[0].id);
  const fin = P(0.5, 0.3);
  const fases = [
    { id: 'f1', tramos: [tr('tr1', q[0].id, q[0].id, 'bota', q[0], fin)] },
    { id: 'f2', tramos: [tr('tr2', q[0].id, suyo, 'tira', fin, ARO, { tipo: 'shot', desenlace: 'entra' })] },
  ];
  const r = conRondas(fases, l);
  const c = Object.fromEntries(copias(r, 1).map((t) => [t.id, t]));
  eq(Object.keys(c), ['tr2_r1', 'tr2_r2']);
  ok(M(c.tr2_r1.trazo[0], fin) < 1e-9 && M(c.tr2_r2.trazo[0], fin) < 1e-9, 'tiran desde donde acabaron de botar en la fase 1');
  eq(c.tr2_r2.corre_id, balonDe(l, q[2].id));
});

test('UNA FASE CON LA DURACIÓN PUESTA A MANO SE ALARGA PARA QUE QUEPAN TODAS', () => {
  const { l, fases } = botaYTira();
  fases[0].duracion_ms = 1000;
  const r = conRondas(fases, l);
  const t = tiemposDeFase({ ...r.fases[0], duracion_ms: null });
  ok(r.fases[0].duracion_ms >= t.duracion_ms && t.duracion_ms > 1000, `${r.fases[0].duracion_ms} para ${t.duracion_ms}`);
  const sin = conRondas([{ ...fases[0], duracion_ms: 99999 }], l);
  eq(sin.fases[0].duracion_ms, 99999, 'y si ya caben, no se toca:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
