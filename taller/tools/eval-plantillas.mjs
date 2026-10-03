/* ============================================================
   eval-plantillas.mjs — banco Node de las colocaciones y fases guardadas
   (taller/js/pizarra/plantillas.js, ESPEC-PIZARRA-v3 §7.8).
   Sin red, sin DOM.

     node taller/tools/eval-plantillas.mjs
   ============================================================ */

import * as PL from '../js/pizarra/plantillas.js';
import { anadir, asignarBalon, soltarBalon, quitar, reiniciarIds, numeroDe } from '../js/pizarra/elementos.js';
import { hacerFila, deLaFila } from '../js/pizarra/filas.js';
import { trazoDeIdaYVuelta } from '../js/pizarra/trazo.js';
import { aroExacto } from '../js/canvas/anclas.js';
import { readFileSync } from 'node:fs';

/* Por espacio de nombres y no por nombre: si falta una función (el
   código de antes de un arreglo), falla SU prueba y no el banco entero. */
const {
  TIPOS_PLANTILLA, MAX_NOMBRE_PLANTILLA, nombreDePlantilla, normalizarPlantilla,
  colocacionDe, ponerColocacion, plantillaDeFase, papelesPorDefecto, tramosDePlantilla,
  errorDePlantilla,
} = PL;

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
  eq(normalizarPlantilla({ id: 'u', tipo: 'colocacion', nombre: ' Cinco ', pista: 'media', datos: { elementos: [] } }), { id: 'u', tipo: 'colocacion', nombre: 'Cinco', pista: 'media', datos: { elementos: [], canasta: 'norte' } }, 'sin canasta, es de la norte:');
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
  eq(r.puestas, 12, 'tres jugadores, un balón, dos conos, y los tres de la fila con su balón:');
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
  eq(ponerColocacion([], { elementos: [{ id: 'z', kind: 'zona', x: 0.5, y: 0.5 }, { id: 'j', kind: 'jugador', x: NaN, y: 0.5 }] }, 'entera').puestas, 0, 'ni lo que llegue roto de la tabla:');
});

test('CON UNA FILA, CADA UNO SIGUE CON SU NÚMERO: los pares de la defensa no se cruzan', () => {
  /* El cono y su fila ANTES que un jugador suelto de su equipo: el primero
     de la fila es A1 y el suelto A2. */
  reiniciarIds();
  let l = anadir([], { kind: 'cono' }, 0.5, 0.7);
  const cono = l[0];
  l = hacerFila(l, cono.id, { n: 3, equipo: 'A', balon: true, orientacion: 90 }, 'entera');
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.3, 0.5);
  l = anadir(l, { kind: 'jugador', equipo: 'B' }, 0.5, 0.66);
  const quien = (lista) => lista.filter((e) => e.kind === 'jugador' && e.en_juego !== false).map((e) => [nombreDe(e), e.x, e.y]);
  const antes = quien(l);
  eq(antes.map((x) => x[0]), ['A1', 'A2', 'B1'], 'el primero de la fila es el 1:');
  const datos = JSON.parse(JSON.stringify(colocacionDe(l)));
  const r = ponerColocacion([], datos, 'entera').elementos;
  eq(quien(r), antes, 'puesta de nuevo, los mismos números en los mismos sitios:');
  const c = r.find((e) => e.kind === 'cono');
  eq(deLaFila(r, c.id).map((e) => [e.puesto, e.en_juego, e.label]), [[0, true, '1'], [1, false, null], [2, false, null]], 'y la cola, en su cono y por su orden:');
  /* Añadida a una escena con un A1: se numera detrás, en el mismo orden. */
  const con = ponerColocacion(anadir([], { kind: 'jugador', equipo: 'A' }, 0.1, 0.1), datos, 'entera').elementos;
  eq(quien(con).map((x) => x[0]), ['A1', 'A2', 'A3', 'B1']);
});

