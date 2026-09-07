/* ============================================================
   eval-encuadre.mjs — banco Node de la matriz de encuadre de la
   Pizarra (taller/js/canvas/encuadre.js). Sin red, sin DOM.

     node taller/tools/eval-encuadre.mjs

   Lo que más vigila, y el motivo de que este banco exista antes que
   ninguna línea de interfaz: que el modo NEUTRO dé exactamente lo
   mismo que court.js hace hoy. Si esa aserción se pone en rojo, el
   motor, el proyector, la miniatura y la ficha empiezan a dibujar en
   otro sitio, y el fallo se vería en la pared del pabellón antes que
   aquí.

   La segunda que más vigila: que las distancias en METROS —el imán de
   0,60 m, el suavizado del trazo de 0,25 m— salgan invariantes al
   zoom. Es la propiedad de la que cuelga que dibujar al 400 % y al
   100 % produzca el mismo ejercicio.
   ============================================================ */

import {
  ZOOM_MIN, ZOOM_MAX, MARGEN,
  neutro, ajustar, anchoPista, altoPista, proyectar, despoyectar,
  zoomA, desplazar, limitar, ventana, seVe, hairline,
  guardable, desdeGuardado,
} from '../js/canvas/encuadre.js';
import { marcoDe, pxPorMetro } from '../js/canvas/medidas.js';

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
const aprox = (real, esp, tol = 1e-9, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};

/* La fórmula EXACTA de court.js, copiada a mano aquí a propósito: es
   el testigo contra el que se compara. Si algún día cambia allí, este
   banco tiene que ponerse en rojo y obligar a mirarlo. */
const toPxCourt = (w, h, rot, x, y) => (rot === 90 ? [(1 - y) * w, x * h] : [x * w, y * h]);
const toNormCourt = (w, h, rot, px, py) => (rot === 90 ? [py / h, 1 - px / w] : [px / w, py / h]);

const PUNTOS = [
  [0, 0], [1, 1], [0.5, 0.5], [0.1511, 0.5], [0.0, 0.8993], [0.73, 0.21], [1, 0], [0, 1],
];

/* ── 1. Lo que no se puede romper ────────────────────────── */

test('neutro reproduce toPx de court.js al píxel, sin girar', () => {
  const enc = neutro(640, 480, 0);
  for (const [x, y] of PUNTOS) {
    eq(proyectar(enc, x, y), toPxCourt(640, 480, 0, x, y), `punto ${x},${y}:`);
  }
});

test('neutro reproduce toPx de court.js al píxel, girado 90°', () => {
  const enc = neutro(900, 500, 90);
  for (const [x, y] of PUNTOS) {
    eq(proyectar(enc, x, y), toPxCourt(900, 500, 90, x, y), `punto ${x},${y}:`);
  }
});

test('neutro reproduce toNorm de court.js (sin su recorte), en los dos giros', () => {
  for (const rot of [0, 90]) {
    const enc = neutro(640, 480, rot);
    for (const [px, py] of [[0, 0], [640, 480], [320, 240], [17, 401]]) {
      const real = despoyectar(enc, px, py);
      const esp = toNormCourt(640, 480, rot, px, py);
      aprox(real[0], esp[0], 1e-12, `rot ${rot} x en ${px},${py}:`);
      aprox(real[1], esp[1], 1e-12, `rot ${rot} y en ${px},${py}:`);
    }
  }
});

test('despoyectar NO recorta: fuera de la pista devuelve fuera de [0,1]', () => {
  const enc = neutro(600, 400, 0);
  const [x, y] = despoyectar(enc, -30, 480);
  ok(x < 0, `esperaba x<0, salió ${x}`);
  ok(y > 1, `esperaba y>1, salió ${y}`);
});

/* ── 2. Ida y vuelta ─────────────────────────────────────── */

test('proyectar y despoyectar son inversas con zoom y desplazamiento', () => {
  for (const rot of [0, 90]) {
    let enc = ajustar({ vw: 820, vh: 610, aspect: marcoDe('media').aspect, rot });
    enc = zoomA(enc, 2.75, 410, 305);
    enc = desplazar(enc, -137, 44);
    for (const [x, y] of PUNTOS) {
      const [px, py] = proyectar(enc, x, y);
      const [x2, y2] = despoyectar(enc, px, py);
      aprox(x2, x, 1e-9, `rot ${rot} x:`);
      aprox(y2, y, 1e-9, `rot ${rot} y:`);
    }
  }
});

