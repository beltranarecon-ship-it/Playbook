/* ============================================================
   eval-frase.mjs — banco Node de la frase automática
   (taller/js/pizarra/motor/frase.js). Sin red, sin DOM.

     node taller/tools/eval-frase.mjs

   La frase de cada fase (§9.1) es lo que la Pizarra enseña, lo que lee
   la voz y el desarrollo que se lleva al paso 3. Aquí se prueba que cada
   acción y cada variante se dicen, que el ejemplo de la especificación
   sale tal cual, y que la defensa va al final, aparte.
   ============================================================ */

import { frasesDeJugada, fraseDeFase, COMO_SE_DICE, unir, nombreEnFrase } from '../js/pizarra/motor/frase.js';
import { VARIANTES } from '../js/pizarra/repertorio.js';
import { CATALOGO_SISTEMA } from '../js/ia/acciones.js';
import { posicionesDe } from '../js/canvas/anclas.js';

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

/* Los sitios de la pista entera atacando al norte. */
const A = Object.fromEntries(Object.entries(posicionesDe('entera', 'norte')).map(([k, [x, y]]) => [k, { x, y }]));
const N = (p) => ({ x: p.x, y: p.y, tipo_nodo: 'lineal' });
const jugador = (id, equipo, label, p, extra = {}) => ({ id, kind: 'jugador', equipo, label, dorsal: null, x: p.x, y: p.y, en_juego: true, ...extra });
const balon = (id, portador, p) => ({ id, kind: 'balon', portador_id: portador, x: p.x + 0.04, y: p.y });
const cono = (id, p, extra = {}) => ({ id, kind: 'cono', x: p.x, y: p.y, nombre: null, fila: null, ...extra });
let n = 0;
const tr = (elemento_id, corre_id, accion, desde, hasta, extra = {}) => ({
  id: `tr${++n}`, elemento_id, corre_id, receptor_id: null, accion, tipo: 'run', variante: null,
  trazo: [N(desde), N(hasta)], ...extra,
});
const jugada = (elementos, fases) => ({ version: 3, pista: 'entera', canasta: 'norte', elementos, fases: fases.map((tramos, i) => ({ id: `f${i + 1}`, tramos })) });
const P = (x, y) => ({ x, y });

/* ── 1. El ejemplo de la especificación ──────────────────── */

console.log('· el ejemplo del §9.1');

test('«A1 BOTA HASTA EL CODO DERECHO Y PASA PICADO A A2, QUE HA CORTADO A LA ESQUINA…»', () => {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der),
    balon('b1', 'j1', A.base), jugador('j3', 'B', '1', P(A.base.x, A.base.y - 0.05)),
    jugador('j4', 'B', '2', P(A.alero_der.x - 0.03, A.alero_der.y - 0.03)),
  ];
  const f = [
    tr('j1', 'j1', 'bota', A.base, A.codo_der),
    tr('j2', 'j2', 'corta', A.alero_der, A.esquina_der),
    tr('j1', 'b1', 'pasa', A.codo_der, A.esquina_der, { tipo: 'pass', receptor_id: 'j2', variante: 'picado' }),
  ];
  eq(frasesDeJugada(jugada(el, [f])), [
    'A1 bota hasta el codo derecho y pasa picado a A2, que ha cortado a la esquina derecha. B1 y B2 siguen a su par por el lado de canasta.',
  ]);
});

/* ── 2. Cada acción y cada variante ──────────────────────── */

console.log('· cada acción y cada variante');

test('TODAS LAS VARIANTES DEL CATÁLOGO TIENEN CÓMO DECIRSE, y ninguna sobra', () => {
  for (const [accion, lista] of Object.entries(VARIANTES)) {
    ok(COMO_SE_DICE[accion], `falta ${accion}`);
    eq(Object.keys(COMO_SE_DICE[accion]).sort(), lista.map((v) => v.slug).sort(), `${accion}:`);
  }
  eq(Object.keys(COMO_SE_DICE).sort(), Object.keys(VARIANTES).sort());
});

