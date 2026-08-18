/* ============================================================
   eval-video.mjs — banco Node del vídeo de referencia de una acción
   (taller/js/ia/video.js). Sin red, sin DOM.

     node taller/tools/eval-video.mjs

   Lo que vigila: que lo que se PEGA en el cuadro acabe siendo el tramo
   que se ve en la pared. Entre las dos cosas hay cinco formas de URL de
   YouTube, tres de escribir un segundo y una decisión —TikTok como
   enlace— que solo se sostiene si nadie la contradice por accidente.

   Y sobre todo: que un vídeo que NO se entiende se rechace. Un enlace
   roto guardado en silencio no falla al guardarlo, falla en el
   pabellón, con doce críos mirando la pared.
   ============================================================ */

import {
  leerVideo, normalizarVideo, validarVideo, urlIncrustado, urlPublica,
  textoTramo, duracionMs, segundosDe, mmss, seIncrusta, TIPOS,
} from '../js/ia/video.js';
import { compilarAnimacion } from '../js/ia/compilador.js';
import { expandirRondas } from '../js/ia/rondas.js';
import { CATALOGO_SISTEMA, conVideos, validarAccion } from '../js/ia/acciones.js';

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

const ID = 'dQw4w9WgXcQ';   // once caracteres, con guion y guion bajo

/* ── 1. Los segundos, como los escribe una persona ──────────── */

console.log('\n· leer un segundo');

test('los tres formatos que se usan de verdad', () => {
  eq(segundosDe('7'), 7, 'un número suelto');
  eq(segundosDe('1:07'), 67, 'minutos:segundos');
  eq(segundosDe('1:02:03'), 3723, 'con horas');
  eq(segundosDe('1m30s'), 90, 'el de YouTube');
  eq(segundosDe('45s'), 45, 'solo segundos');
  eq(segundosDe(12), 12, 'ya es número');
});

test('lo que no es un tiempo no se inventa', () => {
  eq(segundosDe(''), null);
  eq(segundosDe('   '), null);
  eq(segundosDe('luego'), null);
  eq(segundosDe(null), null);
  eq(segundosDe(-3), null, 'un segundo negativo no existe');
});

test('y se vuelve a escribir como se lee', () => {
  eq(mmss(7), '0:07');
  eq(mmss(67), '1:07');
  eq(mmss(3723), '1:02:03');
  eq(mmss(0), '0:00');
});

/* ── 2. Las cinco formas de copiar un enlace de YouTube ─────── */

console.log('\n· pegar un enlace de YouTube');

test('las cinco salen con el mismo id', () => {
  const esperado = { tipo: 'youtube', id: ID, desde: null, hasta: null };
  eq(leerVideo(`https://youtu.be/${ID}`), esperado, 'compartir');
  eq(leerVideo(`https://www.youtube.com/watch?v=${ID}`), esperado, 'barra de direcciones');
  eq(leerVideo(`https://www.youtube.com/shorts/${ID}`), esperado, 'short');
  eq(leerVideo(`https://www.youtube.com/embed/${ID}`), esperado, 'incrustado');
  eq(leerVideo(`https://www.youtube.com/live/${ID}`), esperado, 'directo');
});

test('el «compartir a partir de aquí» trae el segundo puesto', () => {
  eq(leerVideo(`https://youtu.be/${ID}?t=12`), { tipo: 'youtube', id: ID, desde: 12, hasta: null });
  eq(leerVideo(`https://youtu.be/${ID}?t=1m30s`), { tipo: 'youtube', id: ID, desde: 90, hasta: null });
  eq(leerVideo(`https://www.youtube.com/watch?v=${ID}&start=12&end=19`), { tipo: 'youtube', id: ID, desde: 12, hasta: 19 });
});

test('un watch con más parámetros delante sigue dando el id', () => {
  // el enlace que pega YouTube trae `si=` (seguimiento) antes de la v
  eq(leerVideo(`https://www.youtube.com/watch?si=abc123&v=${ID}`), { tipo: 'youtube', id: ID, desde: null, hasta: null });
});

test('lo que no trae un id de once caracteres no es un vídeo', () => {
  eq(leerVideo('https://www.youtube.com/watch?v=corto'), null);
  eq(leerVideo('https://youtube.com'), null);
  eq(leerVideo('mira este vídeo'), null);
  eq(leerVideo(''), null);
  eq(leerVideo(null), null);
});

/* ── 3. TikTok: enlace, y solo enlace ───────────────────────── */

