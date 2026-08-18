/* ============================================================
   eval-frase.mjs — banco Node del lector de la descripción
   (taller/js/ia/frase.js) y del diccionario de sujetos
   (taller/js/ia/sujetos.js). Sin red, sin DOM.

     node taller/tools/eval-frase.mjs

   Lo que vigila: que lo que se escribe en el paso 2 salga siempre en
   el mismo evento. Un lector que entiende «A1 bota hasta el codo» de
   dos maneras distintas según el día es peor que uno que no lo
   entiende, porque el segundo lo dice y el primero no.
   ============================================================ */

import {
  crearLexico, leerFrase, leerFases, tokenizar, repartir, textoDeAccion,
  escribirFrase, huecosDe, actoresDe, anclarSujetos,
} from '../js/ia/frase.js';
import {
  sujetosDelTablero, indexarSujetos, siguientePosicion, clave, NOMBRE_ANCLA,
} from '../js/ia/sujetos.js';
import { CATALOGO_SISTEMA, indexar, parametroDe } from '../js/ia/acciones.js';
import { compilarAnimacion } from '../js/ia/compilador.js';
import { anclasEnMetros } from '../js/canvas/medidas.js';

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

/* ---- Un tablero de trabajo -------------------------------------
   Dos atacantes, un defensor, un balón, una fila de tres con rondas,
   dos conos a rodear, una zona y una escalera. Da de sí para todo lo
   que el paso 2 tiene que saber leer. */
const TABLERO = [
  { id: 'j1', kind: 'jugador', equipo: 'A', label: '1', x: 0.50, y: 0.60, dorsal: '7' },
  { id: 'j2', kind: 'jugador', equipo: 'A', label: '2', x: 0.30, y: 0.40 },
  { id: 'j3', kind: 'jugador', equipo: 'B', label: '1', x: 0.45, y: 0.50 },
  { id: 'b1', kind: 'balon', x: 0.50, y: 0.60 },
  { id: 'cf', kind: 'cono', x: 0.80, y: 0.30, funcion: 'fila', fila_config: { n_jugadores: 3, direccion_grados: 0, equipo: 'A', rondas: true } },
  { id: 'cr1', kind: 'cono', x: 0.60, y: 0.25, funcion: 'rodear' },
  { id: 'cr2', kind: 'cono', x: 0.50, y: 0.20, funcion: 'rodear' },
  { id: 'z1', kind: 'zona', tipo: 'rect', nombre: 'ZONA 1', x: 0.10, y: 0.10, x2: 0.30, y2: 0.30 },
  { id: 'e1', kind: 'escalera', x: 0.70, y: 0.70, rot: 0 },
];
const SUJETOS = sujetosDelTablero({ elementos: TABLERO, pista: 'media', canasta: 'norte' });
const LEX = crearLexico({ sujetos: SUJETOS });

const nombreDe = (ref) => (SUJETOS.find((s) => s.ref === ref) || {}).nombre;
const ev = (texto, estado = {}) => leerFrase(texto, LEX, estado).eventos;
const av = (texto, estado = {}) => leerFrase(texto, LEX, estado).avisos.map((a) => `${a.texto_original}|${a.interpretacion}`);

console.log('· el diccionario de sujetos');

test('cada ficha del tablero tiene su nombre y su referencia', () => {
  eq(nombreDe('A1'), 'A1');
  eq(nombreDe('fila1'), 'Fila 1');
  eq(nombreDe('fila1_2'), '2º de la Fila 1');
  eq(nombreDe('ZONA 1'), 'ZONA 1');
  eq(nombreDe('aro'), 'el aro');
  eq(nombreDe('codo_der'), 'Codo derecho');
  eq(nombreDe('e1'), 'Escalera 1');
});

test('el cono de una fila es la FILA, no un cono suelto', () => {
  // Pinchar el cono de una cola es referirse a la cola entera (§5.2).
  const conos = SUJETOS.filter((s) => s.tipo === 'cono');
  eq(conos.map((c) => c.ref), ['cr1', 'cr2'], 'el cono de la fila no debe salir como cono');
  eq(conos.map((c) => c.nombre), ['Cono 1', 'Cono 2'], 'se numeran los que SE VEN, no el índice del tablero');
});

