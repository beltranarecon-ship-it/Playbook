/* ============================================================
   eval-jugada.mjs — banco Node de reabrir lo guardado
   (taller/js/pizarra/motor/jugada.js). Sin red, sin DOM.

     node taller/tools/eval-jugada.mjs

   Lo que se vigila es que abrir un ejercicio NO REVIENTE NUNCA, venga
   lo que venga de la base de datos, y que lo que se deje fuera se diga.
   Y dos cosas que solo fallan al reabrir, nunca al dibujar por primera
   vez: que la numeración de fichas y tramos siga donde se quedó, y que
   un ejercicio de antes de la Pizarra se abra con sus mismos jugadores.
   ============================================================ */

import { normalizarJugada, jugadaDesdeAnimacion } from '../js/pizarra/motor/jugada.js';
import { compilar, VERSION_JUGADA } from '../js/pizarra/motor/compilar.js';
import { continuarIds, nuevoId, reiniciarIds } from '../js/pizarra/elementos.js';
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

const N = (x, y) => ({ x, y, tipo_nodo: 'lineal', handle_in: null, handle_out: null });
const buena = () => ({
  version: 3, pista: 'media', canasta: 'sur',
  elementos: [
    { id: 'jugador_1', kind: 'jugador', x: 0.3, y: 0.8, equipo: 'A', label: '1', dorsal: null, nombre: null, en_juego: true },
    { id: 'jugador_2', kind: 'jugador', x: 0.7, y: 0.8, equipo: 'A', label: '2', dorsal: null, nombre: null, en_juego: true },
    { id: 'balon_3', kind: 'balon', x: 0.34, y: 0.8, portador_id: 'jugador_1' },
  ],
  fases: [
    { id: 'f1', nombre: null, duracion_ms: null, pausa_post_ms: null, tramos: [
      { id: 'tr4', elemento_id: 'jugador_2', corre_id: 'jugador_2', accion: 'corta', trazo: [N(0.7, 0.8), N(0.7, 0.3)], tipo: 'cut', ritmo: 'normal' },
    ] },
    { id: 'f2', nombre: null, duracion_ms: null, pausa_post_ms: 800, tramos: [
      { id: 'tr9', elemento_id: 'jugador_1', corre_id: 'jugador_1', accion: 'bota', trazo: [N(0.3, 0.8), N(0.3, 0.4)], tipo: 'run', ritmo: 'normal' },
    ] },
  ],
});

/* ── 1. Lo que llega bien, se abre tal cual ──────────────── */

test('UNA JUGADA BUENA SE ABRE ENTERA Y SIN AVISOS', () => {
  const r = normalizarJugada(buena());
  eq(r.avisos, []);
  eq(r.jugada.pista, 'media');
  eq(r.jugada.canasta, 'sur');
  eq(r.jugada.elementos.length, 3);
  eq(r.jugada.fases.map((f) => f.tramos.length), [1, 1]);
  eq(r.jugada.fases[1].pausa_post_ms, 800, 'lo puesto a mano se conserva:');
  eq(r.jugada.defensa, { preajuste: 'entre_par_y_aro', parametros: {}, situacion: null, ataca: null },
    'sin defensa guardada, la de serie, sin avisar:');
});

test('LA DEFENSA GUARDADA SE CONSERVA, y la rota se arregla diciéndolo', () => {
  const j = buena();
  j.defensa = { preajuste: 'presion', parametros: { presion: 0.6 }, situacion: null, ataca: 'nadie' };
  eq(normalizarJugada(j).jugada.defensa, j.defensa);
  j.defensa = { preajuste: 'inventada' };
  const r = normalizarJugada(j);
  eq(r.jugada.defensa.preajuste, 'entre_par_y_aro');
  ok(r.avisos.some((a) => /regla de la defensa/.test(a)), `y se dice: ${r.avisos}`);
});

test('UN DEFENSOR QUE DEFENDÍA A ALGUIEN QUE NO ESTÁ SE EMPAREJA SOLO, y se dice', () => {
  const j = buena();
  j.elementos[1] = { ...j.elementos[1], defiende_a: 'jugador_9', regla_defensa: 'zona' };
  const r = normalizarJugada(j);
  eq([r.jugada.elementos[1].defiende_a, r.jugada.elementos[1].regla_defensa], [null, null]);
  ok(r.avisos.some((a) => /ya no está/.test(a)) && r.avisos.some((a) => /regla que no se conoce/.test(a)), `${r.avisos}`);
});

test('y lo abierto se compila como lo guardado', () => {
  const r = normalizarJugada(buena());
  const a = compilar(r.jugada);
  eq(a.fases.length, 2);
  eq(a.jugadores.map((j) => j.id), ['A1', 'A2']);
  eq(a.balones[0].portador_id, 'A1');
});

test('LA NUMERACIÓN DE TRAMOS SIGUE DONDE SE QUEDÓ', () => {
  /* Empezando otra vez desde 1, el primer tramo nuevo se llamaría igual
     que uno guardado, y corregir uno movería el otro. */
  eq(normalizarJugada(buena()).siguienteTramo, 10, 'después del tr9:');
});

