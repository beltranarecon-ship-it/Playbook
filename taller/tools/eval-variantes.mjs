/* ============================================================
   eval-variantes.mjs — banco Node de las variantes técnicas y sus
   vídeos (taller/js/pizarra/variantes.js, ESPEC-PIZARRA-v3 §4.3 y §10).
   Sin red, sin DOM.

     node taller/tools/eval-variantes.mjs

   Aquí se prueba que el vídeo cuelga de la variante, que las variantes
   del club se añaden detrás de las de serie sin pisarlas, que lo que se
   escribe en el panel se entiende, y qué vídeo enseña cada fase en la
   columna del proyector.
   ============================================================ */

import {
  ACCIONES_CON_VARIANTES, MAX_SLUG_VARIANTE, claveDeVideo, slugDeVariante, normalizarVarianteDelClub,
  videoDeLoEscrito, validarVarianteNueva, tituloDeVariante, videoDeFase, videosDeAnimacion,
} from '../js/pizarra/variantes.js';
import { readFileSync } from 'node:fs';
import { VARIANTES, ponerVariantesDelClub, variantesDelClub, variantesDe, varianteDe, tieneVariantes } from '../js/pizarra/repertorio.js';
import { clipDeColumna, urlEnBucle, CLIP_COLUMNA_S } from '../js/ia/video.js';
import { frasesDeJugada } from '../js/pizarra/motor/frase.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
  finally { ponerVariantesDelClub([]); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  const r = JSON.stringify(real), e = JSON.stringify(esp);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
};
const YT = (id = 'dQw4w9WgXcQ', desde = null, hasta = null) => ({ tipo: 'youtube', id, desde, hasta });

console.log('· el vídeo cuelga de la variante');

test('LA CLAVE DEL VÍDEO: la acción, o la acción y su variante con dos guiones bajos', () => {
  eq([claveDeVideo('pasa'), claveDeVideo('pasa', 'picado'), claveDeVideo('corta', 'puerta_atras')], ['pasa', 'pasa__picado', 'corta__puerta_atras']);
  eq(claveDeVideo(null), null);
  eq(claveDeVideo('pasa', 'x'.repeat(40)), null, 'lo que no cabe en la tabla (40) no tiene clave:');
  for (const accion of ACCIONES_CON_VARIANTES) {
    for (const v of VARIANTES[accion]) ok(claveDeVideo(accion, v.slug), `${accion} · ${v.slug} tiene clave`);
  }
});

test('QUÉ VÍDEO ENSEÑA UNA FASE: la variante elegida, la de siempre, y si no la acción', () => {
  const videos = { pasa__picado: YT('aaaaaaaaaaa', 3, 9), pasa__recto: YT('eeeeeeeeeee'), bota__normal: YT('bbbbbbbbbbb'), corta: YT('ccccccccccc'), tira__gancho: { tipo: 'tiktok', url: 'https://www.tiktok.com/@x/video/1' } };
  const f = (acciones, variantes = []) => ({ acciones, variantes });
  eq(videoDeFase(f(['pasa', 'bota'], [{ accion: 'pasa', variante: 'picado', nombre: 'Picado' }]), { videos }), { clave: 'pasa__picado', video: YT('aaaaaaaaaaa', 3, 9), titulo: 'Pasa · Picado' });
  eq(videoDeFase(f(['pasa', 'bota'], [{ accion: 'pasa', variante: 'beisbol' }]), { videos }).clave, 'bota__normal', 'sin vídeo de la elegida, la de siempre de otra acción de la fase:');
  eq(videoDeFase(f(['pasa'], [{ accion: 'pasa', variante: 'beisbol' }]), { videos }), null, 'una acción con variante elegida no cae en la de siempre:');
  eq(videoDeFase(f(['corta']), { videos }).clave, 'corta', 'y si no, el de la acción:');
  eq(videoDeFase(f(['tira'], [{ accion: 'tira', variante: 'gancho' }]), { videos }), null, 'un TikTok no va en la columna:');
  const catalogo = [{ slug: 'entra', nombre: 'Entra', video: YT('ddddddddddd') }];
  eq(videoDeFase(f(['entra']), { videos: {}, catalogo }).titulo, 'Entra', 'el vídeo que traía la acción del catálogo, también:');
  eq([videoDeFase(null), videoDeFase(f([]), { videos })], [null, null]);
  /* La elegida manda sobre la de siempre de otro trazo, aunque ese se dibujara antes. */
  eq(videoDeFase(f(['corta', 'pasa'], [{ accion: 'pasa', variante: 'recto', de_siempre: true }, { accion: 'pasa', variante: 'picado' }]), { videos }).clave, 'pasa__picado');
  eq(videoDeFase(f(['pasa'], [{ accion: 'pasa', variante: 'recto', de_siempre: true }]), { videos }).clave, 'pasa__recto', 'y sin ninguna elegida, la de siempre:');
});

