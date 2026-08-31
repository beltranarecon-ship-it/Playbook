/* ============================================================
   eval-cronometro.mjs — banco Node del reloj del entrenamiento
   (equipos/js/data/cronometro.js). Sin red, sin DOM.

     node equipos/tools/eval-cronometro.mjs

   Lo que vigila: que el reloj siga diciendo la verdad en el minuto 70
   de un entrenamiento que se ha ido torciendo desde el minuto 10. Un
   cronómetro que se equivoca es peor que no tenerlo: el entrenador
   deja de mirarlo y vuelve a llevar el tiempo a ojo.
   ============================================================ */

import {
  MAS_MIN, estadoCronometro, estaHecho, minutosReales,
  arranqueAhora, textoReloj, textoDesvio, claveDe,
  pausadoMs, estaPausado, alternarPausa, minutosPerdidos,
} from '../js/data/cronometro.js';

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

const MIN = 60000;
const T0 = new Date(2026, 8, 15, 18, 0, 0, 0).getTime();   // las seis en punto
const enMin = (m) => T0 + m * MIN;

/* Un plan de cuatro bloques: 10 + 20 + 15 + 15 = 60 minutos. */
const plan = () => ([
  { uid: 'b1', titulo: 'Calentamiento', duracion_min: 10 },
  { uid: 'b2', titulo: 'Rueda', duracion_min: 20 },
  { uid: 'b3', titulo: '3c3', duracion_min: 15 },
  { uid: 'b4', titulo: 'Tiro libre', duracion_min: 15 },
]);

/* ── 1. El bloque en curso ─────────────────────────────────── */

console.log('\n· qué bloque toca');

test('al empezar, el primero', () => {
  const e = estadoCronometro(plan(), { arranque: T0, ahora: T0 });
  eq(e.indice, 0);
  eq(e.bloque.titulo, 'Calentamiento');
  eq(e.hechos, 0);
  eq(e.total, 4);
});

test('el bloque en curso es el primero SIN duración real', () => {
  const bs = plan();
  bs[0].duracion_real_min = 12;
  const e = estadoCronometro(bs, { arranque: T0, ahora: enMin(12) });
  eq(e.indice, 1);
  eq(e.bloque.titulo, 'Rueda');
  eq(e.hechos, 1);
  ok(estaHecho(bs[0]) && !estaHecho(bs[1]));
});

test('y empieza donde acabó el anterior DE VERDAD, no donde decía el plan', () => {
  const bs = plan();
  bs[0].duracion_real_min = 14;      // se alargó cuatro minutos
  const e = estadoCronometro(bs, { arranque: T0, ahora: enMin(20) });
  eq(e.inicioBloque, enMin(14), 'el segundo empezó en el minuto 14');
  eq(e.transcurridoMs, 6 * MIN, 'y lleva seis');
});

test('con todos dados, se acabó', () => {
  const bs = plan().map((b) => ({ ...b, duracion_real_min: b.duracion_min }));
  const e = estadoCronometro(bs, { arranque: T0, ahora: enMin(60) });
  ok(e.terminada);
  eq(e.bloque, null);
  eq(e.hechos, 4);
});

test('un bloque de duración cero no cuenta como bloque', () => {
  const e = estadoCronometro([{ uid: 'x', duracion_min: 0 }, ...plan()], { arranque: T0, ahora: T0 });
  eq(e.total, 4);
});

/* ── 2. La cuenta atrás ────────────────────────────────────── */

console.log('\n· la cuenta atrás');

test('cuenta lo que queda del bloque', () => {
  const e = estadoCronometro(plan(), { arranque: T0, ahora: enMin(4) });
  eq(e.transcurridoMs, 4 * MIN);
  eq(e.restanteMs, 6 * MIN);
});

test('y sigue contando EN NEGATIVO cuando se pasa', () => {
  /* Ponerla a cero escondería justo el dato que hace falta: cuánto
     llevas de más. */
  const e = estadoCronometro(plan(), { arranque: T0, ahora: enMin(13) });
  eq(e.restanteMs, -3 * MIN);
  eq(textoReloj(e.restanteMs), '−3:00');
});

test('«+5» alarga el bloque en curso sin tocar a los demás', () => {
  const bs = plan();
  const e = estadoCronometro(bs, { arranque: T0, ahora: enMin(12), extras: { b1: MAS_MIN } });
  eq(e.previstoMs, 15 * MIN, 'diez más cinco');
  eq(e.restanteMs, 3 * MIN);
  eq(bs[1].duracion_min, 20, 'el siguiente no se toca');
});

test('el reloj no depende de que nadie le dé latidos', () => {
  /* El móvil se bloquea en el bolsillo. Al volver, la respuesta tiene
     que ser exacta, no la de hace ocho minutos. */
  const bs = plan();
  const a = estadoCronometro(bs, { arranque: T0, ahora: enMin(3) });
  const b = estadoCronometro(bs, { arranque: T0, ahora: enMin(11) });
  eq(a.transcurridoMs, 3 * MIN);
  eq(b.transcurridoMs, 11 * MIN, 'ocho minutos sin preguntar y sigue bien');
});

