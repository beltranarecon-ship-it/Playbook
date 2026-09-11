/* ============================================================
   eval-fases.mjs — banco Node del compás de la jugada
   (taller/js/pizarra/fases.js). Sin red, sin DOM.

     node taller/tools/eval-fases.mjs

   Lo que aquí se vigila no es que las cuentas den un número bonito,
   sino que la fase se VEA bien sin que el entrenador toque un solo
   milisegundo:

     · dentro de un carril, en serie — nadie corta y bota a la vez;
     · entre carriles, en paralelo — que de eso va el baloncesto;
     · y los arranques evidentes del §6.3, que son los que hacen que el
       receptor no eche a correr con el balón todavía en el aire.

   Y una cosa más, que es de las que se descubren tarde: que esto NO SE
   PUEDA COLGAR. No por un tope en el bucle, sino porque las dos
   dependencias apuntan siempre hacia atrás en el orden de dibujo, así
   que el grafo es acíclico por construcción. Eso es una propiedad de
   las REGLAS, no del código que las resuelve, y por eso se prueba
   aquí: el día que alguien añada una regla que mire hacia delante,
   esta prueba es la que lo dirá.
   ============================================================ */

import {
  MINIMO_TRAMO_MS, PENDIENTES,
  nuevaFase, carrilesDesde, tramosDe,
  duracionDeTramo, tiemposDe, duracionDeCarril, posicionesFinales,
  reanclarFase, recalcular, posesionAlFinal,
  tramosConFicha, balonEnJuego, conFichaNueva, sinFichas,
} from '../js/pizarra/fases.js';
import { duracionDe, longitudMetros, nuevoTrazo } from '../js/pizarra/trazo.js';

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

let n = 0;
/** Un tramo como los que produce la Pizarra. */
const tramo = (elemento, desde, hasta, extra = {}) => ({
  id: `tr${++n}`,
  elemento_id: elemento,
  corre_id: extra.corre_id || elemento,
  receptor_id: extra.receptor_id || null,
  balon_id: extra.balon_id || null,
  accion: extra.accion || 'corta',
  variante: null,
  trazo: nuevoTrazo(desde, hasta),
  tipo: extra.tipo || 'cut',
  ritmo: extra.ritmo || 'normal',
  inicio_ms: extra.inicio_ms ?? null,
  duracion_ms: extra.duracion_ms ?? null,
  manual: !!extra.manual,
});
const conCarriles = (tramos) => ({ ...nuevaFase('f1'), carriles: carrilesDesde(tramos) });
const P = (x, y) => ({ x, y });

/* ── 1. Los carriles ─────────────────────────────────────── */

test('UN CARRIL POR FICHA, y los tramos de cada uno en su orden', () => {
  const a1 = tramo('A1', P(0.2, 0.8), P(0.4, 0.5));
  const a2 = tramo('A2', P(0.8, 0.8), P(0.6, 0.5));
  const a1b = tramo('A1', P(0.4, 0.5), P(0.5, 0.2));
  const carriles = carrilesDesde([a1, a2, a1b]);
  eq(carriles.length, 2, 'dos fichas, dos carriles:');
  eq(carriles.map((c) => c.elemento), ['A1', 'A2'], 'en el orden en que entraron en escena:');
  eq(carriles[0].tramos.map((t) => t.id), [a1.id, a1b.id], 'y los de A1 en el orden en que se dibujaron:');
});

test('EL CARRIL ES DE QUIEN ACTÚA, no de quien recorre el trazo', () => {
  /* Un pase lo recorre el balón. Agrupando por el que viaja, cada balón
     abriría su propio carril y la línea de tiempo tendría filas que no
     corresponden a nadie de la pista. */
  const pase = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2' });
  const carriles = carrilesDesde([pase]);
  eq(carriles.map((c) => c.elemento), ['A1']);
});

test('sin tramos no hay carriles, y eso no rompe nada', () => {
  eq(carrilesDesde([]), []);
  eq(carrilesDesde(null), []);
  eq(tramosDe(nuevaFase('f1'), 'A1'), []);
});

test('una fase nueva nace vacía y con la duración por calcular', () => {
  const f = nuevaFase('f1');
  eq(f.id, 'f1');
  eq(f.duracion_ms, null, 'null = la calcula ella:');
  eq(f.carriles, []);
  eq(f.texto, null, 'null = frase automática:');
});