test('las catorce anclas medidas tienen nombre de entrenador', () => {
  // Si mañana medidas.js añade un ancla, aquí falta su nombre y el
  // paso 2 la enseñaría con el slug crudo.
  const medidas = Object.keys(anclasEnMetros()).filter((k) => k !== 'aro');
  const sinNombre = medidas.filter((k) => !NOMBRE_ANCLA[k]);
  eq(sinNombre, [], 'anclas sin nombre legible');
});

test('una zona sin nombre no se puede nombrar', () => {
  const s = sujetosDelTablero({ elementos: [{ id: 'z', kind: 'zona', tipo: 'rect', nombre: '  ', x: 0, y: 0, x2: 0.2, y2: 0.2 }], pista: 'media' });
  eq(s.filter((x) => x.tipo === 'zona').length, 0);
});

test('una clave que es solo un número no entra en el índice', () => {
  // «Cono 1» y «A1» comparten el 1: si el número suelto valiera como
  // nombre, el 1 de «Cono 1» señalaría a un jugador.
  const idx = indexarSujetos([{ nombre: 'A1', alias: ['A 1'], tipo: 'jugador', ref: 'A1' }]);
  ok(!idx.has('1'), 'el «1» suelto no debe apuntar a nadie');
  ok(idx.has('a1'), 'y el nombre entero sí');
});

test('los nombres de posición nuevos no pisan a los guardados', () => {
  eq(siguientePosicion({}), 'posicion_1');
  eq(siguientePosicion({ posicion_1: [0, 0], posicion_2: [0, 0] }), 'posicion_3');
});

console.log('\n· lo que el catálogo y los sujetos comparten');

test('acciones y sujetos se normalizan IGUAL', () => {
  // Se buscan sobre el mismo flujo de palabras: si una tolerase «el» y
  // la otra no, la frase se partiría distinto según qué se buscara.
  const idx = indexar(CATALOGO_SISTEMA);
  for (const a of CATALOGO_SISTEMA) {
    ok(idx.has(clave(a.nombre)), `la clave de «${a.nombre}» no coincide entre acciones.js y sujetos.js`);
  }
});

console.log('\n· tokenizado y troceado');

test('cada palabra sabe dónde está en el texto', () => {
  const t = tokenizar('A1 bota, tira');
  eq(t.map((x) => x.norm), ['a1', 'bota', 'tira']);
  eq(t.map((x) => [x.ini, x.fin]), [[0, 2], [3, 7], [9, 13]]);
});

test('los ordinales y los acentos no rompen la palabra', () => {
  eq(tokenizar('el 2º Balón').map((x) => x.norm), ['el', '2', 'balon']);
});

console.log('\n· la frase');

test('sujeto + acción + destino', () => {
  eq(ev('A1 bota hasta el codo derecho'), [{ jugador: 'A1', accion: 'bota', args: { destino: 'codo_der' } }]);
});

test('una coma o una «y» separan dos cosas distintas', () => {
  eq(ev('A1 bota hacia el aro y pasa a A2'), [
    { jugador: 'A1', accion: 'bota', args: { destino: 'aro' } },
    { jugador: 'A1', accion: 'pasa', args: { destino: 'A2' } },
  ]);
  eq(ev('A1 bloquea a A2, A2 corta al aro'), [
    { jugador: 'A1', accion: 'bloquea', args: { companero: 'A2' } },
    { jugador: 'A2', accion: 'corta', args: { destino: 'aro' } },
  ]);
});

test('el sujeto se arrastra: no hay que repetir el nombre', () => {
  // Es la mitad del «casi sin escribir» del criterio de aceptación.
  eq(ev('A1 bota hacia el aro y tira'), [
    { jugador: 'A1', accion: 'bota', args: { destino: 'aro' } },
    { jugador: 'A1', accion: 'tira', args: {} },
  ]);
});

test('dos que hacen lo mismo salen como dos eventos', () => {
  eq(ev('A1 y A2 cortan al aro'), [
    { jugador: 'A1', accion: 'corta', args: { destino: 'aro' } },
    { jugador: 'A2', accion: 'corta', args: { destino: 'aro' } },
  ]);
});