function unaAccion(accion, variante = null) {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), jugador('j5', 'A', '5', A.codo_izq),
    balon('b1', 'j1', A.base),
  ];
  const t = {
    pasa: () => tr('j1', 'b1', 'pasa', A.base, A.alero_der, { tipo: 'pass', receptor_id: 'j2', variante }),
    tira: () => tr('j1', 'b1', 'tira', A.base, A.aro, { tipo: 'pass', desenlace: 'entra', variante }),
    entra: () => tr('j1', 'j1', 'entra', A.base, P(A.aro.x, A.aro.y + 0.04), { variante }),
    bota: () => tr('j1', 'j1', 'bota', A.base, A.codo_der, { variante }),
    corta: () => tr('j2', 'j2', 'corta', A.alero_der, A.esquina_der, { variante }),
    bloquea: () => tr('j5', 'j5', 'bloquea', A.codo_izq, P(A.base.x - 0.02, A.base.y - 0.03), { tipo: 'bloqueo', companero_id: 'j1', variante }),
    recoge: () => tr('j1', 'j1', 'recoge', A.base, A.codo_der, { balon_id: 'b1' }),
    vuelve_a_fila: () => tr('j1', 'j1', 'vuelve_a_fila', A.base, A.centro),
    rodea: () => tr('j1', 'j1', 'rodea', A.base, A.codo_der, { variante }),
  }[accion];
  return t ? fraseDeFase(jugada(el, [[t()]]), 0) : null;
}

test('CADA ACCIÓN QUE SE DIBUJA SE DICE, con su sujeto y su verbo', () => {
  const esperado = {
    pasa: 'A1 pasa a A2.',
    tira: 'A1 tira desde la punta y anota.',
    entra: 'A1 entra a canasta.',
    bota: 'A1 bota hasta el codo derecho.',
    corta: 'A2 corta a la esquina derecha.',
    bloquea: 'A5 bloquea para A1.',
    recoge: 'A1 recoge el balón.',
    vuelve_a_fila: 'A1 vuelve al final de la fila.',
  };
  for (const [accion, frase] of Object.entries(esperado)) eq(unaAccion(accion), frase, `${accion}:`);
  const dibujables = CATALOGO_SISTEMA.filter((a) => a.familia !== 'gesto' && a.familia !== 'entre_dos').map((a) => a.slug);
  for (const slug of dibujables) {
    const f = unaAccion(slug);
    if (f === null) continue;
    ok(f && /^A\d /.test(f), `${slug} sin sujeto: ${f}`);
  }
});

test('CADA VARIANTE SE DICE DENTRO DE SU FRASE', () => {
  for (const [accion, lista] of Object.entries(VARIANTES)) {
    for (const v of lista) {
      const f = unaAccion(accion, v.slug);
      const trozo = COMO_SE_DICE[accion][v.slug];
      if (accion === 'tira' && v.slug === 'palmeo') { ok(/palmea/.test(f), f); continue; }
      if (accion === 'bloquea' && v.slug === 'mano_a_mano') { eq(f, 'A5 hace un mano a mano con A1.'); continue; }
      ok(f.includes(trozo.trim()), `${accion}/${v.slug}: «${trozo}» no está en «${f}»`);
    }
  }
  eq(unaAccion('bloquea', 'directo'), 'A5 pone un bloqueo directo a A1.');
  eq(unaAccion('bota', 'cambio_mano'), 'A1 bota con cambio de mano hasta el codo derecho.');
});

/* ── 3. Cómo se encadena ─────────────────────────────────── */

console.log('· cómo se encadena');

test('LO DE CADA UNO VA SEGUIDO, en el orden en que empieza cada jugador', () => {
  const el = [jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_izq), balon('b1', 'j1', A.base)];
  const f = [
    tr('j1', 'j1', 'bota', A.base, A.codo_der),
    tr('j1', 'b1', 'pasa', A.codo_der, A.alero_izq, { tipo: 'pass', receptor_id: 'j2' }),
    tr('j1', 'j1', 'corta', A.codo_der, A.aro),
    tr('j2', 'b1', 'tira', A.alero_izq, A.aro, { tipo: 'pass', desenlace: 'falla' }),
  ];
  eq(fraseDeFase(jugada(el, [f]), 0), 'A1 bota hasta el codo derecho, pasa a A2 y corta al aro. A2 tira desde el alero izquierdo y falla.');
});