/* ── 2. Cuánto dura cada tramo (§6.2) ────────────────────── */

test('LA DURACIÓN ES LA MISMA CUENTA QUE AL DIBUJARLO', () => {
  /* Si aquí se contara distinto, un tramo duraría una cosa al soltarlo
     y otra al reproducir la fase, y no habría manera de saber cuál de
     las dos miente. */
  const t = tramo('A1', P(0.2, 0.8), P(0.8, 0.2));
  const esperado = duracionDe(longitudMetros(t.trazo, 'entera'), 'normal') * 1000;
  eq(duracionDeTramo(t, 'entera'), Math.round(esperado));
});

test('cada ritmo dura lo suyo, y un pase llega antes que nadie corriendo', () => {
  const de = (r, extra = {}) => duracionDeTramo(tramo('A1', P(0.2, 0.8), P(0.8, 0.2), { ritmo: r, ...extra }), 'entera');
  ok(de('sprint') < de('normal'), 'esprintando se tarda menos');
  ok(de('normal') < de('andando'), 'y andando más');
  ok(de('pase') < de('sprint'), 'el balón vuela');
});

test('ningún tramo dura cero: con cero, repartir el recorrido divide por cero', () => {
  eq(duracionDeTramo(tramo('A1', P(0.5, 0.5), P(0.5, 0.5)), 'entera'), MINIMO_TRAMO_MS);
  eq(duracionDeTramo({ id: 'x', trazo: [] }, 'entera'), MINIMO_TRAMO_MS);
  eq(duracionDeTramo(null, 'entera'), MINIMO_TRAMO_MS);
});

test('una duración puesta a mano manda sobre la distancia (« todo es ajustable »)', () => {
  const t = tramo('A1', P(0.2, 0.8), P(0.8, 0.2), { duracion_ms: 3000 });
  eq(duracionDeTramo(t, 'entera'), 3000);
  // pero ni a mano se baja del mínimo
  eq(duracionDeTramo(tramo('A1', P(0.2, 0.8), P(0.8, 0.2), { duracion_ms: 5 }), 'entera'), MINIMO_TRAMO_MS);
});

/* ── 3. Los arranques (§6.3) ─────────────────────────────── */

test('POR DEFECTO TODOS LOS CARRILES ARRANCAN A LA VEZ', () => {
  /* Es la respuesta a «si encadeno secuencias, ¿cómo hago que dos hagan
     algo a la vez?»: no se hace nada, se dibuja lo de cada uno. */
  const a = tramo('A1', P(0.2, 0.8), P(0.4, 0.4));
  const b = tramo('A2', P(0.8, 0.8), P(0.6, 0.4));
  const r = tiemposDe(conCarriles([a, b]), { pista: 'entera' });
  eq(r.tramos[a.id].inicio_ms, 0);
  eq(r.tramos[b.id].inicio_ms, 0);
});

test('dentro de un carril, EN SERIE: nadie corta y bota a la vez', () => {
  const a = tramo('A1', P(0.2, 0.8), P(0.4, 0.4));
  const b = tramo('A1', P(0.4, 0.4), P(0.7, 0.2));
  const r = tiemposDe(conCarriles([a, b]), { pista: 'entera' });
  eq(r.tramos[a.id].inicio_ms, 0);
  eq(r.tramos[b.id].inicio_ms, r.tramos[a.id].fin_ms, 'el segundo empieza cuando acaba el primero:');
});

test('QUIEN RECIBE UN PASE NO SALE HASTA QUE EL BALÓN LLEGA', () => {
  /* Sin esto el receptor echa a correr con el balón en el aire y la
     jugada se ve mal sin que nadie sepa decir por qué. */
  const pase = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2', ritmo: 'pase', tipo: 'pass' });
  const corre = tramo('A2', P(0.8, 0.8), P(0.8, 0.3));
  const r = tiemposDe(conCarriles([pase, corre]), { pista: 'entera' });
  eq(r.tramos[pase.id].inicio_ms, 0, 'el pase sale ya:');
  eq(r.tramos[corre.id].inicio_ms, r.tramos[pase.id].fin_ms, 'y el receptor cuando llega:');
  ok(r.tramos[corre.id].inicio_ms > 0, 'que no es cero');
});

