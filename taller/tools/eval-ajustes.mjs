/* ============================================================
   eval-ajustes.mjs — banco Node de lo que enseña la pestaña «Ajustes»
   (taller/js/pizarra/paneles/ajustes-modelo.js). Sin red, sin DOM.

     node taller/tools/eval-ajustes.mjs

   Lo que se vigila es que cada selección enseñe lo suyo y que lo que se
   enseña diga la verdad: el valor elegido, lo que saldría solo, y los
   números de serie frente a los cambiados.
   ============================================================ */

import { modeloAjustes, NUMEROS } from '../js/pizarra/paneles/ajustes-modelo.js';
import { papelesDeJugada, PARAMETROS, REGLAS } from '../js/pizarra/motor/defensa.js';

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

const J = (id, equipo, x, y, extra = {}) => ({ id, kind: 'jugador', equipo, label: id.slice(1), dorsal: null, en_juego: true, x, y, defiende_a: null, regla_defensa: null, ...extra });
const escena = (conBalon = 'A1') => [
  J('A1', 'A', 0.3, 0.5), J('A2', 'A', 0.7, 0.5), J('B1', 'B', 0.3, 0.6), J('B2', 'B', 0.7, 0.6),
  { id: 'b', kind: 'balon', x: 0.3, y: 0.5, portador_id: conBalon },
];
const papeles = (elementos, defensa = null) => papelesDeJugada({ pista: 'entera', elementos, fases: [{}], defensa }).inicio;
const modelo = (seleccion, elementos = escena(), defensa = null, extra = {}) =>
  modeloAjustes({ seleccion, elementos, papeles: papeles(elementos, defensa), defensa, nombreDe: (e) => e.id, ...extra });

test('SIN NADA SELECCIONADO, LOS AJUSTES DEL EJERCICIO: quién ataca, regla, situación y números', () => {
  const m = modelo([]);
  eq(m.tipo, 'ejercicio');
  eq(m.ataca.valor, null);
  eq(m.ataca.opciones.map((o) => o.valor), [null, 'A', 'B', 'nadie'], 'solo los equipos que hay, y «nadie»:');
  ok(/Equipo 1/.test(m.ataca.opciones[0].nombre), `lo que saldría solo se dice: ${m.ataca.opciones[0].nombre}`);
  eq(m.preajuste.opciones.map((o) => o.valor), REGLAS);
  eq(m.situacion.opciones.map((o) => o.valor), [null, 'igualdad', 'inferioridad', 'superioridad']);
  ok(/igualdad/.test(m.situacion.opciones[0].nombre), m.situacion.opciones[0].nombre);
  eq(m.numeros.map((n) => n.clave), NUMEROS.map(([c]) => c));
  ok(m.numeros.every((n) => n.valor === PARAMETROS[n.clave] && !n.cambiado), 'todos de serie');
  ok(/Defienden 2/.test(m.resumen), m.resumen);
});

test('LO CAMBIADO SE MARCA, y lo que se ha forzado se enseña elegido SIN perder lo que saldría solo', () => {
  const d = { preajuste: 'presion', parametros: { presion: 0.6 }, situacion: 'superioridad', ataca: 'B' };
  const m = modelo([], escena(), d);
  eq([m.ataca.valor, m.preajuste.valor, m.situacion.valor], ['B', 'presion', 'superioridad']);
  const presion = m.numeros.find((n) => n.clave === 'presion');
  eq([presion.valor, presion.porDefecto, presion.cambiado], [0.6, 1.0, true]);
  /* Con la defensa forzada, la primera opción sigue diciendo lo que
     pasaría sin forzar nada: el balón es del A, y sin forzar hay igualdad. */
  ok(/Equipo 1/.test(m.ataca.opciones[0].nombre), m.ataca.opciones[0].nombre);
  ok(/igualdad/.test(m.situacion.opciones[0].nombre), m.situacion.opciones[0].nombre);
  // con «ataca el B» forzado, el que defiende es A2
  const def = modelo(['A2'], escena(), d);
  eq(def.tipo, 'defensor');
  ok(/Presión al balón/.test(def.regla.opciones[0].nombre), `la del ejercicio se nombra: ${def.regla.opciones[0].nombre}`);
});

