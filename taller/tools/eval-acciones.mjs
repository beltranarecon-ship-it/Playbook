/* ============================================================
   eval-acciones.mjs — banco Node del catálogo de acciones
   (taller/js/ia/acciones.js). Sin red, sin DOM.

     node taller/tools/eval-acciones.mjs

   Lo que vigila: que el vocabulario del motor siga siendo un DATO
   válido. En cuanto cualquier entrenador puede crear acciones, el
   compilador deja de poder fiarse de que los verbos que le llegan los
   escribió alguien que conoce el motor — así que la puerta de entrada
   es este validador, y aquí se comprueba que cierra.
   ============================================================ */

import {
  FAMILIAS, FAMILIA_KEYS, CATALOGO_SISTEMA, EVENTOS_LEGADO, REFERENCIAS,
  validarAccion, normalizarNombre, indexar, resolverAccion, fusionarCatalogo, parametroDe,
} from '../js/ia/acciones.js';
import { TAGS } from '../../tools/biblioteca/vocabulario.mjs';
import { normalizarIntent } from '../js/ia/intencion.js';

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

/** Una acción de club mínima y válida, para partir de ella en los casos. */
const clubBase = (extra = {}) => ({
  slug: 'puerta_atras', nombre: 'Puerta atrás', familia: 'desplazamiento',
  parametros: { destino: 'aro', alcance: 'completo', trayectoria: 'curva' },
  pide: [], ...extra,
});

console.log('· las cinco familias');

test('son cinco y las que dice la especificación', () => {
  eq(FAMILIA_KEYS, ['desplazamiento', 'balon', 'entre_dos', 'gesto', 'simulacion']);
});

test('cada familia declara sus parámetros con tipo', () => {
  for (const [k, f] of Object.entries(FAMILIAS)) {
    ok(f.nombre && f.resuelve, `${k}: falta nombre o descripción`);
    ok(Object.keys(f.parametros).length > 0, `${k}: sin parámetros`);
    for (const [p, def] of Object.entries(f.parametros)) {
      ok(typeof def.tipo === 'string', `${k}.${p}: sin tipo`);
      if (def.tipo === 'opcion') ok(Array.isArray(def.valores) && def.valores.length, `${k}.${p}: opción sin valores`);
      if (def.tipo === 'referencia' || def.tipo === 'lista_referencias') {
        ok(Array.isArray(def.admite) && def.admite.length, `${k}.${p}: referencia sin admite`);
        for (const r of def.admite) ok(REFERENCIAS.includes(r), `${k}.${p}: referencia desconocida "${r}"`);
      }
    }
  }
});

test('ningún parámetro pide coordenadas', () => {
  // La regla que hace que una acción valga en las cuatro pistas y con el
  // tablero movido: los parámetros son relativos, nunca un (x, y).
  for (const [k, f] of Object.entries(FAMILIAS)) {
    for (const [p, def] of Object.entries(f.parametros)) {
      ok(!/^(x|y|coord|punto_xy)$/i.test(p), `${k}.${p} parece una coordenada`);
      ok(def.tipo !== 'coordenada', `${k}.${p} es de tipo coordenada`);
    }
  }
});

console.log('\n· el catálogo del sistema');

test('las nueve acciones del motor anterior están cubiertas', () => {
  // Es el criterio de aceptación del Tramo 2.5.
  const cubiertos = new Set(CATALOGO_SISTEMA.map((a) => a._legado).filter(Boolean));
  const faltan = EVENTOS_LEGADO.filter((e) => !cubiertos.has(e));
  ok(!faltan.length, `sin equivalencia en el catálogo: ${faltan.join(', ')}`);
});

test('no hay equivalencias inventadas', () => {
  const sobran = CATALOGO_SISTEMA
    .map((a) => a._legado).filter(Boolean)
    .filter((e) => !EVENTOS_LEGADO.includes(e));
  ok(!sobran.length, `_legado apunta a eventos que no existían: ${[...new Set(sobran)].join(', ')}`);
});