test('pero lo que el receptor ya estaba haciendo NO se retrasa', () => {
  /* Si se estaba moviendo cuando se lo pasan, ese tramo empezó antes y
     no se toca: lo que espera es el PRIMERO que venga después. */
  const antes = tramo('A2', P(0.9, 0.9), P(0.8, 0.8));
  const pase = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2', ritmo: 'pase' });
  const despues = tramo('A2', P(0.8, 0.8), P(0.8, 0.3));
  const r = tiemposDe(conCarriles([antes, pase, despues]), { pista: 'entera' });
  eq(r.tramos[antes.id].inicio_ms, 0, 'lo que ya hacía arranca a la vez que el pase:');
  eq(r.tramos[despues.id].inicio_ms, Math.max(r.tramos[antes.id].fin_ms, r.tramos[pase.id].fin_ms),
    'y lo de después espera a lo que acabe más tarde de las dos cosas:');
});

test('IR A POR UN BALÓN SUELTO ESPERA A QUE ESTÉ SUELTO', () => {
  const tiro = tramo('A1', P(0.5, 0.7), P(0.5, 0.1), { corre_id: 'b1', accion: 'pasa', ritmo: 'pase' });
  const recoge = tramo('A2', P(0.3, 0.9), P(0.5, 0.2), { accion: 'recoge', balon_id: 'b1' });
  const r = tiemposDe(conCarriles([tiro, recoge]), { pista: 'entera' });
  eq(r.tramos[recoge.id].inicio_ms, r.tramos[tiro.id].fin_ms, 'no sale antes de que el balón se suelte:');
});

test('un tramo MANUAL conserva su instante y deja de recalcularse', () => {
  const a = tramo('A1', P(0.2, 0.8), P(0.4, 0.4));
  const b = tramo('A1', P(0.4, 0.4), P(0.7, 0.2), { manual: true, inicio_ms: 5000 });
  const r = tiemposDe(conCarriles([a, b]), { pista: 'entera' });
  eq(r.tramos[b.id].inicio_ms, 5000, 'lo que dijo el entrenador:');
  eq(r.tramos[b.id].fin_ms, 5000 + r.tramos[b.id].duracion_ms);
});

test('NO PUEDE HABER CICLOS: las dependencias apuntan siempre hacia atrás', () => {
  /* Es lo que garantiza que esto no se cuelgue nunca, y es una
     propiedad de las reglas, no del bucle: el receptor espera a un pase
     ANTERIOR y quien recoge espera a una suelta ANTERIOR. Dos pases
     cruzados, que es lo más parecido a un ciclo que se puede dibujar,
     salen encadenados y no en círculo. */
  const p1 = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2', ritmo: 'pase' });
  const p2 = tramo('A2', P(0.8, 0.8), P(0.2, 0.8), { corre_id: 'b2', accion: 'pasa', receptor_id: 'A1', ritmo: 'pase' });
  const r = tiemposDe(conCarriles([p1, p2]), { pista: 'entera' });
  eq(r.avisos, [], 'nada de ciclos:');
  eq(r.tramos[p1.id].inicio_ms, 0, 'el primero sale ya:');
  eq(r.tramos[p2.id].inicio_ms, r.tramos[p1.id].fin_ms, 'y el segundo cuando el balón ha llegado:');
});

test('y ENCADENADO LARGO también termina, con todo el mundo colocado', () => {
  /* Cinco pases seguidos: cada receptor espera al anterior. Si la
     resolución por pasadas se quedara corta, los últimos saldrían con
     arranque cero —todos a la vez— en vez de en fila. */
  const ids = ['A1', 'A2', 'A3', 'A4', 'A5', 'A1'];
  const lista = [];
  for (let i = 0; i < 5; i++) {
    lista.push(tramo(ids[i], P(0.2 + i * 0.1, 0.8), P(0.3 + i * 0.1, 0.8),
      { corre_id: 'b1', accion: 'pasa', receptor_id: ids[i + 1], ritmo: 'pase' }));
  }
  const r = tiemposDe(conCarriles(lista), { pista: 'entera' });
  eq(r.avisos, [], 'sin avisos:');
  for (let i = 1; i < 5; i++) {
    ok(r.tramos[lista[i].id].inicio_ms >= r.tramos[lista[i - 1].id].fin_ms,
      `el pase ${i + 1} no puede salir antes de que llegue el ${i}`);
  }
  ok(r.duracion_ms > r.tramos[lista[0].id].fin_ms * 3, 'y la fase dura la fila entera');
});