test('LOS VÍDEOS DE UN EJERCICIO, sin repetir y de todas sus ramas: los botones de la cabecera del proyector', () => {
  const videos = { pasa__picado: YT('aaaaaaaaaaa'), bota__normal: { tipo: 'tiktok', url: 'https://www.tiktok.com/@x/video/1' }, corta: YT('ccccccccccc') };
  const anim = {
    fases: [{ acciones: ['pasa', 'bota'], variantes: [{ accion: 'pasa', variante: 'picado' }] }, { acciones: ['pasa'], variantes: [{ accion: 'pasa', variante: 'picado' }] }],
    fases_rama: [{ acciones: ['corta'], variantes: [] }],
  };
  eq(videosDeAnimacion(anim, { videos }).map((c) => [c.clave, c.titulo]), [['pasa__picado', 'Pasa · Picado'], ['bota__normal', 'Bota · Normal'], ['corta', 'Corta']]);
  eq(videosDeAnimacion({}, { videos }), []);
});

test('LA MIGRACIÓN 044 RESERVA JUSTO LAS VARIANTES DE SERIE', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/044_variantes.sql', import.meta.url), 'utf8');
  const lista = /de_serie text\[\] := ARRAY\[([\s\S]*?)\];/.exec(sql);
  ok(lista, 'la lista está');
  const enSql = [...lista[1].matchAll(/'([a-z_]+\/[a-z_]+)'/g)].map((m) => m[1]).sort();
  const enCodigo = Object.entries(VARIANTES).flatMap(([a, vs]) => vs.map((v) => `${a}/${v.slug}`)).sort();
  eq(enSql, enCodigo, 'si se añade una de serie, hay que añadirla también a la 044:');
  ok(new RegExp(`slug ~ '\\^\\[a-z\\]\\[a-z0-9_\\]\\{0,${MAX_SLUG_VARIANTE - 1}\\}\\$'`).test(sql), 'y el largo del slug es el mismo');
});

test('EL TÍTULO: «acción · variante», también con una del club que no se conoce', () => {
  eq(tituloDeVariante('pasa', 'picado'), 'Pasa · Picado');
  eq(tituloDeVariante('pasa', 'por_detras', 'Por detrás'), 'Pasa · Por detrás');
  eq(tituloDeVariante('pasa', 'raro'), 'Pasa · raro');
});

test(`LA COLUMNA REPITE EL PRINCIPIO DEL TRAMO: ${CLIP_COLUMNA_S} s como mucho, mudo y en bucle`, () => {
  eq(clipDeColumna(YT('aaaaaaaaaaa', 12, 40)), { id: 'aaaaaaaaaaa', desde: 12, hasta: 12 + CLIP_COLUMNA_S });
  eq(clipDeColumna(YT('aaaaaaaaaaa', 12, 15)), { id: 'aaaaaaaaaaa', desde: 12, hasta: 15 }, 'uno corto, entero:');
  eq(clipDeColumna(YT('aaaaaaaaaaa')), { id: 'aaaaaaaaaaa', desde: 0, hasta: CLIP_COLUMNA_S }, 'sin tramo, desde el principio:');
  eq(clipDeColumna({ tipo: 'tiktok', url: 'https://www.tiktok.com/@x/video/1' }), null);
  const u = urlEnBucle(YT('aaaaaaaaaaa', 12, 40));
  for (const p of ['mute=1', 'loop=1', 'playlist=aaaaaaaaaaa', 'controls=0', 'start=12', `end=${12 + CLIP_COLUMNA_S}`, 'enablejsapi=1']) ok(u.includes(p), `${p} en ${u}`);
});

console.log('· lo que se escribe en el panel');

test('EL ENLACE PEGADO, con desde y hasta escritos aparte, que mandan', () => {
  eq(videoDeLoEscrito({ enlace: 'https://youtu.be/dQw4w9WgXcQ?t=12' }), { video: YT('dQw4w9WgXcQ', 12, null), error: null });
  eq(videoDeLoEscrito({ enlace: 'https://youtu.be/dQw4w9WgXcQ?t=12', desde: '0:05', hasta: '9' }).video, YT('dQw4w9WgXcQ', 5, 9));
  eq(videoDeLoEscrito({ enlace: '' }), { video: null, error: null }, 'nada escrito, nada:');
  ok(/YouTube o de TikTok/.test(videoDeLoEscrito({ enlace: 'https://vimeo.com/1' }).error), 'otra cosa se dice');
  ok(/inicio/.test(videoDeLoEscrito({ enlace: 'https://youtu.be/dQw4w9WgXcQ', desde: 'pronto' }).error));
  ok(/antes/.test(videoDeLoEscrito({ enlace: 'https://youtu.be/dQw4w9WgXcQ', desde: '9', hasta: '3' }).error), 'el final antes del principio se dice');
  eq(videoDeLoEscrito({ enlace: 'https://www.tiktok.com/@club/video/123?x=1', desde: '5' }).video, { tipo: 'tiktok', url: 'https://www.tiktok.com/@club/video/123' }, 'un TikTok no tiene tramo:');
});

