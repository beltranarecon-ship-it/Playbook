/* ============================================================
   eval-anillo.mjs — banco Node de la geometría del anillo de la
   Pizarra (taller/js/pizarra/anillo.js). Sin red, sin DOM.

     node taller/tools/eval-anillo.mjs

   Una sola cosa importa aquí, y todo lo demás es consecuencia: NINGUNA
   casilla puede quedarse fuera de la ventana. En una pizarra media
   colocación está pegada a la línea de fondo o a la banda, así que un
   anillo repartido en 360° alrededor de la ficha se sale casi siempre.
   Y una casilla fuera de pantalla no se pulsa; una a medias se lee
   cortada.

   Este banco recorre la ventana entera —esquinas, bordes, centro— y en
   cada punto exige que las seis casillas entren enteras.
   ============================================================ */

import {
  RADIO_INTERIOR, RADIO_EXTERIOR, RADIO_MIN, RADIO_MAX, APERTURA,
  radioDe, repartir, posicionMas,
} from '../js/pizarra/anillo.js';

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
const aprox = (real, esp, tol = 1e-6, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};

const CAJA = { ancho: 110, alto: 34, margen: 8 };
const cabe = (p, vw, vh) => p.x >= CAJA.ancho / 2 + CAJA.margen - 1e-9
  && p.x <= vw - CAJA.ancho / 2 - CAJA.margen + 1e-9
  && p.y >= CAJA.alto / 2 + CAJA.margen - 1e-9
  && p.y <= vh - CAJA.alto / 2 - CAJA.margen + 1e-9;

/* ── 1. El radio ─────────────────────────────────────────── */

test('el radio sale del lado MENOR de la ventana', () => {
  // en un móvil en vertical, sacarlo del alto pondría las casillas
  // fuera por los lados
  const alto = radioDe(400, 900);
  const ancho = radioDe(900, 400);
  eq(alto, ancho, 'la misma ventana girada tiene que dar el mismo radio:');
});

test('el radio tiene suelo y techo', () => {
  eq(radioDe(200, 200), RADIO_MIN, 'en una ventana diminuta no puede ser ridículo:');
  eq(radioDe(4000, 4000), RADIO_MAX, 'ni desmesurado en una enorme:');
  const medio = radioDe(800, 600);
  ok(medio > RADIO_MIN && medio < RADIO_MAX, `en una normal debería estar entre los topes: ${medio}`);
});

test('el anillo exterior es más grande que el interior', () => {
  ok(radioDe(1200, 900, RADIO_EXTERIOR) > radioDe(1200, 900, RADIO_INTERIOR),
    'las variantes van por fuera de las acciones');
});

/* ── 2. Lo único que importa: que quepan ─────────────────── */

test('con la ficha en el centro, el anillo se reparte entero', () => {
  const vw = 900, vh = 600;
  const ps = repartir(6, { cx: vw / 2, cy: vh / 2, vw, vh, radio: radioDe(vw, vh), ...CAJA });
  eq(ps.length, 6);
  for (const p of ps) ok(cabe(p, vw, vh), `se sale: ${JSON.stringify(p)}`);
  // y es un reparto regular: seis ángulos separados 60°
  const dif = ((ps[1].angulo - ps[0].angulo) * 180) / Math.PI;
  aprox(dif, 60, 1e-9, 'reparto regular:');
});

test('EN LAS CUATRO ESQUINAS no se sale ni una casilla', () => {
  const vw = 820, vh = 560;
  const radio = radioDe(vw, vh);
  for (const [cx, cy] of [[10, 10], [vw - 10, 10], [10, vh - 10], [vw - 10, vh - 10]]) {
    const ps = repartir(6, { cx, cy, vw, vh, radio, ...CAJA });
    for (const p of ps) ok(cabe(p, vw, vh), `esquina ${cx},${cy} se sale: ${JSON.stringify(p)}`);
  }
});

test('recorriendo TODA la ventana, nunca se sale nada', () => {
  const vw = 820, vh = 560;
  const radio = radioDe(vw, vh);
  let malas = 0, total = 0;
  for (let cx = 0; cx <= vw; cx += 20) {
    for (let cy = 0; cy <= vh; cy += 20) {
      for (const p of repartir(6, { cx, cy, vw, vh, radio, ...CAJA })) {
        total++;
        if (!cabe(p, vw, vh)) malas++;
      }
    }
  }
  eq(malas, 0, `${malas} casillas fuera de ${total} probadas:`);
});

