/* ============================================================
   eval-zonas.mjs — banco Node de las zonas de la pista
   (taller/js/canvas/zonas.js). Sin red, sin DOM.

     node taller/tools/eval-zonas.mjs

   Lo que más vigila: que todo lo que una zona mide esté en METROS.
   Repartir seis conos por el contorno de un rectángulo alargado es la
   prueba: hacerlo en unidades de lienzo los amontona en los lados
   cortos, y sobre la pista se ve torcido aunque los números cuadren.
   ============================================================ */

import {
  TIPOS_ZONA, crearZona, siguienteNombre, radioMetros, cajaDe, centroDe,
  contornoDe, puntosDe, largoMetros, repartirSobre, ajustarConShift,
  zonaGuardable, zonaDesdeGuardada,
} from '../js/canvas/zonas.js';
import { metrosEntre } from '../js/canvas/escala.js';
import { marcoDe } from '../js/canvas/medidas.js';

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

const P = 'media';

/** Distancia entre dos puntos consecutivos MEDIDA POR EL CONTORNO. */
function porElContorno(pista, z, a, b) {
  const { puntos, cerrado } = contornoDe(pista, z);
  const vs = cerrado ? [...puntos, puntos[0]] : puntos;
  const s = (p) => {           // longitud de arco hasta el punto p
    let acc = 0;
    for (let i = 1; i < vs.length; i++) {
      const d = metrosEntre(pista, vs[i - 1], vs[i]);
      const dA = metrosEntre(pista, vs[i - 1], p), dB = metrosEntre(pista, p, vs[i]);
      if (Math.abs(dA + dB - d) < 1e-6) return acc + dA;   // p cae en este tramo
      acc += d;
    }
    return acc;
  };
  return Math.abs(s(b) - s(a));
}

console.log('· nombres');

test('la primera zona se llama ZONA 1', () => {
  eq(crearZona('rect', 0.2, 0.2, 0.4, 0.4).nombre, 'ZONA 1');
});

test('el nombre rellena el hueco que quede libre', () => {
  eq(siguienteNombre([{ nombre: 'ZONA 1' }, { nombre: 'ZONA 3' }]), 'ZONA 2');
});

test('un nombre puesto a mano no estorba a la numeración', () => {
  eq(siguienteNombre([{ nombre: 'Zona de tiro' }, { nombre: 'ZONA 1' }]), 'ZONA 2');
});

console.log('\n· geometría, en metros');

test('un círculo tiene el radio que dicen sus dos puntos', () => {
  // 0,12 unidades a lo ancho de la media son 2,16 m
  const z = crearZona('circulo', 0.5, 0.5, 0.62, 0.5);
  aprox(radioMetros(P, z), 0.12 * marcoDe(P).ancho, 1e-9);
});

test('un círculo es redondo sobre la PISTA, no sobre el lienzo', () => {
  // Es la trampa del marco no cuadrado: tomando el radio en unidades
  // normalizadas, el mismo número da 2,16 m a lo ancho y 2,28 a lo alto.
  const z = crearZona('circulo', 0.5, 0.5, 0.62, 0.5);
  const c = cajaDe(P, z);
  aprox(metrosEntre(P, [c.x0, z.y], [z.x, z.y]), radioMetros(P, z), 1e-9, 'radio horizontal');
  aprox(metrosEntre(P, [z.x, c.y0], [z.x, z.y]), radioMetros(P, z), 1e-9, 'radio vertical');
});

test('el contorno de un rectángulo mide su perímetro real', () => {
  const z = crearZona('rect', 0.3, 0.3, 0.6, 0.6);
  const m = marcoDe(P);
  aprox(largoMetros(P, z), 2 * (0.3 * m.ancho + 0.3 * m.alto), 1e-9);
});

test('el centro de cada forma es el que se espera', () => {
  // con `aprox` y no con igualdad exacta: (0.4+0.8)/2 en coma flotante da
  // 0.6000000000000001, y comparar coordenadas al bit no prueba nada
  const centro = (z, x, y) => {
    const c = centroDe(P, z);
    aprox(c.x, x, 1e-12, 'x'); aprox(c.y, y, 1e-12, 'y');
  };
  centro(crearZona('rect', 0.2, 0.4, 0.6, 0.8), 0.4, 0.6);
  centro(crearZona('linea', 0.2, 0.2, 0.6, 0.4), 0.4, 0.3);
  centro(crearZona('circulo', 0.5, 0.5, 0.6, 0.5), 0.5, 0.5);
});

test('las tres formas dan sitios a los que referirse', () => {
  eq(puntosDe(P, crearZona('linea', 0.2, 0.2, 0.6, 0.4)).map((p) => p.nombre), ['centro', 'inicio', 'fin']);
  eq(puntosDe(P, crearZona('rect', 0.2, 0.2, 0.6, 0.4)).map((p) => p.nombre),
    ['centro', 'esquina_1', 'esquina_2', 'esquina_3', 'esquina_4']);
  // el círculo da los cuatro cardinales, no sus 48 vértices: nadie manda
  // a nadie «al vértice 31»
  eq(puntosDe(P, crearZona('circulo', 0.5, 0.5, 0.6, 0.5)).map((p) => p.nombre),
    ['centro', 'arriba', 'abajo', 'izquierda', 'derecha']);
});

