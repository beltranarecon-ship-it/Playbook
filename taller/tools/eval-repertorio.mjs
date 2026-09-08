/* ============================================================
   eval-repertorio.mjs — banco Node del repertorio de la Pizarra
   (taller/js/pizarra/repertorio.js). Sin red, sin DOM.

     node taller/tools/eval-repertorio.mjs

   Lo que más vigila es que el VOCABULARIO SIGA SIENDO ÚNICO. Cada
   variante que corresponda a un concepto de baloncesto declara su tag,
   y ese tag tiene que existir ya en el vocabulario de la biblioteca.
   Si alguien inventa aquí una palabra nueva, el ejercicio se
   etiquetaría con algo que ni el planificador ni la rúbrica saben
   leer, y eso no se ve hasta mucho después y en otro sitio.

   Y que las acciones que aún no existen salgan DECLARADAS como
   pendientes, con su motivo: verlas apagadas en el anillo enseña el
   plan; que desaparezcan sin más las convierte en un olvido.
   ============================================================ */

import {
  ESTADOS, ANILLO, VARIANTES, estadoDe, anilloDe, resto,
  trasAccion,
  variantesDe, tieneVariantes, variantePorDefecto, necesita,
} from '../js/pizarra/repertorio.js';
import { CATALOGO_SISTEMA, normalizarNombre } from '../js/ia/acciones.js';
import { TAGS } from '../js/ia/vocabulario.js';

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
const porSlug = new Map(CATALOGO_SISTEMA.map((a) => [a.slug, a]));
const de = (slug) => porSlug.get(slug);

/* ── 1. El estado, que no es del jugador sino del momento ── */

test('el estado sale de lo que puede hacer AHORA, no de quién es', () => {
  eq(estadoDe({ llevaBalon: true }), 'conBalon');
  eq(estadoDe({ llevaBalon: false }), 'sinBalon');
  eq(estadoDe({ esDefensor: true }), 'defensor');
  eq(estadoDe({ llevaBalon: true, esDefensor: true }), 'defensor', 'defender manda sobre llevar balón:');
  eq(estadoDe(), 'sinBalon', 'sin datos, lo más común');
});

/* ── 2. El anillo ────────────────────────────────────────── */

test('hay un anillo por estado y todos traen SEIS casillas', () => {
  eq(Object.keys(ANILLO).sort(), [...ESTADOS].sort());
  for (const e of ESTADOS) {
    eq(anilloDe(e).length, 6, `el anillo de ${e}:`);
  }
});

test('dentro de un anillo no se repite ninguna', () => {
  for (const e of ESTADOS) {
    const slugs = anilloDe(e).map((c) => c.slug);
    eq(new Set(slugs).size, 6, `${e} repite alguna: ${slugs}`);
  }
});

test('cada casilla lista trae su acción del catálogo compartido', () => {
  for (const e of ESTADOS) {
    for (const c of anilloDe(e)) {
      if (c.pendiente) continue;
      ok(c.accion, `${e}/${c.slug}: sin acción`);
      eq(c.accion.slug, c.slug);
      ok(porSlug.has(c.slug), `${c.slug} no está en CATALOGO_SISTEMA`);
      ok(c.nombre && c.icono, `${c.slug}: le falta nombre o icono`);
    }
  }
});

test('lo que aún no existe sale DECLARADO como pendiente y con su motivo', () => {
  const pend = anilloDe('defensor').filter((c) => c.pendiente);
  ok(pend.length > 0, 'la defensa todavía no está: alguna tiene que salir pendiente');
  for (const c of pend) {
    ok(c.motivo && c.motivo.length > 10, `${c.slug}: un pendiente sin motivo es un olvido`);
    eq(c.accion, null);
  }
  // y la que SÍ existe no puede estar marcada
  const def = anilloDe('defensor').find((c) => c.slug === 'defiende');
  eq(def.pendiente, false, '«defiende» existe en el catálogo desde siempre');
});