test('LA FILA VUELVE CON LO SUYO: a qué fila se vuelve, y el balón y los ajustes de cada uno', () => {
  /* Dos filas, cada una vuelve a la otra (una rueda). */
  reiniciarIds();
  let l = anadir(anadir([], { kind: 'cono' }, 0.2, 0.7), { kind: 'cono' }, 0.8, 0.7);
  const [c1, c2] = l;
  l = hacerFila(l, c1.id, { n: 2, equipo: 'A', balon: false, vuelta: c2.id }, 'entera');
  l = hacerFila(l, c2.id, { n: 2, equipo: 'A', balon: true, vuelta: c1.id }, 'entera');
  /* A mano: un balón al primero de la fila sin balones, y el segundo de la
     otra se queda sin el suyo; el primero defiende con su regla. */
  const [p1] = deLaFila(l, c1.id);
  const [, s2] = deLaFila(l, c2.id);
  l = anadir(l, { kind: 'balon' }, p1.x, p1.y);
  l = asignarBalon(l, l[l.length - 1].id, p1.id, 'entera');
  l = quitar(l, [l.find((e) => e.kind === 'balon' && e.portador_id === s2.id).id]);
  l = l.map((e) => (e.id === p1.id ? { ...e, regla_defensa: 'presion' } : e));
  const balones = (lista, cono) => deLaFila(lista, cono).map((j) => lista.some((e) => e.kind === 'balon' && e.portador_id === j.id));
  eq([balones(l, c1.id), balones(l, c2.id)], [[true, false], [true, false]]);
  /* En otra pizarra en la que ya hay conos: los nombres no coinciden. */
  reiniciarIds();
  const base = anadir(anadir([], { kind: 'cono' }, 0.5, 0.1), { kind: 'cono' }, 0.5, 0.2);
  const r = ponerColocacion(base, JSON.parse(JSON.stringify(colocacionDe(l))), 'entera').elementos;
  const [n1, n2] = r.filter((e) => e.kind === 'cono' && e.fila);
  ok(![c1.id, c2.id].includes(n1.id) || ![c1.id, c2.id].includes(n2.id), 'son conos con otro nombre');
  eq([n1.fila.vuelta, n2.fila.vuelta], [n2.id, n1.id], 'cada fila vuelve a la otra, la de ahora:');
  eq([balones(r, n1.id), balones(r, n2.id)], [[true, false], [true, false]], 'cada uno con su balón, o sin él:');
  eq(deLaFila(r, n1.id)[0].regla_defensa, 'presion', 'y con su regla:');
  eq(r.filter((e) => e.kind === 'balon').length, 2, 'ni un balón de más:');
  /* Una fila que llega sin su cola se rehace como desde el panel. */
  const sola = ponerColocacion([], { elementos: [{ id: 'c', kind: 'cono', x: 0.5, y: 0.5, fila: { n: 3, equipo: 'B', balon: true } }] }, 'entera').elementos;
  const cs = sola.find((e) => e.kind === 'cono');
  eq([deLaFila(sola, cs.id).length, sola.filter((e) => e.kind === 'balon').length], [3, 3]);
  ok(soltarBalon, 'soltarBalon');
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

test('EL BALÓN SE SIGUE TRAMO A TRAMO: quien recibe el pase puede tirar después', () => {
  const { l, a1, a2, bal } = escena();
  const fase = { id: 'f1', tramos: [
    { id: 'tr1', elemento_id: a1.id, corre_id: bal.id, receptor_id: a2.id, accion: 'pasa', tipo: 'pass', trazo: [N(0.3, 0.6), N(0.7, 0.6)] },
    { id: 'tr2', elemento_id: a2.id, corre_id: bal.id, accion: 'tira', tipo: 'pass', desenlace: 'falla', trazo: [N(0.7, 0.6), N(0.5, 0.08)] },
    { id: 'tr3', elemento_id: a2.id, corre_id: bal.id, accion: 'tira', tipo: 'pass', desenlace: 'entra', trazo: [N(0.7, 0.6), N(0.5, 0.08)] },
  ] };
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  let n = 0;
  const r = tramosDePlantilla(datos, { p1: 'x', p2: 'y' }, { entrada: { x: { x: 0.2, y: 0.8 }, y: { x: 0.8, y: 0.7 } }, posesion: { b9: 'x' }, pista: 'entera', nuevoId: () => `n${++n}` });
  eq(r.tramos.map((t) => [t.accion, t.elemento_id, t.corre_id, t.desenlace ?? null]), [['pasa', 'x', 'b9', null], ['tira', 'y', 'b9', 'falla']], 'recibe y tira con ese balón; el segundo tiro, ya sin él, no:');
  eq([r.tramos[1].trazo[0].x, r.tramos[1].trazo.at(-1).y], [0.8, 0.08], 'el tiro sale de quien tira y va al aro:');
  ok(r.avisos.length === 1 && /tira/.test(r.avisos[0]), r.avisos.join(' | '));
});

test('LO QUE PIDE BALÓN Y NO LO TIENE, NO SE PONE: tampoco un bote; y lo que no se pone no mueve a nadie', () => {
  const { l, a1, a2, bal } = escena();
  /* A1 pasa a un sitio; A2 lo recoge (eso no se guarda), bota y corta. */
  const fase = { id: 'f1', tramos: [
    { id: 'tr1', elemento_id: a1.id, corre_id: bal.id, accion: 'pasa', tipo: 'pass', trazo: [N(0.3, 0.6), N(0.5, 0.4)] },
    { id: 'tr2', elemento_id: a2.id, corre_id: a2.id, accion: 'recoge', tipo: 'cut', balon_id: bal.id, trazo: [N(0.7, 0.6), N(0.52, 0.42)] },
    { id: 'tr3', elemento_id: a2.id, corre_id: a2.id, accion: 'bota', tipo: 'run', trazo: [N(0.52, 0.42), N(0.5, 0.2)] },
    { id: 'tr4', elemento_id: a1.id, corre_id: a1.id, accion: 'corta', tipo: 'cut', trazo: [N(0.3, 0.6), N(0.3, 0.3)] },
  ] };
  /* Qué pide balón no se marca al guardar: lo dice al insertar la regla
     del anillo (repertorio.js#saleEn), la misma con la que se dibuja. */
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  eq(datos.tramos.map((t) => [t.accion, 'con_balon' in t]), [['pasa', false], ['bota', false], ['corta', false]]);
  let n = 0;
  const base = { entrada: { x: { x: 0.2, y: 0.8 }, y: { x: 0.8, y: 0.7 } }, pista: 'entera', nuevoId: () => `n${++n}`, nombreDe: (id) => id.toUpperCase() };
  const r = tramosDePlantilla(datos, { p1: 'x', p2: 'y' }, { ...base, posesion: { b9: 'x' } });
  eq(r.tramos.map((t) => [t.accion, t.elemento_id]), [['pasa', 'x'], ['corta', 'x']], 'el bote de quien no lleva balón no se pone:');
  ok(/Y \(bota\)/.test(r.avisos[0]), r.avisos.join(' | '));
  /* Con el balón en sus manos desde el principio, sí bota. */
  const s = tramosDePlantilla(datos, { p1: 'x', p2: 'y' }, { ...base, posesion: { b9: 'x', b8: 'y' } });
  eq(s.tramos.map((t) => t.accion), ['pasa', 'bota', 'corta']);
  /* Lo que no se pone no mueve: sin balón nadie, A1 corta desde su sitio. */
  const z = tramosDePlantilla(datos, { p1: 'x', p2: 'y' }, { ...base, posesion: {} });
  eq(z.tramos.map((t) => [t.accion, t.trazo[0].x, t.trazo[0].y]), [['corta', 0.2, 0.8]]);
});

test('LOS NODOS QUE PUSO UN CONO NO SE GUARDAN; EL ARRANQUE PUESTO A MANO, SÍ', () => {
  const { l, a1 } = escena();
  const fase = { id: 'f1', tramos: [
    { id: 'tr1', elemento_id: a1.id, corre_id: a1.id, accion: 'corta', tipo: 'cut', manual: true, inicio_ms: 2000.4,
      trazo: [N(0.3, 0.6), { ...N(0.25, 0.45), por_cono: 'cono_7', lado: 'izq' }, N(0.3, 0.3)] },
    { id: 'tr2', elemento_id: a1.id, corre_id: a1.id, accion: 'corta', tipo: 'cut', manual: false, inicio_ms: 900, trazo: [N(0.3, 0.3), N(0.5, 0.3)] },
  ] };
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  eq(datos.tramos[0].trazo.map((p) => [p.x, p.y]), [[0.3, 0.6], [0.3, 0.3]], 'sin el quiebro del cono, que aquí no está:');
  eq(datos.tramos.map((t) => t.inicio_ms ?? null), [2000, null], 'solo el arranque que se puso a mano:');
  let n = 0;
  const r = tramosDePlantilla(datos, { p1: 'x' }, { entrada: { x: { x: 0.3, y: 0.6 } }, pista: 'entera', nuevoId: () => `n${++n}` });
  eq(r.tramos.map((t) => [t.inicio_ms, t.manual]), [[2000, true], [null, false]]);
});

test('LO QUE TIENE SU SITIO VA A SU SITIO DE AHORA: el bloqueo junto al compañero, el tiro a su aro', () => {
  const { l, a1, a2, bal } = escena();
  const fase = { id: 'f1', tramos: [
    { id: 'tr1', elemento_id: a2.id, corre_id: a2.id, companero_id: a1.id, accion: 'bloquea', tipo: 'bloqueo', trazo: [N(0.7, 0.6), N(0.34, 0.56)] },
    { id: 'tr2', elemento_id: a1.id, corre_id: a1.id, accion: 'bota', tipo: 'run', trazo: [N(0.3, 0.6), N(0.5, 0.4)] },
    { id: 'tr3', elemento_id: a1.id, corre_id: bal.id, accion: 'tira', tipo: 'pass', desenlace: 'entra', trazo: [N(0.5, 0.4), N(0.5, 0.1)] },
  ] };
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  const pedidos = [];
  const destino = (x) => {
    pedidos.push([x.accion, x.tipo, x.id, x.desde, x.companero]);
    if (x.tipo === 'bloqueo') return { x: x.companero.en.x + 0.05, y: x.companero.en.y };
    if (x.accion === 'tira') return { x: 0.5, y: 0.9 };
    return null;
  };
  let n = 0;
  const base = { entrada: { x: { x: 0.2, y: 0.8 }, y: { x: 0.8, y: 0.8 } }, posesion: { b9: 'x' }, pista: 'entera', nuevoId: () => `n${++n}` };
  const r = tramosDePlantilla(datos, { p1: 'y', p2: 'x' }, { ...base, destino });
  const fin = (t) => [r6(t.trazo.at(-1).x), r6(t.trazo.at(-1).y)];
  const [bloqueo, bote, tiro] = r.tramos;
  eq([fin(bloqueo), bloqueo.companero_id], [[0.25, 0.8], 'x'], 'junto al compañero, donde está AHORA:');
  eq(fin(bote), [0.5, 0.4], 'lo que no tiene sitio propio conserva su destino:');
  eq([[tiro.trazo[0].x, tiro.trazo[0].y], fin(tiro)], [[0.5, 0.4], [0.5, 0.9]], 'y el tiro, desde donde acaba el bote, al aro que se le dice:');
  eq(pedidos, [
    ['bloquea', 'bloqueo', 'y', { x: 0.8, y: 0.8 }, { id: 'x', en: { x: 0.2, y: 0.8 } }],
    ['bota', 'run', 'x', { x: 0.2, y: 0.8 }, null],
    ['tira', 'pass', 'x', { x: 0.5, y: 0.4 }, null],
  ]);
  /* Sin quien lo diga, como estaba guardado. */
  const s = tramosDePlantilla(datos, { p1: 'y', p2: 'x' }, base);
  eq([[r6(s.tramos[0].trazo.at(-1).x), r6(s.tramos[0].trazo.at(-1).y)], [s.tramos[2].trazo.at(-1).x, s.tramos[2].trazo.at(-1).y]], [[0.34, 0.56], [0.5, 0.1]]);
});

test('CADA PAPEL, A LA FICHA QUE SE LLAMA IGUAL si la hay', () => {
  const { l, a1, a2, fase } = faseDeEjemplo();
  const { datos } = plantillaDeFase(fase, l, { nombreDe });
  eq(papelesPorDefecto(datos, l, nombreDe), { p1: a2.id, p2: a1.id });
  eq(papelesPorDefecto(datos, l.filter((e) => e.id !== a2.id), nombreDe).p1, null, 'sin «A2», ese papel queda por decir:');
});

const papel = (clave, nombre, x, y) => ({ clave, equipo: 'A', nombre, en: { x, y } });

console.log('· lo que llega roto de la base de datos');

test('UNA FASE ROTA SE SANEA: lo que no se entiende se deja fuera y se cuenta, sin lanzar', () => {
  const p = normalizarPlantilla({ id: 'u', tipo: 'fase', nombre: 'x', pista: 'entera', datos: {
    papeles: [null, 3, papel('p1', 'A1', 0.3, 0.6), { clave: 'p2', nombre: 'A2' }],
    tramos: ['basura', null,
      { accion: 'corta', tipo: 'cut', quien: 'zz', trazo: [N(0.3, 0.6), N(0.5, 0.5)] },
      { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: null },
      { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.3, 0.6), { x: 'a', y: 1 }] },
      { accion: 'pasa', tipo: 'pass', quien: 'p1', receptor: 'p9', vuela: true, trazo: [N(0.3, 0.6), N(0.5, 0.5)] },
      { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.3, 0.6), N(0.5, 0.5)] },
    ] } });
  ok(p, 'la fila se queda: tiene un tramo bueno');
  eq([p.datos.papeles.map((x) => x.clave), p.datos.tramos.length, p.descartados], [['p1'], 1, 9],
    'tres papeles rotos (null, 3, sin sitio) y seis tramos (basura, null, de nadie, sin trazo, nodo roto, receptor de nadie):');
});