test('todas las del sistema pasan su propio validador', () => {
  for (const a of CATALOGO_SISTEMA) {
    const r = validarAccion(a);
    ok(r.ok, `${a.slug}: ${r.errores.join('; ')}`);
  }
});

test('los slugs no se repiten', () => {
  const vistos = new Set();
  for (const a of CATALOGO_SISTEMA) {
    ok(!vistos.has(a.slug), `slug repetido: ${a.slug}`);
    vistos.add(a.slug);
  }
});

test('«entra» llega al aro y «bota» solo se acerca', () => {
  // El error de las trece fichas, ahora imposible de escribir: no es la
  // misma palabra con distinto argumento, son dos acciones distintas.
  const entra = CATALOGO_SISTEMA.find((a) => a.slug === 'entra');
  const bota = CATALOGO_SISTEMA.find((a) => a.slug === 'bota');
  eq(parametroDe(entra, 'alcance'), 'pegado', 'entra');
  eq(parametroDe(entra, 'destino'), 'aro', 'entra');
  eq(parametroDe(bota, 'alcance'), 'parcial', 'bota');
  ok(parametroDe(entra, 'separacion') <= 1.2, 'la entrada tiene que morir pegada al aro');
});

test('el rodeo es una trayectoria, no un evento suelto', () => {
  const rodea = CATALOGO_SISTEMA.find((a) => a.slug === 'rodea');
  eq(parametroDe(rodea, 'trayectoria'), 'rodeo');
  ok(rodea.pide.includes('sorteando'), 'tiene que preguntar QUÉ sortea: si no, vuelve a irse en línea recta');
});

console.log('\n· el puente del vocabulario único');

test('cada acción declara su tag, o declara que no tiene', () => {
  // Que falte el campo es distinto de que valga null: null es la
  // decisión de que esa acción es mecánica del motor y no un concepto
  // que evaluar en un jugador. Se exige explícita para que nadie se la
  // salte por olvido.
  for (const a of CATALOGO_SISTEMA) {
    ok('tag' in a, `${a.slug}: falta el campo tag (pon null si es mecánica del motor)`);
    ok(a.tag === null || (typeof a.tag === 'string' && a.tag.length), `${a.slug}: tag inválido`);
  }
});

test('el tag de cada acción existe en el vocabulario de la biblioteca', () => {
  // Es la comprobación de que el vocabulario es DE VERDAD único: la
  // palabra con la que se describe el ejercicio en el paso 2 es la misma
  // con la que se etiqueta, se apunta un objetivo y se evalúa a un
  // jugador. Vale la raíz: «bloqueo» cubre «bloqueo directo» y «bloqueo
  // indirecto», porque cuál de los dos sea es propiedad del ejercicio y
  // no del movimiento.
  const tags = TAGS.map(normalizarNombre);
  for (const a of CATALOGO_SISTEMA) {
    if (a.tag === null) continue;
    const raiz = normalizarNombre(a.tag);
    const hay = tags.some((t) => t === raiz || t.startsWith(`${raiz} `));
    ok(hay, `${a.slug}: el tag "${a.tag}" no está en el vocabulario de la biblioteca`);
  }
});

test('las mecánicas del motor son las que se espera', () => {
  // Si mañana alguien pone tag: null en «tira» para saltarse el aviso de
  // arriba, esta prueba lo dice. La lista es corta a propósito.
  const mecanicas = CATALOGO_SISTEMA.filter((a) => a.tag === null).map((a) => a.slug).sort();
  eq(mecanicas, ['rodea', 'vuelve_a_fila']);
});

console.log('\n· validación de acciones nuevas');

test('una acción de club correcta pasa', () => {
  const r = validarAccion(clubBase());
  ok(r.ok, r.errores.join('; '));
});

test('familia desconocida se rechaza', () => {
  const r = validarAccion(clubBase({ familia: 'magia' }));
  ok(!r.ok && /familia/.test(r.errores[0]), JSON.stringify(r.errores));
});