test('no toca lo que recibe', () => {
  const b = buena();
  const copia = JSON.parse(JSON.stringify(b));
  const r = normalizarJugada(b);
  r.jugada.fases[0].tramos[0].trazo[0].x = 99;
  r.jugada.elementos[0].x = 99;
  eq(b, copia, 'lo guardado ha cambiado:');
});

/* ── 2. Lo que llega mal, NO REVIENTA ────────────────────── */

test('SIN JUGADA NO HAY NADA QUE ABRIR, y lo dice', () => {
  for (const x of [null, undefined, 'hola', 42, {}, { elementos: 'no' }]) {
    const r = normalizarJugada(x);
    eq(r.jugada, null, `con ${JSON.stringify(x)}:`);
    ok(r.avisos.length, 'y lo dice');
  }
});

test('una jugada sin fases se abre con la primera vacía', () => {
  const r = normalizarJugada({ elementos: [] });
  eq(r.jugada.fases.length, 1);
  eq(r.jugada.fases[0].tramos, []);
  eq(r.jugada.pista, 'entera', 'y con la pista de siempre:');
  eq(r.jugada.canasta, 'norte');
});

test('UNA FICHA ROTA SE QUEDA FUERA, pero se avisa', () => {
  const b = buena();
  b.elementos.push({ id: 'cono_7', kind: 'cono', x: 'mucho', y: 0.5 });
  b.elementos.push(null);
  const r = normalizarJugada(b);
  eq(r.jugada.elementos.length, 3);
  eq(r.avisos.length, 2);
});

test('dos fichas con el mismo nombre: se queda la primera', () => {
  const b = buena();
  b.elementos.push({ ...b.elementos[0], x: 0.9 });
  const r = normalizarJugada(b);
  eq(r.jugada.elementos.length, 3);
  eq(r.jugada.elementos[0].x, 0.3, 'la primera:');
  ok(r.avisos.some((a) => /mismo nombre/.test(a)));
});

test('un balón de alguien que ya no está se queda suelto', () => {
  const b = buena();
  b.elementos = b.elementos.filter((e) => e.id !== 'jugador_1');
  const r = normalizarJugada(b);
  eq(r.jugada.elementos.find((e) => e.kind === 'balon').portador_id, null);
  ok(r.avisos.some((a) => /suelto/.test(a)));
});

test('UN TRAZO ROTO NO SE PUEDE DIBUJAR: fuera, y dicho', () => {
  const b = buena();
  b.fases[0].tramos.push({ id: 'tr12', elemento_id: 'jugador_1', accion: 'corta', trazo: [N(0.1, 0.1)] });
  b.fases[0].tramos.push({ id: 'tr13', elemento_id: 'jugador_1', accion: 'corta', trazo: [N(0.1, 0.1), { x: NaN, y: 0 }] });
  const r = normalizarJugada(b);
  eq(r.jugada.fases[0].tramos.length, 1);
  eq(r.avisos.filter((a) => /roto/.test(a)).length, 2);
});

test('UN TRAMO SIN PROTAGONISTA SE CONSERVA: el §6.5 manda marcarlo, no borrarlo', () => {
  const b = buena();
  b.elementos = b.elementos.filter((e) => e.id !== 'jugador_2');
  const r = normalizarJugada(b);
  eq(r.jugada.fases[0].tramos.length, 1, 'sigue ahí:');
  ok(r.avisos.some((a) => /protagonista/.test(a)), 'y se avisa');
});

test('una versión más nueva se abre igual, avisando', () => {
  const r = normalizarJugada({ ...buena(), version: VERSION_JUGADA + 1 });
  ok(r.jugada, 'se abre');
  ok(r.avisos.some((a) => /más nueva/.test(a)));
});

test('dos fases con el mismo id se separan', () => {
  const b = buena();
  b.fases[1].id = 'f1';
  const ids = normalizarJugada(b).jugada.fases.map((f) => f.id);
  eq(new Set(ids).size, 2, `ids repetidos: ${ids}`);
});

/* ── 3. Los ejercicios de antes (§11.4) ──────────────────── */

test('UN EJERCICIO DE ANTES SE ABRE CON SUS POSICIONES Y UNA FASE VACÍA', () => {
  const j = jugadaDesdeAnimacion(SAMPLE_ANIMACION);
  eq(j.fases.length, 1);
  eq(j.fases[0].tramos, []);
  eq(j.elementos.filter((e) => e.kind === 'jugador').length, SAMPLE_ANIMACION.jugadores.length);
  eq(j.elementos.filter((e) => e.kind === 'balon').length, SAMPLE_ANIMACION.balones.length);
  const a1 = j.elementos.find((e) => e.id === 'A1');
  eq([a1.x, a1.y], SAMPLE_ANIMACION.jugadores[0].posicion_inicial);
});