/* ── 3. Encajar ──────────────────────────────────────────── */

test('ajustar encaja la pista entera dentro de la ventana, con su aire', () => {
  const aspect = marcoDe('entera').aspect;      // retrato: 18/27 = 0,667
  const enc = ajustar({ vw: 900, vh: 600, aspect });
  ok(anchoPista(enc) <= 900 - 2 * MARGEN + 1e-9, `se sale de ancho: ${anchoPista(enc)}`);
  ok(altoPista(enc) <= 600 - 2 * MARGEN + 1e-9, `se sale de alto: ${altoPista(enc)}`);
  aprox(anchoPista(enc) / altoPista(enc), aspect, 1e-9, 'relación de aspecto:');
  // y toca uno de los dos lados: encajar es encajar, no dejar aire de sobra
  const tocaAlto = Math.abs(altoPista(enc) - (600 - 2 * MARGEN)) < 1e-6;
  const tocaAncho = Math.abs(anchoPista(enc) - (900 - 2 * MARGEN)) < 1e-6;
  ok(tocaAlto || tocaAncho, 'no toca ningún borde: sobra aire');
});

test('ajustar centra la pista en la ventana', () => {
  const enc = ajustar({ vw: 900, vh: 600, aspect: marcoDe('media').aspect });
  aprox(enc.ox, (900 - anchoPista(enc)) / 2, 1e-9, 'ox:');
  aprox(enc.oy, (600 - altoPista(enc)) / 2, 1e-9, 'oy:');
});

test('ajustar con giro de 90° invierte la relación de aspecto', () => {
  const aspect = marcoDe('entera').aspect;
  const depie = ajustar({ vw: 700, vh: 700, aspect, rot: 0 });
  const tumbada = ajustar({ vw: 700, vh: 700, aspect, rot: 90 });
  aprox(anchoPista(depie) / altoPista(depie), aspect, 1e-9, 'de pie:');
  aprox(anchoPista(tumbada) / altoPista(tumbada), 1 / aspect, 1e-9, 'tumbada:');
});

test('en una ventana más estrecha que el margen la pista no se da la vuelta', () => {
  const enc = ajustar({ vw: 30, vh: 20, aspect: marcoDe('media').aspect });
  ok(anchoPista(enc) > 0 && altoPista(enc) > 0, 'pista de tamaño no positivo');
  ok(Number.isFinite(enc.ox) && Number.isFinite(enc.oy), 'desplazamiento no finito');
});

/* ── 4. Zoom ─────────────────────────────────────────────── */

test('el zoom deja quieto el punto de pantalla al que se ancla', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  const ancla = [512, 233];
  const antes = despoyectar(base, ancla[0], ancla[1]);
  for (const z of [0.5, 1.4, 2, 4]) {
    const enc = zoomA(base, z, ancla[0], ancla[1]);
    const [px, py] = proyectar(enc, antes[0], antes[1]);
    aprox(px, ancla[0], 1e-9, `zoom ${z} x:`);
    aprox(py, ancla[1], 1e-9, `zoom ${z} y:`);
  }
});

test('el zoom encadenado también deja quieta el ancla', () => {
  let enc = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  const ancla = [300, 300];
  const antes = despoyectar(enc, ancla[0], ancla[1]);
  for (const f of [1.2, 1.2, 1.2, 0.8]) enc = zoomA(enc, enc.escala * f, ancla[0], ancla[1]);
  const [px, py] = proyectar(enc, antes[0], antes[1]);
  aprox(px, ancla[0], 1e-8, 'x:');
  aprox(py, ancla[1], 1e-8, 'y:');
});

test('el zoom se queda entre el 50 % y el 400 %', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  eq(zoomA(base, 99, 400, 300).escala, ZOOM_MAX);
  eq(zoomA(base, 0.01, 400, 300).escala, ZOOM_MIN);
  eq(zoomA(base, NaN, 400, 300).escala, base.escala);
});

