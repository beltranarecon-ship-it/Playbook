/* ============================================================
   eval-llevar.mjs — banco Node de «llevar al paso 3»
   (taller/js/wizard/llevar.js). Sin red, sin DOM.

     node taller/tools/eval-llevar.mjs

   Lo que la pizarra ya sabe pasa a la ficha (§9.4): contenido,
   etiquetas, material y desarrollo, con plantillas y sin IA, y solo
   donde la ficha está vacía.
   ============================================================ */

import { propuestaDesdeLaJugada, llevarAlPaso3, duracionDeUnaVuelta, esTraidoDeLaPizarra } from '../js/wizard/llevar.js';
import { volcar } from '../js/wizard/puente.js';
import { nuevoDraft } from '../js/wizard/draft.js';
import { esTagValido } from '../js/ia/vocabulario.js';
import { posicionesDe } from '../js/canvas/anclas.js';

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

const A = Object.fromEntries(Object.entries(posicionesDe('entera', 'norte')).map(([k, [x, y]]) => [k, { x, y }]));
const N = (p) => ({ x: p.x, y: p.y, tipo_nodo: 'lineal' });
const jugador = (id, equipo, label, p) => ({ id, kind: 'jugador', equipo, label, dorsal: null, x: p.x, y: p.y, en_juego: true });
let n = 0;
const tr = (elemento_id, corre_id, accion, desde, hasta, extra = {}) => ({
  id: `tr${++n}`, elemento_id, corre_id, receptor_id: null, accion, tipo: 'run', variante: null, trazo: [N(desde), N(hasta)], ...extra,
});
const jugada = (elementos, fases) => ({ version: 3, pista: 'entera', canasta: 'norte', elementos, fases });

function entrada() {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der),
    { id: 'b1', kind: 'balon', portador_id: 'j1', x: A.base.x + 0.04, y: A.base.y },
    { id: 'cono_5', kind: 'cono', x: 0.3, y: 0.6, nombre: null, fila: null },
  ];
  const cerca = { x: A.aro.x, y: A.aro.y + 0.04 };
  return jugada(el, [
    { id: 'f1', tramos: [
      tr('j1', 'b1', 'pasa', A.base, A.alero_der, { tipo: 'pass', receptor_id: 'j2', variante: 'picado' }),
      tr('j1', 'j1', 'corta', A.base, A.codo_der),
    ] },
    { id: 'f2', tramos: [
      tr('j2', 'j2', 'entra', A.alero_der, cerca, { variante: 'bandeja' }),
      tr('j2', 'b1', 'tira', cerca, A.aro, { tipo: 'pass', desenlace: 'entra' }),
    ], texto: 'El 2 se va por la línea de fondo y termina en bandeja.' },
  ]);
}

test('LA PROPUESTA: contenido, etiquetas del vocabulario, material y el desarrollo con las frases', () => {
  const p = propuestaDesdeLaJugada(entrada());
  eq(p.category, 'juego-de-2', 'un pasar y cortar es juego de dos aunque acabe en entrada, como en la biblioteca:');
  eq(p.tags, ['pase', 'pase picado', 'corte', 'entrada', 'bandeja', 'tiro', 'pasar y cortar']);
  ok(p.tags.every(esTagValido), 'todas del vocabulario de la biblioteca');
  eq(p.material, ['balones', 'conos']);
  const [uno, dos] = p.desarrollo.split('\n');
  ok(/^1\. A1 pasa picado a A2 y corta al codo derecho\.$/.test(uno), `la automática de la fase 1: ${uno}`);
  eq(dos, '2. El 2 se va por la línea de fondo y termina en bandeja.', 'y la reescrita, que manda:');
});

test('EL CONTENIDO SALE DE LO QUE SE HA USADO, con su prioridad', () => {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), jugador('j3', 'B', '1', A.codo_der),
    { id: 'b1', kind: 'balon', portador_id: 'j1', x: A.base.x + 0.04, y: A.base.y },
  ];
  const con = (tramos) => propuestaDesdeLaJugada(jugada(el, [{ id: 'f1', tramos }])).category;
  eq(con([tr('j1', 'j1', 'bota', A.base, A.codo_der)]), 'bote');
  eq(con([tr('j1', 'j1', 'bota', A.base, A.codo_der), tr('j1', 'j1', 'tira', A.codo_der, A.aro, { desenlace: 'falla' })]), 'tiro');
  eq(con([tr('j2', 'j2', 'bloquea', A.alero_der, A.base, { tipo: 'bloqueo', companero_id: 'j1' })]), 'juego-de-2');
  eq(con([tr('j1', 'j1', 'recoge', A.base, A.aro, { balon_id: 'x' })]), 'rebote');
  eq(con([]), 'defensa', 'sin nada dibujado y con defensa, defensa:');
  eq(propuestaDesdeLaJugada(jugada([jugador('j1', 'A', '1', A.base)], [{ id: 'f1', tramos: [] }])).category, null, 'y sin nada, nada:');
});