test('parámetro que no existe en la familia se rechaza', () => {
  const r = validarAccion(clubBase({ parametros: { destino: 'aro', altura: 3 } }));
  ok(!r.ok && r.errores.some((e) => /altura/.test(e)), JSON.stringify(r.errores));
});

test('valor fuera de la lista de opciones se rechaza', () => {
  const r = validarAccion(clubBase({ parametros: { destino: 'aro', trayectoria: 'espiral' } }));
  ok(!r.ok && r.errores.some((e) => /espiral/.test(e)), JSON.stringify(r.errores));
});

test('obligatorio que ni se fija ni se pregunta se rechaza', () => {
  const r = validarAccion({ slug: 'x_test', nombre: 'X', familia: 'desplazamiento', parametros: {}, pide: [] });
  ok(!r.ok && r.errores.some((e) => /destino/.test(e)), JSON.stringify(r.errores));
});

test('obligatorio que se pregunta al usarla vale', () => {
  const r = validarAccion({ slug: 'x_test', nombre: 'X', familia: 'desplazamiento', parametros: {}, pide: ['destino'] });
  ok(r.ok, r.errores.join('; '));
});

test('fracción fuera de (0,1] se rechaza', () => {
  const r = validarAccion(clubBase({ parametros: { destino: 'aro', alcance: 'parcial', avance: 1.4 } }));
  ok(!r.ok && r.errores.some((e) => /avance/.test(e)), JSON.stringify(r.errores));
});

test('un parámetro condicionado sin su condición avisa', () => {
  // `separacion` solo significa algo con alcance 'pegado'. Ponerlo con
  // alcance 'completo' es la firma de una acción copiada a medias.
  const r = validarAccion(clubBase({ parametros: { destino: 'aro', alcance: 'completo', separacion: 1.1 } }));
  ok(!r.ok && r.errores.some((e) => /separacion/.test(e)), JSON.stringify(r.errores));
});

test('slug con mayúsculas, espacios o acentos se rechaza', () => {
  for (const slug of ['Puerta', 'puerta atras', 'puertá', 'a', '']) {
    ok(!validarAccion(clubBase({ slug })).ok, `debería rechazar "${slug}"`);
  }
});

test('basura no revienta el validador', () => {
  for (const v of [null, undefined, 42, 'texto', [], {}]) {
    const r = validarAccion(v);
    ok(r && Array.isArray(r.errores), `con ${JSON.stringify(v)} debería devolver errores, no lanzar`);
  }
});

console.log('\n· fusión con el catálogo del club');

test('una acción de club válida se suma y queda marcada como del club', () => {
  const { acciones, descartadas } = fusionarCatalogo([clubBase()]);
  eq(descartadas.length, 0, JSON.stringify(descartadas));
  eq(acciones.length, CATALOGO_SISTEMA.length + 1);
  eq(acciones[acciones.length - 1].origen, 'club');
});

test('no se puede redefinir un slug del sistema', () => {
  // Redefinir «tira» cambiaría el significado de las 204 fichas de la
  // biblioteca sin tocar ninguna.
  const { acciones, descartadas } = fusionarCatalogo([clubBase({ slug: 'tira' })]);
  eq(acciones.length, CATALOGO_SISTEMA.length);
  eq(descartadas.length, 1);
  ok(/sistema/.test(descartadas[0].motivo), descartadas[0].motivo);
});

test('una acción de club inválida se descarta con su porqué', () => {
  const { descartadas } = fusionarCatalogo([clubBase({ familia: 'magia' })]);
  eq(descartadas.length, 1);
  ok(descartadas[0].motivo.length > 0);
});

test('dos acciones de club con el mismo slug: entra la primera', () => {
  const { acciones, descartadas } = fusionarCatalogo([clubBase(), clubBase({ nombre: 'Otra' })]);
  eq(acciones.length, CATALOGO_SISTEMA.length + 1);
  eq(descartadas.length, 1);
});