/* ── 4. Lo que dura la fase (§6.1) ───────────────────────── */

test('LA FASE DURA LO QUE EL CARRIL MÁS LARGO', () => {
  const corto = tramo('A1', P(0.5, 0.5), P(0.55, 0.52));
  const largo = tramo('A2', P(0.1, 0.9), P(0.9, 0.1));
  const fase = conCarriles([corto, largo]);
  const r = tiemposDe(fase, { pista: 'entera' });
  eq(r.duracion_ms, r.tramos[largo.id].fin_ms, 'manda el más largo:');
  ok(r.tramos[corto.id].fin_ms < r.duracion_ms, 'y el corto acaba antes y se queda quieto');
});

test('cada carril sabe cuánto dura, que es su barra en la línea de tiempo', () => {
  const a = tramo('A1', P(0.2, 0.8), P(0.4, 0.4));
  const b = tramo('A1', P(0.4, 0.4), P(0.7, 0.2));
  const c = tramo('A2', P(0.9, 0.9), P(0.85, 0.85));
  const fase = conCarriles([a, b, c]);
  const r = tiemposDe(fase, { pista: 'entera' });
  eq(duracionDeCarril(fase.carriles[0], r), r.tramos[b.id].fin_ms, 'el de A1 llega hasta su último tramo:');
  ok(duracionDeCarril(fase.carriles[1], r) < duracionDeCarril(fase.carriles[0], r));
  eq(duracionDeCarril(null, r), 0);
});

test('una duración de fase puesta a mano manda sobre la calculada', () => {
  const a = tramo('A1', P(0.2, 0.8), P(0.4, 0.4));
  const fase = { ...conCarriles([a]), duracion_ms: 9000 };
  eq(tiemposDe(fase, { pista: 'entera' }).duracion_ms, 9000);
});

test('una fase vacía dura cero y no da NaN', () => {
  const r = tiemposDe(nuevaFase('f1'), { pista: 'entera' });
  eq(r.duracion_ms, 0);
  eq(r.tramos, {});
  eq(r.avisos, []);
});

/* ── 5. Dónde acaba cada ficha (§6.4) ────────────────────── */

test('QUIEN NO SE MUEVE SE QUEDA DONDE ESTABA', () => {
  /* Por eso se parte de las posiciones de entrada: los carriles solo
     hablan de quien hace algo. */
  const a = tramo('A1', P(0.2, 0.8), P(0.6, 0.3));
  const entrada = { A1: P(0.2, 0.8), A2: P(0.8, 0.8), A3: P(0.5, 0.5) };
  const salida = posicionesFinales(conCarriles([a]), entrada);
  eq(salida.A1, P(0.6, 0.3), 'quien se mueve, acaba en su punta:');
  eq(salida.A2, P(0.8, 0.8), 'y quien no, donde estaba:');
  eq(salida.A3, P(0.5, 0.5));
});

test('EN UN PASE SE MUEVE EL BALÓN, NO EL QUE PASA', () => {
  const pase = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2' });
  const salida = posicionesFinales(conCarriles([pase]), { A1: P(0.2, 0.8), b1: P(0.24, 0.8) });
  eq(salida.A1, P(0.2, 0.8), 'el pasador se queda:');
  eq(salida.b1, P(0.8, 0.8), 'y el balón vuela:');
});

test('con varios tramos manda el ÚLTIMO de cada uno', () => {
  const a = tramo('A1', P(0.2, 0.8), P(0.4, 0.4));
  const b = tramo('A1', P(0.4, 0.4), P(0.7, 0.2));
  eq(posicionesFinales(conCarriles([a, b]), { A1: P(0.2, 0.8) }).A1, P(0.7, 0.2));
});

test('sin entrada ni fase, devuelve algo válido en vez de romperse', () => {
  eq(posicionesFinales(null, {}), {});
  eq(posicionesFinales(nuevaFase('f1'), {}), {});
});