test('el anillo del que lleva balón ofrece lo que se hace con balón', () => {
  const slugs = anilloDe('conBalon').map((c) => c.slug);
  for (const s of ['bota', 'pasa', 'tira']) ok(slugs.includes(s), `falta ${s}`);
  ok(!slugs.includes('recoge'), 'recoger un balón teniéndolo no tiene sentido');
});

test('el anillo del que NO lleva balón no ofrece pasar ni tirar', () => {
  const slugs = anilloDe('sinBalon').map((c) => c.slug);
  for (const s of ['pasa', 'tira', 'bota']) ok(!slugs.includes(s), `${s} necesita balón`);
  ok(slugs.includes('corta'), 'lo primero que hace alguien sin balón es moverse');
});

test('«⋯ más» ofrece lo que no cabe, y nada de lo que ya está', () => {
  for (const e of ESTADOS) {
    const dentro = new Set(anilloDe(e).map((c) => c.slug));
    for (const a of resto(e)) ok(!dentro.has(a.slug), `${a.slug} sale dos veces en ${e}`);
  }
  ok(resto('conBalon').length > 0, 'algo tiene que quedar fuera de seis casillas');
});

/* ── 3. Las variantes ────────────────────────────────────── */

test('las variantes cuelgan de acciones que existen', () => {
  for (const slug of Object.keys(VARIANTES)) {
    ok(porSlug.has(slug), `hay variantes de "${slug}", que no está en el catálogo`);
  }
});

test('dentro de una acción no se repite el slug de una variante', () => {
  for (const [accion, vs] of Object.entries(VARIANTES)) {
    const slugs = vs.map((v) => v.slug);
    eq(new Set(slugs).size, slugs.length, `${accion} repite variante: ${slugs}`);
  }
});

test('EL VOCABULARIO ES ÚNICO: todo tag de variante existe en la biblioteca', () => {
  const tags = TAGS.map(normalizarNombre);
  for (const [accion, vs] of Object.entries(VARIANTES)) {
    for (const v of vs) {
      if (v.tag === null) continue;
      const raiz = normalizarNombre(v.tag);
      const hay = tags.some((t) => t === raiz || t.startsWith(`${raiz} `));
      ok(hay, `${accion}/${v.slug}: el tag "${v.tag}" no está en el vocabulario de la biblioteca`);
    }
  }
});

test('cada variante declara su tag, aunque sea null', () => {
  for (const [accion, vs] of Object.entries(VARIANTES)) {
    for (const v of vs) {
      ok('tag' in v, `${accion}/${v.slug}: falta el campo tag (pon null si es solo una forma de ejecutar)`);
      ok(v.tag === null || (typeof v.tag === 'string' && v.tag.length), `${accion}/${v.slug}: tag inválido`);
      ok('video' in v, `${accion}/${v.slug}: falta el hueco del vídeo`);
    }
  }
});

test('la primera variante es la de siempre y NO lleva tag', () => {
  // «un pase recto» no es un concepto que evaluar: es un pase
  for (const [accion, vs] of Object.entries(VARIANTES)) {
    if (accion === 'tira' || accion === 'entra' || accion === 'corta' || accion === 'bloquea') continue;
    eq(vs[0].tag, null, `${accion}: la variante por defecto no debería etiquetar nada`);
  }
});

test('las acciones sin variantes lo dicen, en vez de devolver undefined', () => {
  eq(variantesDe('para'), []);
  eq(tieneVariantes('para'), false);
  eq(tieneVariantes('pasa'), true);
  eq(variantePorDefecto('para'), null);
  eq(variantePorDefecto('pasa').slug, 'recto');
});

test('las que más se usan tienen variantes; las mecánicas del motor no', () => {
  for (const s of ['pasa', 'bota', 'tira', 'corta']) ok(tieneVariantes(s), `${s} debería tener variantes`);
  ok(!tieneVariantes('vuelve_a_fila'), 'volver a la fila no tiene «cómo»');
});

/* ── 4. Qué hay que preguntar después de elegir ──────────── */