test('sin acciones de club, el catálogo es el del sistema', () => {
  eq(fusionarCatalogo().acciones.length, CATALOGO_SISTEMA.length);
});

console.log('\n· resolver lo que se escribe a mano');

const idx = indexar(CATALOGO_SISTEMA);

test('el nombre, el slug y los sinónimos resuelven a la misma acción', () => {
  for (const t of ['Tira', 'tira', 'tiro', 'lanzamiento', 'tira a canasta']) {
    eq(resolverAccion(t, idx)?.slug, 'tira', t);
  }
});

test('tildes, mayúsculas y artículos dan igual', () => {
  eq(resolverAccion('  DA EL BALÓN ', idx)?.slug, 'pasa');
  eq(resolverAccion('el rebote', idx)?.slug, 'recoge');
});

test('una frase larga encuentra la acción que lleva dentro', () => {
  eq(resolverAccion('luego vuelve a la fila corriendo', idx)?.slug, 'vuelve_a_fila');
});

test('lo que no reconoce devuelve null, no una acción cualquiera', () => {
  // Que devuelva null es lo correcto: el paso 2 preguntará, igual que
  // hace con una posición que no conoce.
  for (const t of ['', '   ', 'hace la croqueta', null, undefined]) {
    eq(resolverAccion(t, idx), null, JSON.stringify(t));
  }
});

test('normalizarNombre deja el texto comparable', () => {
  eq(normalizarNombre('  Bloqueó, y  DESPUÉS...  '), 'bloqueo y despues');
});

console.log('\n· parámetros efectivos');

test('lo que no fija la acción sale del valor por defecto de la familia', () => {
  const bota = CATALOGO_SISTEMA.find((a) => a.slug === 'bota');
  eq(parametroDe(bota, 'ritmo'), 'normal');
  eq(parametroDe(bota, 'trayectoria'), 'recta');
});

test('un parámetro que no existe devuelve undefined', () => {
  eq(parametroDe(CATALOGO_SISTEMA[0], 'no_existe'), undefined);
});

console.log('\n· traducción del dialecto antiguo');

/** Atajo: normaliza una sola fase y devuelve sus eventos resueltos. */
const norm = (eventos) => normalizarIntent({ canasta: 'norte', fases: [{ eventos }] });
const uno = (eventos) => norm(eventos).fases[0].eventos[0];

test('«bote hacia canasta» avanza un trozo; «bote hacia aro» llega', () => {
  // Las dos mitades del error de las trece fichas, ahora con nombre propio.
  const avanza = uno([{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }]);
  eq(avanza.accion.slug, 'bota');
  eq(avanza.params.alcance, 'parcial');
  eq(avanza.params.avance, 0.55);

  const llega = uno([{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }]);
  eq(llega.accion.slug, 'entra');
  eq(llega.params.alcance, 'pegado');
});

test('un corte hacia el aro también llega hasta él', () => {
  // Es la continuación al aro tras un bloqueo. Se escapó en la primera
  // versión de la traducción —solo el bote miraba 'aro'— y el que rodaba
  // se quedaba a 2,8 m de la canasta. Lo cazó el banco de animación.
  const roll = uno([{ jugador: 'A2', tipo: 'corte', hacia: 'aro' }]);
  eq(roll.accion.slug, 'corta');
  eq(roll.params.alcance, 'pegado');
  ok(roll.params.separacion <= 1.2, 'tiene que morir pegado al aro');
});

test('un destino concreto se recorre entero', () => {
  const ev = uno([{ jugador: 'A1', tipo: 'bote', hacia: { x: 0.3, y: 0.4 } }]);
  eq(ev.params.destino, { x: 0.3, y: 0.4 });
  eq(ev.params.alcance, 'completo');
});