console.log('\n· pegar un TikTok');

test('se guarda la URL limpia', () => {
  eq(leerVideo('https://www.tiktok.com/@entrenador/video/7300000000000000000?is_from_webapp=1'),
    { tipo: 'tiktok', url: 'https://www.tiktok.com/@entrenador/video/7300000000000000000' });
});

test('el enlace corto de la app también vale', () => {
  eq(leerVideo('https://vm.tiktok.com/ZMabcdef/'), { tipo: 'tiktok', url: 'https://vm.tiktok.com/ZMabcdef/' });
});

test('un TikTok NO se incrusta: es la decisión, no un olvido (§12.36)', () => {
  const v = leerVideo('https://www.tiktok.com/@x/video/7300000000000000000');
  eq(urlIncrustado(v), null, 'no hay incrustado');
  ok(!seIncrusta(v), 'y se dice que no');
  ok(urlPublica(v), 'pero sí hay enlace');
  eq(textoTramo(v), null, 'ni tramo');
  eq(duracionMs(v), null, 'ni cuenta atrás');
});

/* ── 4. Sanear: lo que no sirve, fuera ──────────────────────── */

console.log('\n· sanear');

test('un tramo que acaba antes de empezar no es un tramo', () => {
  eq(normalizarVideo({ tipo: 'youtube', id: ID, desde: 19, hasta: 12 }),
    { tipo: 'youtube', id: ID, desde: 19, hasta: null }, 'se tira el final, no el vídeo');
  eq(normalizarVideo({ tipo: 'youtube', id: ID, desde: 12, hasta: 12 }),
    { tipo: 'youtube', id: ID, desde: 12, hasta: null }, 'cero segundos tampoco');
});

test('un id inventado no pasa', () => {
  eq(normalizarVideo({ tipo: 'youtube', id: 'x' }), null);
  eq(normalizarVideo({ tipo: 'youtube' }), null);
  eq(normalizarVideo({ tipo: 'vimeo', id: ID }), null, 'solo las dos formas de §12.36');
  eq(normalizarVideo(null), null);
  eq(normalizarVideo('https://youtu.be/' + ID), null, 'esto es texto, para eso está leerVideo');
});

test('sanear es idempotente', () => {
  const v = leerVideo(`https://youtu.be/${ID}?t=12`);
  eq(normalizarVideo(normalizarVideo(v)), v);
});

test('«sin vídeo» es válido: una acción sin vídeo funciona igual (§11)', () => {
  eq(validarVideo(null), { ok: true, errores: [] });
});

test('y lo que está mal dice por qué', () => {
  ok(!validarVideo({ tipo: 'vimeo' }).ok, 'tipo');
  ok(validarVideo({ tipo: 'vimeo' }).errores[0].includes('vimeo'), 'lo nombra');
  ok(!validarVideo({ tipo: 'youtube', id: 'x' }).ok, 'id');
  ok(!validarVideo({ tipo: 'youtube', id: ID, desde: 19, hasta: 12 }).ok, 'tramo del revés');
  ok(!validarVideo({ tipo: 'tiktok', url: 'https://otra.cosa/x' }).ok, 'tiktok falso');
  ok(TIPOS.length === 2, 'solo dos formas');
});

/* ── 5. Lo que se le pide para enseñarlo ────────────────────── */

console.log('\n· enseñarlo');

test('el incrustado lleva el tramo y arranca solo', () => {
  const u = urlIncrustado({ tipo: 'youtube', id: ID, desde: 12, hasta: 19 });
  ok(u.startsWith(`https://www.youtube-nocookie.com/embed/${ID}?`), `dominio sin cookies: ${u}`);
  ok(u.includes('start=12'), 'entra en el 12');
  ok(u.includes('end=19'), 'sale en el 19');
  ok(u.includes('autoplay=1'), 'no hay que darle al play: la animación ya se paró');
  ok(u.includes('rel=0'), 'sin rejilla de sugeridos en la pared del pabellón');
});

test('sin tramo, el incrustado sigue valiendo', () => {
  const u = urlIncrustado({ tipo: 'youtube', id: ID });
  ok(u && !u.includes('start=') && !u.includes('end='), u);
});

test('el enlace de siempre conserva el segundo de entrada', () => {
  eq(urlPublica({ tipo: 'youtube', id: ID, desde: 12 }), `https://www.youtube.com/watch?v=${ID}&t=12`);
  eq(urlPublica({ tipo: 'youtube', id: ID }), `https://www.youtube.com/watch?v=${ID}`);
});