test('EL CONTENIDO: el juego de pies, el bote con gestos y el rebote que se dice', () => {
  const el = [jugador('j1', 'A', '1', A.base), { id: 'b1', kind: 'balon', portador_id: 'j1', x: A.base.x + 0.04, y: A.base.y }];
  const con = (tramos, defensa) => propuestaDesdeLaJugada(jugada(el, [{ id: 'f1', tramos, ...(defensa ? { defensa } : {}) }])).category;
  eq(con([tr('j1', 'j1', 'finta', A.base, A.base), tr('j1', 'j1', 'pivota', A.base, A.base)]), 'juego-de-pies');
  eq(con([tr('j1', 'j1', 'protege', A.base, A.base)]), 'bote');
});

test('LAS ETIQUETAS: la situación desde el ataque, el rebote de quien lo coge, el bloqueo de serie y lo dicho de la defensa', () => {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), jugador('j3', 'B', '1', A.codo_der),
    { id: 'b1', kind: 'balon', portador_id: 'j1', x: A.base.x + 0.04, y: A.base.y },
  ];
  const tags = (tramos, defensa) => propuestaDesdeLaJugada(jugada(el, [{ id: 'f1', tramos, ...(defensa ? { defensa } : {}) }])).tags;
  ok(tags([tr('j1', 'b1', 'pasa', A.base, A.alero_der, { tipo: 'pass', receptor_id: 'j2' })]).includes('superioridad'),
    'un 2c1 es superioridad, como en la biblioteca');
  const fallo = tr('j1', 'b1', 'tira', A.base, A.aro, { desenlace: 'falla' });
  ok(tags([fallo, tr('j3', 'j3', 'recoge', A.codo_der, A.aro, { balon_id: 'b1' })]).includes('rebote defensivo'), 'lo coge la defensa');
  ok(tags([fallo, tr('j2', 'j2', 'recoge', A.alero_der, A.aro, { balon_id: 'b1' })]).includes('rebote ofensivo'), 'lo coge el ataque');
  ok(tags([tr('j2', 'j2', 'bloquea', A.alero_der, A.base, { tipo: 'bloqueo', companero_id: 'j1' })]).includes('bloqueo directo'), 'un bloqueo sin variante es directo');
  ok(tags([tr('j1', 'b1', 'pasa', A.base, A.alero_der, { tipo: 'pass', receptor_id: 'j2' })], { j3: { accion: 'roba', objetivo_id: 'j2' } }).includes('línea de pase'),
    'lo dicho de la defensa, con la etiqueta del catálogo');
});

test('CON UN TIRO DE FUERA NO SE PROMETE UNA FINALIZACIÓN: el listón de la biblioteca lo exigiría a todos los tiros', () => {
  const el = [jugador('j1', 'A', '1', A.codo_der), jugador('j2', 'A', '2', A.alero_izq),
    { id: 'b1', kind: 'balon', portador_id: 'j1', x: A.codo_der.x + 0.04, y: A.codo_der.y },
    { id: 'b2', kind: 'balon', portador_id: 'j2', x: A.alero_izq.x + 0.04, y: A.alero_izq.y }];
  const cerca = { x: A.aro.x, y: A.aro.y + 0.04 };
  const t = propuestaDesdeLaJugada(jugada(el, [{ id: 'f1', tramos: [
    tr('j1', 'b1', 'tira', A.codo_der, A.aro, { desenlace: 'entra' }),
    tr('j2', 'j2', 'entra', A.alero_izq, cerca, { variante: 'bandeja' }),
    tr('j2', 'b2', 'tira', cerca, A.aro, { desenlace: 'entra' }),
  ] }])).tags;
  ok(!t.includes('entrada') && !t.includes('bandeja') && t.includes('tiro'), t.join(', '));
});