/* ── 6. Lo que falta, declarado ──────────────────────────── */

test('el tercer arranque del §6.3 sale DECLARADO como pendiente, con su motivo', () => {
  ok(PENDIENTES.bloqueo, 'quien sale de un bloqueo espera al bloqueador');
  ok(PENDIENTES.bloqueo.length > 30, 'un pendiente sin motivo es un olvido');
  ok(/bloque/i.test(PENDIENTES.bloqueo));
});

/* ── Volver atrás y arrastrar a las siguientes (§6.5) ── */

test('AL CAMBIAR UNA FASE, LAS SIGUIENTES SE ESTIRAN DESDE EL SITIO NUEVO', () => {
  /* Sin esto, corregir la fase 1 dejaba la fase 2 dibujada desde un
     sitio donde ya no hay nadie. */
  const f2 = conCarriles([tramo('A1', P(0.5, 0.5), P(0.9, 0.1))]);
  const r = reanclarFase(f2, { A1: P(0.3, 0.7) }, 'entera');
  const t = r.carriles[0].tramos[0];
  eq([t.trazo[0].x, t.trazo[0].y], [0.3, 0.7], 'arranca donde está ahora:');
  eq([t.trazo[1].x, t.trazo[1].y], [0.9, 0.1], 'y EL DESTINO SE QUEDA QUIETO:');
  eq(t.huerfano, false);
});

test('EL ORIGEN LO PONE QUIEN ACTÚA, NO QUIEN VIAJA', () => {
  /* Un pase sale del pasador aunque lo recorra el balón. Siguiendo a
     quien viaja, el pase arrancaría desde donde quedó el balón. */
  const pase = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2' });
  const r = reanclarFase(conCarriles([pase]), { A1: P(0.4, 0.6), b1: P(0.44, 0.6) }, 'entera');
  const t = r.carriles[0].tramos[0];
  eq([t.trazo[0].x, t.trazo[0].y], [0.4, 0.6], 'sale del pasador:');
  eq([t.trazo[1].x, t.trazo[1].y], [0.8, 0.8], 'y llega donde llegaba:');
});

test('dentro de un carril, DESPUÉS DE PASAR el pasador no se ha movido', () => {
  /* El trazo siguiente solo arranca donde acabó el anterior si la ficha
     lo recorrió. Encadenando a ciegas, el que pasa aparecería de golpe
     donde acabó su propio pase. */
  const pase = tramo('A1', P(0.2, 0.8), P(0.8, 0.8), { corre_id: 'b1', accion: 'pasa', receptor_id: 'A2' });
  const corta = tramo('A1', P(0.2, 0.8), P(0.3, 0.3));
  const r = reanclarFase(conCarriles([pase, corta]), { A1: P(0.4, 0.6) }, 'entera');
  const [p, c] = r.carriles[0].tramos;
  eq([p.trazo[0].x, p.trazo[0].y], [0.4, 0.6]);
  eq([c.trazo[0].x, c.trazo[0].y], [0.4, 0.6], 'el corte también sale de donde sigue estando:');
});

test('y si SÍ lo recorrió, el siguiente arranca en su punta', () => {
  const a = tramo('A1', P(0.2, 0.8), P(0.5, 0.5));
  const b = tramo('A1', P(0.5, 0.5), P(0.9, 0.2));
  const r = reanclarFase(conCarriles([a, b]), { A1: P(0.1, 0.9) }, 'entera');
  const [x, y] = r.carriles[0].tramos;
  eq([x.trazo[0].x, x.trazo[0].y], [0.1, 0.9]);
  eq([y.trazo[0].x, y.trazo[0].y], [x.trazo[1].x, x.trazo[1].y], 'encadenados:');
  eq([y.trazo[1].x, y.trazo[1].y], [0.9, 0.2], 'con su destino intacto:');
});

test('UN TRAMO SIN PROTAGONISTA NO SE BORRA EN SILENCIO: se marca', () => {
  /* Borrarlo sin decir nada sería hacer desaparecer trabajo del
     entrenador. Se marca y quien nos usa lo enseña (§6.5). */
  const t = tramo('A9', P(0.5, 0.5), P(0.9, 0.1));
  const r = reanclarFase(conCarriles([t]), { A1: P(0.3, 0.7) }, 'entera');
  eq(r.carriles[0].tramos[0].huerfano, true);
  eq(r.carriles[0].tramos[0].trazo, t.trazo, 'y su trazo se queda tal cual:');
});

