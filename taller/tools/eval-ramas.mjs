/* ============================================================
   eval-ramas.mjs — banco Node de las ramas (taller/js/pizarra/ramas.js).
   Sin red, sin DOM.

     node taller/tools/eval-ramas.mjs

   Una jugada con ramas (§6.7) sigue siendo una lista plana de fases, y
   tres campos dicen cómo se enlazan. Aquí se prueba que de esa lista
   salen bien el árbol, los caminos —el principal y todos— y que abrir,
   quitar, reunir y separar ramas la dejan como tiene que quedar.
   ============================================================ */

import {
  MAX_RAMAS, MAX_CAMINOS, grafoDe, siguientesDe, esCruce, tieneRamas, caminoHasta, caminoPor, caminoPrincipal, todosLosCaminos,
  cuantosCaminos, reunionesDe, nuevoIdDeFase, abrirRama, renombrarRama, quitarRama, reunir, separar, insertarDetras, arbolDe,
} from '../js/pizarra/ramas.js';

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

const F = (id, extra = {}) => ({ id, tramos: [], rama_de: null, rama_nombre: null, reune: [], ...extra });
const lineal = () => [F('f1'), F('f2'), F('f3'), F('f4')];
const ids = (fases) => fases.map((f) => f.id);
const crear = (id) => F(id);

console.log('· sin ramas, todo como siempre');

test('UNA JUGADA SIN RAMAS ES UN SOLO CAMINO, en el orden de la lista', () => {
  const f = lineal();
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3', 'f4']);
  eq(todosLosCaminos(f), [['f1', 'f2', 'f3', 'f4']]);
  eq(siguientesDe(f, 'f2'), ['f3']);
  eq([esCruce(f, 'f2'), tieneRamas(f)], [false, false]);
  eq(caminoHasta(f, 'f3'), ['f1', 'f2', 'f3']);
  eq(caminoPrincipal([]), []);
});

console.log('· abrir ramas');

test('ABRIR RAMA: lo que ya venía pasa a ser la primera, con su nombre, y la nueva empieza vacía', () => {
  const r = abrirRama(lineal(), 'f2', { primera: 'si le dejan', nueva: 'si le niegan', crear });
  ok(r.fases, r.motivo);
  eq(r.nuevas, ['f5']);
  const f = r.fases;
  eq(siguientesDe(f, 'f2'), ['f3', 'f5'], 'la primera, la que ya venía:');
  eq([f.find((x) => x.id === 'f3').rama_nombre, f.find((x) => x.id === 'f5').rama_nombre], ['si le dejan', 'si le niegan']);
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3', 'f4'], 'el principal no cambia:');
  eq(caminoPor(f, 'f5'), ['f1', 'f2', 'f5']);
  eq(todosLosCaminos(f), [['f1', 'f2', 'f3', 'f4'], ['f1', 'f2', 'f5']]);
  ok(esCruce(f, 'f2') && tieneRamas(f));
});

test('CADA RAMA NECESITA SU NOMBRE; y como mucho tres por cruce', () => {
  eq(abrirRama(lineal(), 'f2', { primera: '', nueva: 'x', crear }).motivo, 'cada rama necesita su nombre');
  eq(abrirRama(lineal(), 'f2', { primera: 'a', nueva: '  ', crear }).motivo, 'cada rama necesita su nombre');
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  const tercera = abrirRama(f, 'f2', { nueva: 'c', crear });
  ok(tercera.fases, 'en un cruce ya abierto, solo el nombre de la nueva');
  f = tercera.fases;
  eq(siguientesDe(f, 'f2').length, MAX_RAMAS);
  eq(abrirRama(f, 'f2', { nueva: 'd', crear }).motivo, `una fase abre como mucho ${MAX_RAMAS} ramas`);
  eq(abrirRama(f, 'nada', { primera: 'a', nueva: 'b' }).motivo, 'esa fase no está');
});

test('EN LA ÚLTIMA FASE, SALEN LAS DOS RAMAS VACÍAS', () => {
  const r = abrirRama(lineal(), 'f4', { primera: 'uno', nueva: 'dos', crear });
  eq(r.nuevas, ['f5', 'f6']);
  eq(siguientesDe(r.fases, 'f4'), ['f5', 'f6']);
});