test('el plural de la acción se entiende sin ponerlo en el catálogo', () => {
  eq(ev('A1 y A2 botan hacia el aro').length, 2);
  eq(ev('A1 y A2 recogen').length, 2);
  eq(ev('A1 y A2 vuelven a la fila').length, 2);
});

test('un jugador con dorsal se puede llamar por él', () => {
  eq(ev('el dorsal 7 tira'), [{ jugador: 'A1', accion: 'tira', args: {} }]);
});

test('«vuelve a la Fila 2» no se come el nombre de la fila', () => {
  /* El caso que decide el orden de las dos pasadas: la acción «vuelve a
     la fila» lleva la palabra «fila» dentro. Buscando acciones primero
     se tragaría el nombre de la fila y el número quedaría suelto. */
  const dos = [
    ...TABLERO,
    { id: 'cf2', kind: 'cono', x: 0.2, y: 0.8, funcion: 'fila', fila_config: { n_jugadores: 2, direccion_grados: 180, equipo: 'B' } },
  ];
  const lex = crearLexico({ sujetos: sujetosDelTablero({ elementos: dos, pista: 'media' }) });
  eq(leerFrase('la Fila 1 vuelve a la Fila 2', lex).eventos, [
    { jugador: 'fila1', accion: 'vuelve_a_fila', args: { destino: 'fila2' } },
  ]);
});

test('un jugador concreto de la fila hace algo distinto', () => {
  eq(ev('el 2º de la Fila 1 corta al aro'), [{ jugador: 'fila1_2', accion: 'corta', args: { destino: 'aro' } }]);
});

console.log('\n· los huecos de cada familia');

test('a un compañero se le bloquea; a un sitio se va', () => {
  eq(ev('A1 bloquea a A2'), [{ jugador: 'A1', accion: 'bloquea', args: { companero: 'A2' } }]);
  eq(ev('A1 corta a ZONA 1'), [{ jugador: 'A1', accion: 'corta', args: { destino: 'ZONA 1' } }]);
});

test('un defensor puede ir a un sitio en vez de a su par (la ayuda)', () => {
  eq(ev('B1 defiende a A1 en ZONA 1'), [{ jugador: 'B1', accion: 'defiende', args: { companero: 'A1', destino: 'ZONA 1' } }]);
});

test('un cono se rodea si la acción rodea, y se va a él si no', () => {
  // «bota hasta el Cono 2» no puede acabar haciendo eslalon alrededor
  // del sitio al que se le manda ir.
  eq(ev('A1 rodea el Cono 1 hacia el aro'), [
    { jugador: 'A1', accion: 'rodea', args: { sorteando: ['cr1'], destino: 'aro' } },
  ]);
  eq(ev('A1 bota hasta el Cono 1'), [{ jugador: 'A1', accion: 'bota', args: { destino: 'cr1' } }]);
});

test('una lista sigue creciendo con la «y»', () => {
  eq(ev('A1 rodea el Cono 1 y el Cono 2'), [
    { jugador: 'A1', accion: 'rodea', args: { sorteando: ['cr1', 'cr2'] } },
  ]);
});

test('quien no puede actuar no es el sujeto: es el complemento', () => {
  // «hasta el codo, A1 bota» es raro pero no es un error.
  eq(ev('hasta el codo derecho A1 bota'), [{ jugador: 'A1', accion: 'bota', args: { destino: 'codo_der' } }]);
});

test('el propio actor no se cuela como su propio destino', () => {
  eq(ev('la Fila 1 vuelve a la fila'), [{ jugador: 'fila1', accion: 'vuelve_a_fila', args: {} }]);
});

test('el reparto respeta lo que la familia admite', () => {
  const pasa = CATALOGO_SISTEMA.find((a) => a.slug === 'pasa');
  const zona = { tipo: 'zona', ref: 'ZONA 1', nombre: 'ZONA 1' };
  const r = repartir(pasa, [zona]);
  eq(r.args, {}, 'un pase no va a una zona');
  eq(r.sobras.length, 1, 'y se dice, no se traga');
});

console.log('\n· lo que NO se entiende, se dice');

