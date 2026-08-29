/* ============================================================
   eval-marco.mjs — banco del analizador que reescribe coordenadas
   dentro de las tandas (tools/biblioteca/marco-comun.mjs).
   Sin red, sin DOM, sin ficheros.

     node tools/eval-marco.mjs

   ── POR QUÉ ESTE BANCO ──────────────────────────────────────
   Este analizador toca 1742 números repartidos por 17 ficheros, de
   una sola pasada y sin que nadie los mire después. Si se equivoca en
   qué es una coordenada, el error no sale por ningún lado: sale meses
   más tarde, cuando alguien abre una ficha y ve un cono en la grada.

   Lo que vigila, en orden de lo que más daño haría:

     1. Que NO toque expresiones. `M.codo_der[0] - 0.06` es un
        desplazamiento relativo a un ancla que ya se mueve sola;
        reescribirlo movería la ficha dos veces.
     2. Que no se despiste con comas dentro de textos ni con
        paréntesis anidados — ahí es donde un analizador ingenuo
        empieza a contar mal los argumentos.
     3. Que cada ficha use el mapa de SU pista: las cuatro tienen
        marcos distintos y aplicar el que no toca desplaza todo.
     4. Que el sello de marco impida aplicar la migración dos veces.
   ============================================================ */

import {
  recta, argumentos, migrarTexto, marcoDe, sellar, ES_NUMERO, LLAMADAS,
} from '../tools/biblioteca/marco-comun.mjs';

let pasan = 0, fallan = 0;
function test(nombre, fn) {
  try { fn(); pasan++; console.log(`  ✓ ${nombre}`); }
  catch (e) { fallan++; console.error(`  ✗ ${nombre}\n      ${e.message}`); }
}
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (real, esp, msg = '') => {
  if (real !== esp) throw new Error(`${msg} esperado=${JSON.stringify(esp)} real=${JSON.stringify(real)}`);
};

/* Un mapa de juguete: x se desplaza +0,1 y y se dobla. Números feos a
   propósito, para que cualquier confusión de ejes cante. */
const MAPA = {
  entera: { x: (v) => Number((v + 0.1).toFixed(4)), y: (v) => Number((v * 2).toFixed(4)) },
  media:  { x: (v) => Number((v - 0.05).toFixed(4)), y: (v) => Number((v / 2).toFixed(4)) },
};
const migra = (t) => migrarTexto(t, MAPA).texto;

console.log('\n· la recta lleva las líneas conocidas a su sitio');

test('lleva los dos extremos exactamente, y el punto medio al medio', () => {
  const f = recta([0.2, 0.8], [0.1, 0.9]);
  eq(+f(0.2).toFixed(6), 0.1);
  eq(+f(0.8).toFixed(6), 0.9);
  eq(+f(0.5).toFixed(6), 0.5);
});

test('un punto fuera del campo sigue fuera, y del mismo lado', () => {
  /* Importa: un cono en la banda tiene que seguir en la banda. */
  const f = recta([0.2, 0.8], [0.1, 0.9]);
  ok(f(0.1) < 0.1, 'se ha metido dentro por la izquierda');
  ok(f(0.9) > 0.9, 'se ha metido dentro por la derecha');
});

console.log('\n· el analizador de argumentos');

test('separa por comas de nivel 0 y devuelve dónde cierra', () => {
  const s = "jug('A', 1, 0.34, 0.66)";
  const r = argumentos(s, s.indexOf('('));
  eq(r.args.length, 4);
  eq(s.slice(...r.args[2]).trim(), '0.34');
  eq(s[r.fin], ')');
});

test('una coma DENTRO de un texto no parte el argumento', () => {
  const s = "jug('base, tirador', 1, 0.34, 0.66)";
  const r = argumentos(s, s.indexOf('('));
  eq(r.args.length, 4, 'la coma del texto ha contado como separador:');
  eq(s.slice(...r.args[3]).trim(), '0.66');
});

test('los paréntesis y corchetes anidados no descuadran la cuenta', () => {
  const s = 'jug(nombre(x), [1, 2], 0.3, 0.4)';
  const r = argumentos(s, s.indexOf('('));
  eq(r.args.length, 4);
  eq(s.slice(...r.args[2]).trim(), '0.3');
});

test('si el paréntesis no cierra, se devuelve null y no se toca nada', () => {
  const s = "jug('A', 1, 0.3, 0.4";
  eq(argumentos(s, s.indexOf('(')), null);
});

test('ES_NUMERO acepta un número suelto y rechaza cualquier expresión', () => {
  for (const bueno of ['0.34', ' 0.34 ', '-0.2', '.5', '1']) {
    ok(ES_NUMERO.test(bueno), `debería aceptar «${bueno}»`);
  }
  for (const malo of ['M.codo_der[0]', '0.3 - 0.06', 'x', '0.3+0', "'0.3'"]) {
    ok(!ES_NUMERO.test(malo), `NO debería aceptar «${malo}»`);
  }
});

console.log('\n· qué se reescribe');