test('LO QUE SE DIBUJA DETRÁS DE UNA RAMA SIGUE EN ELLA, sin tocar las demás', () => {
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;   // f3 (a) → f4 ; f5 (b)
  f = insertarDetras(f, 'f5', F(nuevoIdDeFase(f)));                               // f6 detrás de f5
  eq(caminoPor(f, 'f6'), ['f1', 'f2', 'f5', 'f6']);
  f = insertarDetras(f, 'f3', F(nuevoIdDeFase(f)));                               // f7 detrás de f3, antes de f4
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3', 'f7', 'f4'], 'en medio de la rama a:');
  eq(caminoPor(f, 'f6'), ['f1', 'f2', 'f5', 'f6'], 'y la b, igual:');
});

test('RAMAS DENTRO DE RAMAS: cada cruce con las suyas', () => {
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  f = abrirRama(f, 'f3', { primera: 'a1', nueva: 'a2', crear }).fases;           // f3 → f4 (a1) | f6 (a2)
  eq(todosLosCaminos(f), [['f1', 'f2', 'f3', 'f4'], ['f1', 'f2', 'f3', 'f6'], ['f1', 'f2', 'f5']]);
  const arbol = arbolDe(f);
  eq(arbol.fases, ['f1', 'f2']);
  eq(arbol.ramas.map((r) => [r.nombre, r.fases]), [['a', ['f3']], ['b', ['f5']]]);
  eq(arbol.ramas[0].ramas.map((r) => [r.nombre, r.fases]), [['a1', ['f4']], ['a2', ['f6']]]);
});

console.log('· renombrar y quitar');

test('RENOMBRAR UNA RAMA; y no a una fase que no empieza ninguna', () => {
  const f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  eq(renombrarRama(f, 'f5', 'si ayudan').fases.find((x) => x.id === 'f5').rama_nombre, 'si ayudan');
  eq(renombrarRama(f, 'f4', 'x').motivo, 'esa fase no empieza ninguna rama');
  eq(renombrarRama(f, 'f5', ' ').motivo, 'cada rama necesita su nombre');
});

test('QUITAR UNA RAMA VACÍA: con una sola, la que queda vuelve a ser lo que sigue', () => {
  const f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  const r = quitarRama(f, 'f5');
  ok(r.fases, r.motivo);
  eq(ids(r.fases), ['f1', 'f2', 'f3', 'f4']);
  eq([r.fases[2].rama_de, r.fases[2].rama_nombre], [null, null]);
  eq(tieneRamas(r.fases), false);
  const conTrazo = f.map((x) => (x.id === 'f5' ? { ...x, tramos: [{ id: 't1' }] } : x));
  eq(quitarRama(conTrazo, 'f5').motivo, 'la rama tiene algo dibujado; bórralo antes');
  eq(quitarRama(f, 'f4').motivo, 'esa fase no empieza ninguna rama');
});

test('QUITAR LA PRIMERA RAMA: la otra pasa a seguir al cruce, en su sitio de la lista', () => {
  let f = abrirRama([F('f1'), F('f2')], 'f2', { primera: 'a', nueva: 'b', crear }).fases;   // f2 → f3 (a) | f4 (b)
  f = insertarDetras(f, 'f4', F('f5'));
  const r = quitarRama(f, 'f3');
  eq(caminoPrincipal(r.fases), ['f1', 'f2', 'f4', 'f5']);
  eq(tieneRamas(r.fases), false);
});

console.log('· reunir');

test('REUNIR: una fase es continuación común; a ella se llega por la primera rama', () => {
  // f1 → f2 ─┬─ f3 (a) → f4
  //          └─ f5 (b)            y f5 sigue por f4
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  const r = reunir(f, 'f5', 'f4');
  ok(r.fases, r.motivo);
  f = r.fases;
  eq(f.find((x) => x.id === 'f4').reune, ['f3', 'f5'], 'la primera, la que ya llegaba:');
  eq(caminoHasta(f, 'f4'), ['f1', 'f2', 'f3', 'f4'], 'se llega por la primera rama:');
  eq(todosLosCaminos(f), [['f1', 'f2', 'f3', 'f4'], ['f1', 'f2', 'f5', 'f4']], 'y se reproduce por las dos:');
  const arbol = arbolDe(f);
  eq(arbol.ramas[1].sigueEn, 'f4', 'en el árbol, la b dice por dónde sigue:');
  eq(separar(f, 'f5', 'f4').fases.find((x) => x.id === 'f4').reune, [], 'y se puede deshacer:');
});