test('también con el anillo exterior, que es mayor y se sale antes', () => {
  const vw = 700, vh = 500;
  const radio = radioDe(vw, vh, RADIO_EXTERIOR);
  for (let cx = 0; cx <= vw; cx += 25) {
    for (let cy = 0; cy <= vh; cy += 25) {
      for (const p of repartir(6, { cx, cy, vw, vh, radio, ...CAJA })) {
        ok(cabe(p, vw, vh), `exterior en ${cx},${cy} se sale`);
      }
    }
  }
});

test('y en una ventana estrecha de móvil', () => {
  const vw = 380, vh = 700;
  const radio = radioDe(vw, vh);
  for (let cx = 0; cx <= vw; cx += 20) {
    for (let cy = 0; cy <= vh; cy += 40) {
      for (const p of repartir(6, { cx, cy, vw, vh, radio, ...CAJA })) {
        ok(cabe(p, vw, vh), `móvil en ${cx},${cy} se sale`);
      }
    }
  }
});

/* ── 3. El volcado ───────────────────────────────────────── */

test('pegado al borde derecho, las casillas se vuelcan hacia la izquierda', () => {
  const vw = 800, vh = 600;
  const ps = repartir(6, { cx: vw - 20, cy: vh / 2, vw, vh, radio: radioDe(vw, vh), ...CAJA });
  for (const p of ps) ok(p.x < vw - 20, 'ninguna puede quedar a la derecha de la ficha');
});

test('pegado al borde izquierdo, hacia la derecha', () => {
  const vw = 800, vh = 600;
  const ps = repartir(6, { cx: 20, cy: vh / 2, vw, vh, radio: radioDe(vw, vh), ...CAJA });
  for (const p of ps) ok(p.x > 20, 'ninguna puede quedar a la izquierda de la ficha');
});

test('el arco abre lo acordado y sigue centrado en la ficha', () => {
  const vw = 800, vh = 600;
  const radio = radioDe(vw, vh);
  const ps = repartir(6, { cx: vw - 15, cy: vh / 2, vw, vh, radio, ...CAJA });
  const grados = ((ps[5].angulo - ps[0].angulo) * 180) / Math.PI;
  aprox(Math.abs(grados), APERTURA, 1e-9, 'la apertura del arco:');
});

test('el anillo aplastado no es un capricho: las casillas son anchas y bajas', () => {
  const vw = 900, vh = 600, radio = 120;
  const ps = repartir(4, { cx: 450, cy: 300, vw, vh, radio, ...CAJA });
  const dx = Math.max(...ps.map((p) => Math.abs(p.x - 450)));
  const dy = Math.max(...ps.map((p) => Math.abs(p.y - 300)));
  ok(dy < dx, 'tiene que abrirse más a lo ancho que a lo alto');
});

/* ── 4. Casos raros ──────────────────────────────────────── */

test('con una sola casilla sale una sola casilla', () => {
  const ps = repartir(1, { cx: 400, cy: 300, vw: 800, vh: 600, radio: 100, ...CAJA });
  eq(ps.length, 1);
});

test('sin casillas no devuelve nada, en vez de romperse', () => {
  eq(repartir(0, { cx: 400, cy: 300, vw: 800, vh: 600, radio: 100 }), []);
  eq(repartir(-3, { cx: 400, cy: 300, vw: 800, vh: 600, radio: 100 }), []);
});

test('en una ventana más pequeña que una casilla no se cuelga', () => {
  const ps = repartir(6, { cx: 30, cy: 20, vw: 60, vh: 40, radio: 80, ...CAJA });
  eq(ps.length, 6);
  for (const p of ps) ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'posición rota');
});

/* ── 5. La pastilla de «⋯ más» ───────────────────────────── */

test('«más» va debajo del anillo, y arriba si abajo no cabe', () => {
  const vw = 800, vh = 600, radio = 120;
  const centro = posicionMas({ cx: 400, cy: 200, vw, vh, radio });
  ok(centro.y > 200, 'con sitio abajo, va abajo');
  const bajo = posicionMas({ cx: 400, cy: vh - 20, vw, vh, radio });
  ok(bajo.y < vh - 20, 'pegado al fondo, se pasa arriba');
});

test('«más» nunca se sale de la ventana', () => {
  const vw = 400, vh = 300, radio = 100;
  for (const [cx, cy] of [[0, 0], [vw, 0], [0, vh], [vw, vh], [vw / 2, vh / 2]]) {
    const p = posicionMas({ cx, cy, vw, vh, radio });
    ok(p.x >= 0 && p.x <= vw && p.y >= 0 && p.y <= vh, `se sale en ${cx},${cy}: ${JSON.stringify(p)}`);
  }
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