test('ENTRAR Y TIRAR ES UNA ENTRADA: «entra a canasta en bandeja y anota»', () => {
  const el = [jugador('j1', 'A', '1', A.base), balon('b1', 'j1', A.base)];
  const cerca = P(A.aro.x, A.aro.y + 0.04);
  const f = [
    tr('j1', 'j1', 'entra', A.base, cerca, { variante: 'bandeja' }),
    tr('j1', 'b1', 'tira', cerca, A.aro, { tipo: 'pass', desenlace: 'entra' }),
  ];
  eq(fraseDeFase(jugada(el, [f]), 0), 'A1 entra a canasta en bandeja y anota.');
});

test('EL REBOTE ES REBOTE si el balón viene de un tiro, aunque sea de la fase anterior', () => {
  const el = [jugador('j1', 'A', '1', A.alero_der), jugador('j2', 'A', '2', A.poste_bajo_izq), balon('b1', 'j1', A.alero_der)];
  const tiro = tr('j1', 'b1', 'tira', A.alero_der, A.aro, { tipo: 'pass', desenlace: 'falla' });
  const rebote = tr('j2', 'j2', 'recoge', A.poste_bajo_izq, A.aro, { balon_id: 'b1' });
  eq(frasesDeJugada(jugada(el, [[tiro], [rebote]])), ['A1 tira desde el alero derecho y falla.', 'A2 coge el rebote.']);
});

test('LOS CONOS: rodeando uno por su lado, sorteando varios, pasando por la puerta', () => {
  const el = [jugador('j1', 'A', '1', A.base), cono('cono_2', A.codo_der), cono('cono_3', A.codo_izq), cono('cono_4', A.tiro_libre)];
  const con = (sorteando) => fraseDeFase(jugada(el, [[tr('j1', 'j1', 'corta', A.base, A.aro, { sorteando })]]), 0);
  eq(con([{ cono: 'cono_2', lado: 'der', tipo: 'rodeo' }]), 'A1 corta al aro rodeando el cono 2 por la derecha.');
  eq(con([{ cono: 'cono_2', lado: 'der', tipo: 'zigzag' }, { cono: 'cono_3', lado: 'izq', tipo: 'zigzag' }, { cono: 'cono_4', lado: 'der', tipo: 'zigzag' }]), 'A1 corta al aro sorteando los conos.');
  eq(con([{ cono: 'cono_2', puerta: ['cono_2', 'cono_3'], tipo: 'puerta' }]), 'A1 corta al aro pasando por la puerta.');
  eq(con([{ cono: 'cono_2', lado: 'der', tipo: 'rodeo', anulado: true }]), 'A1 corta al aro.', 'lo anulado no se cuenta:');
});

test('EL DESTINO ES UN CONO si no cae en ninguna zona', () => {
  const lejos = P(0.5, 0.62);
  const el = [jugador('j1', 'A', '1', A.centro), cono('cono_7', lejos)];
  eq(fraseDeFase(jugada(el, [[tr('j1', 'j1', 'corta', A.centro, P(lejos.x + 0.01, lejos.y))]]), 0), 'A1 corta al cono 7.');
  eq(fraseDeFase(jugada(el, [[tr('j1', 'j1', 'corta', A.centro, P(0.2, 0.7))]]), 0), 'A1 corta.', 'y a ninguna parte con nombre, sin destino:');
});