test('una palabra fuera del vocabulario se señala', () => {
  const r = leerFrase('A1 hace un mortal', LEX);
  eq(r.eventos, []);
  ok(r.avisos.some((a) => a.texto_original === 'mortal'), `debería avisar de «mortal»: ${JSON.stringify(r.avisos)}`);
  ok(r.tramos.some((t) => t.clase === 'nada'), 'y subrayarla');
});

test('sin saber quién actúa no se inventa un protagonista', () => {
  // Es exactamente lo que hacía el extractor viejo: elegía por cercanía
  // al balón y montaba un ejercicio que nadie había escrito.
  const r = leerFrase('bota hacia el aro', LEX);
  eq(r.eventos, []);
  ok(r.avisos.some((a) => /quién/.test(a.interpretacion)), JSON.stringify(r.avisos));
});

test('a una acción a la que le falta un dato se le pide', () => {
  ok(av('A1 pasa').some((s) => /falta/.test(s)), 'un pase sin destinatario');
  ok(av('A1 bota').some((s) => /falta/.test(s)), 'un bote sin destino');
});

test('un destino que no encaja se dice en vez de tragarse', () => {
  ok(av('A1 pasa a ZONA 1').some((s) => /ZONA 1/.test(s)));
});

test('una línea vacía no es un error', () => {
  const r = leerFrase('', LEX);
  eq(r.eventos, []); eq(r.avisos, []); eq(r.tramos, []);
});

test('basura de entrada devuelve algo utilizable', () => {
  for (const v of [null, undefined, 42, {}]) {
    const r = leerFrase(v, LEX);
    ok(Array.isArray(r.eventos) && Array.isArray(r.tramos), `con ${JSON.stringify(v)}`);
  }
});

console.log('\n· los tramos que se pintan debajo de lo escrito');

test('cada trozo reconocido sabe su sitio exacto', () => {
  const t = 'A1 bota hasta el codo derecho';
  const r = leerFrase(t, LEX);
  const trozo = (c) => r.tramos.filter((x) => x.clase === c).map((x) => t.slice(x.ini, x.fin));
  eq(trozo('sujeto'), ['A1', 'codo derecho']);
  eq(trozo('accion'), ['bota']);
});

test('los tramos no se solapan y van en orden', () => {
  const r = leerFrase('la Fila 1 rodea el Cono 1 y el Cono 2, tira y vuelve a la fila', LEX);
  let fin = -1;
  for (const t of r.tramos) {
    ok(t.ini >= fin, `tramo solapado en ${t.ini} (el anterior acababa en ${fin})`);
    fin = t.fin;
  }
});

test('las preposiciones no salen marcadas en rojo', () => {
  // Subrayar «hasta» en «bota hasta el codo» diría que algo va mal
  // cuando todo va bien.
  const r = leerFrase('A1 bota hasta el codo derecho con la izquierda', LEX);
  const rojo = r.tramos.filter((x) => x.clase === 'nada');
  eq(rojo.length, 1, `solo «izquierda» debería quedar sin reconocer: ${JSON.stringify(rojo)}`);
});

console.log('\n· las fases');

test('el sujeto se arrastra de una fase a la siguiente', () => {
  const r = leerFases([{ texto: 'la Fila 1 bota hacia el aro' }, { texto: 'tira' }, { texto: 'recoge' }, { texto: 'vuelve a la fila' }], LEX);
  eq(r.fases.map((f) => f.eventos.map((e) => `${e.jugador}:${e.accion}`)), [
    ['fila1:bota'], ['fila1:tira'], ['fila1:recoge'], ['fila1:vuelve_a_fila'],
  ]);
  eq(r.avisos, []);
});

test('la duración y la pausa de la cabecera viajan con la fase', () => {
  const r = leerFases([{ texto: 'A1 tira', duracion_ms: 2500, pausa_post_ms: 100 }], LEX);
  eq(r.fases[0].duracion_ms, 2500);
  eq(r.fases[0].pausa_post_ms, 100);
  const anim = compilarAnimacion({ canasta: 'norte', fases: r.fases }, TABLERO, 'media');
  eq(anim.fases[0].duracion_ms, 2500, 'y el compilador las respeta');
  eq(anim.fases[0].pausa_post_ms, 100);
});