test('UNA VARIANTE NUEVA: nombre obligatorio y que no esté, solo en acciones con variantes, y con su slug', () => {
  const r = validarVarianteNueva({ accion: 'pasa', nombre: '  Por   detrás ', descripcion: ' A la espalda. ', enlace: 'https://youtu.be/dQw4w9WgXcQ', hasta: '6' });
  ok(r.ok, r.errores.join('; '));
  eq(r.variante, { accion: 'pasa', slug: 'por_detras', nombre: 'Por detrás', descripcion: 'A la espalda.' });
  eq(r.video, YT('dQw4w9WgXcQ', null, 6));
  eq(validarVarianteNueva({ accion: 'pasa', nombre: '' }).errores, ['la variante necesita un nombre']);
  eq(validarVarianteNueva({ accion: 'pasa', nombre: 'picado' }).errores, ['«Picado» ya está'], 'la misma que una de serie, no:');
  eq(validarVarianteNueva({ accion: 'pasa', nombre: 'Béisbol' }).errores, ['«De béisbol» ya está'], 'ni con otro nombre para el mismo slug:');
  ponerVariantesDelClub([{ accion: 'pasa', slug: 'por_detras', nombre: 'Por detrás' }]);
  eq(validarVarianteNueva({ accion: 'pasa', nombre: 'por-detras' }).errores, ['«Por detrás» ya está'], 'ni la misma con otra tilde u otro signo:');
  ponerVariantesDelClub([]);
  ok(validarVarianteNueva({ accion: 'pasa', nombre: 'Constructor' }).ok, 'un nombre que es también una palabra del lenguaje vale');
  eq(validarVarianteNueva({ accion: 'constructor', nombre: 'X' }).errores, ['esa acción no tiene variantes']);
  eq(validarVarianteNueva({ accion: 'recoge', nombre: 'A dos manos' }).errores, ['esa acción no tiene variantes']);
  eq(validarVarianteNueva({ accion: 'pasa', nombre: 'x'.repeat(41) }).errores, ['el nombre es demasiado largo (40 letras como mucho)']);
  eq(validarVarianteNueva({ accion: 'pasa', nombre: '¡¡!!' }).errores, ['el nombre necesita alguna letra']);
  ok(!validarVarianteNueva({ accion: 'pasa', nombre: 'Rara', enlace: 'hola' }).ok, 'con un enlace que no vale, no');
});

test('EL SLUG sale del nombre, sin tildes ni símbolos, corto y sin chocar', () => {
  eq(slugDeVariante('Paso cero', 'entra'), 'paso_cero');
  eq(slugDeVariante('Tras finta ñ', 'tira'), 'tras_finta_n');
  eq(slugDeVariante('3 y fuera', 'tira'), 'v_3_y_fuera');
  eq(slugDeVariante('Picado', 'pasa'), 'picado_2', 'si ya está, con número:');
  ok(slugDeVariante('Un nombre larguísimo para una variante', 'bloquea').length <= MAX_SLUG_VARIANTE);
  eq(slugDeVariante('   ', 'pasa'), null);
});

console.log('· las variantes del club');

test('SE AÑADEN DETRÁS DE LAS DE SERIE, sin pisarlas, y solo donde hay variantes', () => {
  const n = VARIANTES.pasa.length;
  ponerVariantesDelClub([
    { accion: 'pasa', slug: 'por_detras', nombre: ' Por detrás ', descripcion: 'A la espalda' },
    { accion: 'pasa', slug: 'picado', nombre: 'Otro picado' },          // pisa una de serie
    { accion: 'pasa', slug: 'por_detras', nombre: 'Repetida' },         // repetida
    { accion: 'recoge', slug: 'a_dos_manos', nombre: 'A dos manos' },   // sin variantes
    { accion: 'tira', slug: 'tras_finta', nombre: '' },                 // sin nombre
    null,
  ]);
  eq(variantesDe('pasa').length, n + 1);
  eq(variantesDe('pasa')[n].nombre, 'Por detrás');
  eq(varianteDe('pasa', 'picado').nombre, 'Picado', 'la de serie sigue siendo la suya:');
  eq([tieneVariantes('recoge'), varianteDe('pasa', null), variantesDelClub().length], [false, null, 1]);
  ok(!VARIANTES.pasa.some((v) => v.slug === 'por_detras'), 'las de serie no se tocan');
});