test('el tramo se lee en castellano', () => {
  eq(textoTramo({ tipo: 'youtube', id: ID, desde: 12, hasta: 19 }), 'del 0:12 al 0:19');
  eq(textoTramo({ tipo: 'youtube', id: ID, desde: 90 }), 'desde 1:30');
  eq(textoTramo({ tipo: 'youtube', id: ID }), null, 'el vídeo entero no es un tramo');
});

/* ── 6. Volver sola a la animación ──────────────────────────── */

console.log('\n· volver sola');

test('con tramo se sabe cuánto esperar', () => {
  // 7 segundos de gesto + el margen de arranque del reproductor
  eq(duracionMs({ tipo: 'youtube', id: ID, desde: 12, hasta: 19 }, { margen_ms: 0 }), 7000);
  ok(duracionMs({ tipo: 'youtube', id: ID, desde: 12, hasta: 19 }) > 7000, 'con margen, algo más');
});

test('el tramo desde el principio cuenta desde cero', () => {
  eq(duracionMs({ tipo: 'youtube', id: ID, hasta: 5 }, { margen_ms: 0 }), 5000);
});

test('SIN final no se adivina: se devuelve null y quien lo enseñe pone un botón', () => {
  eq(duracionMs({ tipo: 'youtube', id: ID, desde: 12 }), null);
  eq(duracionMs({ tipo: 'youtube', id: ID }), null);
});

/* ── 7. De la fase al vídeo ───────────────────────────────── */

/*
   El eslabón que hace posible el 2.14: el proyector tiene que saber QUÉ
   acción ocurre en la fase que va a empezar. Deducirlo del intent no
   vale —las rondas de fila reordenan y funden fases—, así que lo
   escribe el compilador, que es el único que lo sabe sin adivinar.
*/

console.log('\n· cada fase sabe qué acción es');

const TABLERO_FILA = [
  { id: 'cf', kind: 'cono', x: 0.86, y: 0.30, funcion: 'fila',
    fila_config: { n_jugadores: 3, direccion_grados: 180, equipo: 'A', rondas: true, cadencia_s: null, rol: 'atacante' } },
  { id: 'b1', kind: 'balon', x: 0.84, y: 0.30, portador_id: null },
];
const INTENT_FILA = {
  canasta: 'norte',
  fases: [
    { eventos: [{ jugador: 'fila1', accion: 'entra', args: {} }] },
    { eventos: [{ jugador: 'fila1', accion: 'tira', args: {} }] },
    { eventos: [{ jugador: 'fila1', accion: 'vuelve_a_fila', args: {} }] },
  ],
};

test('el compilador anota los slugs de cada fase', () => {
  const anim = compilarAnimacion(INTENT_FILA, TABLERO_FILA, 'media');
  eq(anim.fases.slice(0, 3).map((f) => f.acciones), [['entra'], ['tira'], ['vuelve_a_fila']]);
});

test('y sobreviven a las rondas de fila, que es donde se rompe todo', () => {
  const anim = compilarAnimacion(INTENT_FILA, TABLERO_FILA, 'media');
  ok(anim.rondas === 3, `deberían salir 3 rondas, salieron ${anim.rondas}`);
  // la ronda 2 hace lo mismo que la 1: mismas acciones, otro actor
  const ronda2 = anim.fases.filter((f) => f.ronda === 2).map((f) => f.acciones);
  eq(ronda2, [['entra'], ['tira'], ['vuelve_a_fila']]);
});

test('el dialecto ANTIGUO de las 204 fichas también las anota', () => {
  /* Y las anota con el slug al que TRADUCE, no con el verbo viejo:
     `bote hacia 'aro'` es «entra» desde el Tramo 2.6 —es la corrección
     que arregló las trece fichas que soltaban el balón lejos del aro—.
     Así el vídeo del doble ritmo sale también en las fichas viejas, sin
     tocarlas. */
  const anim = compilarAnimacion({
    canasta: 'norte',
    fases: [{ eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'aro' }, { jugador: 'A1', tipo: 'tiro' }] }],
  }, [{ id: 'j1', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6 }], 'media');
  eq(anim.fases[0].acciones, ['entra', 'tira']);
});