test('sin cabecera manda el criterio del compilador', () => {
  const r = leerFases([{ texto: 'A1 tira' }], LEX);
  ok(!('duracion_ms' in r.fases[0]), 'no se inventa una duración');
  const anim = compilarAnimacion({ canasta: 'norte', fases: r.fases }, TABLERO, 'media');
  eq(anim.fases[0].duracion_ms, 1000, 'un tiro dura lo que dura un tiro');
});

/* El mismo tablero SIN la fila con rondas: para contar fases una a una
   hace falta que no se repitan tres veces. */
const SIN_FILA = TABLERO.filter((e) => e.id !== 'cf');

test('quien defiende sigue defendiendo hasta que haga otra cosa', () => {
  /* El arco del defensor sale de `fase.defensores`. Sin arrastrarlo, un
     defensor declarado en la fase 1 dejaría de dibujarse como defensor
     en la 2 — y eso se lee como que ha dejado de defender. */
  const r = leerFases([{ texto: 'B1 defiende a A1. A1 bota hacia el aro' }, { texto: 'A1 pasa a A2' }, { texto: 'A2 entra' }], LEX);
  const anim = compilarAnimacion({ canasta: 'norte', fases: r.fases }, SIN_FILA, 'media');
  eq(anim.fases.map((f) => f.defensores), [['B1'], ['B1'], ['B1']]);
  eq(anim.jugadores.find((j) => j.id === 'B1').tipo, 'defensor');
});

test('el defensor arrastrado no se mueve solo', () => {
  const r = leerFases([{ texto: 'B1 defiende a A1. A1 bota hacia el aro' }, { texto: 'A1 pasa a A2' }], LEX);
  const anim = compilarAnimacion({ canasta: 'norte', fases: r.fases }, SIN_FILA, 'media');
  const suyos = anim.fases[1].movimientos.filter((m) => m.elemento_id === 'B1');
  eq(suyos, [], 'sin par y sin destino, el defensor se queda donde está');
});

console.log('\n· de la frase a la animación');

test('un ejercicio de 4 fases sale entero a la primera', () => {
  // El criterio de aceptación del Tramo 2.9, tal cual.
  const r = leerFases([
    { texto: 'la Fila 1 bota hacia el aro' },
    { texto: 'tira' },
    { texto: 'recoge' },
    { texto: 'vuelve a la fila' },
  ], LEX);
  eq(r.avisos, [], 'no debería haber nada que preguntar');
  const anim = compilarAnimacion({ canasta: 'norte', fases: r.fases }, TABLERO, 'media');
  eq(anim.rondas, 3, 'la fila tiene rondas: salen los tres');
  eq(anim.fases.length, 12, '3 rondas × 4 fases');
  ok(anim.fases.some((f) => f.tiros.length), 'y hay un tiro');
  ok(anim.fases.some((f) => f.recogidas.length), 'y una recogida');
});

test('«hasta el Cono 2» lleva de verdad hasta el cono', () => {
  const r = leerFases([{ texto: 'A1 corre hasta el Cono 2' }], LEX);
  const anim = compilarAnimacion({ canasta: 'norte', fases: r.fases }, TABLERO, 'media');
  const m = anim.fases[0].movimientos.find((x) => x.elemento_id === 'A1');
  const fin = m.path[m.path.length - 1];
  eq([Number(fin.x.toFixed(3)), Number(fin.y.toFixed(3))], [0.5, 0.2]);
});

test('la barra de acciones deja el cursor donde toca', () => {
  const de = (slug) => textoDeAccion(CATALOGO_SISTEMA.find((a) => a.slug === slug));
  eq(de('pasa'), 'Pasa hasta ');
  eq(de('bloquea'), 'Bloquea a ');
  eq(de('tira'), 'Tira');
  eq(de('entra'), 'Entra a canasta');
});

console.log('\n· el camino de vuelta: escribir la frase');

const NOMBRE = (ref) => (SUJETOS.find((s) => s.ref === ref) || {}).nombre || ref;
const escribir = (eventos) => escribirFrase(eventos, { lexico: LEX, nombreDe: NOMBRE });

test('una frase se escribe como se diría', () => {
  eq(escribir(ev('Fila 1 bota hasta el codo derecho, pasa a A2')),
    'Fila 1 bota hasta Codo derecho, pasa a A2');
});

