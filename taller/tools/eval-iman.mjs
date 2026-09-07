/* ============================================================
   eval-iman.mjs — banco Node del imán y las guías de la Pizarra
   (taller/js/pizarra/iman.js y guias.js). Sin red, sin DOM.

     node taller/tools/eval-iman.mjs

   Van juntos porque son las dos caras del mismo problema: el imán
   PEGA y las guías solo AVISAN.

   Lo que más vigila: que las dos midan en METROS. Es lo que hace que
   se comporten igual a cualquier zoom y en las cuatro pistas. Medir en
   normalizado sería el fallo silencioso clásico — el marco de la
   entera es 18 × 27 m, así que el mismo 0,01 vale 18 cm a lo ancho y
   27 a lo largo, y el imán agarraría metro y medio más lejos por un
   eje que por el otro sin que nadie entienda por qué.
   ============================================================ */

import {
  RADIO_IMAN, puntosDeIman, imantar, pegar, nombreDeAncla,
} from '../js/pizarra/iman.js';
import {
  TOLERANCIA, MAX_POR_EJE, guiasDe, hayGuias,
} from '../js/pizarra/guias.js';
import { posicionesDe } from '../js/canvas/anclas.js';
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

/* Un punto a `m` metros de otro, moviéndose por un eje. Sirve para
   escribir las pruebas en metros y no en normalizado. */
const aLoAncho = (pista, p, m) => ({ x: p.x + m / marcoDe(pista).ancho, y: p.y });
const aLoLargo = (pista, p, m) => ({ x: p.x, y: p.y + m / marcoDe(pista).alto });

/* ── 1. Los nombres, que se leen en el cursor ────────────── */

test('las anclas se llaman como las llama un entrenador', () => {
  eq(nombreDeAncla('codo_der'), 'codo derecho');
  eq(nombreDeAncla('poste_bajo_izq'), 'poste bajo izquierdo');
  eq(nombreDeAncla('aro'), 'aro');
  eq(nombreDeAncla('tiro_libre'), 'tiro libre');
  eq(nombreDeAncla('lo_que_sea_raro'), 'lo_que_sea_raro');  // no inventa
});

/* ── 2. Los puntos a los que pegarse ─────────────────────── */

test('están las anclas de la cancha', () => {
  const ps = puntosDeIman({ pista: 'entera', canasta: 'norte' });
  const slugs = ps.filter((p) => p.tipo === 'ancla').map((p) => p.slug);
  for (const n of ['aro', 'tiro_libre', 'codo_der', 'codo_izq', 'esquina_der', 'poste_bajo_izq', 'centro']) {
    ok(slugs.includes(n), `falta el ancla ${n}`);
  }
});

test('están las fichas puestas, y lo que se arrastra NO se cuenta a sí mismo', () => {
  const elementos = [
    { id: 'j1', kind: 'jugador', x: 0.3, y: 0.3 },
    { id: 'c1', kind: 'cono', x: 0.7, y: 0.7 },
  ];
  const con = puntosDeIman({ elementos });
  ok(con.some((p) => p.id === 'j1'), 'debería estar el jugador');
  const sin = puntosDeIman({ elementos, excluir: ['j1'] });
  ok(!sin.some((p) => p.id === 'j1'), 'lo que se arrastra no puede imantarse a sí mismo');
  ok(sin.some((p) => p.id === 'c1'), 'pero el cono sigue');
});

test('de una zona salen sus esquinas y los medios de sus lados', () => {
  const zona = { id: 'z1', kind: 'zona', tipo: 'rect', nombre: 'pasillo', x: 0.2, y: 0.2, x2: 0.6, y2: 0.5 };
  const ps = puntosDeIman({ elementos: [zona] }).filter((p) => p.tipo === 'zona');
  ok(ps.some((p) => p.nombre.includes('esquina')), 'faltan las esquinas');
  ok(ps.some((p) => p.nombre.includes('medio')), 'faltan los puntos medios');
});

test('están las posiciones que ha marcado el entrenador', () => {
  const ps = puntosDeIman({ posiciones: { mi_sitio: [0.42, 0.42] } });
  const mia = ps.find((p) => p.tipo === 'propia');
  eq([mia.x, mia.y, mia.nombre], [0.42, 0.42, 'mi sitio']);
});

/* ── 3. Pegar, y todo medido en METROS ───────────────────── */

test('se pega a lo que está dentro del radio y no a lo de fuera', () => {
  const P = 'entera';
  const aro = posicionesDe(P, 'norte').aro;
  const ps = puntosDeIman({ pista: P, canasta: 'norte' });
  const cerca = aLoAncho(P, { x: aro[0], y: aro[1] }, 0.4);
  eq(imantar(cerca, ps, P).slug, 'aro', 'a 0,40 m debería pegarse:');
  const lejos = aLoAncho(P, { x: aro[0], y: aro[1] }, 0.9);
  const r = imantar(lejos, ps, P);
  ok(!r || r.slug !== 'aro', `a 0,90 m NO debería pegarse al aro, salió ${r && r.slug}`);
});

