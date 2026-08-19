/* ============================================================
   eval-acta.mjs — banco Node del acta del partido
   (equipos/js/data/acta.js). Sin red, sin DOM.

     node equipos/tools/eval-acta.mjs

   Lo que vigila: que los descuadres se DIGAN y no se arreglen solos.
   Un acta copiada a mano con un número mal se arregla mirando el
   papel; si la app elige por su cuenta cuál de los dos números era el
   bueno, el error deja de ser visible y pasa a ser permanente.

   Y que todo esté en PERIODOS. En minibasket no se juegan minutos, y
   una sola cuenta en minutos aquí contagiaría al reglamento (4.3) y a
   las estadísticas (4.4).
   ============================================================ */

import {
  PERIODOS_DEFECTO, FALTAS_MAX, filaVacia, periodosDe, totales,
  sumaPeriodos, descuadres, loQueFalta, textoFila, saneaFila, saneaCuartos,
  rejillaDe, jugoEn, recuenta, alterna, enPista, enLosPrimeros,
} from '../js/data/acta.js';

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

/* Un minibasket de seis periodos que acabó 38-30. */
const PARTIDO = {
  id: 'm1', rival: 'CB Rival', periodos: 6,
  marcador_favor: 38, marcador_contra: 30,
  marcador_cuartos: [
    { favor: 6, contra: 5 }, { favor: 8, contra: 4 }, { favor: 5, contra: 7 },
    { favor: 7, contra: 6 }, { favor: 6, contra: 4 }, { favor: 6, contra: 4 },
  ],
};
const F = (nombre, jug, des, pts, fal) => ({
  player_id: nombre, nombre, dorsal: 4,
  periodos_jugados: jug, periodos_descansados: des, puntos: pts, faltas: fal,
});
const FILAS = [F('Ana', 4, 2, 12, 2), F('Bruno', 3, 3, 10, 1), F('Carla', 5, 1, 16, 0)];

/* ── 1. Todo en periodos ───────────────────────────────────── */

console.log('\n· periodos, no minutos');

test('seis por defecto, que es lo que se juega en minibasket', () => {
  eq(PERIODOS_DEFECTO, 6);
  eq(periodosDe({}), 6);
  eq(periodosDe(null), 6);
  /* `periodos: null` es como sale de la base de datos mientras nadie lo
     toque. `Number(null)` es 0, y 0 recortado al mínimo daba UN
     periodo: el acta se pintaba con una sola columna. */
  eq(periodosDe({ periodos: null }), 6);
  eq(periodosDe({ periodos: 0 }), 6);
});

test('pero manda lo que diga el partido', () => {
  /* Un amistoso contra un cadete se juega como se acuerde: el acta
     dice lo que pasó, no lo que debería haber pasado. */
  eq(periodosDe({ periodos: 4 }), 4);
  eq(periodosDe({ periodos: 99 }), 12, 'con tope');
});

test('la fila en blanco arranca a cero y con su dorsal', () => {
  eq(filaVacia({ id: 'p1', nombre: 'Ana', dorsal: 7 }), {
    player_id: 'p1', nombre: 'Ana', dorsal: 7, periodos: [],
    periodos_jugados: 0, periodos_descansados: 0, puntos: 0, faltas: 0,
  });
});

/* ── 1 bis. La rejilla ───────────────────────────────── */

console.log('\n· la rejilla, que es lo que dice el acta de verdad');

const R = (nombre, periodos, pts = 0, fal = 0) => recuenta(
  { player_id: nombre, nombre, dorsal: 4, periodos, puntos: pts, faltas: fal }, PARTIDO,
);

test('se lee ordenada y sin repetidos', () => {
  eq(rejillaDe({ periodos: [4, 1, 4, 2] }), [1, 2, 4]);
  eq(rejillaDe({ periodos: [0, 99, 'x', null] }), [], 'lo imposible se cae');
  eq(rejillaDe(null), []);
});