test('el sujeto solo se repite cuando cambia', () => {
  eq(escribir(ev('A1 bota hacia el aro y tira')), 'A1 bota hasta el aro, tira');
  eq(escribir(ev('A1 bloquea a A2, A2 corta al aro')), 'A1 bloquea a A2, A2 corta hasta el aro');
});

test('cada hueco lleva su preposición', () => {
  eq(escribir(ev('B1 defiende a A1 en ZONA 1')), 'B1 defiende a A1 en ZONA 1');
  eq(escribir(ev('A1 rodea el Cono 1 y el Cono 2 hasta el aro')), 'A1 rodea el Cono 1 y el Cono 2 hasta el aro');
});

test('leer → escribir → leer da los MISMOS eventos', () => {
  /* Es lo que sostiene el panel «Manualmente»: enseña lo entendido y al
     cambiar algo reescribe la línea. Si la vuelta no fuera exacta, tocar
     un desplegable cambiaría la jugada por su cuenta. */
  for (const t of [
    'Fila 1 bota hasta el codo derecho, pasa a A2',
    'A1 rodea el Cono 1 y el Cono 2 hasta el aro',
    'Fila 1 vuelve a la fila',
    'A1 entra a canasta',
    'B1 defiende a A1 en ZONA 1',
    'Fila 1 bota hacia el aro, tira, recoge y vuelve a la fila',
    'A1 y A2 cortan al aro',
    'el 2º de la Fila 1 corta al aro',
    'A1 recoge',
  ]) {
    const uno = ev(t);
    const dos = ev(escribir(uno));
    eq(dos, uno, `«${t}» → «${escribir(uno)}»`);
  }
});

test('lo que la acción ya trae puesto no se repite', () => {
  // «entra a canasta» y «entra» son lo mismo para el motor: guardarlo en
  // un caso y no en el otro haría que dos frases idénticas se vieran
  // distintas al releerlas.
  eq(ev('A1 entra a canasta'), ev('A1 entra'));
  eq(ev('A1 tira a canasta'), ev('A1 tira'));
});

test('volver a la PROPIA fila no es un destino que anotar', () => {
  eq(ev('la Fila 1 vuelve a la Fila 1'), [{ jugador: 'fila1', accion: 'vuelve_a_fila', args: {} }]);
});

test('una continuación solo suma si TODO lo nombrado cabe', () => {
  // «rodea el Cono 1 y el Cono 2» sigue sumando…
  eq(ev('A1 rodea el Cono 1 y el Cono 2'), [
    { jugador: 'A1', accion: 'rodea', args: { sorteando: ['cr1', 'cr2'] } },
  ]);
  // …y «bota hasta el codo y A2» no convierte a A2 en un obstáculo.
  const r = leerFrase('A1 bota hasta el codo derecho y A2', LEX);
  eq(r.eventos, [{ jugador: 'A1', accion: 'bota', args: { destino: 'codo_der' } }]);
  ok(r.avisos.some((a) => a.texto_original === 'A2'), 'y se dice que A2 se ha quedado sin hacer nada');
});

test('un punto suelto no se escribe: es un retoque de flecha', () => {
  // Los arrastres viven en la capa de ediciones, no en la frase.
  const conPunto = [{ jugador: 'A1', accion: 'bota', args: { destino: { x: 0.3, y: 0.4 } } }];
  eq(escribir(conPunto), 'A1 bota');
});

test('un defensor arrastrado no se escribe', () => {
  const r = leerFases([{ texto: 'B1 defiende a A1. A1 bota hacia el aro' }, { texto: 'A1 tira' }], LEX);
  eq(escribir(r.fases[1].eventos), 'A1 tira', 'la fase 2 no dice «B1 defiende»: nadie lo escribió');
});