test('RECALCULAR ARRASTRA LA CADENA ENTERA, fase tras fase', () => {
  /* A1 corre en la 1 y vuelve a correr en la 2. Cambiando dónde empieza
     la 1, la 2 tiene que salir del nuevo final de la 1. */
  const f1 = conCarriles([tramo('A1', P(0.2, 0.9), P(0.5, 0.5))]);
  const f2 = conCarriles([tramo('A1', P(0.5, 0.5), P(0.9, 0.1))]);
  const r = recalcular([{ ...f1, id: 'f1' }, { ...f2, id: 'f2' }], { A1: P(0.1, 0.95) }, 'entera');
  const t1 = r.fases[0].carriles[0].tramos[0];
  const t2 = r.fases[1].carriles[0].tramos[0];
  eq([t1.trazo[0].x, t1.trazo[0].y], [0.1, 0.95], 'la 1 sale del sitio nuevo:');
  eq([t2.trazo[0].x, t2.trazo[0].y], [t1.trazo[1].x, t1.trazo[1].y], 'y la 2 del final de la 1:');
  eq([t2.trazo[1].x, t2.trazo[1].y], [0.9, 0.1], 'con su destino intacto:');
  eq(r.huerfanos, []);
  eq(r.entradas.length, 2, 'y sale dónde empieza cada fase:');
});

test('quien no se mueve en una fase llega igual a la siguiente', () => {
  const f1 = conCarriles([tramo('A1', P(0.2, 0.9), P(0.5, 0.5))]);
  const f2 = conCarriles([tramo('A2', P(0.8, 0.8), P(0.6, 0.4))]);
  const r = recalcular([{ ...f1, id: 'f1' }, { ...f2, id: 'f2' }], { A1: P(0.2, 0.9), A2: P(0.8, 0.8) }, 'entera');
  eq(r.huerfanos, [], 'A2 no sale en la fase 1, pero sigue en la pista');
  eq(r.entradas[1].A2, P(0.8, 0.8));
});

test('recalcular DICE quién se ha quedado huérfano, con su fase', () => {
  const f1 = conCarriles([tramo('A1', P(0.2, 0.9), P(0.5, 0.5))]);
  const f2 = conCarriles([tramo('A9', P(0.5, 0.5), P(0.9, 0.1))]);
  const r = recalcular([{ ...f1, id: 'f1' }, { ...f2, id: 'f2' }], { A1: P(0.2, 0.9) }, 'entera');
  eq(r.huerfanos.length, 1);
  eq(r.huerfanos[0].fase, 'f2');
  eq(r.huerfanos[0].elemento, 'A9');
});

test('recalcular no muta lo que recibe', () => {
  const f1 = conCarriles([tramo('A1', P(0.2, 0.9), P(0.5, 0.5))]);
  const copia = JSON.parse(JSON.stringify(f1));
  recalcular([f1], { A1: P(0.7, 0.7) }, 'entera');
  eq(f1, copia, 'la fase original ha cambiado:');
});

test('sin fases ni entrada, no rompe', () => {
  eq(recalcular([], {}, 'entera'), { fases: [], entradas: [], huerfanos: [] });
  eq(recalcular(null, {}, 'entera').fases, []);
  eq(reanclarFase(null, {}, 'entera').carriles, []);
});

/* ── De quién es el balón al volver a una fase (§6.5) ───── */

const pase = (de, a, bal) => ({ id: `tp${++n}`, elemento_id: de, corre_id: bal, receptor_id: a, accion: 'pasa', trazo: [] });

test('VOLVER A UNA FASE DEVUELVE EL BALÓN A QUIEN LO TENÍA ENTONCES', () => {
  /* A1 pasa a A2 en la fase 1 y A2 se lo devuelve en la 2. El modelo
     dice que es de A1 (lo último dibujado); al volver a la 1, es de A2. */
  const fases = [{ tramos: [pase('A1', 'A2', 'b1')] }, { tramos: [pase('A2', 'A1', 'b1')] }];
  eq(posesionAlFinal(fases, 0, { b1: 'A1' }).b1, 'A2', 'al acabar la fase 1:');
  eq(posesionAlFinal(fases, 1, { b1: 'A1' }).b1, 'A1', 'al acabar la 2:');
});