test('LO QUE PASA SE CUENTA EN EL ORDEN EN QUE PASA: un «dame y va» no tira antes de recibir', () => {
  const el = [jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), balon('b1', 'j1', A.base)];
  const f = [
    tr('j1', 'b1', 'pasa', A.base, A.alero_der, { tipo: 'pass', receptor_id: 'j2' }),
    tr('j2', 'b1', 'pasa', A.alero_der, A.base, { tipo: 'pass', receptor_id: 'j1' }),
    tr('j1', 'b1', 'tira', A.base, A.aro, { tipo: 'pass', desenlace: 'entra', variante: 'tras_recepcion' }),
  ];
  eq(fraseDeFase(jugada(el, [f]), 0), 'A1 pasa a A2. A2 pasa a A1. A1 tira tras recepción desde la punta y anota.');
});

test('LA SUBORDINADA SE CIERRA: lo que hace después el que pasa no parece del que recibe', () => {
  const el = [jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), balon('b1', 'j1', A.base)];
  const f = [
    tr('j2', 'j2', 'corta', A.alero_der, A.esquina_der, { variante: 'puerta_atras' }),
    tr('j1', 'b1', 'pasa', A.base, A.esquina_der, { tipo: 'pass', receptor_id: 'j2' }),
    tr('j1', 'j1', 'corta', A.base, A.aro),
  ];
  eq(fraseDeFase(jugada(el, [f]), 0), 'A1 pasa a A2, que ha cortado por la puerta atrás a la esquina derecha, y corta al aro.',
    'con la coma de cierre y con la variante del corte:');
});

test('DOS CORTES ANTES DE RECIBIR: se dice dónde recibe', () => {
  const el = [jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), balon('b1', 'j1', A.base)];
  const f = [
    tr('j2', 'j2', 'corta', A.alero_der, A.poste_bajo_der),
    tr('j2', 'j2', 'corta', A.poste_bajo_der, A.esquina_der),
    tr('j1', 'b1', 'pasa', A.base, A.esquina_der, { tipo: 'pass', receptor_id: 'j2' }),
  ];
  eq(fraseDeFase(jugada(el, [f]), 0), 'A1 pasa a A2, que ha cortado al poste bajo derecho y después a la esquina derecha.');
});

test('EL DESTINO ES EL CONO si el trazo acaba en él, aunque caiga en una zona', () => {
  const enLaPunta = P(A.base.x, A.base.y - 0.02);
  const el = [jugador('j1', 'A', '1', A.centro), cono('cono_3', enLaPunta)];
  eq(fraseDeFase(jugada(el, [[tr('j1', 'j1', 'corta', A.centro, enLaPunta)]]), 0), 'A1 corta al cono 3.');
});

test('TRAS UNA CANASTA NO HAY REBOTE; y un tiro pegado al aro es una finalización', () => {
  const el = [jugador('j1', 'A', '1', A.alero_der), jugador('j2', 'A', '2', A.poste_bajo_izq), balon('b1', 'j1', A.alero_der)];
  const tiro = tr('j1', 'b1', 'tira', A.alero_der, A.aro, { tipo: 'pass', desenlace: 'entra' });
  const recoge = tr('j2', 'j2', 'recoge', A.poste_bajo_izq, A.aro, { balon_id: 'b1' });
  eq(frasesDeJugada(jugada(el, [[tiro], [recoge]]))[1], 'A2 recoge el balón.');
  const pegado = P(A.aro.x + 0.06, A.aro.y + 0.02);
  const el2 = [jugador('j1', 'A', '1', pegado), balon('b1', 'j1', pegado)];
  ok(/finaliza junto al aro/.test(fraseDeFase(jugada(el2, [[tr('j1', 'b1', 'tira', pegado, A.aro, { tipo: 'pass', desenlace: 'falla' })]]), 0)), 'ni «tira desde el aro»');
});

test('A UNO DE LA FILA SE LE PASA «AL 2.º», no «a el 2.º»', () => {
  const c = cono('cono_1', A.centro, { fila: { n: 2, equipo: 'A', papel: 'atacante', balon: false, orientacion: 90, vuelta: null, rondas: false, cadencia_ms: null } });
  const el = [
    c, jugador('j1', 'A', '1', A.centro, { fila_de: 'cono_1', puesto: 0 }),
    jugador('j2', 'A', null, P(A.centro.x, A.centro.y + 0.05), { fila_de: 'cono_1', puesto: 1, en_juego: false }),
    balon('b1', 'j1', A.centro),
  ];
  eq(fraseDeFase(jugada(el, [[tr('j1', 'b1', 'pasa', A.centro, P(A.centro.x, A.centro.y + 0.05), { tipo: 'pass', receptor_id: 'j2' })]]), 0),
    'A1 pasa al 2.º de la fila.');
});