test('UN EQUIPO FORZADO QUE SE HA QUEDADO SIN NADIE SIGUE EN LA LISTA, y se dice', () => {
  const soloA = escena().filter((e) => e.id !== 'B1' && e.id !== 'B2');
  const m = modelo([], soloA, { preajuste: 'entre_par_y_aro', parametros: {}, situacion: null, ataca: 'B' });
  const opcion = m.ataca.opciones.find((o) => o.valor === 'B');
  ok(opcion && /no hay nadie/.test(opcion.nombre), `sigue pudiéndose elegir: ${JSON.stringify(m.ataca.opciones)}`);
});

test('EL «lo que saldría solo» SALE DE LOS PAPELES, no de dónde están las fichas ahora', () => {
  /* Tras un pase al suelo, la pista no tiene portador, pero quien ataca lo
     decide la posesión del PRINCIPIO, que es la de los papeles. */
  const elementos = escena().map((e) => (e.kind === 'balon' ? { ...e, portador_id: null, x: 0.9, y: 0.9 } : e));
  const papeles = papelesDeJugada({ pista: 'entera', elementos: escena(), fases: [{}] }).inicio;
  const m = modeloAjustes({ seleccion: [], elementos, papeles, defensa: null, nombreDe: (e) => e.id });
  ok(/Equipo 1/.test(m.ataca.opciones[0].nombre), m.ataca.opciones[0].nombre);
});

test('SIN ATACANTE, LO DICE: quién ataca solo, «nadie»; y no defiende nadie', () => {
  const m = modelo([], escena(null));
  ok(/nadie/.test(m.ataca.opciones[0].nombre), m.ataca.opciones[0].nombre);
  ok(/no defiende nadie/.test(m.resumen), m.resumen);
});

test('UN DEFENSOR: A QUIÉN DEFIENDE Y CON QUÉ REGLA, y por qué está ahí', () => {
  const m = modelo(['B2'], escena(), null, { explicacion: 'Entre su par y el aro.' });
  eq(m.tipo, 'defensor');
  eq(m.par.valor, null, 'sin «defiende a…», el que le toque:');
  ok(/A2/.test(m.par.opciones[0].nombre), `y se dice cuál le toca: ${m.par.opciones[0].nombre}`);
  eq(m.par.opciones.map((o) => o.valor), [null, 'A1', 'A2'], 'solo atacantes:');
  eq(m.regla.opciones.map((o) => o.valor), [null, ...REGLAS]);
  ok(/Entre su par y el aro/.test(m.regla.opciones[0].nombre), m.regla.opciones[0].nombre);
  eq(m.explicacion, 'Entre su par y el aro.');
  const puesto = escena().map((e) => (e.id === 'B2' ? { ...e, defiende_a: 'A1', regla_defensa: 'niega_linea' } : e));
  const m2 = modelo(['B2'], puesto);
  eq([m2.par.valor, m2.regla.valor], ['A1', 'niega_linea'], 'lo puesto a mano sale elegido:');
});

test('UN ATACANTE: QUIÉN LE DEFIENDE; y quien no juega, lo dice', () => {
  eq(modelo(['A1']), { tipo: 'atacante', id: 'A1', nombre: 'A1', defensor: 'B1', darBalon: false });
  const m = modelo(['A1'], escena(null));
  eq(m.tipo, 'sinPapel');
  ok(/Nadie ataca/.test(m.texto), m.texto);
  const fuera = escena().map((e) => (e.id === 'B2' ? { ...e, en_juego: false } : e));
  ok(/no está en juego/.test(modelo(['B2'], fuera).texto));
});