/* ── 3. Empezar tarde ──────────────────────────────────────── */

console.log('\n· se empezó tarde');

test('mover el arranque mueve el plan entero, no lo recorta (§11)', () => {
  const tarde = enMin(15);
  const e = estadoCronometro(plan(), { arranque: arranqueAhora(tarde), ahora: tarde });
  eq(e.indice, 0, 'sigue tocando el primero');
  eq(e.transcurridoMs, 0, 'y empieza ahora');
  eq(e.finPrevisto, enMin(75), 'el mismo plan, quince minutos más tarde');
});

test('sin mover el arranque, los quince minutos se comen el primer bloque', () => {
  // es justo lo que el ajuste de un toque evita
  const e = estadoCronometro(plan(), { arranque: T0, ahora: enMin(15) });
  ok(e.restanteMs < 0, `debería ir en negativo: ${e.restanteMs}`);
});

/* ── 4. El desvío ──────────────────────────────────────────── */

console.log('\n· cómo va de tiempo');

test('en hora cuando todo cuadra', () => {
  const e = estadoCronometro(plan(), { arranque: T0, ahora: T0 });
  eq(e.desvioMin, 0);
  eq(textoDesvio(0), 'en hora');
});

test('lo que se alargó ayer cuenta hoy', () => {
  const bs = plan();
  bs[0].duracion_real_min = 17;    // siete de más
  const e = estadoCronometro(bs, { arranque: T0, ahora: enMin(17) });
  eq(e.desvioMin, 7);
  eq(textoDesvio(7), '7 min de retraso');
});

test('y lo que se recortó también', () => {
  const bs = plan();
  bs[0].duracion_real_min = 6;
  const e = estadoCronometro(bs, { arranque: T0, ahora: enMin(6) });
  eq(e.desvioMin, -4);
  eq(textoDesvio(-4), '4 min por delante');
});

test('pasarse del bloque EN CURSO ya cuenta como retraso', () => {
  /* Esperar a darlo por finalizado para decirlo llegaría tarde: el
     entrenador quiere saberlo mientras decide si cortar. */
  const e = estadoCronometro(plan(), { arranque: T0, ahora: enMin(14) });
  eq(e.desvioMin, 4);
});

/* ── 5. Lo que se guarda ───────────────────────────────────── */

console.log('\n· la duración real');

test('se redondea al minuto', () => {
  eq(minutosReales(11.6 * MIN), 12);
  eq(minutosReales(11.2 * MIN), 11);
});

test('nunca cero: un bloque que se dio no duró cero minutos', () => {
  /* Guardar cero haría que la próxima vez el ejercicio se propusiera
     con una duración imposible (fila 3.6). */
  eq(minutosReales(0), 1);
  eq(minutosReales(20000), 1);
  eq(minutosReales(null), 1);
});

/* ── 6. Detalles de pantalla ───────────────────────────────── */

console.log('\n· lo que se lee');

test('el reloj se lee en minutos y segundos', () => {
  eq(textoReloj(0), '0:00');
  eq(textoReloj(65000), '1:05');
  eq(textoReloj(600000), '10:00');
  eq(textoReloj(-90000), '−1:30');
});

test('cada bloque se reconoce por su clave, tenga id o no', () => {
  eq(claveDe({ uid: 'b1', id: 'x' }), 'b1', 'manda el uid de la pantalla');
  eq(claveDe({ id: 'x' }), 'x');
  eq(claveDe({ orden: 2 }), '2');
});

test('sin bloques no revienta', () => {
  for (const v of [null, undefined, [], 'texto']) {
    const e = estadoCronometro(v, { arranque: T0, ahora: T0 });
    eq(e.total, 0, `con ${JSON.stringify(v)}:`);
    ok(e.terminada);
  }
});


/* ── 6. La pausa ───────────────────────────────────────────── */

console.log('\n· parar y reanudar');

test('tocar el reloj para y vuelve a tocar para reanudar', () => {
  let p = null;
  p = alternarPausa(p, enMin(5));
  ok(estaPausado(p), 'no se ha parado');
  eq(pausadoMs(p, enMin(8)), 3 * MIN, 'a los 3 min de parada:');
  p = alternarPausa(p, enMin(8));
  ok(!estaPausado(p), 'no ha reanudado');
  eq(pausadoMs(p, enMin(20)), 3 * MIN, 'reanudado, lo parado ya no crece:');
});

test('lo parado se CALCULA, no se cuenta: sobrevive al móvil en el bolsillo', () => {
  /* Es lo mismo que hace el resto del módulo. Si esto se llevara con un
     contador, la pantalla dormida veinte minutos volvería diciendo que
     solo se estuvo parado los pocos latidos que le dio el navegador. */
  const p = alternarPausa(null, enMin(5));
  eq(pausadoMs(p, enMin(25)), 20 * MIN, 'veinte minutos con el móvil bloqueado:');
});

