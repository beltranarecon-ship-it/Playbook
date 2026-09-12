/* ============================================================
   eval-cargar.mjs — banco Node del camino de vuelta: un ejercicio
   guardado, otra vez en el asistente (taller/js/wizard/cargar.js).
   Sin red, sin DOM.

     node taller/tools/eval-cargar.mjs

   Lo que vigila: que abrir y volver a guardar NO cambie el ejercicio.
   Un viaje de ida y vuelta que olvida las líneas de las fases, o que
   descoloca los requisitos, convierte «corregir una coma» en «rehacer
   el ejercicio», y eso no se nota hasta que ya se guardó.
   ============================================================ */

import { borradorDeEjercicio, nombreDeVariante, nombreBase, nombreRepetido } from '../js/wizard/cargar.js';
import { aRegistro, nuevoDraft } from '../js/wizard/draft.js';

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

/* La animación §10 de un ejercicio guardado: una fila que bota hasta el
   aro y tira. Está ESCRITA A MANO —antes la fabricaba el compilador del
   motor viejo, que ya no existe— y con la forma completa a propósito:
   este banco vigila que la animación vuelva intacta, y con media
   animación no se vigila nada. */
function animacionGuardada() {
  return {
    pista: 'media',
    canasta: 'norte',
    jugadores: [
      { id: 'A1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.5, 0.6], tiene_balon: false, dorsal: '7', nombre: 'Ana' },
      { id: 'fila1', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.86, 0.3], tiene_balon: true, dorsal: null, nombre: null },
      { id: 'fila1_2', equipo: 'A', tipo: 'atacante', posicion_inicial: [0.79, 0.3], tiene_balon: false, dorsal: null, nombre: null },
    ],
    balones: [{ id: 'b1', posicion_inicial: [0.86, 0.3], portador_id: 'fila1' }],
    /* La cola dibujada va DESCONTADA de los que salieron a trabajar: de
       los seis del tablero quedan cuatro esperando. */
    conos: [{ id: 'cf', posicion: [0.86, 0.3], funcion: 'fila', fila_config: { n_jugadores: 4, direccion_grados: 180, equipo: 'A', rondas: true, cadencia_s: null, rol: 'atacante' } }],
    zonas: [{ id: 'z1', tipo: 'rect', nombre: 'ZONA 1', visible: false, puntos: [[0.1, 0.1], [0.3, 0.3]] }],
    materiales: [{ id: 'e1', tipo: 'escalera', posicion: [0.7, 0.7], rot: 90 }],
    fases: [
      {
        id: 'fase_1', duracion_ms: 1500, pausa_post_ms: 400,
        movimientos: [{
          elemento_id: 'fila1', tipo_elemento: 'jugador', tipo_movimiento: 'carrera_con_balon',
          path: [{ x: 0.86, y: 0.3, tipo_nodo: 'lineal' }, { x: 0.47, y: 0.41, tipo_nodo: 'lineal' }],
        }],
        pases: [], bloqueos: [], tiros: [], recogidas: [], defensores: [], acciones: ['bota'], ronda: 1,
      },
      {
        id: 'fase_2', duracion_ms: 1000, pausa_post_ms: 600,
        movimientos: [], pases: [], bloqueos: [],
        tiros: [{ jugador_id: 'fila1', balon_id: 'b1', canasta: 'norte', path: [{ x: 0.47, y: 0.41 }, { x: 0.15, y: 0.5 }] }],
        recogidas: [], defensores: [], acciones: ['tira'], ronda: 1,
      },
    ],
    rondas: 2,
    warnings: [],
    /* Lo que se guardó para poder reabrirlo. Las líneas y las posiciones
       las vuelve a leer cargar.js; el tablero (`_elementos`) ya no lo lee
       nadie, pero está en la base de datos de los ejercicios guardados y
       tiene que sobrevivir a abrir y volver a guardar. */
    _fases_texto: [
      { texto: 'la Fila 1 bota hasta el aro', duracion_ms: null, pausa_post_ms: null },
      { texto: 'tira', duracion_ms: 2500, pausa_post_ms: 100 },
    ],
    _posiciones: { refugio: [0.25, 0.4] },
    _elementos: [
      { id: 'j1', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6, dorsal: '7', nombre: 'Ana' },
      { id: 'b1', kind: 'balon', x: 0.5, y: 0.6, portador_id: null },
      { id: 'cf', kind: 'cono', x: 0.86, y: 0.3, funcion: 'fila', fila_config: { n_jugadores: 6, direccion_grados: 180, equipo: 'A', rondas: true, cadencia_s: null, rol: 'atacante' } },
      { id: 'z1', kind: 'zona', tipo: 'rect', nombre: 'ZONA 1', visible: false, x: 0.1, y: 0.1, x2: 0.3, y2: 0.3 },
      { id: 'e1', kind: 'escalera', x: 0.7, y: 0.7, rot: 90 },
    ],
  };
}

