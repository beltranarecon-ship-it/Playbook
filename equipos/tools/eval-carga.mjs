/* ============================================================
   eval-carga.mjs — banco Node del motor de la curva de carga
   (equipos/js/data/carga.js). Sin red, sin DOM.
   Ejecutar desde la raíz de cbp-v2:
     node equipos/tools/eval-carga.mjs
   ============================================================ */

import { curvaCarga, geometriaCurva, avisoDuracion } from '../js/data/carga.js';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
function eq(real, esperado, msg = '') {
  const r = JSON.stringify(real), e = JSON.stringify(esperado);
  if (r !== e) throw new Error(`${msg} esperado=${e} real=${r}`);
}
function aprox(real, esperado, msg = '') {
  if (Math.abs(real - esperado) > 1e-9) throw new Error(`${msg} esperado≈${esperado} real=${real}`);
}

const B = (duracion_min, intensidad, titulo = null) => ({ duracion_min, intensidad, titulo });

console.log('· curvaCarga');

test('vacío → todo a cero', () => {
  const c = curvaCarga([]);
  eq([c.segmentos.length, c.duracion, c.carga, c.cargaMedia], [0, 0, 0, 0]);
});

test('un bloque: carga = intensidad×duración', () => {
  const c = curvaCarga([B(20, 4, 'Rueda')]);
  eq(c.duracion, 20); eq(c.carga, 80);
  eq(c.segmentos[0], { x0: 0, x1: 20, intensidad: 4, duracion: 20, titulo: 'Rueda' });
  aprox(c.cargaMedia, 4);
});

test('varios bloques encadenan x0/x1 y suman carga', () => {
  const c = curvaCarga([B(10, 2), B(15, 5), B(5, 1)]);
  eq(c.segmentos.map((s) => [s.x0, s.x1]), [[0, 10], [10, 25], [25, 30]]);
  eq(c.duracion, 30);
  eq(c.carga, 10 * 2 + 15 * 5 + 5 * 1); // 20+75+5 = 100
  aprox(c.cargaMedia, 100 / 30);
});

test('bloques de duración 0 o negativa se ignoran', () => {
  const c = curvaCarga([B(0, 5), B(10, 3), B(-4, 5)]);
  eq(c.segmentos.length, 1); eq(c.duracion, 10); eq(c.carga, 30);
});

test('intensidad ausente cuenta como 0 en la carga, no rompe', () => {
  const c = curvaCarga([{ duracion_min: 10 }]);
  eq(c.duracion, 10); eq(c.carga, 0);
});

console.log('· geometriaCurva');

test('escalón: dos puntos top por segmento (subida vertical implícita)', () => {
  const { segmentos } = curvaCarga([B(10, 2), B(10, 4)]);
  const g = geometriaCurva(segmentos, { ancho: 100, alto: 50, maxIntensidad: 5 });
  // dur=20 → x: 0,50,50,100 ; y int2 = 50-(2/5)*50=30 ; int4 = 50-(4/5)*50=10
  eq(g.top, [
    { x: 0, y: 30 }, { x: 50, y: 30 },
    { x: 50, y: 10 }, { x: 100, y: 10 },
  ]);
});

test('área cierra contra la base (y=alto) a izquierda y derecha', () => {
  const { segmentos } = curvaCarga([B(30, 5)]);
  const g = geometriaCurva(segmentos, { ancho: 60, alto: 40 });
  eq(g.area[0], { x: 0, y: 40 });                    // base izq
  eq(g.area[g.area.length - 1], { x: 60, y: 40 });   // base der
  eq(g.top, [{ x: 0, y: 0 }, { x: 60, y: 0 }]);       // int máx → y=0
});

test('intensidad se recorta a [0,max] al escalar (defensivo)', () => {
  const g = geometriaCurva([{ x0: 0, x1: 10, intensidad: 9 }], { ancho: 10, alto: 100, maxIntensidad: 5 });
  eq(g.top[0].y, 0); // clamp a max → arriba del todo
});

test('sin segmentos → área vacía, sin dividir por cero', () => {
  const g = geometriaCurva([], { ancho: 100, alto: 50 });
  eq([g.area.length, g.duracion], [0, 0]);
});

console.log('· avisoDuracion');

test('sin slot conocido → sin aviso', () => { eq(avisoDuracion(90, null), null); eq(avisoDuracion(90, 0), null); });
test('cuadra dentro de ±5 min → sin aviso', () => { eq(avisoDuracion(88, 90), null); eq(avisoDuracion(93, 90), null); });
test('excede > 5 min', () => { eq(avisoDuracion(100, 90), { tipo: 'excede', diff: 10 }); });
test('se queda corto > 5 min', () => { eq(avisoDuracion(80, 90), { tipo: 'corto', diff: 10 }); });

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