test('LO ROTO NO ROMPE AL ELEGIR PAPELES NI AL INSERTAR: se pone lo que se entiende y se dice', () => {
  const roto = { papeles: [null, papel('p1', 'A1', 0.3, 0.6)], tramos: [
    { accion: 'corta', tipo: 'cut', quien: 'p7', trazo: [N(0.3, 0.6), N(0.5, 0.5)] },
    { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: null },
    { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.3, 0.6), N(0.5, 0.4)] },
  ] };
  eq(papelesPorDefecto(roto, [{ id: 'x', kind: 'jugador', equipo: 'A', label: '1' }], nombreDe), { p1: 'x' });
  const r = tramosDePlantilla(roto, { p1: 'x' }, { entrada: { x: { x: 0.2, y: 0.8 } }, posesion: {}, pista: 'entera', nuevoId: () => 'n' });
  eq(r.tramos.map((t) => t.accion), ['corta']);
  ok(r.avisos.some((a) => /3 partes de la plantilla no se entendían/.test(a)), r.avisos.join(' | '));
  const vacios = tramosDePlantilla({ papeles: [], tramos: [{ accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0, 0), N(1, 1)] }] }, {}, { entrada: {}, posesion: {}, pista: 'entera', nuevoId: () => 'n' });
  eq(vacios.tramos, [], 'papeles vacíos con tramos: nada que poner, sin lanzar:');
  eq(normalizarPlantilla({ tipo: 'fase', nombre: 'x', datos: { papeles: [], tramos: [{ accion: 'corta', quien: 'p1' }] } }), null, 'y esa fila no se ofrece:');
  reiniciarIds();
  const col = ponerColocacion([], { elementos: [{ id: 'j', kind: 'jugador', x: 0.5, y: 0.5 }, { id: 'k', kind: 'jugador', x: 'a', y: 0.5 }, null] }, 'entera');
  eq(col.puestas, 1);
  ok((col.avisos || []).some((a) => /2 fichas de la colocación no se entendían/.test(a)), (col.avisos || []).join(' | '));
});