/* ── 4. La defensa, aparte y al final ────────────────────── */

console.log('· la defensa');

function conDefensa(regla = null) {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), balon('b1', 'j1', A.base),
    jugador('j3', 'B', '1', P(A.base.x, A.base.y - 0.04)), jugador('j4', 'B', '2', P(A.alero_der.x - 0.03, A.alero_der.y - 0.03)),
  ];
  const j = jugada(el, [[tr('j1', 'j1', 'bota', A.base, A.codo_der)]]);
  if (regla) j.defensa = { preajuste: regla, parametros: {}, situacion: null };
  return j;
}

test('LA DEFENSA QUE SE MUEVE SOLA VA AL FINAL, según la regla que cumple', () => {
  eq(fraseDeFase(conDefensa(), 0), 'A1 bota hasta el codo derecho. B1 y B2 siguen a su par por el lado de canasta.');
  ok(/B1 presiona a A1/.test(fraseDeFase(conDefensa('presion'), 0)), fraseDeFase(conDefensa('presion'), 0));
});

test('LO QUE HA DICHO EL ENTRENADOR VA ANTES QUE LO QUE SALE SOLO', () => {
  const j = conDefensa();
  j.fases[0].defensa = { j4: { accion: 'ayuda', objetivo_id: 'j1' } };
  eq(fraseDeFase(j, 0), 'A1 bota hasta el codo derecho. B2 ayuda sobre A1 y vuelve con su par. B1 sigue a A1 por el lado de canasta.',
    'cada cosa dicha en su oración, para que no se mezclen:');
  j.fases[0].defensa = { j3: { accion: 'roba', objetivo_id: 'j1' } };
  ok(/B1 le roba el balón a A1, y su equipo pasa a atacar\./.test(fraseDeFase(j, 0)), fraseDeFase(j, 0));
});

test('UN PASE AL QUE LE ROBAN ES UNA INTERCEPTACIÓN', () => {
  const j = conDefensa();
  j.fases[0].tramos.push(tr('j1', 'b1', 'pasa', A.codo_der, A.alero_der, { tipo: 'pass', receptor_id: 'j2' }));
  j.fases[0].defensa = { j4: { accion: 'roba', objetivo_id: 'j2' } };
  ok(/B2 intercepta el pase para A2, y su equipo pasa a atacar\./.test(fraseDeFase(j, 0)), fraseDeFase(j, 0));
});

test('TRAS UN TIRO QUE FALLA, LA DEFENSA CIERRA EL REBOTE; y quien ha dibujado algo suyo no sale dos veces', () => {
  const el = [
    jugador('j1', 'A', '1', A.base), jugador('j2', 'A', '2', A.alero_der), balon('b1', 'j1', A.base),
    jugador('j3', 'B', '1', P(A.base.x, A.base.y - 0.04)), jugador('j4', 'B', '2', P(A.alero_der.x - 0.03, A.alero_der.y - 0.03)),
  ];
  const tiro = tr('j1', 'b1', 'tira', A.base, A.aro, { tipo: 'pass', desenlace: 'falla' });
  eq(fraseDeFase(jugada(el, [[tiro]]), 0), 'A1 tira desde la punta y falla. B1 y B2 siguen a su par por el lado de canasta. Tras el tiro, B1 y B2 cierran el rebote.');
  const rebote = tr('j3', 'j3', 'recoge', P(A.base.x, A.base.y - 0.04), A.aro, { balon_id: 'b1' });
  const f = fraseDeFase(jugada(el, [[tiro, rebote]]), 0);
  ok(/B1 coge el rebote\./.test(f) && !/B1 y B2/.test(f) && /B2 sigue a A2/.test(f), f);
});