test('Y SUS JUGADORES SIGUEN SIENDO LOS MISMOS al compilarlo otra vez', () => {
  /* El número que se pinta sale del nombre: A1 tiene que seguir siendo
     A1, no convertirse en otro jugador al rehacer la pizarra. */
  const a = compilar(jugadaDesdeAnimacion(SAMPLE_ANIMACION));
  eq(a.jugadores.map((x) => x.id), SAMPLE_ANIMACION.jugadores.map((x) => x.id));
  eq(a.jugadores.map((x) => x.posicion_inicial), SAMPLE_ANIMACION.jugadores.map((x) => x.posicion_inicial));
  eq(a.balones[0].portador_id, SAMPLE_ANIMACION.balones[0].portador_id, 'con el balón en las mismas manos:');
});

test('lo que no es una animación no se abre', () => {
  eq(jugadaDesdeAnimacion(null), null);
  eq(jugadaDesdeAnimacion('x'), null);
  eq(jugadaDesdeAnimacion({}).elementos, []);
});

/* ── 4. La numeración de fichas ──────────────────────────── */

test('AL REABRIR, LA FICHA NUEVA NO SE LLAMA COMO UNA GUARDADA', () => {
  /* Si no, las dos se seleccionarían y se moverían juntas. */
  reiniciarIds();
  continuarIds(buena().elementos);
  const nueva = nuevoId('jugador');
  ok(!buena().elementos.some((e) => e.id === nueva), `${nueva} ya existía`);
  eq(nueva, 'jugador_4');
});

test('continuarIds solo sube la cuenta, nunca la baja', () => {
  reiniciarIds();
  continuarIds([{ id: 'jugador_20' }]);
  continuarIds([{ id: 'jugador_3' }, { id: 'A1' }, null, {}]);
  eq(nuevoId('cono'), 'cono_21');
});

test('UN TIRO GUARDADO SIN DESENLACE SE ABRE COMO «ENTRA», y se dice', () => {
  const j = buena();
  j.fases[1].tramos.push({ id: 'tr10', elemento_id: 'jugador_1', corre_id: 'balon_3', accion: 'tira', trazo: [N(0.3, 0.4), N(0.5, 0.1)], tipo: 'pass', ritmo: 'tiro' });
  const r = normalizarJugada(j);
  eq(r.jugada.fases[1].tramos.find((t) => t.id === 'tr10').desenlace, 'entra');
  ok(r.avisos.some((a) => /sin desenlace/.test(a)), `tiene que decirlo: ${r.avisos}`);
});

test('el que ya lo tiene lo conserva, y a lo que no es un tiro no se le pone', () => {
  const j = buena();
  j.fases[1].tramos.push({ id: 'tr10', elemento_id: 'jugador_1', corre_id: 'balon_3', accion: 'tira', desenlace: 'falla', trazo: [N(0.3, 0.4), N(0.5, 0.1)], tipo: 'pass', ritmo: 'tiro' });
  const r = normalizarJugada(j);
  eq(r.jugada.fases[1].tramos.find((t) => t.id === 'tr10').desenlace, 'falla');
  ok(!('desenlace' in r.jugada.fases[0].tramos[0]), 'un corte no tiene desenlace');
  ok(!r.avisos.some((a) => /desenlace/.test(a)), 'y no se avisa de nada');
});

test('UN BLOQUEO SIN SU COMPAÑERO SE CONSERVA, y se dice', () => {
  const j = buena();
  j.fases[0].tramos.push({ id: 'tr11', elemento_id: 'jugador_2', corre_id: 'jugador_2', companero_id: 'jugador_9', accion: 'bloquea', trazo: [N(0.7, 0.3), N(0.5, 0.3)], tipo: 'bloqueo', ritmo: 'normal' });
  const r = normalizarJugada(j);
  const t = r.jugada.fases[0].tramos.find((x) => x.id === 'tr11');
  ok(t && t.companero_id === 'jugador_9', 'se conserva tal cual');
  ok(r.avisos.some((a) => /compañero/.test(a)), `y se dice: ${r.avisos}`);
  ok(!normalizarJugada(buena()).avisos.some((a) => /compañero/.test(a)), 'sin bloqueos no se habla de compañeros');
});

test('LO QUE UN DEFENSOR HACE DISTINTO SE GUARDA EN SU FASE, y lo roto se dice', () => {
  const j = normalizarJugada({
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'A1', kind: 'jugador', equipo: 'A', x: 0.3, y: 0.7 },
      { id: 'B1', kind: 'jugador', equipo: 'B', x: 0.3, y: 0.5 },
    ],
    fases: [{
      id: 'f1', tramos: [],
      defensa: {
        B1: { accion: 'ayuda', objetivo_id: 'A1' },
        B9: { accion: 'sobrepasado' },
        A1: { accion: 'baila' },
      },
    }],
  });
  eq(j.jugada.fases[0].defensa, { B1: { accion: 'ayuda', objetivo_id: 'A1' } });
  eq(j.avisos.filter((a) => /defensa/.test(a)).length, 2, 'las dos que se caen se dicen:');
  const vacia = normalizarJugada({ version: 3, elementos: [], fases: [{ id: 'f1', tramos: [] }] });
  eq(vacia.jugada.fases[0].defensa, {}, 'una fase sin nada declarado trae el hueco vacío:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