test('LOS TEXTOS DE LA BASE PASAN A TEXTO CON TOPE, y una acción que no es un nombre de acción, fuera', () => {
  const c = normalizarPlantilla({ tipo: 'colocacion', nombre: 'x', datos: { elementos: [
    { id: 'j1', kind: 'jugador', equipo: 'Z', x: 0.5, y: 0.5, dorsal: { a: 1 }, nombre: 'n'.repeat(500) },
    { id: 'j2', kind: 'jugador', equipo: 'A', x: 0.5, y: 0.5, dorsal: 12345678, nombre: { b: 2 } },
    { id: 'c1', kind: 'cono', x: 2, y: -1, nombre: '  Cono   alto ' },
  ] } });
  const [j1, j2, c1] = c.datos.elementos;
  eq([j1.dorsal, j1.nombre.length, j1.equipo, j2.dorsal, j2.nombre, c1.nombre, c1.x, c1.y], [null, 40, 'A', '1234', null, 'Cono alto', 1, 0]);
  const f = normalizarPlantilla({ tipo: 'fase', nombre: 'x', datos: { papeles: [{ clave: 'p1', equipo: 'A', nombre: '<b>'.repeat(30), en: { x: 0.1, y: 0.1 } }], tramos: [
    { accion: '<img src=x onerror=alert(1)>', tipo: 'cut', quien: 'p1', trazo: [N(0.1, 0.1), N(0.2, 0.2)] },
    { accion: 'corta', tipo: 'cut', quien: 'p1', variante_nombre: 'v'.repeat(99), trazo: [N(0.1, 0.1), N(0.2, 0.2)] },
  ] } });
  eq([f.datos.tramos.map((t) => t.accion), f.datos.papeles[0].nombre.length, f.datos.tramos[0].variante_nombre.length, f.descartados], [['corta'], 40, 40, 1]);
  eq(normalizarPlantilla({ tipo: 'colocacion', nombre: { a: 1 }, datos: { elementos: [] } }), null, 'un nombre que no es texto:');
});