test('los contadores se DERIVAN de ella: no hay dos versiones de lo mismo', () => {
  const f = recuenta({ periodos: [1, 2, 4], periodos_jugados: 99 }, PARTIDO);
  eq(f.periodos_jugados, 3);
  eq(f.periodos_descansados, 3, 'los seis menos los tres');
});

test('pero un acta sin rejilla conserva su contador', () => {
  /* Un acta dictada al chat (4.2) da «jugó cuatro periodos» y no cuáles.
     Poner cero porque la rejilla esté vacía borraría el dato bueno. */
  const f = recuenta({ periodos: [], periodos_jugados: 4, periodos_descansados: 2 }, PARTIDO);
  eq(f.periodos_jugados, 4);
});

test('marcar y desmarcar un periodo', () => {
  let f = filaVacia({ id: 'p1', nombre: 'Ana' });
  f = alterna(f, 3, PARTIDO);
  ok(jugoEn(f, 3) && f.periodos_jugados === 1, JSON.stringify(f));
  f = alterna(f, 3, PARTIDO);
  ok(!jugoEn(f, 3) && rejillaDe(f).length === 0, JSON.stringify(f));
});

test('y desmarcar el ÚLTIMO deja el contador a cero, no el de antes', () => {
  /* Tocar la rejilla la convierte en la verdad: vacía quiere decir «no
     jugó». Con el contador viejo puesto, el que se desmarca del todo no
     sale nunca del acta y se queda como si hubiera jugado dos periodos. */
  const f = alterna(R('Ana', [4]), 4, PARTIDO);
  eq(f.periodos_jugados, 0);
  eq(f.periodos_descansados, 6);
});

test('en pista hay cinco, y la columna lo dice', () => {
  const filas = [R('a', [1, 2]), R('b', [1, 2]), R('c', [1]), R('d', [2]), R('e', [1, 2])];
  eq(enPista(filas, 1), 4);
  eq(enPista(filas, 2), 4);
  eq(enPista(filas, 6), 0);
});

test('de los cinco primeros: lo que necesita el reglamento (4.3)', () => {
  /* Jugó el 1, el 2 y el 6: dos de los cinco primeros, y tres
     descansados de esos cinco. El sexto no cuenta para la regla. */
  eq(enLosPrimeros(R('Ana', [1, 2, 6]), 5, PARTIDO), { jugados: 2, descansados: 3, de: 5 });
});

test('y si no hay rejilla, no se contesta en vez de inventarse el acta', () => {
  eq(enLosPrimeros({ periodos: [], periodos_jugados: 4 }, 5, PARTIDO), null);
});

/* ── 2. Los totales ────────────────────────────────────────── */

console.log('\n· lo que suma');

test('los puntos y las faltas de las filas', () => {
  const t = totales(FILAS);
  eq(t.puntos, 38);
  eq(t.faltas, 3);
  eq(t.jugadores, 3);
  eq(t.conPeriodos, 3);
});

test('y el marcador por periodos', () => {
  eq(sumaPeriodos(PARTIDO.marcador_cuartos), { favor: 38, contra: 30 });
  eq(sumaPeriodos([]), { favor: 0, contra: 0 });
  eq(sumaPeriodos(null), { favor: 0, contra: 0 });
});

/* ── 3. Los descuadres ─────────────────────────────────────── */

console.log('\n· que los números cuadren');

test('un acta que cuadra no dice nada', () => {
  eq(descuadres(PARTIDO, FILAS), []);
});

test('si los puntos de los jugadores no suman el marcador, se dice con los dos números', () => {
  const d = descuadres({ ...PARTIDO, marcador_favor: 40 }, FILAS);
  ok(d.some((x) => x.campo === 'puntos' && x.texto.includes('38') && x.texto.includes('40')), JSON.stringify(d));
});

test('ni se corrige solo: se arregla mirando el papel', () => {
  /* El acta que entra sale igual: nadie decide por su cuenta cuál de
     los dos números era el bueno. */
  const filas = JSON.parse(JSON.stringify(FILAS));
  descuadres({ ...PARTIDO, marcador_favor: 40 }, filas);
  eq(filas, FILAS);
});

