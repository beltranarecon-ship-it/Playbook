/* ============================================================
   eval-cargar.mjs — banco Node del camino de vuelta: un ejercicio
   guardado, otra vez en los cuatro pasos (taller/js/wizard/cargar.js).
   Sin red, sin DOM.

     node taller/tools/eval-cargar.mjs

   Lo que vigila: que abrir y volver a guardar NO cambie el ejercicio.
   Un viaje de ida y vuelta que pierde un jugador de la cola, o que
   olvida las líneas del paso 2, convierte «corregir una coma» en
   «rehacer el ejercicio», y eso no se nota hasta que ya se guardó.
   ============================================================ */

import { borradorDeEjercicio, elementosDeAnimacion, nombreDeVariante, nombreBase, nombreRepetido } from '../js/wizard/cargar.js';
import { aRegistro, nuevoDraft } from '../js/wizard/draft.js';
import { compilarAnimacion } from '../js/ia/compilador.js';

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

/* Un ejercicio como el que deja el Taller: con tablero guardado, líneas
   de fase y posiciones marcadas dentro de la animación. */
const TABLERO = [
  { id: 'j1', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6, dorsal: '7', nombre: 'Ana' },
  { id: 'b1', kind: 'balon', x: 0.5, y: 0.6, portador_id: null },
  { id: 'cf', kind: 'cono', x: 0.86, y: 0.3, funcion: 'fila', fila_config: { n_jugadores: 6, direccion_grados: 180, equipo: 'A', rondas: true, cadencia_s: null, rol: 'atacante' } },
  { id: 'z1', kind: 'zona', tipo: 'rect', nombre: 'ZONA 1', visible: false, x: 0.1, y: 0.1, x2: 0.3, y2: 0.3 },
  { id: 'e1', kind: 'escalera', x: 0.7, y: 0.7, rot: 90 },
];

function filaGuardada() {
  const anim = compilarAnimacion({
    canasta: 'norte',
    fases: [
      { eventos: [{ jugador: 'fila1', accion: 'bota', args: { destino: 'aro' } }] },
      { eventos: [{ jugador: 'fila1', accion: 'tira', args: {} }] },
    ],
  }, TABLERO, 'media');
  anim._fases_texto = [
    { texto: 'la Fila 1 bota hasta el aro', duracion_ms: null, pausa_post_ms: null },
    { texto: 'tira', duracion_ms: 2500, pausa_post_ms: 100 },
  ];
  anim._posiciones = { refugio: [0.25, 0.4] };
  anim._elementos = TABLERO.map((e) => ({ ...e }));
  return {
    id: 'abc-123', name: 'Entradas desde la fila', type: 'Bote', category: 'entrada',
    tipo_pista: 'media', categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Entradas por parejas desde la fila.',
    objetivos: 'Fijar el doble ritmo.', descripcion_texto: 'Una fila en el 45…',
    notas: 'Corregir el último apoyo.', tags: ['entrada', 'doble ritmo'],
    autor_nombre: 'Beltrán',
    requisitos: { jugadores_min: 4, jugadores_max: 12, densidad: 'media', niveles: { base: 'a', intermedio: 'b', avanzado: 'c' } },
    animacion: anim,
  };
}

console.log('· abrir un ejercicio guardado');

test('vuelve TODO lo que se escribió', () => {
  const { draft } = borradorDeEjercicio(filaGuardada());
  eq(draft.nombre, 'Entradas desde la fila');
  eq(draft.tipo, 'Bote');
  eq(draft.category, 'entrada');
  eq(draft.tipo_pista, 'media');
  eq(draft.dificultad_valor, 4);
  eq(draft.duracion_min, 8);
  eq(draft.description, 'Entradas por parejas desde la fila.');
  eq(draft.tags, ['entrada', 'doble ritmo']);
  eq(draft.autor_nombre, 'Beltrán');
});

