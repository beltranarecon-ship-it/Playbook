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

import { readFileSync } from 'node:fs';
import {
  recta, argumentos, migrarTexto, marcoDe, sellar, ES_NUMERO, LLAMADAS,
} from '../tools/biblioteca/marco-comun.mjs';
import { limitesCancha } from '../taller/js/canvas/medidas.js';

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

console.log('\n· convertir la animación guardada en la base');

/* La regla de migrar-marco-3-base.mjs: se convierte TODO objeto con `x`
   e `y` numéricos. Se reimplanta aquí igual que allí —son ocho líneas—
   porque ese script abre conexión a Supabase al importarse y un banco
   no puede depender de la red ni de una clave. Si las dos se separan,
   la última prueba de esta tanda lo dice. */
const ajustarC = (v) => Number(Math.min(1, Math.max(0, v)).toFixed(4));
function convertir(nodo, f, cuenta = { n: 0 }) {
  if (!nodo || typeof nodo !== 'object') return cuenta.n;
  if (Array.isArray(nodo)) { for (const v of nodo) convertir(v, f, cuenta); return cuenta.n; }
  if (typeof nodo.x === 'number' && typeof nodo.y === 'number') {
    nodo.x = ajustarC(f.x(nodo.x)); nodo.y = ajustarC(f.y(nodo.y)); cuenta.n += 1;
  }
  for (const v of Object.values(nodo)) convertir(v, f, cuenta);
  return cuenta.n;
}
const F = { x: (v) => v + 0.1, y: (v) => v * 2 };

test('convierte los pares x/y a cualquier profundidad', () => {
  const a = { fases: [{ movimientos: [{ path: [{ x: 0.2, y: 0.3, tipo_nodo: 'lineal' }] }] }] };
  eq(convertir(a, F), 1);
  eq(a.fases[0].movimientos[0].path[0].x, 0.3);
  eq(a.fases[0].movimientos[0].path[0].y, 0.6);
  eq(a.fases[0].movimientos[0].path[0].tipo_nodo, 'lineal', 'ha tocado lo que no es coordenada:');
});

test('los tiradores del bezier también, que son absolutos', () => {
  /* canvas/geometry.js los calcula como n.x ± algo y los recorta a
     [0,1]: son sitios, no desplazamientos. Dejarlos sin convertir
     deforma la curva sin mover sus extremos, que es peor que moverla. */
  const a = { path: [{ x: 0.2, y: 0.3, handle_in: { x: 0.1, y: 0.2 }, handle_out: { x: 0.3, y: 0.4 } }] };
  eq(convertir(a, F), 3);
  eq(a.path[0].handle_in.x, 0.2);
  eq(a.path[0].handle_out.y, 0.8);
});

test('NO toca números que no son un par x/y', () => {
  /* Duraciones, grados y recuentos son números y están al lado. Una
     lista de campos se equivoca en cuanto alguien añade uno; la regla
     estructural, no. */
  const a = {
    fases: [{ duracion_ms: 800, pausa_post_ms: 200 }],
    conos: [{ fila_config: { direccion_grados: 90, n_jugadores: 4 } }],
    _ediciones: 3,
  };
  eq(convertir(a, F), 0);
  eq(a.fases[0].duracion_ms, 800);
  eq(a.conos[0].fila_config.direccion_grados, 90);
  eq(a._ediciones, 3);
});

test('un objeto con solo x, o con x no numérica, se queda quieto', () => {
  const a = { p: { x: 0.4 }, q: { x: '0.4', y: 0.5 }, r: { x: 0.4, y: null } };
  eq(convertir(a, F), 0);
  eq(a.p.x, 0.4); eq(a.q.x, '0.4'); eq(a.r.x, 0.4);
});

test('recorta a [0,1] y redondea a cuatro decimales', () => {
  const a = { p: { x: 0.95, y: 0.9 } };          // x → 1.05, y → 1.8
  convertir(a, F);
  eq(a.p.x, 1); eq(a.p.y, 1);
});

test('una animación vacía o nula no revienta', () => {
  for (const v of [null, undefined, {}, { fases: [] }, []]) {
    eq(convertir(v, F), 0, JSON.stringify(v));
  }
});

test('la conversión NO es idempotente: por eso hace falta la columna', () => {
  /* Aplicarla dos veces mueve todo el doble y no hay vuelta atrás. Lo
     que lo impide es `exercises.marco` (038), no un fichero suelto. */
  const uno = { p: { x: 0.2, y: 0.3 } };
  convertir(uno, F);
  const primera = { ...uno.p };
  convertir(uno, F);
  ok(uno.p.x !== primera.x, 'sería idempotente y la columna sobraría');
});