test('UNA SOLA FASE NO SE NUMERA; y sin fases no hay desarrollo', () => {
  const el = [jugador('j1', 'A', '1', A.base)];
  eq(propuestaDesdeLaJugada(jugada(el, [{ id: 'f1', tramos: [tr('j1', 'j1', 'corta', A.base, A.aro)] }])).desarrollo, 'A1 corta al aro.');
  eq(propuestaDesdeLaJugada(jugada(el, [])).desarrollo, '');
  /* Una fase sin dibujar no se reproduce: lo escrito en ella no cuenta. */
  eq(propuestaDesdeLaJugada(jugada(el, [{ id: 'f1', tramos: [tr('j1', 'j1', 'corta', A.base, A.aro)] }, { id: 'f2', tramos: [], texto: 'Aquí paro y explico.' }])).desarrollo,
    'A1 corta al aro.');
  eq(propuestaDesdeLaJugada(null), { category: null, tags: [], material: [], desarrollo: '' });
});

test('LLEVAR AL PASO 3 RELLENA SOLO LO VACÍO, y dice qué ha puesto', () => {
  const d = nuevoDraft();
  const r = llevarAlPaso3(d, entrada());
  eq(r.puestos, ['el contenido', 'las etiquetas', 'el material', 'el desarrollo']);
  eq([d.category, d.requisitos.material], ['juego-de-2', ['balones', 'conos']]);
  ok(d.descripcion_texto.startsWith('1. A1 pasa picado'), d.descripcion_texto);
  const escrito = nuevoDraft();
  escrito.category = 'pase';
  escrito.tags = ['1c1'];
  escrito.descripcion_texto = 'Lo mío.';
  escrito.requisitos.material = ['petos'];
  eq(llevarAlPaso3(escrito, entrada()).puestos, [], 'lo escrito no se toca:');
  eq([escrito.category, escrito.tags, escrito.descripcion_texto, escrito.requisitos.material], ['pase', ['1c1'], 'Lo mío.', ['petos']]);
  eq(d.duracion_min, nuevoDraft().duracion_min, 'y la duración, tampoco (lo decidió el entrenador):');
});

test('AL VOLVER A DIBUJAR, LO TRAÍDO SE PONE AL DÍA; lo tocado a mano, no', () => {
  const d = nuevoDraft();
  const el = [jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der),
    { id: 'b1', kind: 'balon', portador_id: 'j1', x: A.base.x + 0.04, y: A.base.y }];
  const pase = tr('j1', 'b1', 'pasa', A.base, A.alero_der, { tipo: 'pass', receptor_id: 'j2' });
  llevarAlPaso3(d, jugada(el, [{ id: 'f1', tramos: [pase] }]));
  eq([d.category, d.descripcion_texto], ['pase', 'A1 pasa a A2.']);
  ok(esTraidoDeLaPizarra(d, 'category', 'pase'), 'queda apuntado como traído');
  d.tags = ['pase', 'recepción'];   // el entrenador toca las etiquetas
  const cerca = { x: A.aro.x, y: A.aro.y + 0.04 };
  const r = llevarAlPaso3(d, jugada(el, [{ id: 'f1', tramos: [pase] }, { id: 'f2', tramos: [
    tr('j2', 'j2', 'entra', A.alero_der, cerca, { variante: 'bandeja' }), tr('j2', 'b1', 'tira', cerca, A.aro, { desenlace: 'entra' }),
  ] }]));
  eq(d.category, 'entrada', 'el contenido traído se pone al día:');
  ok(d.descripcion_texto.startsWith('1. A1 pasa a A2.\n2. A2 entra'), d.descripcion_texto);
  eq(d.tags, ['pase', 'recepción'], 'lo tocado a mano se queda:');
  ok(r.puestos.includes('el contenido') && !r.puestos.includes('las etiquetas'), r.puestos.join(', '));
});

test('EL CHAT PUEDE PONER LO SUYO ENCIMA DE LO TRAÍDO, y no encima de lo escrito', () => {
  const d = nuevoDraft();
  llevarAlPaso3(d, entrada());
  d.objetivos = 'Lo escribí yo.';
  const res = volcar(d, JSON.stringify({ category: 'pase', descripcion_texto: 'Dos filas; rota el que pasa.', objetivos: 'Del chat.' }));
  eq([d.category, d.descripcion_texto, d.objetivos], ['pase', 'Dos filas; rota el que pasa.', 'Lo escribí yo.']);
  ok(res.puestos.includes('descripcion_texto') && res.ignorados.includes('objetivos'), JSON.stringify(res));
  ok(!esTraidoDeLaPizarra(d, 'category', 'pase'), 'y deja de contar como traído');
});

test('UNA VUELTA COMPLETA: todas las fases con sus pausas', () => {
  eq(duracionDeUnaVuelta({ fases: [{ duracion_ms: 2000, pausa_post_ms: 400 }, { duracion_ms: 3500 }] }), 5900);
  eq([duracionDeUnaVuelta(null), duracionDeUnaVuelta({ fases: [] })], [0, 0]);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
