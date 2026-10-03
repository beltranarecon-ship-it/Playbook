/* ============================================================
   eval-anillo.mjs — banco Node de la geometría del menú de acciones de
   la Pizarra (taller/js/pizarra/anillo.js). Sin red, sin DOM.

     node taller/tools/eval-anillo.mjs

   Dos cosas importan aquí, y todo lo demás es consecuencia:

     · que la tarjeta ENTRE entera en la ventana: en una pizarra media
       colocación está pegada a la línea de fondo o a la banda, y una
       tarjeta que se sale no se pulsa y una a medias se lee cortada;
     · que NO TAPE la ficha de la que habla, que es lo que el menú
       circular de antes no garantizaba (las casillas se pisaban entre
       sí y con la ficha).

   Este banco recorre la ventana entera —esquinas, bordes, centro— y en
   cada punto exige las dos.
   ============================================================ */

import {
  HUECO, MARGEN, RADIO_ESQUINA, MIN_PARA_BUSCAR, colocarTarjeta,
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

const EPS = 1e-9;
/** ¿Cabe la tarjeta colocada dentro de la ventana, con su margen? */
const dentro = (s, ancho, alto, vw, vh) => s.left >= MARGEN - EPS && s.top >= MARGEN - EPS
  && s.left + ancho <= vw - MARGEN + EPS && s.top + alto <= vh - MARGEN + EPS;
/** ¿Tapa la tarjeta el círculo de la ficha? (radio generoso: una ficha
 *  con mucho zoom mide unos 20 px de radio) */
const tapa = (s, ancho, alto, cx, cy, radio = 20) => {
  const x = Math.max(s.left, Math.min(cx, s.left + ancho));
  const y = Math.max(s.top, Math.min(cy, s.top + alto));
  return Math.hypot(cx - x, cy - y) < radio;
};

/* ── 1. El lado ──────────────────────────────────────────── */

test('con sitio, la tarjeta sale a la derecha de la ficha', () => {
  const s = colocarTarjeta({ cx: 200, cy: 300, vw: 900, vh: 600, ancho: 300, alto: 260 });
  eq(s.lado, 'derecha');
  aprox(s.left, 200 + HUECO, 1e-9, 'a HUECO del centro de la ficha:');
});

test('y va centrada en vertical con la ficha', () => {
  const s = colocarTarjeta({ cx: 200, cy: 300, vw: 900, vh: 600, ancho: 300, alto: 260 });
  aprox(s.top + 130, 300, 1e-9, 'el centro de la tarjeta, a la altura de la ficha:');
});

test('sin sitio a la derecha, pasa a la izquierda', () => {
  const s = colocarTarjeta({ cx: 780, cy: 300, vw: 900, vh: 600, ancho: 300, alto: 260 });
  eq(s.lado, 'izquierda');
  aprox(s.left + 300, 780 - HUECO, 1e-9, 'su borde derecho, a HUECO de la ficha:');
});

test('en una ventana estrecha, baja o sube en vez de ir a un lado', () => {
  // 340 de ancho: ni a la derecha ni a la izquierda cabe una tarjeta de 300
  const abajo = colocarTarjeta({ cx: 170, cy: 100, vw: 340, vh: 700, ancho: 300, alto: 260 });
  eq(abajo.lado, 'abajo');
  const arriba = colocarTarjeta({ cx: 170, cy: 640, vw: 340, vh: 700, ancho: 300, alto: 260 });
  eq(arriba.lado, 'arriba');
});

test('si no cabe en ningún lado, se queda el lado con más sitio y se recorta', () => {
  const s = colocarTarjeta({ cx: 150, cy: 150, vw: 320, vh: 300, ancho: 300, alto: 280 });
  ok(['derecha', 'izquierda', 'abajo', 'arriba'].includes(s.lado), `lado desconocido: ${s.lado}`);
  ok(Number.isFinite(s.left) && Number.isFinite(s.top) && Number.isFinite(s.flecha), 'posición rota');
  ok(s.left >= MARGEN - EPS && s.top >= MARGEN - EPS, 'no se sale por arriba ni por la izquierda');
});

/* ── 2. Lo único que importa: que quepa y que no tape ───── */

test('recorriendo TODA la ventana, la tarjeta entra entera y no tapa la ficha', () => {
  const vw = 820, vh = 560, ancho = 300, alto = 260;
  let malas = 0, total = 0, tapadas = 0;
  for (let cx = 0; cx <= vw; cx += 10) {
    for (let cy = 0; cy <= vh; cy += 10) {
      const s = colocarTarjeta({ cx, cy, vw, vh, ancho, alto });
      total++;
      if (!dentro(s, ancho, alto, vw, vh)) malas++;
      if (tapa(s, ancho, alto, cx, cy)) tapadas++;
    }
  }
  eq(malas, 0, `${malas} tarjetas fuera de ${total} probadas:`);
  eq(tapadas, 0, `${tapadas} tarjetas tapan la ficha de ${total} probadas:`);
});

test('también la tarjeta alta de «más», con la lista desplegada', () => {
  const vw = 900, vh = 640, ancho = 300, alto = 420;
  for (let cx = 0; cx <= vw; cx += 20) {
    for (let cy = 0; cy <= vh; cy += 20) {
      const s = colocarTarjeta({ cx, cy, vw, vh, ancho, alto });
      ok(dentro(s, ancho, alto, vw, vh), `«más» en ${cx},${cy} se sale: ${JSON.stringify(s)}`);
      ok(!tapa(s, ancho, alto, cx, cy), `«más» en ${cx},${cy} tapa la ficha`);
    }
  }
});

test('y en una ventana de móvil', () => {
  const vw = 380, vh = 700, ancho = 300, alto = 260;
  for (let cx = 0; cx <= vw; cx += 20) {
    for (let cy = 0; cy <= vh; cy += 20) {
      const s = colocarTarjeta({ cx, cy, vw, vh, ancho, alto });
      ok(dentro(s, ancho, alto, vw, vh), `móvil en ${cx},${cy} se sale: ${JSON.stringify(s)}`);
      ok(!tapa(s, ancho, alto, cx, cy), `móvil en ${cx},${cy} tapa la ficha`);
    }
  }
});

test('el margen se respeta contra los cuatro bordes', () => {
  const vw = 820, vh = 560, ancho = 300, alto = 260;
  for (const [cx, cy] of [[0, 0], [vw, 0], [0, vh], [vw, vh], [vw / 2, 0], [vw / 2, vh]]) {
    const s = colocarTarjeta({ cx, cy, vw, vh, ancho, alto });
    ok(dentro(s, ancho, alto, vw, vh), `en ${cx},${cy} no deja margen: ${JSON.stringify(s)}`);
  }
});

/* ── 3. La flecha ────────────────────────────────────────── */

test('la flecha apunta a la ficha cuando la tarjeta no se ha recortado', () => {
  const s = colocarTarjeta({ cx: 200, cy: 300, vw: 900, vh: 600, ancho: 300, alto: 260 });
  aprox(s.top + s.flecha, 300, 1e-9, 'la punta, a la altura de la ficha:');
  const abajo = colocarTarjeta({ cx: 170, cy: 100, vw: 340, vh: 700, ancho: 300, alto: 260 });
  eq(abajo.lado, 'abajo');
  aprox(abajo.left + abajo.flecha, 170, 1e-9, 'la punta, a la altura de la ficha:');
});

test('la flecha nunca cae sobre una esquina redondeada', () => {
  const vw = 820, vh = 560, ancho = 300, alto = 260;
  for (let cx = 0; cx <= vw; cx += 20) {
    for (let cy = 0; cy <= vh; cy += 20) {
      const s = colocarTarjeta({ cx, cy, vw, vh, ancho, alto });
      const largo = s.lado === 'derecha' || s.lado === 'izquierda' ? alto : ancho;
      ok(s.flecha >= RADIO_ESQUINA - EPS && s.flecha <= largo - RADIO_ESQUINA + EPS,
        `flecha fuera del borde recto en ${cx},${cy}: ${s.flecha}`);
    }
  }
});

test('con la ficha en una esquina la flecha se queda en el borde, no se pierde', () => {
  const s = colocarTarjeta({ cx: 5, cy: 5, vw: 820, vh: 560, ancho: 300, alto: 260 });
  eq(s.lado, 'derecha');
  aprox(s.flecha, RADIO_ESQUINA, 1e-9, 'tan cerca de la punta como se puede:');
});

/* ── 4. Casos raros ──────────────────────────────────────── */

test('sin medidas no se rompe', () => {
  const s = colocarTarjeta();
  // la tarjeta no tiene tamaño ni ventana: lo que importa es no lanzar
  ok(typeof s === 'object', 'devuelve algo');
});

test('en una ventana más pequeña que la tarjeta no se cuelga', () => {
  const s = colocarTarjeta({ cx: 30, cy: 20, vw: 60, vh: 40, ancho: 300, alto: 260 });
  ok(Number.isFinite(s.left) && Number.isFinite(s.top), 'posición rota');
});

test('con muy pocas acciones no hay buscador, y con muchas sí', () => {
  ok(MIN_PARA_BUSCAR > 6, 'seis acciones caben a la vista: no hace falta buscar');
  ok(MIN_PARA_BUSCAR <= 12, 'una lista larga sí lo necesita');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
