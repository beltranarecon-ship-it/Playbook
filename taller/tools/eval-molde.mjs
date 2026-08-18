/* ============================================================
   eval-molde.mjs — banco Node del molde de ficha del paso 3
   (taller/js/ia/molde.js) y del puente al chat
   (taller/js/ia/puente.js). Sin red, sin DOM.

     node taller/tools/eval-molde.mjs

   Lo que vigila: que el listón del paso 3 sea EL MISMO que el de la
   biblioteca, y que la respuesta pegada del chat caiga donde va sin
   pisar lo que el entrenador ya había escrito. Un puente que borra
   media ficha propia se usa una vez.
   ============================================================ */

import { fichaDeBorrador, revisarBorrador, requisitosSugeridos } from '../js/ia/molde.js';
import { armarEnvio, extraerJSON, volcar } from '../js/ia/puente.js';
import { revisaFicha } from '../js/ia/lint.js';
import { TAGS, BLOQUE_KEYS, NIVELES_EXIGENCIA, REQUISITOS_OBLIGATORIOS } from '../js/ia/vocabulario.js';
import { nuevoDraft, aRegistro } from '../js/wizard/draft.js';

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

/** Una ficha completa, como la dejaría el paso 3 bien rellenado. */
function borradorCompleto() {
  const d = nuevoDraft();
  Object.assign(d, {
    nombre: 'Bote en cuadrantes',
    tipo: 'Bote',
    category: 'bote',
    tipo_pista: 'media',
    categoria_rama: 'Minibasket',
    dificultad_valor: 3,
    intensidad: 4,
    duracion_min: 8,
    duracion_max: 12,
    description: 'Bote libre por cuatro zonas cambiando de mano al cruzar.',
    objetivos: 'Automatizar el cambio de mano con la cabeza levantada.',
    descripcion_texto: 'Cuatro cuadrantes, un balón cada uno, tres por cuadrante.',
    notas: 'Corregir la altura del bote. No corregir la mano al principio.',
    tags: ['bote', 'cambio de mano'],
  });
  Object.assign(d.requisitos, {
    jugadores_min: 6, jugadores_max: 16, canastas: 0, estaciones: 1, simultaneo: true,
    material: ['balones', 'conos'],
    densidad: 'alta', oposicion: 'nula', presion: 'espacio',
    requisito_previo: 'botar en el sitio sin mirar el balón',
    organizacion: 'Con 12: los doce a la vez, tres por cuadrante.',
    criterio_exito: 'completar 60 segundos sin perder el balón',
    niveles: { base: 'cuadrantes fijos', intermedio: 'cambia cada 5 segundos', avanzado: 'dos perseguidores' },
  });
  return d;
}

console.log('· el listón del paso 3 es el de la biblioteca');

test('una ficha completa pasa el linter sin un solo error', () => {
  // Es el criterio de aceptación del Tramo 2.12, tal cual.
  const r = revisarBorrador(borradorCompleto());
  eq(r.errores, [], 'errores');
  eq(r.avisos, [], 'avisos');
});

test('un borrador recién abierto dice TODO lo que falta', () => {
  /* Al abrir el paso 3 nada está decidido, y el listón lo tiene que
     decir entero: si se callara la mitad, el entrenador guardaría
     creyendo que va bien. */
  const r = revisarBorrador(nuevoDraft());
  ok(r.errores.length >= 10, `debería quedarse muy corto; solo dice ${r.errores.length} cosas`);
  for (const trozo of ['description', 'objetivos', 'descripcion_texto', 'notas', 'tags', 'niveles']) {
    ok(r.errores.some((e) => e.includes(trozo)), `no menciona ${trozo}: ${JSON.stringify(r.errores)}`);
  }
});

test('las reglas son literalmente las mismas', () => {
  // No una copia parecida: la misma función sobre la misma ficha.
  const d = borradorCompleto();
  const directo = revisaFicha(fichaDeBorrador(d));
  eq(revisarBorrador(d).errores, directo.errores);
});

test('la traducción de nombres no pierde ningún campo', () => {
  const f = fichaDeBorrador(borradorCompleto());
  for (const k of ['name', 'type', 'category', 'tipo_pista', 'categoria_rama', 'difficulty',
    'intensidad', 'duration_min', 'duration_max', 'description', 'objetivos',
    'descripcion_texto', 'notas', 'tags', 'requisitos']) {
    ok(f[k] !== undefined && f[k] !== null && f[k] !== '', `falta ${k} tras traducir`);
  }
});