console.log('· la canasta: en espejo si se ataca a la otra');

test('LA COLOCACIÓN GUARDA SU CANASTA y, puesta atacando a la otra, va en espejo (fichas, fila y escalera)', () => {
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'jugador', equipo: 'A' }, 0.3, 0.2);
  l = anadir(l, { kind: 'escalera' }, 0.6, 0.3);
  l = l.map((e) => (e.kind === 'escalera' ? { ...e, rot: 30 } : e));
  l = anadir(l, { kind: 'cono' }, 0.5, 0.25);
  const cono = l[l.length - 1];
  l = hacerFila(l, cono.id, { n: 2, equipo: 'B', orientacion: 90 }, 'entera');
  const datos = JSON.parse(JSON.stringify(colocacionDe(l, { canasta: 'norte' })));
  eq(datos.canasta, 'norte');
  reiniciarIds();
  const r = ponerColocacion([], datos, 'entera', 'sur');
  const j = r.elementos.find((e) => e.kind === 'jugador' && !e.fila_de);
  const esc = r.elementos.find((e) => e.kind === 'escalera');
  const c = r.elementos.find((e) => e.kind === 'cono');
  eq([r6(j.x), r6(j.y), r6(esc.y), esc.rot, r6(c.y), c.fila.orientacion], [0.3, 0.8, 0.7, 330, 0.75, 270]);
  ok(deLaFila(r.elementos, c.id)[1].y < c.y, 'la cola sale hacia el medio campo, en espejo');
  reiniciarIds();
  eq(r6(ponerColocacion([], datos, 'entera', 'norte').elementos[0].y), 0.2, 'a la misma canasta, igual:');
  reiniciarIds();
  eq(r6(ponerColocacion([], { elementos: datos.elementos }, 'entera', 'sur').elementos[0].y), 0.8, 'sin canasta guardada, es de la norte:');
  reiniciarIds();
  eq(r6(ponerColocacion([], datos, 'media', 'sur').elementos[0].y), 0.2, 'la media no tiene otra canasta:');
});