console.log('\n· conos a distancia regular (el Shift del paso 1)');

test('seis conos sobre un rectángulo quedan equidistantes POR EL CONTORNO', () => {
  const z = crearZona('rect', 0.3, 0.3, 0.6, 0.6);
  const ps = repartirSobre(P, z, 6);
  eq(ps.length, 6);
  const paso = largoMetros(P, z) / 6;
  for (let i = 1; i < ps.length; i++) {
    aprox(porElContorno(P, z, ps[i - 1], ps[i]), paso, 1e-4, `entre el ${i} y el ${i + 1}`);
  }
});

test('sobre un rectángulo MUY alargado siguen siendo equidistantes', () => {
  // Aquí es donde se nota si el reparto va en metros o en unidades de
  // lienzo: con un rectángulo de 12 × 1 m, repartir por unidades
  // normalizadas amontona los conos en los dos lados cortos.
  const z = crearZona('rect', 0.15, 0.48, 0.85, 0.53);
  const ps = repartirSobre(P, z, 8);
  const paso = largoMetros(P, z) / 8;
  for (let i = 1; i < ps.length; i++) {
    aprox(porElContorno(P, z, ps[i - 1], ps[i]), paso, 1e-4, `entre el ${i} y el ${i + 1}`);
  }
});

test('sobre una línea, el primero y el último caen en los extremos', () => {
  const z = crearZona('linea', 0.2, 0.2, 0.8, 0.5);
  const ps = repartirSobre(P, z, 5);
  eq(ps[0], { x: 0.2, y: 0.2 });
  aprox(ps[4].x, 0.8, 1e-9); aprox(ps[4].y, 0.5, 1e-9);
});

test('un cono suelto y cero conos no revientan', () => {
  const z = crearZona('linea', 0.2, 0.2, 0.8, 0.5);
  eq(repartirSobre(P, z, 0), []);
  eq(repartirSobre(P, z, 1).length, 1);
  eq(repartirSobre(P, z, -3), []);
});

test('una zona degenerada (dos puntos iguales) no cuelga el reparto', () => {
  const z = crearZona('linea', 0.4, 0.4, 0.4, 0.4);
  eq(repartirSobre(P, z, 4), []);
});

console.log('\n· el Shift al dibujar');

test('una línea casi horizontal se endereza del todo', () => {
  const r = ajustarConShift(P, 'linea', 0.2, 0.5, 0.7, 0.52);
  aprox(r.y2, 0.5, 1e-12);
  aprox(r.x2, 0.7, 1e-12);
});

test('una línea casi vertical se endereza del todo', () => {
  const r = ajustarConShift(P, 'linea', 0.5, 0.2, 0.52, 0.7);
  aprox(r.x2, 0.5, 1e-12);
});

test('una diagonal sale a 45 grados SOBRE LA PISTA', () => {
  // No a 45° del lienzo: el marco no es cuadrado, así que una diagonal
  // que parezca de 45° en pantalla no lo sería sobre el suelo.
  const z0 = { x: 0.2, y: 0.2 };
  const r = ajustarConShift(P, 'linea', z0.x, z0.y, 0.5, 0.42);
  const m = marcoDe(P);
  aprox(Math.abs((r.x2 - z0.x) * m.ancho), Math.abs((r.y2 - z0.y) * m.alto), 1e-9);
});

test('un rectángulo con Shift sale cuadrado en metros', () => {
  const r = ajustarConShift(P, 'rect', 0.3, 0.3, 0.6, 0.5);
  const m = marcoDe(P);
  aprox(Math.abs((r.x2 - 0.3) * m.ancho), Math.abs((r.y2 - 0.3) * m.alto), 1e-9);
});

console.log('\n· lo que se guarda');

test('guardar y volver a leer devuelve la misma zona', () => {
  const z = { ...crearZona('rect', 0.3, 0.35, 0.6, 0.62), id: 'zona_7', nombre: 'Zona de tiro', visible: false };
  const v = zonaDesdeGuardada(zonaGuardable(z));
  eq([v.id, v.tipo, v.nombre, v.visible, v.x, v.y, v.x2, v.y2],
    ['zona_7', 'rect', 'Zona de tiro', false, 0.3, 0.35, 0.6, 0.62]);
});

test('una zona sin id recibe uno estable por su posición en la lista', () => {
  eq(zonaGuardable(crearZona('linea', 0.1, 0.1, 0.2, 0.2), 2).id, 'zona_3');
});

test('visible es true salvo que se diga lo contrario', () => {
  eq(zonaGuardable(crearZona('rect', 0.1, 0.1, 0.2, 0.2)).visible, true);
  eq(zonaDesdeGuardada({ id: 'z', tipo: 'rect', nombre: 'X', puntos: [[0, 0], [1, 1]] }).visible, true);
});

test('los tipos son los tres de la especificación', () => {
  eq(TIPOS_ZONA, ['rect', 'circulo', 'linea']);
});

test('un tipo inventado cae a rectángulo en vez de romperse', () => {
  eq(crearZona('trapecio', 0.1, 0.1, 0.2, 0.2).tipo, 'rect');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