test('NO SE REÚNE lo que haría un círculo, ni desde una fase que sigue', () => {
  const f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  eq(reunir(f, 'f5', 'f2').motivo, 'esa fase va antes: se daría la vuelta');
  eq(reunir(f, 'f3', 'f5').motivo, 'solo se reúne desde la última fase de una rama');
  eq(reunir(f, 'f5', 'f1').motivo, 'la primera fase no sigue a ninguna');
  eq(reunir(f, 'f5', 'f5').motivo, 'una fase no puede seguir por sí misma');
  eq(separar(f, 'f5', 'f4').motivo, 'esas fases no están reunidas');
});

test('QUITAR UNA RAMA QUE SE REUNÍA deja la reunión como estaba', () => {
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  f = reunir(f, 'f5', 'f4').fases;
  const r = quitarRama(f, 'f5');
  eq(r.fases.find((x) => x.id === 'f4').reune, []);
  eq(caminoPrincipal(r.fases), ['f1', 'f2', 'f3', 'f4']);
});

test('SI UN CRUCE TIENE ALGO QUE SIGUE SIN SER RAMA, eso es el camino principal', () => {
  const f = [F('f1'), F('f2', { rama_de: 'f1', rama_nombre: 'b' }), F('f3')];
  /* f3 sigue a f2 por el orden; para que siga a f1 sin ser rama tiene que ir justo detrás. */
  const g = [F('f1'), F('f3'), F('f2', { rama_de: 'f1', rama_nombre: 'b' })];
  eq(siguientesDe(g, 'f1'), ['f3', 'f2']);
  eq(caminoPrincipal(g), ['f1', 'f3']);
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3']);
});

test('LOS IDS NUEVOS NO CHOCAN con los que ya hay, aunque no vayan seguidos', () => {
  eq(nuevoIdDeFase([F('f1'), F('f7'), F('x')]), 'f8');
  eq(nuevoIdDeFase([]), 'f1');
});

test('LO ROTO NO REVIENTA: una rama que cuelga de una fase que no está sigue a la anterior', () => {
  const f = [F('f1'), F('f2', { rama_de: 'nadie', rama_nombre: 'x' }), null, F('f3', { reune: ['f9'] })];
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3']);
  eq(grafoDe(null).raiz, null);
});

console.log('· reuniones y caminos, a fondo');

const de = (fases, id) => fases.find((x) => x.id === id);
const dibujada = (f) => ({ ...f, tramos: [{ id: `t_${f.id}` }] });

test('EL PRINCIPAL ENTRA EN UNA REUNIÓN POR DONDE SE DIBUJÓ, aunque se reúna con una fase de la segunda rama', () => {
  // f1 → f2 ─┬─ f3 (a) → f4 ···→ f6
  //          └─ f5 (b) → f6              reunir(f4, f6): la a sigue por la 2.ª fase de la b
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  f = insertarDetras(f, 'f5', F('f6'));
  f = reunir(f, 'f4', 'f6').fases;
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3', 'f4', 'f6']);
  eq(caminoHasta(f, 'f6'), ['f1', 'f2', 'f3', 'f4', 'f6'], 'se dibuja desde el principal, que es por donde se llega antes:');
  eq(grafoDe(f).antes.get('f6'), ['f4', 'f5']);
  eq(todosLosCaminos(f), [['f1', 'f2', 'f3', 'f4', 'f6'], ['f1', 'f2', 'f5', 'f6']]);
  eq(arbolDe(f).ramas.map((r) => [r.nombre, r.fases, r.sigueEn ?? null]), [['a', ['f3', 'f4', 'f6'], null], ['b', ['f5'], 'f6']], 'y en el árbol, donde se llega antes:');
});