test('un pase pide destino y un tiro pide desenlace', () => {
  eq(necesita(porSlug.get('pasa')).destino, true);
  eq(necesita(porSlug.get('tira')).desenlace, true);
  eq(necesita(porSlug.get('tira')).destino, false, 'un tiro va al aro: no hay que decírselo');
});

test('las acciones entre dos piden compañero', () => {
  eq(necesita(porSlug.get('bloquea')).companero, true);
  eq(necesita(porSlug.get('defiende')).companero, true);
});

test('un gesto en el sitio no pide nada', () => {
  const n = necesita(porSlug.get('finta'));
  eq([n.destino, n.companero, n.desenlace], [false, false, false]);
});

test('«entra» y «vuelve a la fila» ya saben a dónde van', () => {
  eq(necesita(porSlug.get('entra')).destino, false, 'entra va al aro');
  eq(necesita(porSlug.get('vuelve_a_fila')).destino, false, 'vuelve a su cola');
  eq(necesita(porSlug.get('corta')).destino, true, 'cortar sí necesita a dónde');
});

test('una acción que no existe no rompe nada', () => {
  eq(necesita(null), { destino: false, companero: false, desenlace: false });
});

/* ── Qué queda en la mano después (el encadenado del §4.5) ─ */

test('tras pasar o tirar, la ficha se queda SIN balón', () => {
  const con = { llevaBalon: true };
  eq(trasAccion(con, de('pasa')).llevaBalon, false);
  eq(trasAccion(con, de('tira')).llevaBalon, false);
  eq(estadoDe(trasAccion(con, de('pasa'))), 'sinBalon',
    'el anillo de la punta de la flecha ya no puede ofrecer tirar');
});

test('tras recoger, la ficha se queda CON balón', () => {
  eq(trasAccion({ llevaBalon: false }, de('recoge')).llevaBalon, true);
  eq(estadoDe(trasAccion({ llevaBalon: false }, de('recoge'))), 'conBalon');
});

test('botar, cortar o fintar no cambian quién lleva el balón', () => {
  for (const s of ['bota', 'corta', 'finta', 'bloquea', 'para', 'entra']) {
    eq(trasAccion({ llevaBalon: true }, de(s)).llevaBalon, true, `${s} con balón:`);
    eq(trasAccion({ llevaBalon: false }, de(s)).llevaBalon, false, `${s} sin balón:`);
  }
});

test('SALE DEL CATÁLOGO, no de una lista escrita otra vez', () => {
  /* Lo decide `parametros.modo`, que es lo mismo que obedece el motor.
     Con una lista de slugs aquí, una acción nueva del club que pasara
     el balón dejaría al encadenado ofreciendo tirar sin balón. */
  for (const a of CATALOGO_SISTEMA) {
    const modo = a.parametros && a.parametros.modo;
    const despues = trasAccion({ llevaBalon: true }, a).llevaBalon;
    if (modo === 'pase' || modo === 'tiro') ok(!despues, `${a.slug} suelta el balón`);
    else ok(despues, `${a.slug} no debería quitarlo`);
  }
  eq(trasAccion({ llevaBalon: false }, { parametros: { modo: 'recoge' } }).llevaBalon, true,
    'una acción inventada con modo recoge también lo coge');
});

test('defender no se pierde por el camino', () => {
  eq(trasAccion({ esDefensor: true, llevaBalon: false }, de('corta')).esDefensor, true);
  eq(estadoDe(trasAccion({ esDefensor: true }, de('recoge'))), 'defensor',
    'quien defiende sigue defendiendo aunque coja un balón');
});

test('sin estado y sin acción no rompe: se queda como estaba', () => {
  eq(trasAccion(null, null), { llevaBalon: false, esDefensor: false });
  eq(trasAccion({ llevaBalon: true }, null), { llevaBalon: true, esDefensor: false });
  eq(trasAccion(undefined, de('pasa')), { llevaBalon: false, esDefensor: false });
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