test('el marcador por periodos tiene que sumar el final, en los dos lados', () => {
  const malo = { ...PARTIDO, marcador_cuartos: [...PARTIDO.marcador_cuartos.slice(0, 5), { favor: 9, contra: 9 }] };
  const d = descuadres(malo, FILAS);
  eq(d.filter((x) => x.campo === 'marcador_cuartos').length, 2, 'el nuestro y el suyo');
});

test('y tantos periodos como tenga el partido', () => {
  const d = descuadres({ ...PARTIDO, marcador_cuartos: PARTIDO.marcador_cuartos.slice(0, 4) }, FILAS);
  ok(d.some((x) => x.campo === 'periodos'), JSON.stringify(d));
});

test('nadie juega y descansa más periodos de los que hay', () => {
  const d = descuadres(PARTIDO, [F('Ana', 5, 3, 0, 0)]);
  ok(d.some((x) => x.texto.includes('Ana') && x.texto.includes('8')), JSON.stringify(d));
});

test('ni tiene más faltas de las que se permiten', () => {
  eq(FALTAS_MAX, 5);
  const d = descuadres(PARTIDO, [F('Ana', 4, 2, 0, 7)]);
  ok(d.some((x) => x.texto.includes('7 faltas')), JSON.stringify(d));
});

test('sin marcador no se inventa un descuadre', () => {
  eq(descuadres({ periodos: 6 }, FILAS), []);
  eq(descuadres(null, null), []);
});

/* ── 4. Lo que falta ───────────────────────────────────────── */

console.log('\n· lo que falta, que no es lo mismo que un error');

test('un acta a medias dice qué le falta', () => {
  const f = loQueFalta({ periodos: 6 }, []);
  eq(f, ['el marcador', 'el marcador por periodos', 'quién jugó y cuánto', 'la foto del acta']);
});

test('y una completa no falta nada', () => {
  eq(loQueFalta({ ...PARTIDO, acta_path: 'x/y.jpg' }, FILAS), []);
});

test('una rejilla de ceros sigue faltando: la pantalla la estira, nadie la ha escrito', () => {
  const ceros = Array.from({ length: 6 }, () => ({ favor: 0, contra: 0 }));
  const f = loQueFalta({ ...PARTIDO, marcador_cuartos: ceros, acta_path: 'x/y.jpg' }, FILAS);
  eq(f, ['el marcador por periodos']);
});

/* ── 5. Sanear lo que entra ────────────────────────────────── */

console.log('\n· sanear');

test('se recorta a los límites en vez de perder la fila entera', () => {
  /* El entrenador está copiando de un papel: un dedo de más no puede
     costarle todo lo demás. */
  eq(saneaFila({ player_id: 'p1', periodos_jugados: 99, puntos: -5, faltas: 12 }, PARTIDO), {
    player_id: 'p1', dorsal: null, periodos: [],
    periodos_jugados: 6, periodos_descansados: 0, puntos: 0, faltas: 5,
  });
});

test('y la rejilla sale limpia y con los contadores puestos', () => {
  eq(saneaFila({ player_id: 'p1', periodos: [2, 2, 9, 1], puntos: 8 }, PARTIDO), {
    player_id: 'p1', dorsal: null, periodos: [1, 2],
    periodos_jugados: 2, periodos_descansados: 4, puntos: 8, faltas: 0,
  });
});

test('el marcador por periodos sale con tantas entradas como periodos', () => {
  const c = saneaCuartos([{ favor: 6, contra: 5 }], PARTIDO);
  eq(c.length, 6);
  eq(c[0], { favor: 6, contra: 5 });
  eq(c[5], { favor: 0, contra: 0 });
});

test('la fila se lee en periodos', () => {
  eq(textoFila(F('Ana', 4, 2, 12, 2), PARTIDO), '4 de 6 periodos · 12 pt · 2 faltas');
  eq(textoFila(F('Ana', 0, 6, 0, 0), PARTIDO), '0 de 6 periodos');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
