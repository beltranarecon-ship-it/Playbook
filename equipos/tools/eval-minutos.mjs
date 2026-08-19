/* ============================================================
   eval-minutos.mjs — banco Node de los minutos activos por jugador
   (equipos/js/data/minutos.js). Sin red, sin DOM.

     node equipos/tools/eval-minutos.mjs

   Lo que vigila: que el número diga la verdad sobre lo que un crío se
   lleva del entrenamiento. Es un número que va a cambiar decisiones
   —qué ejercicio se quita de la sesión—, así que tiene que subir y
   bajar por las razones correctas y no por otras.

   Y sobre todo: que una ficha a medio rellenar NO se penalice en
   silencio ni se cuele como si estuviera completa. Se cuenta a favor
   y se dice.
   ============================================================ */

import {
  COMPROMISO, compromisoDe, aforoDe, minutosDeBloque, minutosDeSesion,
  avisoAforo, textoMinutos,
} from '../js/data/minutos.js';

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
const cerca = (real, esp, tol = 0.05, msg = '') => {
  if (Math.abs(real - esp) > tol) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};

/* Dos ejercicios reales de la biblioteca, con la forma que tienen de
   verdad: una fila (rueda de entradas) y uno simultáneo (manejo con
   un balón cada uno). */
const FILA = { densidad: 'media', jugadores_min: 4, jugadores_max: 12, estaciones: 2, canastas: 1 };
const SIMULTANEO = { densidad: 'alta', jugadores_min: 4, jugadores_max: 16, estaciones: 1, canastas: 0, simultaneo: true };
const SIN_RELLENAR = { densidad: null, jugadores_min: null, jugadores_max: null };

/* ── 1. El criterio de aceptación ───────────────────────────── */

console.log('\n· una fila con 14 críos frente a uno simultáneo');

test('la fila da MENOS minutos activos que el simultáneo, con el mismo tiempo', () => {
  const bloque = { duracion_min: 15 };
  const fila = minutosDeBloque(bloque, { jugadores: 14, requisitos: FILA });
  const simul = minutosDeBloque(bloque, { jugadores: 14, requisitos: SIMULTANEO });
  ok(fila.minutos < simul.minutos, `fila=${fila.minutos} simultáneo=${simul.minutos}`);
  eq(simul.minutos, 15, 'el simultáneo aprovecha el bloque entero');
  // 15 × 0,75 (media) × 12/14 (dos de más esperando) = 9,6
  cerca(fila.minutos, 9.6, 0.05, 'la fila:');
});

test('y con catorce, el simultáneo no penaliza aunque pase de su máximo declarado', () => {
  const m = minutosDeBloque({ duracion_min: 20 }, { jugadores: 30, requisitos: SIMULTANEO });
  eq(m.minutos, 20, 'nadie hace cola: el tope es el material, no el turno');
});

/* ── 2. Los dos factores, por separado ──────────────────────── */

console.log('\n· la densidad');

test('los tres escalones salen de los umbrales de D4', () => {
  eq(COMPROMISO.alta, 1, 'alta = 4/4');
  eq(COMPROMISO.media, 0.75, 'media = punto medio 3 / umbral 4');
  eq(COMPROMISO.baja, 0.25, 'baja = punto medio 1 / umbral 4');
});

test('y se leen de la ficha', () => {
  eq(compromisoDe({ densidad: 'alta' }), 1);
  eq(compromisoDe({ densidad: 'baja' }), 0.25);
  eq(compromisoDe({ densidad: 'regular' }), null, 'un valor fuera del vocabulario no vale');
  eq(compromisoDe({}), null);
  eq(compromisoDe(null), null);
});

test('la misma sesión con densidad baja da la cuarta parte', () => {
  const alta = minutosDeBloque({ duracion_min: 20 }, { jugadores: 10, requisitos: { densidad: 'alta', jugadores_max: 12 } });
  const baja = minutosDeBloque({ duracion_min: 20 }, { jugadores: 10, requisitos: { densidad: 'baja', jugadores_max: 12 } });
  eq(alta.minutos, 20);
  eq(baja.minutos, 5);
});

console.log('\n· el aforo');

test('mientras quepan, no espera nadie', () => {
  for (const n of [4, 8, 12]) {
    const m = minutosDeBloque({ duracion_min: 10 }, { jugadores: n, requisitos: { densidad: 'alta', jugadores_max: 12 } });
    eq(m.minutos, 10, `con ${n}:`);
  }
});

test('a partir del máximo, el tiempo se reparte (§11)', () => {
  const m = minutosDeBloque({ duracion_min: 10 }, { jugadores: 24, requisitos: { densidad: 'alta', jugadores_max: 12 } });
  eq(m.minutos, 5, 'el doble de gente, la mitad de trabajo');
  eq(m.turno, 0.5);
});

test('el aforo de un simultáneo no tiene tope', () => {
  eq(aforoDe(SIMULTANEO), Infinity);
  eq(aforoDe({ jugadores_max: 12 }), 12);
  eq(aforoDe({ jugadores_max: 0 }), null, 'cero no es un aforo');
  eq(aforoDe({}), null);
});

test('sin saber cuánta gente hay, no se penaliza', () => {
  // El planificador puede no saber todavía cuántos vienen.
  const m = minutosDeBloque({ duracion_min: 10 }, { jugadores: null, requisitos: FILA });
  eq(m.turno, 1, 'solo cuenta la densidad');
  eq(m.minutos, 7.5);
});

/* ── 3. Lo que la ficha NO dice ─────────────────────────────── */

console.log('\n· una ficha a medio rellenar');

