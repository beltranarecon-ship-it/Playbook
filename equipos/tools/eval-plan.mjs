/* ============================================================
   eval-plan.mjs — banco Node de las reglas del plan de sesión
   (equipos/js/data/plan.js). Sin red, sin DOM.

     node equipos/tools/eval-plan.mjs

   Lo que vigila: que el planificador no deje escribir un plan que no
   cabe en la pista, que el cuadro de material no invente cantidades
   que nadie ha declarado, y que el aviso de «esto ya lo hiciste»
   mire hacia atrás y no hacia delante.
   ============================================================ */

import {
  MINUTOS_AGUA, bloqueAgua, esAgua, duracionTotal, huecoDisponible,
  ajustarADisponible, materialDeSesion, textoMaterial, repetidosEnSesion,
  repetidosRecientes, textoHace, cabeEnGrupo,
} from '../js/data/plan.js';
import { minutosDeBloque, minutosDeSesion } from '../js/data/minutos.js';

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

/* ── 1. El tope de duración ────────────────────────────────── */

console.log('\n· no se puede pasar de la hora de pista');

const PLAN = [
  { uid: 'b1', duracion_min: 30, exercise_id: 'e1', titulo: 'Rueda' },
  { uid: 'b2', duracion_min: 40, exercise_id: 'e2', titulo: '3c3' },
];

test('el hueco es lo que queda, no un aviso', () => {
  eq(duracionTotal(PLAN), 70);
  eq(huecoDisponible(PLAN, 90), 20);
  eq(huecoDisponible(PLAN, 70), 0, 'clavado');
});

test('un plan que ya se pasa no da hueco negativo', () => {
  eq(huecoDisponible([{ duracion_min: 120 }], 90), 0);
});

test('el bloque que se está editando no cuenta contra sí mismo', () => {
  // subir la duración de b1 puede llegar hasta 90 − 40 = 50
  eq(huecoDisponible(PLAN, 90, { excepto: 'b1' }), 50);
});

test('sin horario no hay tope: cabe todo, y se dice así', () => {
  eq(huecoDisponible(PLAN, null), Infinity);
  eq(huecoDisponible(PLAN, 0), Infinity);
  eq(ajustarADisponible(PLAN, null, 60), { duracion: 60, recortado: 0 });
});

test('lo que cabe a medias entra recortado, y se sabe cuánto se ha quitado', () => {
  eq(ajustarADisponible(PLAN, 90, 30), { duracion: 20, recortado: 10 });
  eq(ajustarADisponible(PLAN, 90, 15), { duracion: 15, recortado: 0 });
});

test('sin hueco, no entra nada', () => {
  eq(ajustarADisponible(PLAN, 70, 10), { duracion: 0, recortado: 10 });
});

/* ── 2. El agua ────────────────────────────────────────────── */

console.log('\n· el agua');

test('nace de tres minutos y se puede cambiar', () => {
  eq(bloqueAgua().duracion_min, MINUTOS_AGUA);
  eq(bloqueAgua(5).duracion_min, 5);
  eq(bloqueAgua().exercise_id, null, 'no es un ejercicio de la biblioteca');
});

test('se reconoce por el título, que es lo que el entrenador lee', () => {
  ok(esAgua({ titulo: 'Agua' }), 'tal cual');
  ok(esAgua({ titulo: '  agua  ' }), 'con espacios');
  ok(esAgua({ titulo: 'Agua y charla' }), 'nadie entrena en ninguna de las dos');
  ok(!esAgua({ titulo: 'Aguante en el bote' }), 'no basta con empezar por las letras');
  ok(!esAgua({ titulo: 'Charla' }), 'una charla no es agua');
  ok(!esAgua({ titulo: 'Agua', exercise_id: 'e1' }), 'un ejercicio de la biblioteca nunca es agua');
  ok(!esAgua(null));
});

test('ocupa pista pero NO cuenta como minutos activos', () => {
  const m = minutosDeBloque(bloqueAgua(), { jugadores: 12 });
  eq(m.duracion, 3, 'los tres minutos son de pista');
  eq(m.minutos, 0, 'pero beber no es entrenar');
  eq(m.agua, true);
});