test('el radio son 0,60 m DE PISTA, iguales en los dos ejes', () => {
  const P = 'entera';
  const centro = { x: 0.5, y: 0.5 };
  const ps = [{ x: centro.x, y: centro.y, nombre: 'diana', tipo: 'elemento' }];
  // el marco es 18 × 27 m: si se midiera en normalizado, el mismo
  // desplazamiento agarraría en un eje y no en el otro
  const porAncho = aLoAncho(P, centro, 0.55);
  const porLargo = aLoLargo(P, centro, 0.55);
  ok(imantar(porAncho, ps, P), 'a 0,55 m a lo ancho debería agarrar');
  ok(imantar(porLargo, ps, P), 'a 0,55 m a lo largo debería agarrar');
  ok(!imantar(aLoAncho(P, centro, 0.65), ps, P), 'a 0,65 m no');
  ok(!imantar(aLoLargo(P, centro, 0.65), ps, P), 'a 0,65 m tampoco');
});

test('el imán se comporta igual en las cuatro pistas', () => {
  for (const P of ['entera', 'media', 'entera_fiba', 'media_fiba']) {
    const ps = [{ x: 0.5, y: 0.5, nombre: 'diana', tipo: 'elemento' }];
    ok(imantar(aLoAncho(P, { x: 0.5, y: 0.5 }, 0.5), ps, P), `${P}: debería agarrar a 0,50 m`);
    ok(!imantar(aLoAncho(P, { x: 0.5, y: 0.5 }, 0.7), ps, P), `${P}: no debería agarrar a 0,70 m`);
  }
});

test('gana el más cercano, no el primero de la lista', () => {
  const P = 'entera';
  const p0 = { x: 0.5, y: 0.5 };
  const ps = [
    { x: aLoAncho(P, p0, 0.5).x, y: p0.y, nombre: 'lejos', tipo: 'elemento' },
    { x: aLoAncho(P, p0, 0.1).x, y: p0.y, nombre: 'cerca', tipo: 'elemento' },
  ];
  eq(imantar(p0, ps, P).nombre, 'cerca');
});

test('en un empate exacto gana lo que ha puesto el entrenador, no el ancla', () => {
  const P = 'entera';
  const aro = posicionesDe(P, 'norte').aro;
  // un cono justo encima del aro: los dos están a distancia cero
  const ps = puntosDeIman({
    pista: P, canasta: 'norte',
    elementos: [{ id: 'c1', kind: 'cono', x: aro[0], y: aro[1] }],
  });
  eq(imantar({ x: aro[0], y: aro[1] }, ps, P).tipo, 'elemento');
});

test('sin nada cerca devuelve null, no el menos malo', () => {
  const ps = [{ x: 0.9, y: 0.9, nombre: 'lejos', tipo: 'elemento' }];
  eq(imantar({ x: 0.1, y: 0.1 }, ps, 'entera'), null);
});

test('un punto imposible no rompe nada', () => {
  eq(imantar(null, [], 'entera'), null);
  eq(imantar({ x: NaN, y: 0.5 }, [{ x: 0.5, y: 0.5 }], 'entera'), null);
});

test('el resultado dice a cuánto se ha pegado, para poder enseñarlo', () => {
  const P = 'entera';
  const ps = [{ x: 0.5, y: 0.5, nombre: 'diana', tipo: 'elemento' }];
  const r = imantar(aLoAncho(P, { x: 0.5, y: 0.5 }, 0.3), ps, P);
  aprox(r.metros, 0.3, 1e-9, 'la distancia:');
  eq(r.nombre, 'diana');
});

test('pegar() hace las dos cosas en un paso', () => {
  const P = 'entera';
  const aro = posicionesDe(P, 'norte').aro;
  const r = pegar(aLoAncho(P, { x: aro[0], y: aro[1] }, 0.3), { pista: P, canasta: 'norte' });
  eq(r.slug, 'aro');
});

/* ── 4. Las guías, que avisan pero no pegan ──────────────── */

test('sale guía vertical cuando dos comparten la misma x', () => {
  const P = 'entera';
  const otros = [{ id: 'a', kind: 'jugador', x: 0.5, y: 0.2 }];
  const g = guiasDe({ id: 'b', x: 0.5, y: 0.8 }, otros, P);
  eq(g.verticales.length, 1);
  eq(g.verticales[0].x, 0.5);
  eq(g.verticales[0].con, ['a']);
  eq(g.horizontales.length, 0, 'no comparten y, no debería haber horizontal:');
});