test('LA FASE GUARDA SU CANASTA y, insertada atacando a la otra, va en espejo: el tiro, al otro aro', () => {
  const { l, a1, a2, bal } = escena();
  const [, yN] = aroExacto('entera', 'norte');
  const [, yS] = aroExacto('entera', 'sur');
  const fase = { tramos: [
    { id: 't1', elemento_id: a2.id, corre_id: a2.id, accion: 'corta', tipo: 'cut', trazo: [N(0.7, 0.6), N(0.7, 0.3)] },
    { id: 't2', elemento_id: a1.id, corre_id: bal.id, accion: 'tira', tipo: 'pass', desenlace: 'entra', trazo: [N(0.3, 0.6), N(0.5, yN)] },
  ] };
  const { datos } = plantillaDeFase(fase, l, { nombreDe, canasta: 'norte' });
  eq(datos.canasta, 'norte');
  const entrada = { x: { x: 0.3, y: 0.4 }, y: { x: 0.7, y: 0.4 } };
  const op = { entrada, posesion: { b: 'x' }, pista: 'entera', nuevoId: () => 'n' };
  const r = tramosDePlantilla(JSON.parse(JSON.stringify(datos)), { p1: 'y', p2: 'x' }, { ...op, canasta: 'sur' });
  const [corte, tiro] = r.tramos;
  eq([r6(corte.trazo.at(-1).y), r6(tiro.trazo.at(-1).y), r6(tiro.trazo[0].y), tiro.desenlace], [0.7, r6(yS), 0.4, 'entra'], 'el corte llega a su sitio en espejo y el tiro va al aro sur:');
  eq(r6(tramosDePlantilla(datos, { p1: 'y', p2: 'x' }, { ...op, canasta: 'norte' }).tramos[1].trazo.at(-1).y), r6(yN), 'atacando a la misma, sin espejo:');
});

console.log('· lo que necesita balón');