test('y por eso meter agua baja el porcentaje, que es la verdad', () => {
  const sin = minutosDeSesion([{ duracion_min: 30, exercise_id: 'e1' }], { jugadores: 12, requisitosDe: () => ({ densidad: 'alta', jugadores_max: 12 }) });
  const con = minutosDeSesion([{ duracion_min: 30, exercise_id: 'e1' }, bloqueAgua()], { jugadores: 12, requisitosDe: () => ({ densidad: 'alta', jugadores_max: 12 }) });
  eq(sin.aprovechamiento, 1);
  ok(con.aprovechamiento < 1, `con agua: ${con.aprovechamiento}`);
  eq(con.minutos, 30, 'los minutos activos no cambian');
  eq(con.duracion, 33, 'la pista sí');
});

/* ── 3. El material ────────────────────────────────────────── */

console.log('\n· el cuadro de material');

const REQ = {
  e1: { material: ['balones', 'conos'], estaciones: 2, densidad: 'media', jugadores_max: 12 },
  e2: { material: ['petos', 'balones'], estaciones: 2, densidad: 'alta', jugadores_max: 12 },
  e3: { material: ['balones'], simultaneo: true, densidad: 'alta', jugadores_max: 20 },
};
const requisitosDe = (b) => REQ[b.exercise_id] || null;

test('junta lo de todos los bloques, sin repetir', () => {
  const m = materialDeSesion(PLAN, { jugadores: 14, requisitosDe });
  eq(m.map((f) => f.nombre), ['balones', 'conos', 'petos']);
});

test('cuenta solo lo que se usa uno por crío, y solo si es simultáneo', () => {
  // por turnos: un balón por estación
  const porTurnos = materialDeSesion([PLAN[0]], { jugadores: 14, requisitosDe });
  eq(porTurnos.find((f) => f.nombre === 'balones').cantidad, 2);
  // simultáneo: uno cada uno
  const simul = materialDeSesion([{ uid: 'x', duracion_min: 10, exercise_id: 'e3', titulo: 'Manejo' }], { jugadores: 14, requisitosDe });
  eq(simul[0].cantidad, 14);
});

test('manda el que más necesite', () => {
  const m = materialDeSesion([...PLAN, { uid: 'x', duracion_min: 10, exercise_id: 'e3', titulo: 'Manejo' }], { jugadores: 14, requisitosDe });
  eq(m.find((f) => f.nombre === 'balones').cantidad, 14, 'catorce, no dos');
});

test('lo que la ficha no dice CUÁNTO, se lista sin número', () => {
  const m = materialDeSesion(PLAN, { jugadores: 14, requisitosDe });
  eq(m.find((f) => f.nombre === 'conos').cantidad, null, 'poner un número a ojo sería peor');
  eq(m.find((f) => f.nombre === 'petos').cantidad, null);
});

test('sin saber cuánta gente hay, no se inventa ninguna cantidad', () => {
  const m = materialDeSesion(PLAN, { jugadores: null, requisitosDe });
  ok(m.every((f) => f.cantidad === null), JSON.stringify(m));
});

test('dice de qué bloque viene cada cosa', () => {
  const m = materialDeSesion(PLAN, { jugadores: 14, requisitosDe });
  eq(m.find((f) => f.nombre === 'conos').deQuien, ['Rueda']);
  eq(m.find((f) => f.nombre === 'balones').deQuien, ['Rueda', '3c3']);
});

test('se lee al pie sin traducir nada', () => {
  eq(textoMaterial([{ nombre: 'balones', cantidad: 14 }, { nombre: 'conos', cantidad: null }]),
    '14 balones · conos');
  eq(textoMaterial([]), '');
});

test('un plan sin fichas no pide material', () => {
  eq(materialDeSesion([{ uid: 'a', duracion_min: 10, titulo: 'Charla' }], { jugadores: 12, requisitosDe }), []);
});

/* ── 4. Lo repetido dentro de la sesión ─────────────────────── */

console.log('\n· repetido en la misma sesión');

test('el mismo ejercicio dos veces se dice', () => {
  const r = repetidosEnSesion([
    { exercise_id: 'e1', titulo: 'Rueda' },
    { exercise_id: 'e2', titulo: '3c3' },
    { exercise_id: 'e1', titulo: 'Rueda' },
  ]);
  eq(r, [{ exercise_id: 'e1', titulo: 'Rueda', veces: 2 }]);
});

test('dos bloques libres no son una repetición', () => {
  eq(repetidosEnSesion([{ titulo: 'Charla' }, { titulo: 'Charla' }]), []);
  eq(repetidosEnSesion([bloqueAgua(), bloqueAgua()]), [], 'ni dos aguas');
});