test('los nueve eventos de siempre se traducen todos', () => {
  const eventos = [
    { jugador: 'A1', tipo: 'bote', hacia: 'canasta' },
    { jugador: 'A2', tipo: 'corte' },
    { jugador: 'A1', tipo: 'pase', a: 'A2' },
    { jugador: 'A2', tipo: 'tiro' },
    { jugador: 'A3', tipo: 'bloqueo', bloqueado_id: 'B1' },
    { jugador: 'B1', tipo: 'defiende', marca: 'A1' },
    { jugador: 'A2', tipo: 'vuelve_a_fila' },
    { jugador: 'A2', tipo: 'recoge' },
  ];
  const r = norm(eventos);
  eq(r.descartados.length, 0, JSON.stringify(r.descartados));
  eq(r.fases[0].eventos.map((e) => e.accion.slug),
    ['bota', 'corta', 'pasa', 'tira', 'bloquea', 'defiende', 'vuelve_a_fila', 'recoge']);
});

test('el rodeo se pliega dentro del desplazamiento y desaparece como evento', () => {
  const r = norm([
    { jugador: 'A1', tipo: 'bote', hacia: 'canasta' },
    { jugador: 'A1', tipo: 'rodea_cono', cono_id: 'cono_1' },
    { jugador: 'A1', tipo: 'rodea_cono', cono_id: 'cono_2' },
  ]);
  eq(r.fases[0].eventos.length, 1, 'el rodeo ya no es un evento suelto');
  const ev = r.fases[0].eventos[0];
  eq(ev.params.trayectoria, 'rodeo');
  eq(ev.params.sorteando, ['cono_1', 'cono_2']);
});

test('un rodeo sin desplazamiento al que pegarse no revienta nada', () => {
  const r = norm([{ jugador: 'A1', tipo: 'rodea_cono', cono_id: 'cono_1' }]);
  eq(r.fases[0].eventos.length, 0);
  eq(r.descartados.length, 0);
});

console.log('\n· el dialecto nuevo, y la puerta cerrada');

test('un evento del paso 2 se resuelve contra el catálogo', () => {
  const ev = uno([{ jugador: 'A1', accion: 'entra' }]);
  eq(ev.accion.slug, 'entra');
  eq(ev.familia, 'desplazamiento');
  eq(ev.params.alcance, 'pegado');
});

test('los args del uso pisan lo que fija la acción', () => {
  // El vocabulario dice qué significa la palabra; la frase concreta puede
  // matizarla: «corta, pero hasta el codo derecho».
  const ev = uno([{ jugador: 'A1', accion: 'corta', args: { destino: 'codo_der', alcance: 'completo' } }]);
  eq(ev.params.destino, 'codo_der');
  eq(ev.params.alcance, 'completo');
});

test('una acción que no está en el catálogo se descarta con su porqué', () => {
  const r = norm([{ jugador: 'A1', accion: 'teletransporte' }]);
  eq(r.fases[0].eventos.length, 0);
  eq(r.descartados.length, 1);
  ok(/catálogo/.test(r.descartados[0].motivo), r.descartados[0].motivo);
});

test('un tipo antiguo desconocido se descarta con su porqué', () => {
  const r = norm([{ jugador: 'A1', tipo: 'mate' }]);
  eq(r.descartados.length, 1);
  ok(/desconocida/.test(r.descartados[0].motivo), r.descartados[0].motivo);
});

test('basura no llega nunca al compilador', () => {
  // Es la invariante del Tramo 0: el compilador jamás recibe algo que no
  // sepa dibujar. Aquí es donde se cierra la puerta.
  const r = norm([null, undefined, 42, {}, { tipo: 'bote' }, { jugador: 'A1' }]);
  eq(r.fases[0].eventos.length, 0);
  ok(r.descartados.length >= 4, `se esperaban descartes; hubo ${r.descartados.length}`);
});

test('un intent vacío o roto devuelve una estructura utilizable', () => {
  for (const v of [null, undefined, {}, { fases: null }, { fases: [{}] }]) {
    const r = normalizarIntent(v);
    ok(Array.isArray(r.fases), `con ${JSON.stringify(v)} debería devolver fases`);
    ok(Array.isArray(r.descartados));
  }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