test('SEPARAR DESDE LA QUE YA LLEGABA separa esa, no la otra', () => {
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;   // f3 (a) → f4 ; f5 (b)
  f = reunir(f, 'f5', 'f4').fases;
  eq([reunionesDe(f, 'f3'), reunionesDe(f, 'f5'), reunionesDe(f, 'f2')], [['f4'], ['f4'], []]);
  const r = separar(f, 'f3', 'f4');
  ok(r.fases, r.motivo);
  eq(todosLosCaminos(r.fases), [['f1', 'f2', 'f3'], ['f1', 'f2', 'f5', 'f4']], 'la a acaba en f3 y la b sigue por f4:');
  eq(reunionesDe(r.fases, 'f5'), [], 'y ya no es una reunión:');
});

test('SEPARAR LA RAMA QUE EMPEZABA EN LA REUNIÓN: deja de ser rama, y si el cruce se queda con una, esa tampoco', () => {
  let f = abrirRama([F('f1'), F('f2')], 'f2', { primera: 'a', nueva: 'b', crear }).fases;   // f2 → f3 (a) | f4 (b)
  f = reunir(f, 'f4', 'f3').fases;                                                          // la b sigue por f3
  for (const g of [separar(f, 'f2', 'f3').fases, quitarRama(f, 'f3').fases]) {
    eq(todosLosCaminos(g), [['f1', 'f2', 'f4', 'f3']], 'f3 sigue solo a la b, que ya no es rama:');
    eq([de(g, 'f3').rama_de, de(g, 'f4').rama_de, de(g, 'f4').rama_nombre], [null, null, null]);
    eq(esCruce(g, 'f2'), false);
  }
});