test('cuenta a favor, y lo dice', () => {
  const m = minutosDeBloque({ duracion_min: 10, exercise_id: 'x' }, { jugadores: 20, requisitos: SIN_RELLENAR });
  eq(m.minutos, 10, 'no se penaliza lo que no se sabe');
  eq(m.supuestos, ['densidad', 'aforo'], 'pero se apunta');
});

test('un bloque LIBRE no es una ficha a medias: cuenta entero y no se le echa la culpa', () => {
  /* Una charla o el agua no tienen ficha que rellenar. Contarlo como
     «falta declarar la densidad» mandaría al entrenador a arreglar algo
     que no está roto. */
  const m = minutosDeBloque({ duracion_min: 8, titulo: 'Charla' }, { jugadores: 12, requisitos: null });
  eq(m.minutos, 8);
  eq(m.supuestos, [], 'ningún dato que echar de menos');
  eq(m.libre, true);
});

test('y un ejercicio SÍ tiene ficha, así que se le pide', () => {
  const m = minutosDeBloque({ duracion_min: 8, exercise_id: 'x' }, { jugadores: 12, requisitos: SIN_RELLENAR });
  eq(m.supuestos, ['densidad', 'aforo']);
  eq(m.libre, false);
});

test('una ficha completa no arrastra ninguna suposición', () => {
  const m = minutosDeBloque({ duracion_min: 10, exercise_id: 'fila' }, { jugadores: 12, requisitos: FILA });
  eq(m.supuestos, []);
  eq(m.libre, false);
});

/* ── 4. La sesión entera ────────────────────────────────────── */

console.log('\n· la sesión');

const PLAN = [
  { duracion_min: 10, titulo: 'Calentamiento', exercise_id: 'sim' },
  { duracion_min: 20, titulo: 'Entradas en rueda', exercise_id: 'fila' },
  { duracion_min: 15, titulo: 'Charla y agua', exercise_id: null },
];
const REQ = { sim: SIMULTANEO, fila: FILA };
const requisitosDe = (b) => REQ[b.exercise_id] || null;

test('suma los bloques y dice cuánto se aprovecha', () => {
  const s = minutosDeSesion(PLAN, { jugadores: 14, requisitosDe });
  eq(s.duracion, 45);
  // 10 (simultáneo) + 20×0,75×12/14 = 12,9 + 15 (bloque libre, a favor)
  cerca(s.minutos, 37.9, 0.05);
  cerca(s.aprovechamiento, 0.842, 0.01);
  eq(s.porBloque.length, 3);
});

test('dice de cuántos bloques sale el número de verdad', () => {
  const s = minutosDeSesion(PLAN, { jugadores: 14, requisitosDe });
  eq(s.conSupuestos, 0, 'las dos fichas del plan están completas');
  eq(s.libres, 1, 'la charla no tiene ficha');
  eq(s.bloquesConDatos, 2);
});

test('quitar el ejercicio de fila sube el aprovechamiento', () => {
  /* Es el uso real: se ve el número, se cambia un ejercicio y se ve
     subir. Si esto no se cumpliera, el número no serviría para nada. */
  const antes = minutosDeSesion(PLAN, { jugadores: 14, requisitosDe });
  const despues = minutosDeSesion(
    PLAN.map((b) => (b.exercise_id === 'fila' ? { ...b, exercise_id: 'sim' } : b)),
    { jugadores: 14, requisitosDe },
  );
  ok(despues.aprovechamiento > antes.aprovechamiento, `${antes.aprovechamiento} → ${despues.aprovechamiento}`);
  eq(despues.duracion, antes.duracion, 'y sin cambiar la duración del entreno');
});

test('los bloques de duración cero no cuentan ni estorban', () => {
  const s = minutosDeSesion([{ duracion_min: 0 }, { duracion_min: 10, exercise_id: 'sim' }], { jugadores: 12, requisitosDe });
  eq(s.porBloque.length, 1);
  eq(s.duracion, 10);
});

test('sin bloques no revienta', () => {
  for (const v of [null, undefined, [], 'texto', 42]) {
    const s = minutosDeSesion(v, { jugadores: 12 });
    eq(s.minutos, 0, `con ${JSON.stringify(v)}:`);
    eq(s.aprovechamiento, 0);
  }
});

/* ── 5. Qué hacer cuando no cabe la gente ───────────────────── */

console.log('\n· el aviso');

test('con 18 en un montaje de 12 hacen falta el doble de estaciones', () => {
  const a = avisoAforo(FILA, 18);
  eq(a, { sobran: 6, estacionesNecesarias: 4, canastasNecesarias: 2 });
});

test('si cabe, no hay aviso', () => {
  eq(avisoAforo(FILA, 12), null);
  eq(avisoAforo(FILA, 4), null);
});

test('un simultáneo nunca lo da, y una ficha sin declarar tampoco', () => {
  eq(avisoAforo(SIMULTANEO, 40), null, 'no hay turno que repartir');
  eq(avisoAforo(SIN_RELLENAR, 40), null, 'no se avisa de lo que no se sabe');
  eq(avisoAforo(FILA, null), null);
});

/* ── 6. Lo que se lee en pantalla ───────────────────────────── */

console.log('\n· el texto');

test('se lee sin traducir nada', () => {
  eq(textoMinutos({ minutos: 57.6, duracion: 90, aprovechamiento: 0.64 }),
    '58 de 90 min · cada jugador trabaja el 64 % del entreno');
});

test('y sin bloques dice lo que hay', () => {
  eq(textoMinutos({ minutos: 0, duracion: 0, aprovechamiento: 0 }), 'Sin bloques todavía.');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
