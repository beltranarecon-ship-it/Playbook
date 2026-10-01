/* ============================================================
   eval-plantillas.mjs — banco Node de las colocaciones y fases guardadas
   (taller/js/pizarra/plantillas.js, ESPEC-PIZARRA-v3 §7.8).
   Sin red, sin DOM.

     node taller/tools/eval-plantillas.mjs
   ============================================================ */

import {
  TIPOS_PLANTILLA, MAX_NOMBRE_PLANTILLA, nombreDePlantilla, normalizarPlantilla,
  colocacionDe, ponerColocacion, plantillaDeFase, papelesPorDefecto, tramosDePlantilla,
} from '../js/pizarra/plantillas.js';
import { anadir, asignarBalon, reiniciarIds, numeroDe } from '../js/pizarra/elementos.js';
import { hacerFila, deLaFila } from '../js/pizarra/filas.js';
import { trazoDeIdaYVuelta } from '../js/pizarra/trazo.js';
import { readFileSync } from 'node:fs';

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
const nombreDe = (e) => `${e.equipo}${numeroDe(e)}`;
const r6 = (v) => Number(v.toFixed(6));

/* A1 con balón, A2, B1, un cono de fila de 3 y un cono suelto. */
function escena() {
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.3, 0.6);
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.7, 0.6);
  l = anadir(l, { kind: 'jugador', equipo: 'B' }, 0.5, 0.4);
  l = anadir(l, { kind: 'balon' }, 0.33, 0.6);
  const [a1, a2, b1, bal] = l;
  l = asignarBalon(l, bal.id, a1.id, 'entera');
  l = anadir(l, { kind: 'cono' }, 0.5, 0.8);
  const cono = l[l.length - 1];
  l = hacerFila(l, cono.id, { n: 3, equipo: 'A', balon: true, orientacion: 90 }, 'entera');
  l = anadir(l, { kind: 'cono' }, 0.2, 0.2);
  return { l, a1, a2, b1, bal, cono };
}

console.log('· el nombre y la fila de la tabla');

test('EL NOMBRE: obligatorio, limpio y con tope', () => {
  eq(nombreDePlantilla('  1-4   alto '), { nombre: '1-4 alto', error: null });
  eq(nombreDePlantilla('   ').error, 'ponle un nombre');
  ok(/demasiado largo/.test(nombreDePlantilla('x'.repeat(MAX_NOMBRE_PLANTILLA + 1)).error));
  eq(TIPOS_PLANTILLA, ['colocacion', 'fase']);
});

test('LA FILA DE LA TABLA SE SANEA: lo que no es una plantilla, fuera', () => {
  eq(normalizarPlantilla({ id: 'u', tipo: 'colocacion', nombre: ' Cinco ', pista: 'media', datos: { elementos: [] } }), { id: 'u', tipo: 'colocacion', nombre: 'Cinco', pista: 'media', datos: { elementos: [] } });
  eq([
    normalizarPlantilla({ tipo: 'otra', nombre: 'x', datos: {} }),
    normalizarPlantilla({ tipo: 'colocacion', nombre: '', datos: { elementos: [] } }),
    normalizarPlantilla({ tipo: 'colocacion', nombre: 'x', datos: {} }),
    normalizarPlantilla({ tipo: 'fase', nombre: 'x', datos: { papeles: [] } }),
    normalizarPlantilla(null),
  ], [null, null, null, null, null]);
});

test('LA MIGRACIÓN 045 CREA LA TABLA con los dos tipos y el mismo tope de nombre', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/045_plantillas.sql', import.meta.url), 'utf8');
  ok(/CREATE TABLE IF NOT EXISTS public\.plantillas/.test(sql));
  ok(/tipo IN \('colocacion', 'fase'\)/.test(sql), 'los dos tipos');
  ok(new RegExp(`BETWEEN 1 AND ${MAX_NOMBRE_PLANTILLA}`).test(sql), 'el tope del nombre');
});

console.log('· colocaciones');