test('«sin animación» no se enseña como problema', () => {
  /* Hay ejercicios que a propósito no llevan animación —juego abierto,
     trabajo en el sitio— y el paso 2 ya dice lo suyo. */
  const r = revisarBorrador(borradorCompleto());
  ok(!r.avisos.some((a) => /sin animación/.test(a)), JSON.stringify(r.avisos));
});

console.log('\n· lo que el molde ya no pide');

test('la dosis se ha retirado de los obligatorios', () => {
  ok(!REQUISITOS_OBLIGATORIOS.includes('dosis'), 'dosis sigue siendo obligatoria');
  const d = borradorCompleto();
  ok(!d.requisitos.dosis, 'el borrador no debería traer dosis');
  eq(revisarBorrador(d).errores, [], 'y sin ella tiene que pasar');
});

test('una ficha que SÍ trae dosis sigue comprobándose', () => {
  // Las 204 la conservan: el dato no estorba, pero si está, cuadra.
  const d = borradorCompleto();
  d.requisitos.dosis = { series: 3, unidad: 'segundos', descanso: 45 };
  ok(revisarBorrador(d).errores.some((e) => /dosis sin `cantidad`/.test(e)));
});

test('el borrador no guarda objetivo de temporada ni variantes', () => {
  const reg = aRegistro(borradorCompleto());
  ok(!('objetivo_temporada_id' in reg), 'el objetivo de temporada no pinta nada al crear un ejercicio');
  ok(!('variantes' in reg), 'su contenido son ahora los tres niveles');
});

test('lo que se guarda lleva la tarjeta y el bloque en su sitio', () => {
  /* Antes `category` llevaba la RAMA ('Minibasket'), que no es un
     bloque de contenido, y `description` llevaba el desarrollo. El
     ejercicio quedaba fuera de los filtros y de su propio linter. */
  const reg = aRegistro(borradorCompleto());
  eq(reg.category, 'bote');
  eq(reg.description, 'Bote libre por cuatro zonas cambiando de mano al cruzar.');
  ok(reg.descripcion_texto !== reg.description, 'la tarjeta y el desarrollo son dos cosas');
});

console.log('\n· lo que se rellena solo');

test('el tablero PROPONE, no decide', () => {
  const r = requisitosSugeridos({ jugadores: 3, balones: 1, conos: 2 }, { jugadores_min: null, jugadores_max: null, material: [] });
  eq(r.jugadores_min, 3, 'el mínimo es lo dibujado');
  eq(r.jugadores_max, 12, 'y el máximo, el grupo de referencia');
  eq(r.material, ['balones', 'conos']);
});

test('lo ya decidido no se pisa', () => {
  const r = requisitosSugeridos({ jugadores: 3, balones: 1 }, { jugadores_min: 8, jugadores_max: 10, material: ['petos'] });
  eq([r.jugadores_min, r.jugadores_max, r.material], [8, 10, ['petos']]);
});

console.log('\n· el puente al chat');

test('el envío lleva las listas cerradas y las reglas', () => {
  const e = armarEnvio(borradorCompleto());
  for (const trozo of ['description', 'category', 'niveles', 'organizacion', 'requisito_previo']) {
    ok(e.includes(trozo), `el envío no nombra ${trozo}`);
  }
  ok(e.includes(BLOQUE_KEYS[0]), 'no lleva los bloques de contenido');
  ok(e.includes(TAGS[0]), 'no lleva el vocabulario de etiquetas');
  ok(/DISTINTAS/.test(e), 'no advierte de los tres niveles distintos');
  ok(/12/.test(e), 'no dice el grupo de referencia');
});

test('el envío NO pide prosa: pide un JSON con la forma exacta', () => {
  // Es lo que permite volcarlo sin releerlo a mano.
  const e = armarEnvio(borradorCompleto());
  ok(/SOLO un bloque JSON/.test(e), 'no exige JSON');
  const molde = extraerJSON(e);
  ok(molde && typeof molde === 'object', 'el propio molde del envío tiene que ser JSON válido');
  for (const n of NIVELES_EXIGENCIA) ok(n in (molde.requisitos?.niveles || {}), `el molde no tiene el nivel ${n}`);
});

