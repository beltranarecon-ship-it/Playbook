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
  ok(urlIncrustado({ tipo: 'youtube', id: ID }, { autoplay: false }).includes('autoplay=0'),
    'y se puede pedir que NO arranque solo: en el planificador se salta de bloque en bloque');
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

/* ── 7. El vídeo pegado al catálogo ───────────────────────── */

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