test('UNA COLOCACIÓN SE PONE DE NUEVO: los mismos sitios, con su balón y su fila, y nombres que no chocan', () => {
  const { l } = escena();
  const datos = JSON.parse(JSON.stringify(colocacionDe(l)));
  reiniciarIds();
  const r = ponerColocacion([], datos, 'entera');
  const j = r.elementos.filter((e) => e.kind === 'jugador');
  eq(j.filter((e) => !e.fila_de).map((e) => [nombreDe(e), e.x, e.y]), [['A1', 0.3, 0.6], ['A2', 0.7, 0.6], ['B1', 0.5, 0.4]]);
  const a1 = j[0];
  ok(r.elementos.some((e) => e.kind === 'balon' && e.portador_id === a1.id), 'A1 lleva su balón');
  const cono = r.elementos.find((e) => e.kind === 'cono' && e.fila);
  eq([cono.x, cono.y, cono.fila.n, deLaFila(r.elementos, cono.id).length], [0.5, 0.8, 3, 3], 'la fila, con su cola:');
  eq(r.elementos.filter((e) => e.kind === 'balon').length, 4, 'un balón de A1 y tres de la fila, ni uno más:');
  eq(r.elementos.filter((e) => e.kind === 'cono').length, 2);
  eq(r.puestas, 6, 'tres jugadores, un balón y dos conos; lo de la fila lo pone la fila:');
  eq(new Set(r.elementos.map((e) => e.id)).size, r.elementos.length, 'sin nombres repetidos');
});

test('AÑADIDA A LO QUE YA HAY, se numera detrás y no toca lo que estaba', () => {
  reiniciarIds();
  let l = anadir([], { kind: 'jugador', equipo: 'A' }, 0.1, 0.1);
  const datos = colocacionDe([
    { id: 'jugador_1', kind: 'jugador', equipo: 'A', x: 0.4, y: 0.5, en_juego: true },
    { id: 'jugador_2', kind: 'jugador', equipo: 'A', x: 0.6, y: 0.5, en_juego: false },
    { id: 'balon_3', kind: 'balon', x: 0.43, y: 0.5, portador_id: 'jugador_1' },
    { id: 'zona_9', kind: 'zona', x: 0.5, y: 0.5 },
  ]);
  const r = ponerColocacion(l, datos, 'entera');
  eq(r.elementos.filter((e) => e.kind === 'jugador').map((e) => [e.x, e.label, e.en_juego]), [[0.1, '1', true], [0.4, '2', true], [0.6, null, false]]);
  eq(r.puestas, 3, 'lo que no es una ficha del panel no se pone:');
  const nuevo = r.elementos.find((e) => e.x === 0.4);
  ok(nuevo.id !== 'jugador_1' && r.elementos.some((e) => e.kind === 'balon' && e.portador_id === nuevo.id), 'con otro nombre, y el balón es del nuevo');
  l = r.elementos;
  eq(ponerColocacion(l, { elementos: [] }, 'entera').puestas, 0);
});

console.log('· fases');

/* A2 corta a (0.7, 0.3); A1 le pasa allí; A1 finta. */
function faseDeEjemplo() {
  const { l, a1, a2, bal } = escena();
  const fase = { id: 'f1', tramos: [
    { id: 'tr1', elemento_id: a2.id, corre_id: a2.id, accion: 'corta', variante: 'puerta_atras', tipo: 'cut', ritmo: 'normal', trazo: [N(0.7, 0.6), N(0.7, 0.3)] },
    { id: 'tr2', elemento_id: a1.id, corre_id: bal.id, receptor_id: a2.id, accion: 'pasa', variante: null, tipo: 'pass', ritmo: 'normal', trazo: [N(0.3, 0.6), N(0.7, 0.3)] },
    { id: 'tr3', elemento_id: a1.id, corre_id: a1.id, accion: 'finta', tipo: 'gesto', ritmo: 'normal', trazo: trazoDeIdaYVuelta({ x: 0.3, y: 0.6 }, { x: 0.3, y: 0.5 }) },
    { id: 'tr4', elemento_id: a2.id, corre_id: a2.id, accion: 'recoge', tipo: 'cut', balon_id: 'balon_99', trazo: [N(0.7, 0.3), N(0.6, 0.2)] },
  ] };
  return { l, a1, a2, bal, fase };
}