test('LA FILA DE LA TABLA SE SANEA: sin nombre, de una acción sin variantes o pisando una de serie, fuera', () => {
  eq(normalizarVarianteDelClub({ id: 'u1', accion: 'tira', slug: 'tras_finta', nombre: ' Tras finta ', descripcion: null }), { id: 'u1', accion: 'tira', slug: 'tras_finta', nombre: 'Tras finta', descripcion: '' });
  eq([
    normalizarVarianteDelClub({ accion: 'tira', slug: 'gancho', nombre: 'Gancho 2' }),
    normalizarVarianteDelClub({ accion: 'recoge', slug: 'x', nombre: 'X' }),
    normalizarVarianteDelClub({ accion: 'tira', slug: 'Mal Slug', nombre: 'X' }),
    normalizarVarianteDelClub({ accion: 'tira', slug: 'x', nombre: '  ' }),
    normalizarVarianteDelClub(null),
  ], [null, null, null, null, null]);
});

test('UNA PALABRA DEL LENGUAJE NO ES UNA ACCIÓN NI UNA VARIANTE: «constructor» no rompe nada', () => {
  eq(normalizarVarianteDelClub({ accion: 'constructor', slug: 'x', nombre: 'X' }), null);
  ponerVariantesDelClub([{ accion: 'constructor', slug: 'x', nombre: 'X' }, { accion: 'pasa', slug: 'constructor', nombre: 'Constructor' }]);
  eq([variantesDe('constructor'), tieneVariantes('constructor'), variantesDelClub().length], [[], false, 1]);
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
  const j = {
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'jugador_1', kind: 'jugador', equipo: 'A', label: '1', x: 0.3, y: 0.6, en_juego: true },
      { id: 'jugador_2', kind: 'jugador', equipo: 'A', label: '2', x: 0.7, y: 0.6, en_juego: true },
      { id: 'balon_3', kind: 'balon', x: 0.33, y: 0.6, portador_id: 'jugador_1' },
    ],
    fases: [{ id: 'f1', tramos: [{ id: 'tr1', elemento_id: 'jugador_1', corre_id: 'balon_3', receptor_id: 'jugador_2', accion: 'pasa', variante: 'constructor', tipo: 'pass', trazo: [N(0.3, 0.6), N(0.7, 0.6)] }] }],
  };
  ok(/^A1 pasa constructor a A2/.test(frasesDeJugada(j)[0]), frasesDeJugada(j)[0]);
  /* Sin cargar las del club, el tramo dice la suya con el nombre que lleva. */
  ponerVariantesDelClub([]);
  j.fases[0].tramos[0] = { ...j.fases[0].tramos[0], variante: 'por_detras', variante_nombre: 'Por detrás' };
  ok(/^A1 pasa por detrás a A2/.test(frasesDeJugada(j)[0]), `con el nombre que lleva el tramo: ${frasesDeJugada(j)[0]}`);
});

test('LA FRASE DICE UNA VARIANTE DEL CLUB POR SU NOMBRE', () => {
  ponerVariantesDelClub([{ accion: 'pasa', slug: 'por_detras', nombre: 'Por detrás' }]);
  const N = (x, y) => ({ x, y, tipo_nodo: 'lineal' });
  const j = {
    version: 3, pista: 'entera', canasta: 'norte',
    elementos: [
      { id: 'jugador_1', kind: 'jugador', equipo: 'A', label: '1', x: 0.3, y: 0.6, en_juego: true },
      { id: 'jugador_2', kind: 'jugador', equipo: 'A', label: '2', x: 0.7, y: 0.6, en_juego: true },
      { id: 'balon_3', kind: 'balon', x: 0.33, y: 0.6, portador_id: 'jugador_1' },
    ],
    fases: [{ id: 'f1', tramos: [{ id: 'tr1', elemento_id: 'jugador_1', corre_id: 'balon_3', receptor_id: 'jugador_2', accion: 'pasa', variante: 'por_detras', tipo: 'pass', trazo: [N(0.3, 0.6), N(0.7, 0.6)] }] }],
  };
  ok(/^A1 pasa por detrás a A2/.test(frasesDeJugada(j)[0]), frasesDeJugada(j)[0]);
  ponerVariantesDelClub([]);
  ok(/^A1 pasa a A2/.test(frasesDeJugada(j)[0]), `sin cargarla, sin nombrarla: ${frasesDeJugada(j)[0]}`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