test('varias paradas se suman', () => {
  let p = alternarPausa(null, enMin(2));
  p = alternarPausa(p, enMin(4));          // 2 min
  p = alternarPausa(p, enMin(10));
  p = alternarPausa(p, enMin(15));         // + 5 min
  eq(pausadoMs(p, enMin(30)), 7 * MIN);
});

test('la cuenta atrás se queda quieta mientras está parado', () => {
  const b = plan();
  let p = alternarPausa(null, enMin(4));
  const aLos4 = estadoCronometro(b, { arranque: T0, ahora: enMin(4), pausa: p });
  const aLos9 = estadoCronometro(b, { arranque: T0, ahora: enMin(9), pausa: p });
  eq(aLos9.transcurridoMs, aLos4.transcurridoMs, 'ha seguido corriendo parado:');
  eq(aLos9.restanteMs, 6 * MIN, 'quedan los mismos 6 min del bloque de 10:');
  ok(aLos9.pausado, 'no dice que está pausado');
  eq(aLos9.paradoMs, 5 * MIN);
});

test('reanudado, sigue por donde iba', () => {
  const b = plan();
  let p = alternarPausa(null, enMin(4));
  p = alternarPausa(p, enMin(9));           // 5 min parados
  const e = estadoCronometro(b, { arranque: T0, ahora: enMin(12), pausa: p });
  eq(e.transcurridoMs, 7 * MIN, '12 de reloj menos 5 parados:');
  eq(e.restanteMs, 3 * MIN);
});

test('lo parado retrasa el final previsto', () => {
  const b = plan();
  const sin = estadoCronometro(b, { arranque: T0, ahora: enMin(4) });
  const con = estadoCronometro(b, { arranque: T0, ahora: enMin(4), pausa: { acumuladoMs: 8 * MIN, desde: null } });
  eq(con.finPrevisto - sin.finPrevisto, 8 * MIN, 'el final no se ha corrido:');
  eq(con.desvioMin, 8, 'y el desvío no lo dice:');
});

console.log('\n· lo perdido ocupa pista, pero no es entrenamiento');

test('el bloque siguiente empieza contando TAMBIÉN lo parado', () => {
  /* Es lo único que mantiene el reloj pegado al de pared. Si lo parado
     se descontara aquí, los diez minutos esperando a que se fuera el
     otro equipo harían que todos los bloques siguientes empezaran diez
     minutos antes de lo que marca el reloj. */
  const b = plan();
  b[0].duracion_real_min = 10;        // se entrenaron 10
  b[0].tiempo_perdido_min = 6;        // y se perdieron 6
  const e = estadoCronometro(b, { arranque: T0, ahora: enMin(16) });
  eq(e.indice, 1, 'no va por el segundo:');
  eq(e.inicioBloque, enMin(16), 'el segundo no empieza en el minuto 16:');
  eq(e.transcurridoMs, 0, 'y por tanto acaba de empezar:');
});

test('sin pausa, un bloque hecho ocupa exactamente lo que duró', () => {
  const b = plan();
  b[0].duracion_real_min = 12;
  const e = estadoCronometro(b, { arranque: T0, ahora: enMin(12) });
  eq(e.inicioBloque, enMin(12));
});

test('minutosReales guarda lo ENTRENADO, no el reloj de pared', () => {
  /* `transcurridoMs` ya viene sin lo parado, así que esto sale solo. Es
     lo que después se le propone al ejercicio en la biblioteca: si se
     guardara con las pausas dentro, un 3c3 de diez minutos acabaría
     fichado como de veinte. */
  const b = plan();
  const p = { acumuladoMs: 6 * MIN, desde: null };
  const e = estadoCronometro(b, { arranque: T0, ahora: enMin(16), pausa: p });
  eq(minutosReales(e.transcurridoMs), 10, 'los 16 de reloj menos 6 parados:');
  eq(minutosPerdidos(e.paradoMs), 6);
});

test('una parada de segundos NO es tiempo perdido', () => {
  /* NULL en la base significa «no se pausó». Atarse una zapatilla no
     es tiempo perdido, es un entrenamiento. */
  eq(minutosPerdidos(0), null);
  eq(minutosPerdidos(20000), null, '20 segundos:');
  eq(minutosPerdidos(29999), null, 'casi medio minuto:');
  eq(minutosPerdidos(45000), 1, '45 segundos redondean a 1:');
});

test('lo roto no revienta ni inventa pausas', () => {
  eq(pausadoMs(null, enMin(5)), 0);
  eq(pausadoMs(undefined, enMin(5)), 0);
  eq(pausadoMs({}, enMin(5)), 0);
  eq(pausadoMs({ acumuladoMs: 'x', desde: 'y' }, enMin(5)), 0);
  eq(estaPausado(null), false);
  eq(estaPausado({ desde: null }), false);
  eq(minutosPerdidos(null), null);
  eq(minutosPerdidos('hola'), null);
});

test('un reloj que va hacia atrás no da tiempos negativos', () => {
  /* Cambio de hora, o el sistema ajustándose por NTP. */
  const p = { acumuladoMs: 0, desde: enMin(10) };
  eq(pausadoMs(p, enMin(5)), 0, 'ahora anterior al inicio de la pausa:');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