test('LA PLANTILLA DE UNA FASE: papeles en vez de fichas, y lo que no se puede llevar, dicho', () => {
  const { l, fase } = faseDeEjemplo();
  const { datos, avisos } = plantillaDeFase(fase, l, { nombreDe });
  eq(datos.papeles, [{ clave: 'p1', equipo: 'A', nombre: 'A2', en: { x: 0.7, y: 0.6 } }, { clave: 'p2', equipo: 'A', nombre: 'A1', en: { x: 0.3, y: 0.6 } }]);
  eq(datos.tramos.map((t) => [t.accion, t.quien, t.receptor, t.vuela, t.variante]), [['corta', 'p1', null, false, 'puerta_atras'], ['pasa', 'p2', 'p1', true, null], ['finta', 'p2', null, false, null]]);
  ok(!JSON.stringify(datos).includes('jugador_') && !JSON.stringify(datos).includes('balon_'), 'ni un nombre de ficha dentro');
  ok(avisos.length === 1 && /recoge/.test(avisos[0]), avisos.join(' | '));
});

test('INSERTADA EN OTRA ESCENA: cada trazo sale de donde está su ficha, y el pase va a quien lo recibe', () => {
  const { l, fase } = faseDeEjemplo();
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  /* Otros dos jugadores, en otros sitios; el balón lo tiene «x». */
  const entrada = { x: { x: 0.2, y: 0.8 }, y: { x: 0.8, y: 0.7 } };
  let n = 0;
  const r = tramosDePlantilla(datos, { p1: 'y', p2: 'x' }, { entrada, posesion: { b9: 'x' }, pista: 'entera', nuevoId: () => `n${++n}` });
  eq(r.avisos, []);
  const [corte, pase, finta] = r.tramos;
  eq([corte.elemento_id, corte.corre_id, [corte.trazo[0].x, corte.trazo[0].y], [corte.trazo.at(-1).x, corte.trazo.at(-1).y]], ['y', 'y', [0.8, 0.7], [0.7, 0.3]], 'el corte sale de su sitio y llega a donde llegaba:');
  eq([pase.elemento_id, pase.corre_id, pase.receptor_id, [pase.trazo[0].x, pase.trazo[0].y], [pase.trazo.at(-1).x, pase.trazo.at(-1).y]], ['x', 'b9', 'y', [0.2, 0.8], [0.7, 0.3]], 'el pase, con el balón que lleva, a donde acaba su corte:');
  eq(finta.trazo.map((p) => [r6(p.x), r6(p.y)]), [[0.2, 0.8], [0.2, 0.7], [0.2, 0.8]], 'la finta, entera, donde está:');
  eq([corte.variante, r.tramos.map((t) => t.id)], ['puerta_atras', ['n1', 'n2', 'n3']]);
});

test('SIN BALÓN NO SE PASA: ese tramo no se pone y se dice; y cada papel, una ficha distinta', () => {
  const { l, fase } = faseDeEjemplo();
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  const entrada = { x: { x: 0.2, y: 0.8 }, y: { x: 0.8, y: 0.7 } };
  let n = 0;
  const base = { entrada, pista: 'entera', nuevoId: () => `n${++n}`, nombreDe: (id) => id.toUpperCase() };
  const r = tramosDePlantilla(datos, { p1: 'y', p2: 'x' }, { ...base, posesion: { b9: 'y' } });
  eq(r.tramos.map((t) => t.accion), ['corta', 'finta']);
  ok(/X \(pasa\)/.test(r.avisos[0]), r.avisos.join(' | '));
  eq(tramosDePlantilla(datos, { p1: 'y' }, { ...base, posesion: {} }).motivo, 'hay que decir qué ficha hace cada papel');
  eq(tramosDePlantilla(datos, { p1: 'x', p2: 'x' }, { ...base, posesion: {} }).motivo, 'una ficha no puede hacer dos papeles');
  eq(tramosDePlantilla(datos, { p1: 'y', p2: 'z' }, { ...base, posesion: {} }).motivo, 'hay que decir qué ficha hace cada papel', 'una ficha que no está no vale:');
});

test('CADA PAPEL, A LA FICHA QUE SE LLAMA IGUAL si la hay', () => {
  const { l, a1, a2, fase } = faseDeEjemplo();
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  eq(papelesPorDefecto(datos, l, nombreDe), { p1: a2.id, p2: a1.id });
  eq(papelesPorDefecto(datos, l.filter((e) => e.id !== a2.id), nombreDe).p1, null, 'sin «A2», ese papel queda por decir:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