test('y el bote que solo AVANZA sigue siendo «bota»', () => {
  const anim = compilarAnimacion({
    canasta: 'norte',
    fases: [{ eventos: [{ jugador: 'A1', tipo: 'bote', hacia: 'canasta' }] }],
  }, [{ id: 'j1', kind: 'jugador', equipo: 'A', label: '1', x: 0.5, y: 0.6 }], 'media');
  eq(anim.fases[0].acciones, ['bota']);
});

test('no se repite una acción que sale dos veces en la misma fase', () => {
  const anim = compilarAnimacion({
    canasta: 'norte',
    fases: [{ eventos: [{ jugador: 'A1', tipo: 'corte', hacia: 'aro' }, { jugador: 'A2', tipo: 'corte', hacia: 'aro' }] }],
  }, [
    { id: 'j1', kind: 'jugador', equipo: 'A', label: '1', x: 0.4, y: 0.6 },
    { id: 'j2', kind: 'jugador', equipo: 'A', label: '2', x: 0.6, y: 0.6 },
  ], 'media');
  eq(anim.fases[0].acciones, ['corta'], 'una lista de acciones, no de eventos');
});

test('con cadencia, dos rondas en el mismo hueco suman sus acciones', () => {
  // fundir() es lo que une dos fases que caen en el mismo momento
  const base = [
    { id: 'fase_1', duracion_ms: 1000, pausa_post_ms: 0, acciones: ['entra'] },
    { id: 'fase_2', duracion_ms: 1000, pausa_post_ms: 0, acciones: ['tira'] },
  ];
  const r = expandirRondas(base, { actor: 'fila1', siguientes: ['fila1_2'], cadencia_s: 1 });
  const conDos = r.fases.filter((f) => (f.acciones || []).length > 1);
  ok(conDos.length >= 1, `alguna fase debería tener dos acciones: ${JSON.stringify(r.fases.map((f) => f.acciones))}`);
  eq(conDos[0].acciones.slice().sort(), ['entra', 'tira']);
});

test('una fase sin acciones no revienta al fundirse', () => {
  const base = [{ id: 'fase_1', duracion_ms: 1000, pausa_post_ms: 0 }];
  const r = expandirRondas(base, { actor: 'fila1', siguientes: ['fila1_2'], cadencia_s: 1 });
  for (const f of r.fases) ok(Array.isArray(f.acciones) || f.acciones === undefined, 'o una lista, o nada, pero nunca basura');
});

/* ── 8. El vídeo pegado al catálogo ───────────────────────── */

console.log('\n· el vídeo, encima del catálogo');

test('se le puede poner vídeo a una acción DEL SISTEMA', () => {
  // Es el caso que motiva la tabla 021: «entra» vive en código y su slug
  // está reservado, pero es justo a la que se le quiere colgar el vídeo.
  const cat = conVideos(CATALOGO_SISTEMA, { entra: { tipo: 'youtube', id: ID, desde: 12, hasta: 19 } });
  const entra = cat.find((a) => a.slug === 'entra');
  eq(entra.video, { tipo: 'youtube', id: ID, desde: 12, hasta: 19 });
  ok(CATALOGO_SISTEMA.find((a) => a.slug === 'entra').video === null, 'y el catálogo original no se toca');
});

test('lo puesto por slug manda sobre el que trajera la acción', () => {
  const club = [{ ...CATALOGO_SISTEMA[0], slug: 'eurostep', video: { tipo: 'youtube', id: ID, desde: 1 } }];
  const cat = conVideos(club, { eurostep: { tipo: 'youtube', id: ID, desde: 30, hasta: 37 } });
  eq(cat[0].video.desde, 30);
});

test('un vídeo con la forma rota se cae, no se propaga', () => {
  const cat = conVideos(CATALOGO_SISTEMA, { entra: { tipo: 'vimeo', id: 'x' } });
  eq(cat.find((a) => a.slug === 'entra').video, null);
});

test('y el validador de acciones lo caza antes de guardarlo', () => {
  const a = { ...CATALOGO_SISTEMA[0], slug: 'eurostep', video: { tipo: 'youtube', id: 'corto' } };
  const { ok: bien, errores } = validarAccion(a);
  ok(!bien, 'no debería pasar');
  ok(errores.some((e) => e.startsWith('vídeo:')), errores.join('; '));
});

test('sin vídeos, el catálogo sale intacto', () => {
  const cat = conVideos(CATALOGO_SISTEMA, {});
  eq(cat.length, CATALOGO_SISTEMA.length);
  ok(cat.every((a, i) => a === CATALOGO_SISTEMA[i]), 'ni siquiera se copian los objetos');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