test('«DALE UN BALÓN» SALE SOLO SI SE PUEDE DAR (§7.3), sea cual sea su papel', () => {
  const puede = { porQueNoDarBalon: () => null };
  const no = { porQueNoDarBalon: () => 'ya lleva uno' };
  eq([modelo(['A1'], escena(), null, puede).darBalon, modelo(['B1'], escena(), null, puede).darBalon], [true, true], 'al atacante y al defensor:');
  eq(modelo(['A1'], escena(null), null, puede).darBalon, true, 'y a quien todavía no tiene papel:');
  eq(modelo(['A1'], escena(), null, no).darBalon, false, 'si no se puede, no sale:');
});

test('VARIAS FICHAS, O UN BALÓN: dice dónde están los ajustes', () => {
  eq(modelo(['A1', 'B1']).tipo, 'otro');
  eq(modelo(['b']).tipo, 'otro');
  eq(modelo(['no_existe']).tipo, 'ejercicio', 'lo que ya no está no cuenta como seleccionado:');
});

test('SIN DATOS NO ROMPE', () => {
  eq(modeloAjustes().tipo, 'ejercicio');
  eq(modeloAjustes({ seleccion: ['x'] }).tipo, 'ejercicio');
});

test('EL PANEL DEL DEFENSOR ENSEÑA LO QUE HACE DISTINTO EN ESTA FASE (§8.5)', () => {
  const m = modeloAjustes({
    seleccion: ['B1'],
    elementos: [
      { id: 'A1', kind: 'jugador', equipo: 'A', label: '1', x: 0.3, y: 0.7 },
      { id: 'A2', kind: 'jugador', equipo: 'A', label: '2', x: 0.7, y: 0.7 },
      { id: 'B1', kind: 'jugador', equipo: 'B', label: '1', x: 0.3, y: 0.5 },
    ],
    papeles: {
      ataca: 'A', atacantes: ['A1', 'A2'], defensores: ['B1'], pares: { B1: 'A1' },
      situacion: 'inferioridad', acciones: {},
    },
    nombreDe: (e) => `${e.equipo}${e.label}`,
  });
  eq(m.hace.valor, null, 'sin nada dicho, defiende a su par:');
  eq(m.hace.opciones.map((o) => o.valor), [null, 'sobrepasado', 'cierra_rebote', 'dos_contra_uno'],
    'y se pueden elegir las que no hay que señalar a nadie:');
  ok(m.hace.opciones.every((o) => o.nombre && o.nombre.length > 3), 'todas con su nombre');
});

test('y si ya hace algo que se señala, se ve con a quién (y se puede quitar)', () => {
  const m = modeloAjustes({
    seleccion: ['B1'],
    elementos: [
      { id: 'A1', kind: 'jugador', equipo: 'A', label: '1', x: 0.3, y: 0.7 },
      { id: 'A2', kind: 'jugador', equipo: 'A', label: '2', x: 0.7, y: 0.7 },
      { id: 'B1', kind: 'jugador', equipo: 'B', label: '1', x: 0.3, y: 0.5 },
    ],
    papeles: {
      ataca: 'A', atacantes: ['A1', 'A2'], defensores: ['B1'], pares: { B1: 'A1' },
      situacion: 'inferioridad', acciones: { B1: { accion: 'ayuda', objetivo_id: 'A2' } },
    },
    nombreDe: (e) => `${e.equipo}${e.label}`,
  });
  eq(m.hace.valor, 'ayuda');
  const suya = m.hace.opciones.find((o) => o.valor === 'ayuda');
  ok(suya && /A2/.test(suya.nombre), `dice a quién ayuda: ${suya && suya.nombre}`);
  ok(m.hace.opciones.some((o) => o.valor === null), 'y se puede volver a defender a su par');
});