/* El ejercicio entero tal y como lo devuelve getEjercicio(). */
function filaGuardada() {
  return {
    id: 'abc-123', name: 'Entradas desde la fila', type: 'Bote', category: 'entrada',
    tipo_pista: 'media', categoria_rama: 'Minibasket', categoria_nivel: [],
    difficulty: 4, intensidad: 3, duration_min: 8, duration_max: 12,
    description: 'Entradas por parejas desde la fila.',
    objetivos: 'Fijar el doble ritmo.', descripcion_texto: 'Una fila en el 45…',
    notas: 'Corregir el último apoyo.', tags: ['entrada', 'doble ritmo'],
    autor_nombre: 'Beltrán',
    requisitos: { jugadores_min: 4, jugadores_max: 12, densidad: 'media', niveles: { base: 'a', intermedio: 'b', avanzado: 'c' } },
    animacion: animacionGuardada(),
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

test('vuelven las líneas de las fases tal como se dejaron', () => {
  /* Sin esto, reabrir devolvería el dibujo pero no lo que se escribió, y
     el paso 3 se quedaría sin las líneas con las que arma la
     descripción del ejercicio. */
  const { draft } = borradorDeEjercicio(filaGuardada());
  eq(draft.fases_texto.map((f) => f.texto), ['la Fila 1 bota hasta el aro', 'tira']);
  eq(draft.fases_texto[1].duracion_ms, 2500, 'y los ajustes de la cabecera');
  eq(draft.fases_texto[1].pausa_post_ms, 100);
  eq(draft.posiciones, { refugio: [0.25, 0.4] });
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
  /* Una COPIA de antes de abrir: borradorDeEjercicio pasa la animación
     sin copiarla, así que comparar con `fila.animacion` era comparar el
     objeto consigo mismo, y un cambio hecho por dentro no se vería. */
  const animacionAntes = JSON.parse(JSON.stringify(fila.animacion));
  const { draft } = borradorDeEjercicio(fila);
  const reg = aRegistro(draft);
  eq(reg.nombre, fila.name);
  eq(reg.category, fila.category);
  eq(reg.description, fila.description);
  eq(reg.tags, fila.tags);
  eq(reg.requisitos.jugadores_min, fila.requisitos.jugadores_min);
  eq(reg.requisitos.niveles, fila.requisitos.niveles);
  eq(reg.dificultad_valor, fila.difficulty);
  eq(reg.animacion, animacionAntes, 'y la animación entera, sin tocar: el dibujo no se recompone al abrir');
});

console.log('\n· lo que llega roto no puede tumbar la carga');

test('una animación vacía o rota no revienta', () => {
  /* Una ficha vieja puede traer cualquier cosa en `animacion`, y abrirla
     para corregirle el nombre no puede acabar en una pantalla en blanco. */
  for (const v of [null, undefined, {}, 'texto', 42]) {
    const { draft } = borradorDeEjercicio({ name: 'Ficha vieja', animacion: v });
    eq(draft.nombre, 'Ficha vieja', `con animacion=${String(v)}:`);
  }
  ok(borradorDeEjercicio(null).draft, 'y sin ejercicio ninguno, también');
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
  eq(draft.fases_texto.length, 2, 'y las líneas de las fases');
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

console.log('\n· la jugada de la Pizarra');

const JUGADA = () => ({
  version: 3, pista: 'media', canasta: 'sur',
  elementos: [{ id: 'jugador_1', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6 }],
  fases: [{ id: 'f1', nombre: null, duracion_ms: null, pausa_post_ms: null, tramos: [] }],
});

test('vuelve la JUGADA tal cual, para seguir dibujando', () => {
  const jugada = JUGADA();
  const { draft } = borradorDeEjercicio({ ...filaGuardada(), jugada });
  eq(draft.jugada, jugada);
  ok(draft.jugada !== jugada, 'es una copia: dibujar no puede cambiar lo que llegó');
});

test('un ejercicio de antes de la Pizarra no tiene jugada, y no se le inventa', () => {
  eq(borradorDeEjercicio(filaGuardada()).draft.jugada, null);
  eq(borradorDeEjercicio({ ...filaGuardada(), jugada: 'rota' }).draft.jugada, null);
  eq(borradorDeEjercicio(null).draft.jugada, null);
});

test('duplicar se lleva la jugada, y guardar la escribe', () => {
  const { draft } = borradorDeEjercicio({ ...filaGuardada(), jugada: JUGADA() }, { duplicar: true, nombres: [] });
  eq(draft.jugada, JUGADA());
  eq(aRegistro(draft).jugada, JUGADA(), 'aRegistro:');
  eq(aRegistro(nuevoDraft()).jugada, null, 'y un borrador nuevo sale sin ella:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