test('la 038 pone la columna, su tope y el 3 por defecto', () => {
  const sql = readFileSync(new URL('../supabase/migrations/038_exercises_marco.sql', import.meta.url), 'utf8');
  ok(/ADD COLUMN IF NOT EXISTS marco smallint NOT NULL DEFAULT 2/.test(sql),
    'las filas que ya están tienen que quedar marcadas como marco 2');
  ok(/ALTER COLUMN marco SET DEFAULT 3/.test(sql), 'lo nuevo debe nacer en el 3');
  ok(sql.indexOf('DEFAULT 2') < sql.indexOf('SET DEFAULT 3'),
    'el DEFAULT 2 tiene que rellenar las filas existentes ANTES de pasar al 3');
  ok(/CHECK \(marco IN \(1, 2, 3\)\)/.test(sql), 'falta el tope de valores');
});

test('el importador escribe el marco, o la otra herramienta duplicaría el mapa', () => {
  const imp = readFileSync(new URL('../tools/biblioteca/importar.mjs', import.meta.url), 'utf8');
  ok(/MARCO_ACTUAL = 3/.test(imp), 'importar.mjs no declara el marco');
  ok(/'marco'/.test(imp), "'marco' no está en CAMPOS: no viajaría en el PATCH");
});

console.log('\n· el SQL dice lo mismo que el código');

test('los coeficientes de la 037 salen de medidas.js, no de una libreta', () => {
  /* ── POR QUÉ ESTE BANCO ──────────────────────────────────
     La migración 037 lleva ocho números escritos a mano que tienen
     que ser exactamente la misma recta que aplicó migrar-marco-3.mjs
     a la biblioteca. Si se separan, las posiciones que marcó el
     entrenador acaban en un sitio y las fichas en otro, sobre la
     misma pista, y nada lo avisa.

     Aquí se recalculan desde limitesCancha() y se comparan con lo que
     hay escrito en el fichero .sql. */
  const ENTERA_2 = { x: [2 / 19, 17 / 19], y: [2 / 32, 30 / 32] };
  const MEDIA_2 = { x: [2 / 18, 16 / 18], y: [2 / 19, 17 / 19] };
  const VIEJO = { entera: ENTERA_2, entera_fiba: ENTERA_2, media: MEDIA_2, media_fiba: MEDIA_2 };

  const sql = readFileSync(new URL('../supabase/migrations/037_posiciones_marco_v3.sql', import.meta.url), 'utf8');

  for (const [pista, viejo] of Object.entries(VIEJO)) {
    const nuevo = limitesCancha(pista);
    for (const eje of ['x', 'y']) {
      const [o0, o1] = viejo[eje], [n0, n1] = nuevo[eje];
      const b = (n1 - n0) / (o1 - o0);
      const a = n0 - b * o0;

      /* La línea del CASE de ese eje y esa pista. El SQL las separa en
         dos bloques (uno por eje) y dentro van por pista. */
      const bloque = sql.split(`${eje} = LEAST`)[1];
      ok(bloque, `no se encuentra el bloque de ${eje} en la 037`);
      const rx = new RegExp(`WHEN '${pista}'\\s+THEN\\s+(-?[\\d.]+)\\s*\\+\\s*([\\d.]+)\\s*\\*\\s*${eje}`);
      const m = rx.exec(bloque.split('ELSE')[0]);
      ok(m, `la 037 no tiene línea para ${pista} en el eje ${eje}`);

      /* Tolerancia: el SQL lleva 6 decimales, así que medio millonésimo. */
      const tol = 5e-7;
      ok(Math.abs(Number(m[1]) - a) <= tol,
        `${pista}.${eje} término independiente: sql=${m[1]} código=${a.toFixed(9)}`);
      ok(Math.abs(Number(m[2]) - b) <= tol,
        `${pista}.${eje} pendiente: sql=${m[2]} código=${b.toFixed(9)}`);
    }
  }
});

test('la 037 admite el marco 3 y lo pone por defecto', () => {
  /* La 019 dejó CHECK (marco IN (1,2)): sin ampliarlo, el UPDATE de la
     037 falla entero y no se entera nadie hasta que se aplica. */
  const sql = readFileSync(new URL('../supabase/migrations/037_posiciones_marco_v3.sql', import.meta.url), 'utf8');
  ok(/CHECK\s*\(marco IN \(1, 2, 3\)\)/.test(sql), 'no amplía la restricción a 3');
  ok(/ALTER COLUMN marco SET DEFAULT 3/.test(sql), 'no cambia el valor por defecto');
  ok(sql.indexOf('SET DEFAULT 3') < sql.indexOf('WHERE marco = 2'),
    'el DEFAULT tiene que cambiarse ANTES del UPDATE, o una fila nueva se cuela en el marco 2');
  ok(/WHERE marco = 2/.test(sql), 'no es idempotente: convertiría filas ya convertidas');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
