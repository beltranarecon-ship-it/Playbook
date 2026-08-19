/* ============================================================
   eval-objetivos.mjs — banco Node de la medida de un objetivo
   (equipos/js/data/objetivos-medida.js). Sin red, sin DOM.

     node equipos/tools/eval-objetivos.mjs

   Lo que vigila: que «5 de 13 han subido» signifique lo que dice. Este
   número sustituye a la pregunta de cumplimiento AUTODECLARADA que se
   retira (§7), así que si miente es peor que la pregunta — una
   respuesta del entrenador al menos se sabe que es una opinión.

   Y sobre todo: que un jugador al que nadie ha mirado NO cuente como
   «no ha subido». No es lo mismo no mejorar que no saberlo.
   ============================================================ */

import {
  rangoDe, nivelesEnPeriodo, medirObjetivo, textoMedida, detalleMedida, queVigilarHoy,
} from '../js/data/objetivos-medida.js';

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

/* Un objetivo de octubre a diciembre, apuntado a la entrada. */
const OBJ = {
  id: 'o1', titulo: 'Entrar a canasta con las dos manos',
  dianas: ['accion:entrada'], fecha_inicio: '2026-10-01', fecha_fin: '2026-12-20',
};
const v = (clave, nivel, fecha) => ({ clave, nivel, created_at: `${fecha}T19:00:00Z` });

const JUGADORES = [
  { id: 'p1', nombre: 'Ana' }, { id: 'p2', nombre: 'Bruno' },
  { id: 'p3', nombre: 'Carla' }, { id: 'p4', nombre: 'Diego' },
];

/* ── 1. El punto de partida ────────────────────────────────── */

console.log('\n· de dónde a dónde');

test('la partida es lo último ANTES de empezar el objetivo', () => {
  const serie = [
    v('accion:entrada', 1, '2026-06-10'),
    v('accion:entrada', 2, '2026-09-20'),   // justo antes
    v('accion:entrada', 3, '2026-11-05'),
  ];
  eq(nivelesEnPeriodo(serie, 'accion:entrada', rangoDe(OBJ)), { antes: 2, ahora: 3 });
});

test('si solo se le ha mirado DURANTE, la primera de dentro es la partida', () => {
  /* Sin esta regla, un jugador al que se empieza a mirar cuando empieza
     el objetivo nunca podría «subir», que es justo el caso normal. */
  const serie = [v('accion:entrada', 1, '2026-10-05'), v('accion:entrada', 3, '2026-12-01')];
  eq(nivelesEnPeriodo(serie, 'accion:entrada', rangoDe(OBJ)), { antes: 1, ahora: 3 });
});

test('lo de después del objetivo no cuenta', () => {
  const serie = [v('accion:entrada', 1, '2026-10-05'), v('accion:entrada', 3, '2027-02-01')];
  eq(nivelesEnPeriodo(serie, 'accion:entrada', rangoDe(OBJ)), { antes: 1, ahora: 1 });
});

test('pasarle el objetivo entero en vez del rango no mide sobre toda la historia', () => {
  /* `rangoDe` existe justo por esto: el objetivo lleva fecha_inicio y
     la función espera desde, así que pasarlo tal cual no daría error —
     mediría de más y el número saldría mal en silencio. */
  eq(rangoDe(OBJ), { desde: '2026-10-01', hasta: '2026-12-20' });
  eq(rangoDe({}), { desde: null, hasta: null });
});

test('otra fila no es esta fila', () => {
  eq(nivelesEnPeriodo([v('accion:tiro', 3, '2026-11-01')], 'accion:entrada', rangoDe(OBJ)), { antes: null, ahora: null });
});

/* ── 2. La medida ──────────────────────────────────────────── */

console.log('\n· la frase de la fila 3.9');

const POR_JUGADOR = {
  p1: [v('accion:entrada', 1, '2026-09-25'), v('accion:entrada', 2, '2026-11-10')],  // sube
  p2: [v('accion:entrada', 2, '2026-10-02'), v('accion:entrada', 2, '2026-12-01')],  // igual
  p3: [v('accion:entrada', 3, '2026-10-02'), v('accion:entrada', 2, '2026-12-01')],  // baja
  // p4 no se ha mirado nunca
};

test('cuenta subidas, bajadas e iguales, y deja fuera a quien no se ha mirado', () => {
  const m = medirObjetivo(OBJ, { jugadores: JUGADORES, porJugador: POR_JUGADOR, sesiones: 7 });
  eq(m.subieron, 1);
  eq(m.bajaron, 1);
  eq(m.igual, 1);
  eq(m.medidos, 3, 'de tres se sabe algo');
  eq(m.sinMirar, 1, 'del cuarto no');
  eq(m.total, 4);
});