/* ── 5. Filas, nombres y lo que no hay ───────────────────── */

console.log('· filas, nombres y lo que no hay');

test('UNA FILA POR RONDAS SE CUENTA EN UNA LÍNEA, no ronda a ronda', () => {
  const c = cono('cono_1', A.centro, { fila: { n: 3, equipo: 'A', papel: 'atacante', balon: false, orientacion: 90, vuelta: null, rondas: true, cadencia_ms: null } });
  const el = [
    c,
    jugador('j1', 'A', '1', A.centro, { fila_de: 'cono_1', puesto: 0 }),
    jugador('j2', 'A', null, P(A.centro.x, A.centro.y + 0.05), { fila_de: 'cono_1', puesto: 1, en_juego: false }),
    jugador('j3', 'A', null, P(A.centro.x, A.centro.y + 0.10), { fila_de: 'cono_1', puesto: 2, en_juego: false }),
  ];
  const j = jugada(el, [[tr('j1', 'j1', 'corta', A.centro, A.aro)]]);
  eq(fraseDeFase(j, 0), 'A1 corta al aro. Detrás, lo repiten uno a uno los otros 2 de la fila.');
  /* Con uno de fuera que le pasa a cada uno: repiten los de la cola, no él. */
  const conPasador = jugada([
    ...el, jugador('j9', 'A', '9', A.alero_der), balon('b9', 'j9', A.alero_der),
  ], [[tr('j1', 'j1', 'corta', A.centro, A.codo_der), tr('j9', 'b9', 'pasa', A.alero_der, A.codo_der, { tipo: 'pass', receptor_id: 'j1' })]]);
  ok(/los otros 2 de la fila\./.test(fraseDeFase(conPasador, 0)), fraseDeFase(conPasador, 0));
  j.elementos[0] = { ...c, fila: { ...c.fila, rondas: false } };
  eq(fraseDeFase(j, 0), 'A1 corta al aro.', 'sin rondas, nada:');
  eq(nombreEnFrase(el[2]), 'el 2.º de la fila');
  /* Con defensa, la línea de las rondas va antes: la defensa, al final. */
  const conDefensor = jugada([...el, balon('b1', 'j1', A.centro), jugador('j5', 'B', '1', P(A.centro.x, A.centro.y - 0.05))],
    [[tr('j1', 'j1', 'corta', A.centro, A.aro)]]);
  conDefensor.elementos[0] = c;
  ok(/de la fila\. B1 /.test(fraseDeFase(conDefensor, 0)), fraseDeFase(conDefensor, 0));
});

test('SIN NADA DIBUJADO NO HAY FRASE, y nada revienta', () => {
  eq(frasesDeJugada(null), []);
  eq(frasesDeJugada(jugada([jugador('j1', 'A', '1', A.base)], [[]])), ['']);
  /* Ni una fase vacía cuenta la defensa: no hay nada que contar. */
  const conDef = [jugador('j1', 'A', '1', A.base), balon('b1', 'j1', A.base), jugador('j3', 'B', '1', A.codo_der)];
  eq(frasesDeJugada(jugada(conDef, [[tr('j1', 'j1', 'bota', A.base, A.codo_der)], []]))[1], '', 'la fase vacía:');
  /* Una fase o un tramo roto no deja sin frase a las demás. */
  const rota = { version: 3, pista: 'entera', canasta: 'norte', elementos: conDef, fases: [null, { id: 'f2', tramos: [null, tr('j1', 'j1', 'bota', A.base, A.codo_der)] }] };
  const r = frasesDeJugada(rota);
  eq(r[0], '');
  ok(/^A1 bota hasta el codo derecho\./.test(r[1]), r[1]);
  eq(fraseDeFase(jugada([], []), 3), '');
  eq([unir([]), unir(['a']), unir(['a', 'b']), unir(['a', 'b', 'c'])], ['', 'a', 'a y b', 'a, b y c']);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
if (fallan) process.exit(1);