test('vuelve el paso 2 tal como se dejó', () => {
  /* Sin esto, reabrir devolvería la geometría pero no lo que se escribió
     para generarla: el paso 2 saldría en blanco y cualquier retoque
     habría que hacerlo a mano sobre las flechas. */
  const { draft } = borradorDeEjercicio(filaGuardada());
  eq(draft.fases_texto.map((f) => f.texto), ['la Fila 1 bota hasta el aro', 'tira']);
  eq(draft.fases_texto[1].duracion_ms, 2500, 'y los ajustes de la cabecera');
  eq(draft.fases_texto[1].pausa_post_ms, 100);
  eq(draft.posiciones, { refugio: [0.25, 0.4] });
});

test('vuelve el tablero EXACTO, no una aproximación', () => {
  const { elementos } = borradorDeEjercicio(filaGuardada());
  eq(elementos, TABLERO);
});

test('los requisitos que falten quedan «sin decidir», no ausentes', () => {
  /* Una ficha vieja a la que le falte un campo del molde tiene que
     tenerlo en null para que el listón del paso 3 lo pida, en vez de
     callarse porque la clave no existe. */
  const { draft } = borradorDeEjercicio(filaGuardada());
  eq(draft.requisitos.jugadores_min, 4, 'lo que había se respeta');
  eq(draft.requisitos.canastas, null, 'y lo que falta se pide');
  eq(draft.requisitos.oposicion, null);
  eq(draft.requisitos.niveles, { base: 'a', intermedio: 'b', avanzado: 'c' });
});

test('el conteo del tablero no pisa lo guardado', () => {
  const { draft } = borradorDeEjercicio(filaGuardada());
  ok(draft.requisitos_manual, 'lo guardado manda sobre la propuesta del tablero');
});

console.log('\n· abrir y volver a guardar no cambia nada');

test('ida y vuelta: el registro sale igual', () => {
  // La prueba que de verdad importa: corregir una coma no puede
  // reescribir media ficha por el camino.
  const fila = filaGuardada();
  const { draft } = borradorDeEjercicio(fila);
  const reg = aRegistro(draft);
  eq(reg.nombre, fila.name);
  eq(reg.category, fila.category);
  eq(reg.description, fila.description);
  eq(reg.tags, fila.tags);
  eq(reg.requisitos.jugadores_min, fila.requisitos.jugadores_min);
  eq(reg.requisitos.niveles, fila.requisitos.niveles);
  eq(reg.dificultad_valor, fila.difficulty);
});

console.log('\n· las fichas de la biblioteca, que no guardaron su tablero');

test('la cola de una fila NO pierde jugadores', () => {
  /* El fallo que este banco existe para impedir: la cola dibujada viene
     descontada de los que salieron a trabajar. Sin devolverlos, cada
     apertura+guardado le quitaría uno a la fila hasta vaciarla. */
  const anim = compilarAnimacion({
    canasta: 'norte',
    fases: [{ eventos: [{ jugador: 'fila1', accion: 'bota', args: { destino: 'aro' } }] }],
  }, TABLERO, 'media');
  delete anim._elementos;
  const dibujada = anim.conos.find((c) => c.funcion === 'fila').fila_config.n_jugadores;
  ok(dibujada < 6, `la animación dibuja ${dibujada}, menos de los 6 que hay`);

  const elementos = elementosDeAnimacion(anim);
  const cono = elementos.find((e) => e.kind === 'cono' && e.funcion === 'fila');
  eq(cono.fila_config.n_jugadores, 6, 'la fila tiene que volver con los seis');
});

test('los jugadores de fila no se convierten en fichas sueltas', () => {
  // Los sintetiza el compilador desde el cono: si volvieran como fichas,
  // el tablero tendría seis jugadores Y una cola de seis.
  const anim = compilarAnimacion({
    canasta: 'norte',
    fases: [{ eventos: [{ jugador: 'fila1', accion: 'bota', args: { destino: 'aro' } }] }],
  }, TABLERO, 'media');
  delete anim._elementos;
  const jugadores = elementosDeAnimacion(anim).filter((e) => e.kind === 'jugador');
  eq(jugadores.length, 1, 'solo A1, el que está puesto a mano');
  eq(jugadores[0].label, '1');
});