test('la tolerancia son 0,25 m, medidos en METROS y por eje', () => {
  const P = 'entera';                       // marco 18 × 27 m
  const ref = { id: 'a', kind: 'jugador', x: 0.5, y: 0.5 };
  const dentro = aLoAncho(P, { x: 0.5, y: 0.5 }, 0.2);
  const fuera = aLoAncho(P, { x: 0.5, y: 0.5 }, 0.4);
  eq(guiasDe({ id: 'b', ...dentro }, [ref], P).verticales.length, 1, 'a 0,20 m:');
  eq(guiasDe({ id: 'b', ...fuera }, [ref], P).verticales.length, 0, 'a 0,40 m:');
  // y por el eje largo tiene que ser LA MISMA distancia real
  const dentroL = aLoLargo(P, { x: 0.5, y: 0.5 }, 0.2);
  const fueraL = aLoLargo(P, { x: 0.5, y: 0.5 }, 0.4);
  eq(guiasDe({ id: 'b', ...dentroL }, [ref], P).horizontales.length, 1, 'a 0,20 m a lo largo:');
  eq(guiasDe({ id: 'b', ...fueraL }, [ref], P).horizontales.length, 0, 'a 0,40 m a lo largo:');
});

test('cinco jugadores en fila son UNA guía, no cinco', () => {
  const otros = [1, 2, 3, 4, 5].map((i) => ({ id: `j${i}`, kind: 'jugador', x: 0.5, y: 0.1 * i }));
  const g = guiasDe({ id: 'x', x: 0.5, y: 0.9 }, otros, 'entera');
  eq(g.verticales.length, 1, 'una sola línea:');
  eq(g.verticales[0].con.length, 5, 'pero sabe con quiénes:');
});

test('no se enseñan más de dos guías por eje', () => {
  const P = 'entera';
  const otros = [];
  for (let i = 0; i < 6; i++) otros.push({ id: `j${i}`, kind: 'jugador', ...aLoAncho(P, { x: 0.5, y: 0.3 }, i * 0.24) });
  const g = guiasDe({ id: 'x', x: 0.5, y: 0.9 }, otros, P);
  ok(g.verticales.length <= MAX_POR_EJE, `salieron ${g.verticales.length} guías verticales`);
});

test('la guía pasa por la referencia QUIETA, no por lo que se mueve', () => {
  const P = 'entera';
  const ref = { id: 'a', kind: 'jugador', x: 0.5, y: 0.2 };
  const movido = { id: 'b', ...aLoAncho(P, { x: 0.5, y: 0.8 }, 0.1) };
  const g = guiasDe(movido, [ref], P);
  eq(g.verticales[0].x, 0.5, 'la línea tiene que pasar por lo que ya estaba:');
});

test('uno no se alinea consigo mismo', () => {
  const g = guiasDe({ id: 'a', x: 0.5, y: 0.5 }, [{ id: 'a', kind: 'jugador', x: 0.5, y: 0.5 }], 'entera');
  eq(hayGuias(g), false);
});

test('las zonas no generan guías: son el escenario, no los actores', () => {
  const zona = { id: 'z', kind: 'zona', tipo: 'rect', x: 0.5, y: 0.1, x2: 0.9, y2: 0.4 };
  eq(hayGuias(guiasDe({ id: 'b', x: 0.5, y: 0.8 }, [zona], 'entera')), false);
});

test('con las anclas puestas, el aro también alinea', () => {
  const P = 'entera';
  const aro = posicionesDe(P, 'norte').aro;
  const sin = guiasDe({ id: 'b', x: aro[0], y: 0.6 }, [], P);
  const con = guiasDe({ id: 'b', x: aro[0], y: 0.6 }, [], P, { conAnclas: true, canasta: 'norte' });
  eq(hayGuias(sin), false, 'sin pedirlas, no:');
  ok(con.verticales.some((g) => g.con.some((c) => c.startsWith('ancla:'))), 'pidiéndolas, sí');
});

test('un movido imposible no rompe nada', () => {
  eq(hayGuias(guiasDe(null, [], 'entera')), false);
  eq(hayGuias(guiasDe({ id: 'a', x: NaN, y: 0.5 }, [], 'entera')), false);
});

/* ── 5. Los números acordados ────────────────────────────── */

test('el radio y la tolerancia son los de la especificación', () => {
  eq(RADIO_IMAN, 0.60);
  eq(TOLERANCIA, 0.25);
  ok(TOLERANCIA < RADIO_IMAN, 'avisar de una alineación tiene que ser más fino que pegarse a un sitio');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