test('UN CONO DICE SI FORMA UNA PUERTA, y con quién (§7.4.1)', () => {
  const elementos = [
    { id: 'cono_1', kind: 'cono', x: 0.45, y: 0.5 },
    { id: 'cono_2', kind: 'cono', x: 0.55, y: 0.5 },
    { id: 'cono_3', kind: 'cono', x: 0.2, y: 0.2 },
  ];
  const nombreDe = (e) => `el cono ${e.id.split('_')[1]}`;
  const m = modeloAjustes({ seleccion: ['cono_1'], elementos, nombreDe, puertas: [['cono_1', 'cono_2']] });
  eq([m.tipo, m.puerta && m.puerta.con], ['cono', 'cono_2']);
  ok(/puerta con el cono 2/.test(m.texto), m.texto);
  const suelto = modeloAjustes({ seleccion: ['cono_3'], elementos, nombreDe, puertas: [['cono_1', 'cono_2']] });
  eq([suelto.tipo, suelto.puerta], ['cono', null], 'uno que no es puerta:');
  ok(/rodea|slalom|puerta/.test(suelto.texto), 'y dice qué puede llegar a ser');
});

test('EL PANEL DEL CONO OFRECE HACER FILA, y la de un cono de fila se cambia ahí (§7.4.2)', () => {
  const suelto = modeloAjustes({ seleccion: ['c1'], elementos: [{ id: 'c1', kind: 'cono', x: 0.5, y: 0.5 }], nombreDe: () => 'el cono 1' });
  eq(suelto.fila, null, 'sin fila todavía:');
  ok(/fila/.test(suelto.texto), 'y dice que puede serlo');
  const elementos = [
    { id: 'c1', kind: 'cono', x: 0.5, y: 0.5, fila: { n: 3, equipo: 'B', papel: 'atacante', balon: true, orientacion: 90, vuelta: null } },
    { id: 'c2', kind: 'cono', x: 0.2, y: 0.5, fila: { n: 2, equipo: 'A', papel: 'atacante', balon: false, orientacion: 0, vuelta: null } },
    { id: 'j1', kind: 'jugador', equipo: 'B', x: 0.5, y: 0.55, fila_de: 'c1', puesto: 1, en_juego: false },
  ];
  const m = modeloAjustes({ seleccion: ['c1'], elementos, nombreDe: (e) => `el ${e.id}` });
  eq([m.fila.n.valor, m.fila.equipo.valor, m.fila.balon.valor, m.fila.orientacion.valor], ['3', 'B', 'si', '90']);
  eq(m.fila.n.opciones.length, 12, 'de uno a doce:');
  eq(m.fila.orientacion.opciones.length, 24, 'de 15 en 15 grados:');
  eq(m.fila.vuelta.opciones.map((o) => o.valor), [null, 'c2'], 'y puede volver a su cola o a la otra:');
  const desdeUno = modeloAjustes({ seleccion: ['j1'], elementos, nombreDe: (e) => `el ${e.id}` });
  eq([desdeUno.tipo, desdeUno.id], ['cono', 'c1'], 'uno que espera enseña la fila de su cono:');
});

test('LA FILA DICE CÓMO SALEN: todos uno tras otro, con su cadencia, o solo el primero (§7.4.2)', () => {
  const con = (fila) => modeloAjustes({ seleccion: ['c1'], elementos: [{ id: 'c1', kind: 'cono', x: 0.5, y: 0.5, fila: { n: 3, equipo: 'A', papel: 'atacante', balon: false, orientacion: 90, vuelta: null, ...fila } }], nombreDe: () => 'el cono 1' }).fila;
  const serie = con({});
  eq(serie.rondas.valor, 'si', 'de serie, salen todos:');
  eq(serie.rondas.opciones.map((o) => o.valor), ['si', 'no']);
  eq(serie.cadencia.valor, null, 'cada uno al acabar el anterior:');
  eq(serie.cadencia.opciones[0], { valor: null, nombre: 'Al acabar el anterior' });
  ok(serie.cadencia.opciones.some((o) => o.valor === '1500' && o.nombre === 'Cada 1,5 s'), 'y cadencias en segundos');
  eq(con({ cadencia_ms: 1750 }).cadencia.opciones.slice(-1)[0], { valor: '1750', nombre: 'Cada 1,75 s' }, 'una cadencia que no está en la lista se enseña igual:');
  const solo = con({ rondas: false });
  eq([solo.rondas.valor, solo.cadencia], ['no', null], 'si solo sale el primero, no hay cadencia:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