test('SIN BALÓN NO SE BOTA: un bote o un cambio de mano sin balón se quitan y se dicen; con él, se ponen', () => {
  const datos = { papeles: [papel('p1', 'A1', 0.3, 0.6)], tramos: [
    { accion: 'bota', tipo: 'run', quien: 'p1', trazo: [N(0.3, 0.6), N(0.3, 0.4)] },
    { accion: 'cambia_de_mano', tipo: 'gesto', quien: 'p1', trazo: trazoDeIdaYVuelta({ x: 0.3, y: 0.4 }, { x: 0.32, y: 0.4 }) },
    { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.3, 0.4), N(0.6, 0.3)] },
  ] };
  const base = { entrada: { x: { x: 0.2, y: 0.8 } }, pista: 'entera', nuevoId: () => 'n', nombreDe: (id) => id.toUpperCase() };
  const sin = tramosDePlantilla(datos, { p1: 'x' }, { ...base, posesion: {} });
  eq(sin.tramos.map((t) => t.accion), ['corta']);
  ok(/X \(bota\), X \(cambia_de_mano\)/.test(sin.avisos[0] || ''), sin.avisos.join(' | '));
  eq([sin.tramos[0].trazo[0].x, sin.tramos[0].trazo[0].y], [0.2, 0.8], 'el corte sale de donde se ha quedado, que no ha botado:');
  const con = tramosDePlantilla(datos, { p1: 'x' }, { ...base, posesion: { b: 'x' } });
  eq([con.tramos.map((t) => t.accion), con.avisos], [['bota', 'cambia_de_mano', 'corta'], []]);
});

console.log('· adónde va un pase');

test('UN PASE TRAS UN CORTE EN V va adonde acaba el receptor; uno de antes, adonde estaba', () => {
  const V = (paseAntes) => {
    const pase = { accion: 'pasa', tipo: 'pass', quien: 'p2', receptor: 'p1', vuela: true, trazo: [N(0.3, 0.5), N(0.7, 0.5)] };
    const v = [
      { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.7, 0.5), N(0.6, 0.3)] },
      { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.6, 0.3), N(0.7, 0.5)] },
    ];
    return { papeles: [papel('p1', 'A2', 0.7, 0.5), papel('p2', 'A1', 0.3, 0.5)], tramos: paseAntes ? [pase, ...v] : [...v, pase] };
  };
  const op = { entrada: { X: { x: 0.2, y: 0.8 }, Y: { x: 0.9, y: 0.8 } }, posesion: { b: 'X' }, pista: 'entera', nuevoId: () => 'n' };
  const fin = (t) => [r6(t.trazo.at(-1).x), r6(t.trazo.at(-1).y)];
  eq(fin(tramosDePlantilla(V(false), { p1: 'Y', p2: 'X' }, op).tramos[2]), [0.7, 0.5], 'tras la V, donde acaba:');
  eq(fin(tramosDePlantilla(V(true), { p1: 'Y', p2: 'X' }, op).tramos[0]), [0.9, 0.8], 'antes de la V, donde estaba al empezar:');
});

console.log('· lo que no viaja');

test('LA COLOCACIÓN SE NUMERA SOLA: el dorsal escrito a mano no viaja, y añadida otra vez no repite número', () => {
  reiniciarIds();
  let l = anadir([], { kind: 'jugador', equipo: 'A' }, 0.3, 0.6);
  l = l.map((e) => ({ ...e, dorsal: '7' }));
  const r = ponerColocacion(l, colocacionDe(l), 'entera');
  eq(r.elementos.map((e) => [e.dorsal, nombreDe(e)]), [['7', 'A7'], [null, 'A2']]);
});

test('SE DICE LO QUE NO VIAJA: el defensor de un bloqueo y lo declarado por la defensa; a quién defiende, viaja (también a uno de fila)', () => {
  const { l, a1, a2, b1 } = escena();
  const fase = { defensa: { [b1.id]: { accion: 'roba' } }, tramos: [
    { id: 't1', elemento_id: a2.id, corre_id: a2.id, companero_id: a1.id, defensor_id: b1.id, accion: 'bloquea', tipo: 'cut', trazo: [N(0.7, 0.6), N(0.35, 0.55)] },
  ] };
  const { datos, avisos } = plantillaDeFase(fase, l, { nombreDe });
  ok(avisos.some((a) => /No se guarda a qué defensor se le pone el bloqueo \(bloquea\)/.test(a)), avisos.join(' | '));
  ok(avisos.some((a) => /No se guarda lo que hacen distinto los defensores/.test(a)), avisos.join(' | '));
  ok(!JSON.stringify(datos).includes(b1.id), 'y el defensor no va dentro');
  /* B1 defiende al primero de la fila: la fila se pone uno a uno, así que
     el par se queda, con el nombre de ahora. */
  const deFila = l.filter((e) => e.fila_de);
  const conPar = l.map((e) => (e.id === b1.id ? { ...e, defiende_a: deFila[0].id } : e));
  reiniciarIds();
  const r = ponerColocacion([], JSON.parse(JSON.stringify(colocacionDe(conPar))), 'entera');
  const nb1 = r.elementos.find((e) => e.kind === 'jugador' && e.equipo === 'B');
  const primero = r.elementos.find((e) => e.fila_de && e.puesto === 0);
  eq([nb1.defiende_a, r.avisos], [primero.id, []]);
  /* Y si defendía a alguien que no está en la colocación, se dice. */
  const roto = JSON.parse(JSON.stringify(colocacionDe(l.map((e) => (e.id === b1.id ? { ...e, defiende_a: 'jugador_99' } : e)))));
  reiniciarIds();
  const s = ponerColocacion([], roto, 'entera');
  ok((s.avisos || []).some((a) => /No se pone a quién defiende B1/.test(a)), (s.avisos || []).join(' | '));
});