test('antes de la primera fase, el dueño del principio', () => {
  eq(posesionAlFinal([{ tramos: [pase('A1', 'A2', 'b1')] }], -1, { b1: 'A1' }).b1, 'A1');
});

test('un pase AL SUELO deja el balón sin dueño', () => {
  eq(posesionAlFinal([{ tramos: [pase('A1', null, 'b1')] }], 0, { b1: 'A1' }).b1, null);
});

test('quien recoge se lo queda', () => {
  const fases = [{ tramos: [pase('A1', null, 'b1')] }, { tramos: [{ id: 'tq', elemento_id: 'A3', corre_id: 'A3', balon_id: 'b1', accion: 'recoge', trazo: [] }] }];
  eq(posesionAlFinal(fases, 1, { b1: 'A1' }).b1, 'A3');
});

test('correr con el balón no cambia de quién es, y los balones quietos tampoco', () => {
  const fases = [{ tramos: [{ id: 'tb', elemento_id: 'A1', corre_id: 'A1', accion: 'bota', trazo: [] }] }];
  eq(posesionAlFinal(fases, 0, { b1: 'A1', b2: null }), { b1: 'A1', b2: null });
});

test('se lee del DATO, no del nombre de la acción', () => {
  /* Una acción nueva del club que mueva el balón funciona sin tocar esto. */
  const fases = [{ tramos: [{ id: 'tx', elemento_id: 'A1', corre_id: 'b1', receptor_id: 'A4', accion: 'accion_nueva_del_club', trazo: [] }] }];
  eq(posesionAlFinal(fases, 0, { b1: 'A1' }).b1, 'A4');
});

test('pedir más allá de la última fase se para en la última, y no toca lo que recibe', () => {
  const inicial = { b1: 'A1' };
  eq(posesionAlFinal([{ tramos: [pase('A1', 'A2', 'b1')] }], 99, inicial).b1, 'A2');
  eq(inicial, { b1: 'A1' }, 'el dueño del principio ha cambiado:');
  eq(posesionAlFinal(null, 3, { b1: 'A1' }), { b1: 'A1' });
});

/* ── La escena: poner y quitar ───────────────────────────── */

const p = (x, y) => ({ x, y });
/* A1 pasa a A2 con b1; A3 recoge b2 del suelo; A4 tiene b3 y no hace
   nada. En la fase 2, A2 corta. */
const escena = () => [
  {
    id: 'f1',
    tramos: [
      { id: 'ta', elemento_id: 'A1', corre_id: 'b1', receptor_id: 'A2', trazo: [] },
      { id: 'tb', elemento_id: 'A3', corre_id: 'A3', balon_id: 'b2', trazo: [] },
    ],
    entrada: { A1: p(0.3, 0.7), A2: p(0.7, 0.7), A3: p(0.5, 0.5), A4: p(0.2, 0.2), b1: p(0.31, 0.7), b2: p(0.6, 0.4), b3: p(0.21, 0.2) },
    posesion: { b1: 'A1', b2: null, b3: 'A4' },
  },
  {
    id: 'f2',
    tramos: [{ id: 'tc', elemento_id: 'A2', corre_id: 'A2', trazo: [] }],
    entrada: { A1: p(0.3, 0.7), A2: p(0.7, 0.7), A4: p(0.2, 0.2), b3: p(0.21, 0.2) },
  },
];

test('TRAMOS CON FICHA: la encuentra actúe, corra, reciba o sea el balón que se recoge', () => {
  const f = escena();
  eq(tramosConFicha(f, 'A1').map((r) => r.tramo.id), ['ta'], 'el que pasa:');
  eq(tramosConFicha(f, 'b1').map((r) => r.tramo.id), ['ta'], 'el balón que vuela:');
  eq(tramosConFicha(f, 'A2').map((r) => `${r.fase}:${r.tramo.id}`), ['0:ta', '1:tc'], 'el que recibe, y también en la fase 2:');
  eq(tramosConFicha(f, 'b2').map((r) => r.tramo.id), ['tb'], 'el balón que se recoge:');
  eq(tramosConFicha(f, 'A4'), [], 'quien no hace nada:');
});