/* ── 5. Recorte del desplazamiento ───────────────────────── */

test('si la pista cabe en un eje, ese eje se queda centrado', () => {
  const base = ajustar({ vw: 900, vh: 600, aspect: marcoDe('media').aspect });
  const movida = desplazar(base, 400, -400);
  const enc = limitar(movida, 900, 600);
  aprox(enc.ox, (900 - anchoPista(enc)) / 2, 1e-9, 'ox:');
  aprox(enc.oy, (600 - altoPista(enc)) / 2, 1e-9, 'oy:');
});

test('si la pista no cabe, se puede mover pero no perderse de vista', () => {
  let enc = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  enc = zoomA(enc, 3, 400, 300);
  const W = anchoPista(enc), H = altoPista(enc);
  ok(W > 800 && H > 600, 'la prueba necesita una pista mayor que la ventana');
  const lejos = limitar(desplazar(enc, 5000, 5000), 800, 600);
  aprox(lejos.ox, MARGEN, 1e-9, 'tope por la izquierda:');
  aprox(lejos.oy, MARGEN, 1e-9, 'tope por arriba:');
  const lejos2 = limitar(desplazar(enc, -5000, -5000), 800, 600);
  aprox(lejos2.ox, 800 - W - MARGEN, 1e-9, 'tope por la derecha:');
  aprox(lejos2.oy, 600 - H - MARGEN, 1e-9, 'tope por abajo:');
});

test('cada eje se recorta por su cuenta', () => {
  // pista muy apaisada: sobra por ancho y cabe de alto
  let enc = ajustar({ vw: 800, vh: 600, aspect: 3 });
  enc = zoomA(enc, 4, 400, 300);
  const W = anchoPista(enc), H = altoPista(enc);
  const r = limitar(desplazar(enc, 9999, 9999), 800, 600);
  if (W > 800) aprox(r.ox, MARGEN, 1e-9, 'ox recortado:');
  if (H <= 600) aprox(r.oy, (600 - H) / 2, 1e-9, 'oy centrado:');
});

/* ── 6. Qué se ve ────────────────────────────────────────── */

test('al 100 % se ve la pista entera; al 200 % se ve la cuarta parte', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: 1, margen: 0 });
  const v1 = ventana(base, 800, 600);
  ok(v1.x0 <= 0 + 1e-9 && v1.x1 >= 1 - 1e-9, `no cubre la pista: ${JSON.stringify(v1)}`);
  const enc = limitar(zoomA(base, 2, 400, 300), 800, 600, 0);
  const v2 = ventana(enc, 800, 600);
  /* Se compara la PROPORCIÓN y no el área absoluta: la ventana no
     tiene por qué tener la forma de la pista, así que al 100 % se ve
     la pista Y un trozo de banda. Lo que sí es invariante es que al
     doble de zoom se ve la cuarta parte de superficie. */
  const areaDe = (v) => (v.x1 - v.x0) * (v.y1 - v.y0);
  aprox(areaDe(v2) / areaDe(v1), 0.25, 1e-9, 'superficie visible al 200 %:');
});

test('la ventana visible también es correcta girada 90°', () => {
  const enc = ajustar({ vw: 900, vh: 500, aspect: marcoDe('media').aspect, rot: 90, margen: 0 });
  const v = ventana(enc, 900, 500);
  ok(v.x0 <= 0 + 1e-9 && v.x1 >= 1 - 1e-9, `x no cubre: ${JSON.stringify(v)}`);
  ok(v.y0 <= 0 + 1e-9 && v.y1 >= 1 - 1e-9, `y no cubre: ${JSON.stringify(v)}`);
});

test('seVe deja fuera lo que no se ve y admite holgura', () => {
  const v = { x0: 0.2, x1: 0.8, y0: 0.2, y1: 0.8 };
  eq(seVe(v, 0.5, 0.5), true);
  eq(seVe(v, 0.05, 0.5), false);
  eq(seVe(v, 0.05, 0.5, 0.2), true);
});

/* ── 7. Los metros no se enteran del zoom ────────────────── */