test('«no se le ha mirado» NO es «no ha subido»', () => {
  /* El denominador es de cuántos se sabe algo. Meter a los no mirados
     abajo convertiría «no lo sé» en «va mal». */
  const m = medirObjetivo(OBJ, { jugadores: JUGADORES, porJugador: POR_JUGADOR, sesiones: 7 });
  eq(textoMedida(m), 'trabajado en 7 sesiones · 1 de 3 han subido');
});

test('la frase de la fila, con sus números', () => {
  const m = { sesiones: 7, subieron: 5, medidos: 13, conDiana: true };
  eq(textoMedida(m), 'trabajado en 7 sesiones · 5 de 13 han subido');
});

test('una sesión se dice en singular', () => {
  eq(textoMedida({ sesiones: 1, subieron: 0, medidos: 2, conDiana: true }),
    'trabajado en 1 sesión · 0 de 2 han subido');
});

test('sin diana no hay medida, y se dice', () => {
  const m = medirObjetivo({ ...OBJ, dianas: [] }, { jugadores: JUGADORES, porJugador: POR_JUGADOR, sesiones: 4 });
  eq(m.conDiana, false);
  eq(textoMedida(m), 'trabajado en 4 sesiones · sin diana, no se puede medir');
  ok(detalleMedida(m).includes('Elige una diana'));
});

test('sin nadie mirado todavía se dice eso, y no un cero', () => {
  const m = medirObjetivo(OBJ, { jugadores: JUGADORES, porJugador: {}, sesiones: 2 });
  eq(textoMedida(m), 'trabajado en 2 sesiones · todavía no se ha mirado a nadie');
});

test('con varias dianas manda el mejor movimiento del jugador', () => {
  /* Si el objetivo apunta a entrada Y a autonomía, subir en una de las
     dos ya es subir: el objetivo no exige las dos a la vez. */
  const obj = { ...OBJ, dianas: ['accion:entrada', 'conducta:autonomia'] };
  const por = {
    p1: [
      v('accion:entrada', 2, '2026-10-02'), v('accion:entrada', 2, '2026-12-01'),
      v('conducta:autonomia', 1, '2026-10-02'), v('conducta:autonomia', 3, '2026-12-01'),
    ],
  };
  const m = medirObjetivo(obj, { jugadores: [{ id: 'p1' }], porJugador: por, sesiones: 3 });
  eq(m.subieron, 1);
});

test('el detalle largo cuenta las cuatro cosas', () => {
  const m = medirObjetivo(OBJ, { jugadores: JUGADORES, porJugador: POR_JUGADOR, sesiones: 7 });
  eq(detalleMedida(m), '1 han subido · 1 siguen igual · 1 han bajado · 1 sin mirar');
});

test('sin objetivo ni jugadores no revienta', () => {
  const m = medirObjetivo(null, {});
  eq(m.total, 0);
  eq(m.conDiana, false);
});

/* ── 3. Qué vigilar hoy ────────────────────────────────────── */

console.log('\n· qué vigilar hoy');

const nombreDe = (c) => c.split(':')[1];

test('nombra a los que están más bajos, que es lo accionable', () => {
  /* «Vigila la entrada, sobre todo en Ana y Bruno» sirve. «Objetivo:
     mejorar la entrada» no. */
  const por = {
    p1: [v('accion:entrada', 0, '2026-11-01')],
    p2: [v('accion:entrada', 1, '2026-11-01')],
    p3: [v('accion:entrada', 3, '2026-11-01')],
  };
  const [x] = queVigilarHoy([OBJ], { jugadores: JUGADORES, porJugador: por, nombreDe });
  eq(x.lineas, ['entrada: mira sobre todo a Ana y Bruno.']);
});

test('si no se ha mirado a nadie, lo dice en vez de callarse', () => {
  const [x] = queVigilarHoy([OBJ], { jugadores: JUGADORES, porJugador: {}, nombreDe });
  eq(x.lineas, ['entrada: todavía no has mirado a nadie en esto.']);
});

test('sin diana, dice cómo arreglarlo', () => {
  const [x] = queVigilarHoy([{ ...OBJ, dianas: [] }], { jugadores: JUGADORES, porJugador: {}, nombreDe });
  ok(x.lineas[0].includes('apuntarlo a una fila de la rúbrica'), x.lineas[0]);
});

test('una o dos líneas por objetivo, no más (§6)', () => {
  const obj = { ...OBJ, dianas: ['accion:entrada', 'accion:tiro', 'accion:pase', 'conducta:actitud'] };
  const por = { p1: [v('accion:entrada', 0, '2026-11-01'), v('accion:tiro', 1, '2026-11-01'), v('accion:pase', 2, '2026-11-01')] };
  const [x] = queVigilarHoy([obj], { jugadores: [{ id: 'p1', nombre: 'Ana' }], porJugador: por, nombreDe });
  eq(x.lineas.length, 2);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