test('QUITAR LA RAMA QUE LLEGABA A UNA REUNIÓN: la fase sigue a la otra rama, que deja de serlo si queda sola', () => {
  // f1 → f2 ─┬─ f3 (a, vacía) → f4 (dibujada)
  //          └─ f5 (b, dibujada) → f4
  let f = abrirRama(lineal().map((x) => (x.id === 'f4' ? dibujada(x) : x)), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  f = f.map((x) => (x.id === 'f5' ? dibujada(x) : x));
  f = reunir(f, 'f5', 'f4').fases;
  const r = quitarRama(f, 'f3');
  ok(r.fases, r.motivo);
  eq(todosLosCaminos(r.fases), [['f1', 'f2', 'f5', 'f4']]);
  eq([de(r.fases, 'f5').rama_de, de(r.fases, 'f5').rama_nombre, esCruce(r.fases, 'f2')], [null, null, false]);
  /* Con tres que llegan, la que queda primera pasa a ser por donde se dibuja. */
  let t = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  t = abrirRama(t, 'f2', { nueva: 'c', crear }).fases;                                       // f5 (b), f6 (c)
  t = reunir(reunir(t, 'f5', 'f4').fases, 'f6', 'f4').fases;
  t = t.map((x) => (x.id === 'f4' ? dibujada(x) : x));
  const q = quitarRama(t, 'f3');
  eq(caminoHasta(q.fases, 'f4'), ['f1', 'f2', 'f5', 'f4']);
  eq(todosLosCaminos(q.fases), [['f1', 'f2', 'f5', 'f4'], ['f1', 'f2', 'f6', 'f4']]);
});

test('NO SE ABREN RAMAS en una fase que sigue por una reunión de otra rama; en la que ya llegaba, sí', () => {
  let f = abrirRama(lineal(), 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  f = reunir(f, 'f5', 'f4').fases;
  eq(abrirRama(f, 'f5', { primera: 'sigue', nueva: 'otra', crear }).motivo, 'esta fase sigue por una reunión: sepárala antes de abrir ramas');
  const r = abrirRama(f, 'f3', { primera: 'sigue', nueva: 'otra', crear });
  ok(r.fases, r.motivo);
  eq(todosLosCaminos(r.fases), [['f1', 'f2', 'f3', 'f4'], ['f1', 'f2', 'f3', 'f6'], ['f1', 'f2', 'f5', 'f4']]);
});

test('LO QUE DICE REUNE CON UNA SOLA FASE SE RESPETA, y sobra si ya lo dice el orden', () => {
  /* f4 va antes que f3 en la lista, pero la sigue: lo dice reune. */
  const f = [F('f1'), F('f2'), F('f4', { reune: ['f3'] }), F('f3', { reune: ['f2'] })];
  eq(caminoPrincipal(f), ['f1', 'f2', 'f3', 'f4']);
  const g = abrirRama(f, 'f2', { primera: 'uno', nueva: 'dos', crear }).fases;
  eq(siguientesDe(g, 'f2'), ['f3', 'f5']);
  eq([de(g, 'f3').rama_de, de(g, 'f3').reune, de(g, 'f4').reune], ['f2', [], ['f3']], 'al ser rama del cruce, su enlace sobra; el de f4, no:');
});

test('QUITAR UNA RAMA CON UN CRUCE DENTRO: lo que colgaba de él y se queda deja de ser rama', () => {
  // f1 → f2 ─┬─ f3 (a, vacía) ─┬─ f5 (a1)
  //          │                  └─ f6 (a2)
  //          └─ f4 (b) ··········→ f5
  let f = abrirRama([F('f1'), F('f2')], 'f2', { primera: 'a', nueva: 'b', crear }).fases;
  f = abrirRama(f, 'f3', { primera: 'a1', nueva: 'a2', crear }).fases;
  f = reunir(f, 'f4', 'f5').fases;
  f = f.map((x) => (x.id === 'f5' ? dibujada(x) : x));
  const r = quitarRama(f, 'f3');
  ok(r.fases, r.motivo);
  eq([de(r.fases, 'f5').rama_de, de(r.fases, 'f5').rama_nombre], [null, null]);
  eq(todosLosCaminos(r.fases), [['f1', 'f2', 'f4', 'f5']]);
});

test('UNA RAMA QUE EMPIEZA EN UNA REUNIÓN YA DIBUJADA dice en el árbol por dónde sigue', () => {
  // f1 ─┬─ f2 (a) ··········→ f5
  //     └─ f3 (b) ─┬─ f4 (b1)
  //                └─ f5 (b2)
  let f = abrirRama([F('f1')], 'f1', { primera: 'a', nueva: 'b', crear }).fases;
  f = abrirRama(f, 'f3', { primera: 'b1', nueva: 'b2', crear }).fases;
  f = reunir(f, 'f2', 'f5').fases;
  const a = arbolDe(f);
  eq(a.ramas[0].fases, ['f2', 'f5'], 'se dibuja donde se llega primero:');
  eq(a.ramas[1].ramas.map((r) => [r.nombre, r.fases, r.sigueEn ?? null]), [['b1', ['f4'], null], ['b2', [], 'f5']]);
});

test(`COMO MUCHO ${MAX_CAMINOS} CAMINOS: no se abre ni se reúne lo que pasaría de ahí`, () => {
  /* Cada vuelta: un cruce de dos que se reúnen detrás. Dobla los caminos. */
  const doblar = (fases, veces) => {
    let f = fases;
    for (let k = 0; k < veces; k++) {
      const fin = caminoPrincipal(f).at(-1);
      const r = abrirRama(f, fin, { primera: 'a', nueva: 'b', crear });
      ok(r.fases, r.motivo);
      const [a, b] = r.nuevas;
      f = insertarDetras(r.fases, a, F(nuevoIdDeFase(r.fases)));
      f = reunir(f, b, f[f.findIndex((x) => x.id === a) + 1].id).fases;
    }
    return f;
  };
  const f = doblar([F('f1')], 6);
  eq([cuantosCaminos(f), todosLosCaminos(f).length], [64, 64]);
  eq(abrirRama(f, caminoPrincipal(f).at(-1), { primera: 'a', nueva: 'b', crear }).motivo, `la jugada tendría más de ${MAX_CAMINOS} caminos distintos: son demasiados para verlos`);
  /* Reunir también multiplica: 16 caminos llegan a un cruce de tres. */
  let g = doblar([F('f1')], 4);
  const fin = caminoPrincipal(g).at(-1);
  let r = abrirRama(g, fin, { primera: 'a', nueva: 'b', crear });
  const [a, b] = r.nuevas;
  g = abrirRama(r.fases, fin, { nueva: 'c', crear }).fases;
  g = abrirRama(g, a, { primera: 'a1', nueva: 'a2', crear }).fases;
  eq(cuantosCaminos(g), 64);
  eq(reunir(g, b, a).motivo, `la jugada tendría más de ${MAX_CAMINOS} caminos distintos: son demasiados para verlos`);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
