/* ============================================================
   eval-memoria.mjs — banco Node de la memoria del encuadre de la
   Pizarra (taller/js/pizarra/memoria.js). Sin red, sin DOM.

     node taller/tools/eval-memoria.mjs

   Lo que más vigila no es que se recuerde el zoom: eso, si falla, se
   arregla acercando otra vez. Vigila que recordarlo NO pueda llenar el
   `localStorage`, porque ese cajón lo comparte con los BORRADORES —el
   ejercicio a medio escribir— y quedarse sin sitio ahí significa
   perder media ficha por haber guardado un encuadre.

   Por eso hay tope de entradas, poda por antigüedad, y todo lo que
   entra se sanea: lo guardado puede ser de una versión anterior, puede
   haberlo tocado alguien a mano, y puede estar a medio escribir si se
   cerró la pestaña en mitad de un guardado.
   ============================================================ */

import {
  CLAVE, MAX_RECUERDOS, claveDe, sanear, podar, recordar, recuperar,
} from '../js/pizarra/memoria.js';

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

const ENC = { escala: 2.5, ox: -120, oy: 40 };

/* ── 1. La clave ─────────────────────────────────────────── */

test('la clave lleva el ejercicio y la PISTA', () => {
  eq(claveDe('abc123', 'media'), 'abc123::media');
  eq(claveDe('abc123', 'entera'), 'abc123::entera');
  ok(claveDe('abc', 'media') !== claveDe('abc', 'entera'),
    'la misma pista para dos canchas distintas abriría el ejercicio torcido');
});

test('un ejercicio sin guardar todavía tiene su propia clave', () => {
  eq(claveDe(null, 'media'), 'nuevo::media');
  eq(claveDe(undefined, undefined), 'nuevo::entera');
});

/* ── 2. Recordar y recuperar ─────────────────────────────── */

test('lo apuntado se recupera en la forma que espera la vista', () => {
  const m = recordar({}, 'a::media', ENC, 1000);
  eq(recuperar(m, 'a::media'), { escala: 2.5, ox: -120, oy: 40 });
});

test('un ejercicio del que no hay nada devuelve null, no un encuadre raro', () => {
  eq(recuperar({}, 'nadie::media'), null);
  eq(recuperar(null, 'nadie::media'), null);
});

test('volver a apuntar el mismo ejercicio lo pisa, no lo duplica', () => {
  let m = recordar({}, 'a::media', ENC, 1000);
  m = recordar(m, 'a::media', { escala: 1, ox: 0, oy: 0 }, 2000);
  eq(Object.keys(m).length, 1);
  eq(recuperar(m, 'a::media').escala, 1);
});

test('no se apunta un encuadre con números que no lo son', () => {
  const m = recordar({}, 'a::media', { escala: NaN, ox: 0, oy: 0 }, 1000);
  eq(m, {});
  eq(recordar({}, 'a::media', { escala: 1, ox: undefined, oy: 0 }, 1000), {});
  eq(recordar({}, '', ENC, 1000), {});
  eq(recordar({}, 'a::media', null, 1000), {});
});

/* ── 3. El tope, que es de lo que va este banco ──────────── */

test('nunca se guardan más recuerdos que el tope', () => {
  let m = {};
  for (let i = 0; i < MAX_RECUERDOS + 25; i++) m = recordar(m, `e${i}::media`, ENC, i);
  eq(Object.keys(m).length, MAX_RECUERDOS);
});

test('lo que se poda es lo más viejo, no lo último que se usó', () => {
  let m = {};
  for (let i = 0; i < MAX_RECUERDOS; i++) m = recordar(m, `e${i}::media`, ENC, i);
  // e0 es el más viejo; al meter uno nuevo tiene que caer él
  m = recordar(m, 'nuevo::media', ENC, 9999);
  eq(recuperar(m, 'e0::media'), null, 'el más viejo debería haber caído');
  ok(recuperar(m, 'nuevo::media'), 'el recién apuntado tiene que estar');
  ok(recuperar(m, `e${MAX_RECUERDOS - 1}::media`), 'el más reciente de antes también');
});

test('reabrir un ejercicio viejo lo rescata de la cola de la poda', () => {
  let m = {};
  for (let i = 0; i < MAX_RECUERDOS; i++) m = recordar(m, `e${i}::media`, ENC, i);
  m = recordar(m, 'e0::media', ENC, 5000);          // se vuelve a usar el más viejo
  for (let i = 0; i < 5; i++) m = recordar(m, `x${i}::media`, ENC, 6000 + i);
  ok(recuperar(m, 'e0::media'), 'al usarlo se rejuvenece y no debería caer');
});

test('podar no toca un mapa que ya cabe', () => {
  const m = { 'a::media': { e: 1, ox: 0, oy: 0, t: 1 } };
  eq(podar(m, 30), m);
});

test('el recuerdo es minúsculo: tres números y una fecha', () => {
  let m = {};
  for (let i = 0; i < MAX_RECUERDOS; i++) m = recordar(m, `ejercicio-${i}::media_fiba`, ENC, i);
  const bytes = JSON.stringify({ entradas: m }).length;
  ok(bytes < 3000, `treinta recuerdos ocupan ${bytes} bytes; deberían ser un par de kB`);
});

/* ── 4. Lo guardado puede venir roto ─────────────────────── */

test('lo que no es un objeto no rompe nada', () => {
  eq(sanear(null), {});
  eq(sanear(undefined), {});
  eq(sanear('a medio escribir'), {});
  eq(sanear(42), {});
  eq(sanear([]), {});
});

test('se descartan las entradas rotas y se conservan las buenas', () => {
  const crudo = {
    'buena::media': { e: 2, ox: 10, oy: -5, t: 100 },
    'sinE::media': { ox: 10, oy: 0, t: 1 },
    'texto::media': 'esto no es una entrada',
    'nula::media': null,
    'conNaN::media': { e: NaN, ox: 0, oy: 0, t: 1 },
    'otraBuena::entera': { e: 1, ox: 0, oy: 0 },
  };
  const m = sanear(crudo);
  eq(Object.keys(m).sort(), ['buena::media', 'otraBuena::entera']);
  eq(m['otraBuena::entera'].t, 0, 'sin fecha se le pone la más vieja posible:');
});

test('una entrada rota no se lleva por delante a las demás', () => {
  const m = sanear({ 'rota::media': { e: 'mucho' }, 'sana::media': { e: 3, ox: 1, oy: 2, t: 7 } });
  eq(recuperar(m, 'sana::media'), { escala: 3, ox: 1, oy: 2 });
});

/* ── 5. La clave del cajón ───────────────────────────────── */

test('la clave lleva el prefijo del resto de la app y es UNA sola', () => {
  ok(CLAVE.startsWith('cbp_'), `la clave debería empezar por cbp_: ${CLAVE}`);
  ok(!CLAVE.includes(':'), 'una sola entrada, no una por ejercicio: la clave no lleva id');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