test('sin id no hay tramos: un receptor vacío no es «este jugador»', () => {
  /* `receptor_id` es null en un pase al suelo: sin la guarda, pedir los
     tramos de una ficha sin id devolvía todos esos pases. */
  eq(tramosConFicha(escena(), undefined), []);
  eq(tramosConFicha(escena(), null), []);
  eq(tramosConFicha(null, 'A1'), []);
});

test('BALÓN EN JUEGO: el que vuela o se recoge sí; el que nadie toca, no', () => {
  const f = escena();
  ok(balonEnJuego(f, 'b1'), 'b1 se pasa');
  ok(balonEnJuego(f, 'b2'), 'b2 se recoge');
  ok(!balonEnJuego(f, 'b3'), 'b3 nadie lo toca');
});

test('FICHA NUEVA: entra en el arranque de la fase 1, y en nada más', () => {
  const f = escena();
  const r = conFichaNueva(f, { id: 'A5', kind: 'jugador', x: 0.4, y: 0.6 });
  eq(r[0].entrada.A5, p(0.4, 0.6));
  ok(!('A5' in r[1].entrada), 'la fase 2 se deduce recalculando, no se escribe aquí');
  ok(!('A5' in r[0].posesion), 'un jugador no es un balón');
  ok(!('A5' in f[0].entrada), 'y no toca lo que recibe');
});

test('un BALÓN nuevo apunta de quién es al empezar, suelto o en las manos de alguien', () => {
  eq(conFichaNueva(escena(), { id: 'b4', kind: 'balon', x: 0.5, y: 0.5, portador_id: null })[0].posesion.b4, null);
  eq(conFichaNueva(escena(), { id: 'b4', kind: 'balon', x: 0.5, y: 0.5, portador_id: 'A3' })[0].posesion.b4, 'A3');
  eq(conFichaNueva(escena(), { id: 'b4', kind: 'balon', x: 0.5, y: 0.5 })[0].posesion.b4, null, 'sin portador, suelto:');
});

test('una ficha nueva, al recalcular, sigue quieta en las fases siguientes', () => {
  const f = [
    { ...nuevaFase('f1'), tramos: [], entrada: { A1: p(0.3, 0.7) } },
    { ...nuevaFase('f2'), tramos: [], entrada: { A1: p(0.3, 0.7) } },
  ];
  const r = conFichaNueva(f, { id: 'A2', kind: 'jugador', x: 0.6, y: 0.4 });
  const rc = recalcular(r.map((x) => ({ ...x, carriles: carrilesDesde(x.tramos) })), r[0].entrada);
  eq(rc.entradas[1].A2, p(0.6, 0.4));
});

test('sin ficha o sin fases, no cambia nada', () => {
  const f = escena();
  eq(conFichaNueva(f, null), f);
  eq(conFichaNueva([], { id: 'A5', kind: 'jugador', x: 0, y: 0 }), []);
});

test('QUITAR: sale de las entradas de TODAS las fases, y solo ella', () => {
  const r = sinFichas(escena(), ['A4']);
  ok(!('A4' in r[0].entrada) && !('A4' in r[1].entrada), 'sigue en alguna fase');
  ok('A1' in r[0].entrada && 'A1' in r[1].entrada, 'se ha llevado a quien no debía');
});

test('quitar al portador deja su balón SUELTO al empezar; quitar el balón lo borra de la posesión', () => {
  eq(sinFichas(escena(), ['A4'])[0].posesion.b3, null, 'el balón de A4:');
  const s = sinFichas(escena(), 'b3');
  ok(!('b3' in s[0].posesion), 'el balón quitado sigue con dueño');
  eq(s[0].posesion.b1, 'A1', 'los demás no cambian:');
  ok(!('posesion' in s[1]), 'a una fase sin posesión no se le inventa una');
});

test('quitar no toca lo que recibe ni los tramos, y sin nada que quitar devuelve lo mismo', () => {
  const f = escena();
  const r = sinFichas(f, ['A1']);
  ok('A1' in f[0].entrada, 'ha tocado la original');
  eq(r[0].tramos.length, 2, 'los tramos son decisión de quien quita:');
  ok(sinFichas(f, []) === f, 'sin nada que quitar, la misma jugada');
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