test('se saca el JSON de lo que sea que haya pegado', () => {
  const j = { description: 'x' };
  const crudo = JSON.stringify(j);
  eq(extraerJSON(crudo), j, 'pelado');
  eq(extraerJSON('```json\n' + crudo + '\n```'), j, 'en una valla');
  eq(extraerJSON('Claro, aquí tienes:\n\n' + crudo + '\n\nEspero que sirva.'), j, 'con cortesía alrededor');
  eq(extraerJSON('```\n' + crudo + '\n```'), j, 'valla sin lenguaje');
});

test('basura pegada no revienta ni inventa nada', () => {
  for (const v of ['', null, undefined, 'hola', '{roto', 42]) eq(extraerJSON(v), null, JSON.stringify(v));
  const d = nuevoDraft();
  ok(volcar(d, 'esto no es json').error, 'debería decir que no ha encontrado el bloque');
  eq(d.description, '', 'y no tocar nada');
});

test('una respuesta completa deja la ficha lista para entrar', () => {
  const d = nuevoDraft();
  Object.assign(d, { nombre: 'Bote en cuadrantes', tipo: 'Bote', tipo_pista: 'media', categoria_rama: 'Minibasket' });
  const buena = borradorCompleto();
  const respuesta = JSON.stringify({
    description: buena.description, category: buena.category, objetivos: buena.objetivos,
    descripcion_texto: buena.descripcion_texto, notas: buena.notas, tags: buena.tags,
    requisitos: buena.requisitos,
  });
  const res = volcar(d, respuesta);
  ok(!res.error, res.error);
  ok(res.puestos.length >= 20, `debería colocar el molde entero; colocó ${res.puestos.length}`);
  eq(revisarBorrador(d).errores, [], 'y la ficha resultante pasa el linter');
});

test('no pisa lo que el entrenador ya había escrito', () => {
  const d = nuevoDraft();
  d.description = 'Mi frase, la mía';
  d.requisitos.densidad = 'baja';
  const res = volcar(d, JSON.stringify({ description: 'otra cosa', requisitos: { densidad: 'alta' } }));
  eq(d.description, 'Mi frase, la mía');
  eq(d.requisitos.densidad, 'baja');
  ok(res.ignorados.includes('description') && res.ignorados.includes('densidad'), JSON.stringify(res));
});

test('…salvo que se pida pisar', () => {
  const d = nuevoDraft();
  d.description = 'Mi frase';
  volcar(d, JSON.stringify({ description: 'la del chat' }), { pisar: true });
  eq(d.description, 'la del chat');
});

test('los tres niveles se vuelcan enteros', () => {
  const d = nuevoDraft();
  volcar(d, JSON.stringify({ requisitos: { niveles: { base: 'a', intermedio: 'b', avanzado: 'c' } } }));
  eq(d.requisitos.niveles, { base: 'a', intermedio: 'b', avanzado: 'c' });
});

test('un nivel inventado no entra', () => {
  // Solo base/intermedio/avanzado: el linter falla con cualquier otro.
  const d = nuevoDraft();
  volcar(d, JSON.stringify({ requisitos: { niveles: { base: 'a', experto: 'z' } } }));
  ok(!('experto' in d.requisitos.niveles), JSON.stringify(d.requisitos.niveles));
});

test('«sin decidir» es distinto de un valor de fábrica', () => {
  /* Con `densidad: 'media'` de serie, el puente no se atrevía a
     tocarla y el linter la daba por decidida: la ficha acababa
     diciendo cosas que nadie había elegido. */
  const d = nuevoDraft();
  for (const k of ['jugadores_min', 'jugadores_max', 'canastas', 'estaciones', 'simultaneo', 'densidad', 'oposicion', 'presion']) {
    eq(d.requisitos[k], null, `${k} debería nacer sin decidir`);
  }
  const res = volcar(d, JSON.stringify({ requisitos: { densidad: 'alta', simultaneo: true, canastas: 0 } }));
  eq(res.ignorados, [], 'nada que respetar: no había nada escrito');
  eq([d.requisitos.densidad, d.requisitos.simultaneo, d.requisitos.canastas], ['alta', true, 0]);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