test('sin repetir, no hay aviso', () => {
  eq(repetidosEnSesion(PLAN), []);
  eq(repetidosEnSesion(null), []);
});

/* ── 5. «Esto ya lo hiciste el martes» ──────────────────────── */

console.log('\n· repetido hace poco');

const HISTORIA = {
  sesiones: [
    { id: 's1', fecha: '2026-08-17', estado: 'realizada' },   // 3 días antes
    { id: 's2', fecha: '2026-08-10', estado: 'realizada' },   // 10 días antes
    { id: 's3', fecha: '2026-07-01', estado: 'realizada' },   // fuera de ventana
    { id: 's4', fecha: '2026-08-22', estado: 'programada' },  // DESPUÉS
    { id: 's5', fecha: '2026-08-18', estado: 'cancelada' },   // no ocurrió
  ],
  bloquesPorSesion: {
    s1: [{ exercise_id: 'e1' }],
    s2: [{ exercise_id: 'e1' }, { exercise_id: 'e2' }],
    s3: [{ exercise_id: 'e9' }],
    s4: [{ exercise_id: 'e3' }],
    s5: [{ exercise_id: 'e4' }],
  },
  fecha: '2026-08-20',
};

test('avisa de lo que se hizo hace poco, con cuándo fue', () => {
  const r = repetidosRecientes([{ exercise_id: 'e1', titulo: 'Rueda' }], HISTORIA);
  eq(r, [{ exercise_id: 'e1', titulo: 'Rueda', fecha: '2026-08-17', dias: 3 }]);
});

test('la fecha que sale es la MÁS RECIENTE de las veces que se hizo', () => {
  // e1 está en s1 (hace 3) y en s2 (hace 10): manda la de hace 3
  const r = repetidosRecientes([{ exercise_id: 'e1', titulo: 'Rueda' }], HISTORIA);
  eq(r[0].dias, 3);
});

test('lo de hace mes y medio ya no es «hace poco»', () => {
  eq(repetidosRecientes([{ exercise_id: 'e9', titulo: 'Viejo' }], HISTORIA), []);
});

test('lo que está PLANIFICADO para el viernes no es «ya lo hiciste»', () => {
  eq(repetidosRecientes([{ exercise_id: 'e3', titulo: 'Manejo' }], HISTORIA), []);
});

test('una sesión cancelada no ocurrió', () => {
  eq(repetidosRecientes([{ exercise_id: 'e4', titulo: 'Otro' }], HISTORIA), []);
});

test('un ejercicio repetido en el plan solo avisa una vez', () => {
  const r = repetidosRecientes([{ exercise_id: 'e1', titulo: 'Rueda' }, { exercise_id: 'e1', titulo: 'Rueda' }], HISTORIA);
  eq(r.length, 1);
});

test('sin fecha de sesión no se aventura nada', () => {
  eq(repetidosRecientes([{ exercise_id: 'e1' }], { ...HISTORIA, fecha: null }), []);
});

test('se lee en castellano', () => {
  eq(textoHace(0), 'hoy');
  eq(textoHace(1), 'ayer');
  eq(textoHace(3), 'hace 3 días');
  eq(textoHace(9), 'la semana pasada');
  eq(textoHace(21), 'hace 3 semanas');
});

/* ── 6. El filtro del picker ───────────────────────────────── */

console.log('\n· filtrar por la gente que hay');

test('se esconde lo que no se puede montar con los que vienen', () => {
  ok(!cabeEnGrupo({ jugadores_min: 20 }, 14), 'un 5c5 con catorce no sale');
  ok(cabeEnGrupo({ jugadores_min: 4 }, 14));
  ok(cabeEnGrupo({ jugadores_min: 14 }, 14), 'justo');
});

test('pasarse del máximo NO esconde nada', () => {
  /* Se puede montar haciendo cola, y los minutos activos ya lo
     penalizan (3.1). Esconderlo taparía media biblioteca. */
  ok(cabeEnGrupo({ jugadores_min: 4, jugadores_max: 8 }, 14));
});

test('sin dato, no se filtra', () => {
  ok(cabeEnGrupo({ jugadores_min: 20 }, null), 'sin saber cuántos vienen');
  ok(cabeEnGrupo({}, 14), 'la ficha no lo declara');
  ok(cabeEnGrupo(null, 14));
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