test('zonas y material vuelven de la animación', () => {
  const anim = compilarAnimacion({ canasta: 'norte', fases: [] }, TABLERO, 'media');
  delete anim._elementos;
  const el = elementosDeAnimacion(anim);
  const z = el.find((e) => e.kind === 'zona');
  ok(z, 'falta la zona');
  eq(z.nombre, 'ZONA 1');
  const esc = el.find((e) => e.kind === 'escalera');
  ok(esc, 'falta la escalera');
  eq(esc.rot, 90, 'y su orientación');
});

test('una animación vacía o rota no revienta', () => {
  for (const v of [null, undefined, {}, 'texto', 42]) eq(elementosDeAnimacion(v), []);
  const { draft, elementos } = borradorDeEjercicio(null);
  ok(draft && Array.isArray(elementos), 'con null tiene que devolver algo utilizable');
});

console.log('\n· duplicar');

test('la variante se llama «X-variante de …»', () => {
  eq(nombreDeVariante('Bote en cuadrantes', []), '1-variante de Bote en cuadrantes');
  eq(nombreDeVariante('Bote en cuadrantes', ['1-variante de Bote en cuadrantes']), '2-variante de Bote en cuadrantes');
  eq(nombreDeVariante('Bote en cuadrantes', ['1-variante de Bote en cuadrantes', '3-variante de Bote en cuadrantes']),
    '2-variante de Bote en cuadrantes', 'ocupa el hueco libre');
});

test('duplicar una variante da otra del ORIGINAL', () => {
  // Si no, a la tercera vuelta sale «1-variante de 1-variante de…».
  eq(nombreBase('2-variante de Bote en cuadrantes'), 'Bote en cuadrantes');
  eq(nombreDeVariante('2-variante de Bote en cuadrantes', ['2-variante de Bote en cuadrantes']),
    '1-variante de Bote en cuadrantes');
});

test('las variantes de OTRO ejercicio no cuentan', () => {
  eq(nombreDeVariante('Tiro libre', ['1-variante de Bote en cuadrantes']), '1-variante de Tiro libre');
});

test('duplicar suelta el id: guardar crea, no pisa', () => {
  /* Es lo que separa «hacer una variante» de «machacar el original», y
     el fallo sería mudo: guardarías creyendo que creas. */
  const { draft } = borradorDeEjercicio(filaGuardada(), { duplicar: true, nombres: [] });
  eq(draft.id, null);
  eq(draft.nombre, '1-variante de Entradas desde la fila');
  eq(draft.animacion !== null, true, 'pero se lleva la jugada entera');
  eq(draft.fases_texto.length, 2, 'y las líneas del paso 2');
});

test('editar conserva el id: guardar corrige', () => {
  const { draft } = borradorDeEjercicio(filaGuardada());
  eq(draft.id, 'abc-123');
});

console.log('\n· dos ejercicios con el mismo nombre');

test('se detecta el repetido, mire como se mire', () => {
  const otros = [{ id: 'x', name: 'Bote en cuadrantes' }];
  ok(nombreRepetido('Bote en cuadrantes', otros), 'igual');
  ok(nombreRepetido('  bote en   cuadrantes ', otros), 'mayúsculas y espacios de sobra');
  ok(!nombreRepetido('Bote en cuadros', otros), 'otro nombre');
});

test('un ejercicio no choca consigo mismo', () => {
  // Guardar sin cambiar el nombre tiene que seguir funcionando.
  const otros = [{ id: 'x', name: 'Bote en cuadrantes' }];
  ok(!nombreRepetido('Bote en cuadrantes', otros, 'x'), 'es él mismo');
  ok(nombreRepetido('Bote en cuadrantes', otros, 'otro-id'), 'y otro sí choca');
});

test('un nombre vacío no cuenta como repetido', () => {
  ok(!nombreRepetido('', [{ id: 'x', name: '' }]));
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
