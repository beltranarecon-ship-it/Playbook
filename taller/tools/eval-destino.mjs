/* ============================================================
   eval-destino.mjs — banco Node de los destinos que la app ya sabe
   (taller/js/pizarra/destino.js). Sin red, sin DOM.

     node taller/tools/eval-destino.mjs

   Lo que más se vigila aquí no es el número sino que sea EL MISMO
   número que usa el motor. La Pizarra calcula estos destinos mientras
   se dibuja y el compilador los vuelve a calcular al animar: con dos
   cuentas parecidas, el trazo que se ve al dibujar y el que se
   reproduce acabarían a distinta distancia del aro, y eso no se nota
   hasta que se proyecta en el pabellón.
   ============================================================ */

import { tieneDestinoPropio, destinoDe } from '../js/pizarra/destino.js';
import { CATALOGO_SISTEMA } from '../js/ia/acciones.js';
import { METROS_FINALIZACION, METROS_RECOGIDA } from '../js/ia/compilador.js';
import { posicionesDe } from '../js/canvas/anclas.js';
import { metrosEntre } from '../js/canvas/escala.js';

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
const de = (slug) => CATALOGO_SISTEMA.find((a) => a.slug === slug);
const jugador = { id: 'j1', kind: 'jugador', x: 0.30, y: 0.75 };

/* ── 1. Quién sabe sola a dónde va ───────────────────────── */

test('SALE DEL CATÁLOGO, no de una lista de slugs escrita a mano', () => {
  for (const a of CATALOGO_SISTEMA) {
    const p = a.parametros || {};
    const esperado = p.destino === 'aro' || p.destino === 'fila_propia' || p.modo === 'recoge';
    eq(tieneDestinoPropio(a), esperado, `${a.slug}:`);
  }
});

test('las tres del §4.4 saben a dónde van; bota y corta no', () => {
  for (const s of ['entra', 'recoge', 'vuelve_a_fila']) ok(tieneDestinoPropio(de(s)), `${s} debería saberlo`);
  for (const s of ['bota', 'corta']) ok(!tieneDestinoPropio(de(s)), `${s} tiene que preguntarlo`);
});

/* ── 2. Al aro ───────────────────────────────────────────── */

test('«entra» SE PARA DONDE SE APOYA, no encima del aro', () => {
  /* Con la ficha encima del aro, su símbolo tapa la canasta entera y no
     se ve si entra o no. La distancia es la del catálogo. */
  const r = destinoDe(de('entra'), jugador, { pista: 'entera', canasta: 'norte' });
  ok(r.punto, 'tiene que salir un punto');
  const aro = posicionesDe('entera', 'norte').aro;
  const d = metrosEntre('entera', r.punto, { x: aro[0], y: aro[1] });
  aprox(d, de('entra').parametros.separacion, 1e-6, 'la distancia al aro:');
});

test('Y ESA DISTANCIA ES LA DEL MOTOR, no una parecida', () => {
  /* El catálogo declara 1,1 y el compilador usa METROS_FINALIZACION de
     reserva: los dos números tienen que ser el mismo, o el trazo que se
     dibuja y el que se anima no coincidirán. */
  eq(de('entra').parametros.separacion, METROS_FINALIZACION,
    'si esto falla, el trazo dibujado y el animado se separan:');
  // y sin `separacion`, se cae en la constante del motor
  const sinSep = { ...de('entra'), parametros: { destino: 'aro', alcance: 'pegado' } };
  const r = destinoDe(sinSep, jugador, { pista: 'entera', canasta: 'norte' });
  const aro = posicionesDe('entera', 'norte').aro;
  aprox(metrosEntre('entera', r.punto, { x: aro[0], y: aro[1] }), METROS_FINALIZACION, 1e-6);
});

test('el destino cae dentro de la pista, venga el jugador de donde venga', () => {
  for (const [x, y] of [[0.02, 0.02], [0.98, 0.98], [0.5, 0.5], [0.02, 0.98]]) {
    const r = destinoDe(de('entra'), { ...jugador, x, y }, { pista: 'entera', canasta: 'norte' });
    ok(r.punto.x >= 0 && r.punto.x <= 1 && r.punto.y >= 0 && r.punto.y <= 1,
      `desde ${x},${y} sale ${JSON.stringify(r.punto)}`);
  }
});

test('cada canasta tiene su aro, y media pista también', () => {
  const n = destinoDe(de('entra'), jugador, { pista: 'entera', canasta: 'norte' }).punto;
  const s = destinoDe(de('entra'), jugador, { pista: 'entera', canasta: 'sur' }).punto;
  ok(Math.abs(n.y - s.y) > 0.2, `norte y sur no pueden dar lo mismo: ${n.y} / ${s.y}`);
  const m = destinoDe(de('entra'), jugador, { pista: 'media', canasta: 'norte' }).punto;
  ok(Number.isFinite(m.x) && Number.isFinite(m.y), 'en media pista también sale un punto');
});

/* ── 3. A por el balón ───────────────────────────────────── */

const balon = (id, x, y, portador = null) => ({ id, kind: 'balon', x, y, portador_id: portador });

test('«recoge» va al balón SUELTO más cercano y se para al lado', () => {
  const elementos = [jugador, balon('b1', 0.50, 0.20), balon('b2', 0.32, 0.70)];
  const r = destinoDe(de('recoge'), jugador, { pista: 'entera', elementos });
  eq(r.balon, 'b2', 'el más cercano:');
  const d = metrosEntre('entera', r.punto, { x: 0.32, y: 0.70 });
  aprox(d, de('recoge').parametros.separacion, 1e-6, 'se para al lado, no encima:');
});

test('la distancia de recogida también es la del motor', () => {
  eq(de('recoge').parametros.separacion, METROS_RECOGIDA);
});

test('un balón que lleva alguien NO se puede recoger', () => {
  const elementos = [jugador, balon('b1', 0.31, 0.74, 'j9')];
  const r = destinoDe(de('recoge'), jugador, { pista: 'entera', elementos });
  ok(!r.punto, 'no debería dar destino');
  ok(/suelto/i.test(r.motivo), `y el motivo lo dice: ${r.motivo}`);
});

test('sin ningún balón suelto lo dice, en vez de inventarse un sitio', () => {
  const r = destinoDe(de('recoge'), jugador, { pista: 'entera', elementos: [jugador] });
  ok(!r.punto);
  ok(r.motivo && r.motivo.length > 8, `un motivo legible: ${r.motivo}`);
});

/* ── 4. Lo que todavía no se puede saber ─────────────────── */

test('«vuelve a la fila» DICE que no hay filas, no se inventa una esquina', () => {
  const r = destinoDe(de('vuelve_a_fila'), jugador, { pista: 'entera' });
  ok(!r.punto, 'no puede salir un punto');
  ok(/fila/i.test(r.motivo), `y el motivo nombra el problema: ${r.motivo}`);
});

test('una acción sin destino propio también lo dice', () => {
  for (const s of ['bota', 'corta', 'finta']) {
    const r = destinoDe(de(s), jugador, { pista: 'entera' });
    ok(!r.punto, `${s} no debería dar destino`);
    ok(r.motivo, `${s} tiene que decir por qué`);
  }
});

test('entradas imposibles no rompen nada', () => {
  ok(destinoDe(null, jugador, {}).motivo);
  ok(destinoDe(de('entra'), null, {}).motivo);
  ok(destinoDe(de('entra'), { id: 'x', kind: 'jugador' }, {}).motivo, 'sin coordenadas:');
  eq(tieneDestinoPropio(null), false);
  eq(tieneDestinoPropio({}), false);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