test('jug: los dos últimos, no el dorsal', () => {
  const t = "tipo_pista: 'entera'\njug('A', 1, 0.30, 0.40)";
  eq(migra(t), "tipo_pista: 'entera'\njug('A', 1, 0.4, 0.8)");
});

test('balon y cono: los dos argumentos', () => {
  const t = "tipo_pista: 'entera'\nbalon(0.30, 0.40) cono(0.20, 0.10)";
  eq(migra(t), "tipo_pista: 'entera'\nbalon(0.4, 0.8) cono(0.3, 0.2)");
});

test('fila: los dos primeros, y los de después se quedan', () => {
  const t = "tipo_pista: 'entera'\nfila(0.30, 0.40, 3, 0)";
  eq(migra(t), "tipo_pista: 'entera'\nfila(0.4, 0.8, 3, 0)");
  eq(LLAMADAS.fila, 0);
});

test('hacia: { x, y } también, en cualquier orden y con espacios', () => {
  const t = "tipo_pista: 'entera'\nhacia: { y: 0.40, x: 0.30 }";
  eq(migra(t), "tipo_pista: 'entera'\nhacia: { y: 0.8, x: 0.4 }");
});

console.log('\n· qué NO se reescribe (lo que más daño haría)');

test('una expresión con un ancla se queda intacta', () => {
  /* El ancla ya se mueve sola desde medidas.js. Tocar el −0.06
     movería la ficha dos veces. */
  const t = "tipo_pista: 'entera'\njug('A', 1, M.codo_der[0] - 0.06, 0.40)";
  eq(migra(t), "tipo_pista: 'entera'\njug('A', 1, M.codo_der[0] - 0.06, 0.8)",
    'debería tocar SOLO la y');
});

test('sin tipo_pista delante no se toca nada', () => {
  const t = 'jug(\'A\', 1, 0.30, 0.40)';
  eq(migra(t), t);
});

test('una pista que no está en el mapa se deja como está', () => {
  const t = "tipo_pista: 'media_fiba'\njug('A', 1, 0.30, 0.40)";
  eq(migra(t), t);
});

test('los números de duración, dorsal o repeticiones no se tocan', () => {
  const t = "tipo_pista: 'entera'\nduracion_min: 8, intensidad: 4, series: 3";
  eq(migra(t), t);
});

console.log('\n· cada ficha con el mapa de SU pista');

test('el tipo_pista cambia el contexto según se avanza', () => {
  const t = "tipo_pista: 'entera'\nbalon(0.30, 0.40)\n"
          + "tipo_pista: 'media'\nbalon(0.30, 0.40)";
  eq(migra(t), "tipo_pista: 'entera'\nbalon(0.4, 0.8)\n"
             + "tipo_pista: 'media'\nbalon(0.25, 0.2)");
});

test('reescribir dos veces NO es lo mismo que reescribir una', () => {
  /* Es el motivo de que exista el sello: el mapa no es idempotente y
     aplicarlo dos veces mueve todo el doble sin forma de deshacerlo. */
  const t = "tipo_pista: 'entera'\nbalon(0.30, 0.40)";
  ok(migra(migra(t)) !== migra(t), 'sería idempotente y el sello sobraría');
});

console.log('\n· el sello de marco');

test('sin sello se asume el marco 2, que es donde están las tandas', () => {
  eq(marcoDe('export const TANDA = []'), 2);
});

test('un texto sellado dice su marco', () => {
  eq(marcoDe('/* marco: 3 */\nexport const TANDA = []'), 3);
  eq(marcoDe('/*marco:3*/\nx'), 3);
});

test('sellar pone el sello arriba y no lo duplica al repetir', () => {
  const uno = sellar('export const TANDA = []', 3);
  ok(uno.startsWith('/* marco: 3 */'), uno.slice(0, 30));
  const dos = sellar(uno, 4);
  eq(marcoDe(dos), 4);
  eq((dos.match(/marco:/g) || []).length, 1, 'ha dejado dos sellos:');
});

test('un shebang sigue siendo la primera línea', () => {
  /* `piloto.mjs` empieza por #!/usr/bin/env node, que solo vale arriba
     del todo. Poner el sello encima lo convertía en código y Node se
     negaba a cargar el fichero. */
  const t = sellar('#!/usr/bin/env node\nexport const P = []', 3);
  ok(t.startsWith('#!/usr/bin/env node\n'), `el shebang ya no es la primera línea:\n${t.slice(0, 40)}`);
  eq(marcoDe(t), 3);
  eq(t.split('\n')[1], '/* marco: 3 */');
});

test('resellar un fichero con shebang tampoco lo mueve', () => {
  const uno = sellar('#!/usr/bin/env node\nexport const P = []', 3);
  const dos = sellar(uno, 4);
  ok(dos.startsWith('#!/usr/bin/env node\n'), dos.slice(0, 40));
  eq(marcoDe(dos), 4);
  eq((dos.match(/marco:/g) || []).length, 1, 'ha dejado dos sellos:');
});

test('el sello no se pierde al migrar el texto', () => {
  const t = sellar("tipo_pista: 'entera'\nbalon(0.30, 0.40)", 2);
  ok(migra(t).startsWith('/* marco: 2 */'), 'se ha comido el sello');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
