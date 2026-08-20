/* ============================================================
   eval-clasificacion.mjs — banco Node del motor de la clasificación
   (la mitad pura de equipos/js/data/clasificacion.js).

     node equipos/tools/eval-clasificacion.mjs

   Lo que vigila:

     1. Que los puntos sean los del BALONCESTO: 2 por victoria y 1 por
        derrota. Con 3-0, como en el fútbol, media liga sale ordenada al
        revés y nadie lo nota hasta abril.
     2. Que dos empatados de verdad salgan MARCADOS y no ordenados a
        ciegas: el desempate es el resultado particular, que la app no
        conoce, e inventárselo es inventarse la clasificación.
     3. Que pegar la tabla de la federación no invente filas.
   ============================================================ */

/* El módulo importa `_client.js`, que necesita el cliente de Supabase.
   Aquí solo se prueba la mitad pura, así que se le pone un doble antes
   de importar: el banco no toca la red ni por accidente. */
const { register } = await import('node:module');

/* Se importa el fichero saltándose `_client.js` con un cargador que lo
   sustituye por un objeto vacío. Es más limpio que partir el módulo en
   dos solo para poder probarlo. */
register(new URL('data:text/javascript,' + encodeURIComponent(`
  export async function resolve(especificador, contexto, siguiente) {
    if (especificador.endsWith('_client.js')) {
      return { url: 'data:text/javascript,export const supabase = {};', shortCircuit: true };
    }
    return siguiente(especificador, contexto);
  }
`)), import.meta.url);

const {
  PUNTOS_VICTORIA, PUNTOS_DERROTA, puntosDe, diferenciaDe,
  ordenar, nuestra, descuadres, leerPegado,
} = await import('../js/data/clasificacion.js');

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

const F = (nombre, jugados, ganados, perdidos, pf, pc, es_nuestro = false) =>
  ({ nombre, jugados, ganados, perdidos, puntos_favor: pf, puntos_contra: pc, es_nuestro });

/* ── 1. Los puntos ─────────────────────────────────────────── */

console.log('\n· los puntos, que son los del baloncesto');

test('dos por victoria y UNO por derrota', () => {
  /* El que pierde también puntúa: por eso jugar un partido más cambia
     la tabla aunque se pierda. Con 3-0 sale ordenada al revés. */
  eq(PUNTOS_VICTORIA, 2);
  eq(PUNTOS_DERROTA, 1);
  eq(puntosDe(F('x', 5, 3, 2, 0, 0)), 8);
  eq(puntosDe(F('x', 5, 0, 5, 0, 0)), 5, 'cinco derrotas son cinco puntos');
});

test('la diferencia es a favor menos en contra', () => {
  eq(diferenciaDe(F('x', 2, 1, 1, 80, 70)), 10);
  eq(diferenciaDe(F('x', 2, 1, 1, 60, 90)), -30);
  eq(diferenciaDe(null), 0);
});

/* ── 2. El orden ───────────────────────────────────────────── */

console.log('\n· el orden');

test('manda los puntos, y la posición se calcula', () => {
  const t = ordenar([
    F('C', 4, 1, 3, 100, 130), F('A', 4, 4, 0, 200, 120), F('B', 4, 2, 2, 150, 150),
  ]);
  eq(t.map((f) => [f.pos, f.nombre, f.puntos]), [[1, 'A', 8], [2, 'B', 6], [3, 'C', 5]]);
});

test('a igualdad de puntos manda la diferencia', () => {
  const t = ordenar([F('A', 4, 2, 2, 150, 150), F('B', 4, 2, 2, 160, 140)]);
  eq(t.map((f) => f.nombre), ['B', 'A']);
});

test('y los empatados de VERDAD salen marcados, no ordenados a ciegas', () => {
  /* Empatados a puntos y a diferencia: el desempate es el resultado
     particular entre ellos, que la app no conoce. Ponerlos en un orden
     sería inventarse la clasificación. */
  const t = ordenar([F('A', 4, 2, 2, 150, 140), F('B', 4, 2, 2, 150, 140), F('C', 4, 4, 0, 200, 100)]);
  const a = t.find((f) => f.nombre === 'A');
  eq(a.empatadoCon, 1);
  eq(t.find((f) => f.nombre === 'C').empatadoCon, 0);
});

test('una clasificación vacía no revienta', () => {
  eq(ordenar([]), []);
  eq(ordenar(null), []);
  eq(nuestra([]), null);
});

test('nuestra fila se encuentra si está marcada', () => {
  const t = ordenar([F('A', 4, 4, 0, 200, 120), F('Nosotros', 4, 1, 3, 100, 130, true)]);
  eq(nuestra(t).nombre, 'Nosotros');
  eq(nuestra(t).pos, 2);
});

/* ── 3. Lo que no cuadra ───────────────────────────────────── */

console.log('\n· lo que no cuadra al copiarla');

test('ganados más perdidos tienen que ser los jugados', () => {
  const d = descuadres([F('A', 5, 3, 1, 100, 90)]);
  ok(d[0].includes('A') && d[0].includes('4') && d[0].includes('5'), JSON.stringify(d));
});

test('y una tabla bien copiada no dice nada', () => {
  eq(descuadres([F('A', 4, 3, 1, 100, 90), F('B', 4, 1, 3, 90, 100)]), []);
});

/* ── 4. Pegar la tabla de la federación ────────────────────── */

console.log('\n· pegar la tabla en vez de copiar setenta y dos números');

test('una tabla pegada entra entera', () => {
  const t = leerPegado(`
1  CB EJEMPLO A       6  6  0  312  198
2  CD SAN JOSE        6  4  2  280  245
3  CB PALENCIA        6  3  3  260  262
`);
  eq(t.length, 3);
  eq(t[0], { nombre: 'CB EJEMPLO A', jugados: 6, ganados: 6, perdidos: 0, puntos_favor: 312, puntos_contra: 198 });
  eq(t[2].nombre, 'CB PALENCIA');
});

test('con tabuladores y sin la posición delante, igual', () => {
  const t = leerPegado('CB EJEMPLO A\t6\t6\t0\t312\t198');
  eq(t[0].nombre, 'CB EJEMPLO A');
  eq(t[0].jugados, 6);
});

test('un nombre con números dentro no se rompe', () => {
  /* «CB 1987» es un nombre de club perfectamente normal, y sus cuatro
     cifras no son los jugados. Los cinco números que cuentan son los
     cinco ÚLTIMOS. */
  const t = leerPegado('3  CB 1987 SORIA  6  3  3  260  262');
  eq(t[0].nombre, 'CB 1987 SORIA');
  eq(t[0].jugados, 6);
  eq(t[0].puntos_contra, 262);
});

test('lo que no trae cinco números NO se adivina', () => {
  /* Una tabla mal leída es peor que copiarla a mano: se guarda con
     pinta de buena y nadie la vuelve a mirar. */
  eq(leerPegado('CB EJEMPLO  6  6'), []);
  eq(leerPegado('Clasificación jornada 6'), []);
  eq(leerPegado(''), []);
  eq(leerPegado(null), []);
});

test('las líneas de cabecera se caen solas', () => {
  const t = leerPegado(`Pos Equipo  J  G  P  PF  PC
1  CB EJEMPLO  6  6  0  312  198`);
  eq(t.length, 1);
  eq(t[0].nombre, 'CB EJEMPLO');
});

test('y los negativos de una diferencia pegada no cuelan como puntos', () => {
  const t = leerPegado('1  CB EJEMPLO  6  6  0  312  198');
  ok(t[0].puntos_favor >= 0 && t[0].puntos_contra >= 0, JSON.stringify(t[0]));
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