test('LA VUELTA DE UNA FILA apunta al cono puesto, no al de cuando se guardó', () => {
  reiniciarIds();
  let l = [];
  l = anadir(l, { kind: 'cono' }, 0.3, 0.8);
  l = anadir(l, { kind: 'cono' }, 0.7, 0.8);
  const [c1, c2] = l;
  l = hacerFila(l, c1.id, { n: 2, equipo: 'A', vuelta: c2.id }, 'entera');
  l = hacerFila(l, c2.id, { n: 2, equipo: 'A' }, 'entera');
  const r = ponerColocacion(l, JSON.parse(JSON.stringify(colocacionDe(l))), 'entera');
  const nuevos = r.elementos.filter((e) => e.kind === 'cono' && !l.some((x) => x.id === e.id));
  eq(nuevos[0].fila.vuelta, nuevos[1].id);
});

test('LOS CONOS QUE SE RODEAN NO VIAJAN, y se dice', () => {
  const { l, a2 } = escena();
  const fase = { tramos: [{ id: 't1', elemento_id: a2.id, corre_id: a2.id, accion: 'corta', tipo: 'cut', sorteando: [{ cono: 'cono_9', lado: 'izq' }],
    trazo: [N(0.7, 0.6), { ...N(0.65, 0.5), por_cono: 'cono_9', lado: 'izq' }, N(0.6, 0.3)] }] };
  const { datos, avisos } = plantillaDeFase(fase, l, { nombreDe });
  ok(avisos.some((a) => /No se guardan los conos que se rodean \(corta\)/.test(a)), avisos.join(' | '));
  ok(!JSON.stringify(datos).includes('cono_9'), 'ni su nombre dentro');
});

test('LO INSERTADO NO COMPARTE NODOS CON LA PLANTILLA', () => {
  const datos = { papeles: [papel('p1', 'A1', 0.3, 0.6)], tramos: [
    { accion: 'finta', tipo: 'gesto', quien: 'p1', trazo: trazoDeIdaYVuelta({ x: 0.3, y: 0.6 }, { x: 0.3, y: 0.5 }) },
    { accion: 'corta', tipo: 'cut', quien: 'p1', trazo: [N(0.3, 0.6), N(0.5, 0.5)] },
  ] };
  const antes = JSON.stringify(datos);
  const r = tramosDePlantilla(datos, { p1: 'x' }, { entrada: { x: { x: 0.3, y: 0.6 } }, posesion: {}, pista: 'entera', nuevoId: () => 'n' });
  r.tramos[0].trazo[0].x = 999;
  r.tramos[1].trazo[1].x = 777;
  eq(JSON.stringify(datos), antes);
});

console.log('· lo que se dice cuando la base no deja');

test('LOS ERRORES DE LA BASE, SEGÚN LO QUE SE HACÍA: «la guardó otro entrenador» solo al quitar', () => {
  const rls = { code: '42501', message: 'new row violates row-level security policy for table "plantillas"' };
  ok(/la guardó otro entrenador/.test(errorDePlantilla(rls, 'borrar')));
  const g = errorDePlantilla(rls, 'guardar');
  ok(!/otro entrenador/.test(g) && /guardar/.test(g), g);
  ok(/migración 045/.test(errorDePlantilla({ code: 'PGRST205', message: 'Could not find the table' }, 'guardar')));
  eq(errorDePlantilla({ message: 'sin red' }, 'borrar'), 'sin red');
  const cli = readFileSync(new URL('../js/supabase/plantillas.js', import.meta.url), 'utf8');
  ok(/errorDePlantilla\(error, 'guardar'\)/.test(cli) && /errorDePlantilla\(error, 'borrar'\)/.test(cli), 'el cliente lo usa así');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