test('un metro mide el doble en pantalla al 200 %, y sigue siendo un metro', () => {
  const P = 'media';
  const base = ajustar({ vw: 800, vh: 800, aspect: marcoDe(P).aspect });
  const doble = zoomA(base, 2, 400, 400);
  const m1 = pxPorMetro(P, anchoPista(base));
  const m2 = pxPorMetro(P, anchoPista(doble));
  aprox(m2 / m1, 2, 1e-9, 'píxeles por metro:');
  // y el ancho de la pista en metros no se ha movido
  aprox(anchoPista(base) / m1, marcoDe(P).ancho, 1e-9, 'ancho en metros al 100 %:');
  aprox(anchoPista(doble) / m2, marcoDe(P).ancho, 1e-9, 'ancho en metros al 200 %:');
});

test('el imán de 0,60 m agarra la misma distancia REAL a cualquier zoom', () => {
  const P = 'media';
  const base = ajustar({ vw: 800, vh: 800, aspect: marcoDe(P).aspect });
  for (const z of [0.5, 1, 2.5, 4]) {
    const enc = zoomA(base, z, 400, 400);
    const radioPx = 0.6 * pxPorMetro(P, anchoPista(enc));
    // ese radio, traducido a normalizado y de vuelta a metros, sigue siendo 0,60
    const [x0] = despoyectar(enc, 0, 0);
    const [x1] = despoyectar(enc, radioPx, 0);
    const metros = Math.abs(x1 - x0) * marcoDe(P).ancho;
    aprox(metros, 0.6, 1e-9, `zoom ${z}:`);
  }
});

/* ── 8. Detalles que se ven en pantalla ──────────────────── */

test('hairline centra la línea en la rejilla del dispositivo', () => {
  for (const dpr of [1, 2, 2.5, 3]) {
    const v = hairline(1, dpr);
    const enDispositivo = v * dpr;
    aprox(enDispositivo - Math.floor(enDispositivo), 0.5, 1e-9, `dpr ${dpr}:`);
  }
});

/* ── 9. Guardar y reponer ────────────────────────────────── */

test('el encuadre guardado se repone sobre la ventana de ahora', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  const trabajado = limitar(desplazar(zoomA(base, 2.5, 400, 300), -40, 20), 800, 600);
  const g = guardable(trabajado);
  eq(Object.keys(g).sort(), ['escala', 'ox', 'oy']);
  const otra = ajustar({ vw: 600, vh: 900, aspect: marcoDe('media').aspect });
  const repuesto = desdeGuardado(otra, g, 600, 900);
  eq(repuesto.escala, trabajado.escala);
  // la base y el giro son los de la ventana NUEVA, no los de entonces
  eq(repuesto.baseW, otra.baseW);
  eq(repuesto.baseH, otra.baseH);
});

test('un encuadre guardado corrupto no rompe nada', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  eq(desdeGuardado(base, null, 800, 600), base);
  const raro = desdeGuardado(base, { escala: 'mucho', ox: NaN, oy: undefined }, 800, 600);
  ok(Number.isFinite(raro.escala) && Number.isFinite(raro.ox) && Number.isFinite(raro.oy),
    `salió ${JSON.stringify(raro)}`);
  ok(raro.escala >= ZOOM_MIN && raro.escala <= ZOOM_MAX, 'zoom fuera de límites');
});

test('reponer un desplazamiento imposible lo recorta en vez de aceptarlo', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  const r = desdeGuardado(base, { escala: 1, ox: 99999, oy: -99999 }, 800, 600);
  aprox(r.ox, (800 - anchoPista(r)) / 2, 1e-9, 'ox:');
  aprox(r.oy, (600 - altoPista(r)) / 2, 1e-9, 'oy:');
});

/* ── 10. Nada muta ───────────────────────────────────────── */

test('ninguna función muta el encuadre que recibe', () => {
  const base = ajustar({ vw: 800, vh: 600, aspect: marcoDe('media').aspect });
  const copia = JSON.parse(JSON.stringify(base));
  zoomA(base, 3, 100, 100);
  desplazar(base, 50, 50);
  limitar(base, 400, 300);
  desdeGuardado(base, { escala: 2, ox: 0, oy: 0 }, 800, 600);
  eq(base, copia, 'el encuadre original ha cambiado:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