test('corregir una fase no cambia quién actúa en las siguientes', () => {
  /* El arrastre del sujeto es lo que deja escribir «bota / tira / recoge»
     sin repetir el nombre. El precio: cambiar quién actúa en la fase 1
     cambiaría, en silencio, quién actúa en las cuatro siguientes. Y el
     panel «Manualmente» promete lo contrario. */
  const original = [
    { texto: 'Fila 1 bota hacia el aro' },
    { texto: 'tira' },
    { texto: 'recoge' },
    { texto: 'vuelve a la fila' },
  ];
  const antes = actoresDe(leerFases(original, LEX).fases);
  eq(antes, ['fila1', 'fila1', 'fila1', 'fila1']);

  // en la fase 1 pasa a actuar otro
  const tocado = original.map((f, i) => (i === 0 ? { texto: 'A1 bota hacia el aro' } : f));
  eq(actoresDe(leerFases(tocado, LEX).fases), ['A1', 'A1', 'A1', 'A1'], 'sin anclar, se lo lleva todo por delante');

  const anclado = anclarSujetos(tocado, LEX, { nombreDe: NOMBRE, actores: antes, desde: 0 });
  eq(actoresDe(leerFases(anclado, LEX).fases), ['A1', 'fila1', 'fila1', 'fila1']);
  eq(anclado[1].texto, 'Fila 1 tira', 'solo se le escribe el nombre a la que hacía falta');
  eq(anclado[2].texto, 'recoge', 'y a las demás no se les toca una palabra');
  eq(anclado[3].texto, 'vuelve a la fila');
});

test('anclar no toca nada si nadie se ve afectado', () => {
  const fases = [{ texto: 'A1 bota hacia el aro' }, { texto: 'A2 corta al aro' }];
  const antes = actoresDe(leerFases(fases, LEX).fases);
  const igual = anclarSujetos(fases, LEX, { nombreDe: NOMBRE, actores: antes, desde: 0 });
  eq(igual.map((f) => f.texto), fases.map((f) => f.texto));
});

console.log('\n· los huecos que enseña el panel «Manualmente»');

test('cada acción declara qué desplegables necesita', () => {
  const de = (slug) => huecosDe(CATALOGO_SISTEMA.find((a) => a.slug === slug)).map((x) => x.hueco);
  eq(de('pasa'), ['destino', 'balon']);
  eq(de('bloquea'), ['companero', 'destino']);
  eq(de('rodea'), ['destino', 'sorteando']);
  // …y «qué rodea» no se le ofrece a quien no rodea
  eq(de('bota'), ['destino']);
  eq(de('corta'), ['destino']);
});

test('lo que la acción PIDE va primero y se marca', () => {
  const h = huecosDe(CATALOGO_SISTEMA.find((a) => a.slug === 'bloquea'));
  eq(h[0].hueco, 'companero');
  eq(h[0].pedido, true);
  eq(h[1].pedido, false);
});

test('un hueco de lista se sabe que lo es', () => {
  const h = huecosDe(CATALOGO_SISTEMA.find((a) => a.slug === 'rodea'));
  eq(h.find((x) => x.hueco === 'sorteando').lista, true);
  eq(h.find((x) => x.hueco === 'destino').lista, false);
});

test('cada hueco dice qué tipos de sujeto admite', () => {
  const de = (slug, hueco) => huecosDe(CATALOGO_SISTEMA.find((a) => a.slug === slug)).find((x) => x.hueco === hueco).tipos;
  eq(de('bloquea', 'companero'), ['jugador', 'fila', 'fila_miembro'], 'un compañero solo puede ser alguien');
  ok(de('bota', 'destino').includes('aro'), 'y a un bote se le puede mandar al aro');
});

console.log('\n· lo que no debe cambiar');

test('las nueve acciones de siempre siguen resolviendo', () => {
  const idx = indexar(CATALOGO_SISTEMA);
  for (const nombre of ['bote', 'corte', 'pase', 'tiro', 'bloqueo', 'defensa', 'zigzag', 'vuelve a la cola', 'rebote']) {
    ok(idx.get(clave(nombre)), `«${nombre}» debería seguir resolviendo`);
  }
});

test('el rol defensor sigue saliendo del catálogo, no de una lista aparte', () => {
  eq(parametroDe(CATALOGO_SISTEMA.find((a) => a.slug === 'defiende'), 'rol'), 'defensor');
  eq(parametroDe(CATALOGO_SISTEMA.find((a) => a.slug === 'bloquea'), 'rol'), 'sin_cambio');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
