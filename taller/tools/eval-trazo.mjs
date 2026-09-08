/* ============================================================
   eval-trazo.mjs — banco Node del trazo de la Pizarra
   (taller/js/pizarra/trazo.js). Sin red, sin DOM.

     node taller/tools/eval-trazo.mjs

   Lo que más vigila:

   · Que los TRES GESTOS produzcan el mismo dato. Un clic, varios clics
     o un arrastre a pulso tienen que acabar en la misma clase de lista
     de nodos, o después no se editan igual ni se guardan igual.

   · Que insertar un nodo NO cambie el trazo. Sale curvo (§5.2) y
     tangente: si al insertarlo la flecha se moviera, añadir un punto
     para redondear una curva la torcería, que es justo lo contrario de
     lo que se quería.

   · Que todo lo que se mide vaya en METROS. En normalizado, un trazo
     diagonal se suavizaría distinto según su inclinación, porque el
     marco de la entera es 18 × 27 m.
   ============================================================ */

import {
  TOLERANCIA_SUAVIZADO, NODOS_MAX, RITMOS, VELOCIDAD_PASE, PASE_MINIMO_S,
  nuevoTrazo, desdePuntos, nodosFijos, moverNodo, insertarEn,
  curvar, enderezar, alternarCurva, esCurvo, borrarNodo,
  longitudMetros, rotulo, duracionDe, suavizar,
  RADIO_NODO, nodoEn, segmentoEn, reanclar,
} from '../js/pizarra/trazo.js';
import { flattenPath } from '../js/canvas/geometry.js';
import { tipoFlecha } from '../js/pizarra/dibujo.js';
import { marcoDe } from '../js/canvas/medidas.js';

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
const aprox = (real, esp, tol = 1e-6, msg = '') => {
  if (!(Math.abs(real - esp) <= tol)) throw new Error(`${msg} esperado≈${esp} real=${real}`);
};

const P = 'entera';                        // marco 18 × 27 m
const M = marcoDe(P);
/** Un punto a `m` metros del origen por el eje que se diga. */
const aX = (x0, m) => x0 + m / M.ancho;
const aY = (y0, m) => y0 + m / M.alto;

/* ── 1. Los tres gestos, el mismo dato ───────────────────── */

test('un clic produce un trazo recto de dos nodos', () => {
  const t = nuevoTrazo({ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.6 });
  eq(t.length, 2);
  eq(t.map((n) => n.tipo_nodo), ['lineal', 'lineal']);
  ok(!esCurvo(t[0]) && !esCurvo(t[1]), 'un trazo recto no lleva manejadores');
});

test('varios clics producen una polilínea con la misma forma de nodo', () => {
  const t = desdePuntos([{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.3 }, { x: 0.8, y: 0.2 }]);
  eq(t.length, 3);
  eq(Object.keys(t[0]).sort(), ['handle_in', 'handle_out', 'tipo_nodo', 'x', 'y']);
});

test('un trazo a pulso acaba en nodos de la misma clase', () => {
  const puntos = [];
  for (let i = 0; i <= 60; i++) puntos.push({ x: 0.2 + i * 0.008, y: 0.3 + Math.sin(i / 9) * 0.02 });
  const t = suavizar(puntos, { pista: P });
  ok(t.length >= 2, 'algo tiene que quedar');
  eq(Object.keys(t[0]).sort(), ['handle_in', 'handle_out', 'tipo_nodo', 'x', 'y']);
});

/* ── 2. Insertar no mueve el trazo ───────────────────────── */

test('el nodo insertado sale CURVO', () => {
  const t = insertarEn(nuevoTrazo({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 }), 0, { x: 0.5, y: 0.5 });
  eq(t.length, 3);
  ok(esCurvo(t[1]), 'los nodos nuevos salen curvos (§5.2)');
  ok(!esCurvo(t[0]) && !esCurvo(t[2]), 'los extremos no se tocan');
});

test('insertar un nodo en una recta NO la dobla', () => {
  const recto = nuevoTrazo({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 });
  const con = insertarEn(recto, 0, { x: 0.5, y: 0.5 });
  // toda la polilínea aplanada tiene que seguir en y = 0,5
  for (const p of flattenPath(con)) aprox(p.y, 0.5, 1e-9, 'se ha torcido en:');
});

test('insertar en un segmento que no existe no rompe nada', () => {
  const t = nuevoTrazo({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 });
  eq(insertarEn(t, 5, { x: 0.5, y: 0.5 }).length, 2);
  eq(insertarEn(t, -1, { x: 0.5, y: 0.5 }).length, 2);
});

/* ── 3. Curvar, enderezar, mover y borrar ────────────────── */

test('el doble clic curva lo recto y endereza lo curvo', () => {
  let t = desdePuntos([{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.4 }, { x: 0.9, y: 0.5 }]);
  t = alternarCurva(t, 1);
  ok(esCurvo(t[1]), 'debería haberse curvado');
  t = alternarCurva(t, 1);
  ok(!esCurvo(t[1]), 'y vuelto a enderezar');
  eq(t[1].tipo_nodo, 'lineal');
});

test('mover un nodo se lleva sus manejadores', () => {
  let t = curvar(desdePuntos([{ x: 0.1, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.5 }]), 1);
  const hin = { ...t[1].handle_in };
  t = moverNodo(t, 1, { x: 0.5, y: 0.8 });
  aprox(t[1].handle_in.y - hin.y, 0.3, 1e-9, 'el manejador tiene que seguir al nodo:');
  aprox(t[1].handle_in.x - hin.x, 0, 1e-9, 'y no desplazarse de más:');
});

test('borrar deja siempre al menos dos nodos', () => {
  const t = nuevoTrazo({ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 });
  eq(borrarNodo(t, 1).length, 2, 'no puede quedarse en uno');
});

test('los nodos FIJOS no se pueden borrar', () => {
  const t = desdePuntos([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }]);
  eq(borrarNodo(t, 0, 'run').length, 3, 'el origen lo pone la ficha');
  eq(borrarNodo(t, 1, 'run').length, 2, 'el de en medio sí');
});

test('en un PASE también está fijo el final: lo pone el receptor', () => {
  /* CON LA PALABRA QUE CIRCULA DE VERDAD. Lo que viaja por la Pizarra
     como `tipo` es el tipo de FLECHA —'run', 'pass', 'cut', 'gesto'—,
     que es lo que sale de `tipoFlecha()` y lo que entiende `drawArrow`.
     Este banco probó durante un tiempo con 'pase', una palabra que no
     existe en la app: salía verde mientras el final de los pases se
     quedaba sin proteger. */
  eq([...nodosFijos('run', 3)], [0]);
  eq([...nodosFijos('pass', 3)].sort(), [0, 2]);
  eq([...nodosFijos('cut', 3)], [0], 'un corte no tiene final fijo');
  const t = desdePuntos([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }]);
  eq(borrarNodo(t, 2, 'pass').length, 3, 'el final de un pase no se borra');
  eq(borrarNodo(t, 2, 'run').length, 2, 'el de un corte sí');
});

test('EL TIPO SALE DE tipoFlecha, y este banco lo comprueba de punta a punta', () => {
  /* La única manera de que el desajuste de palabras no vuelva: preguntar
     por el tipo igual que lo pregunta la app, en vez de escribirlo a mano. */
  const dePase = tipoFlecha({ simbolo: 'pase' });
  const deTiro = tipoFlecha({ simbolo: 'tiro' });
  const deCorte = tipoFlecha({ simbolo: 'corte' });
  eq([...nodosFijos(dePase, 3)].sort(), [0, 2], `el símbolo pase da "${dePase}":`);
  eq([...nodosFijos(deTiro, 3)].sort(), [0, 2], `y el tiro da "${deTiro}":`);
  eq([...nodosFijos(deCorte, 3)], [0], `el corte da "${deCorte}":`);
});

test('nada muta el trazo que recibe', () => {
  const t = desdePuntos([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }]);
  const copia = JSON.parse(JSON.stringify(t));
  curvar(t, 1); enderezar(t, 1); moverNodo(t, 1, { x: 0, y: 0 }); borrarNodo(t, 1); insertarEn(t, 0, { x: 0.2, y: 0.2 });
  eq(t, copia, 'el trazo original ha cambiado:');
});

/* ── 4. Medir, en metros ─────────────────────────────────── */

test('un trazo recto mide lo que mide, en metros de pista', () => {
  const t = nuevoTrazo({ x: 0.3, y: 0.5 }, { x: aX(0.3, 10), y: 0.5 });
  aprox(longitudMetros(t, P), 10, 1e-6, 'diez metros a lo ancho:');
  const v = nuevoTrazo({ x: 0.5, y: 0.2 }, { x: 0.5, y: aY(0.2, 10) });
  aprox(longitudMetros(v, P), 10, 1e-6, 'y diez a lo largo tienen que medir igual:');
});

test('una curva mide MÁS que la recta entre sus extremos', () => {
  const recto = nuevoTrazo({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.5 });
  let curvo = insertarEn(recto, 0, { x: 0.5, y: 0.5 });
  curvo = moverNodo(curvo, 1, { x: 0.5, y: 0.2 });
  ok(longitudMetros(curvo, P) > longitudMetros(recto, P) * 1.1,
    'un rodeo tiene que medir lo que se anda, no la distancia en línea recta');
});

test('la duración sale de la distancia y del ritmo', () => {
  aprox(duracionDe(12, 'normal'), 3, 1e-9);
  aprox(duracionDe(13, 'sprint'), 2, 1e-9);
  aprox(duracionDe(3, 'andando'), 2, 1e-9);
  ok(duracionDe(10, 'sprint') < duracionDe(10, 'normal'), 'correr es más rápido que trotar');
  /* El orden entero, que es lo que de verdad hay que fijar: andar es lo
     más lento de todo, y el lateral defensivo —aunque sea la mitad de
     rápido que el trote— sigue siendo un desplazamiento atlético y va
     por encima de andar y de ir de espaldas. */
  const t = (r) => duracionDe(10, r);
  ok(t('andando') > t('espalda'), 'ir de espaldas es más rápido que andar sin más');
  ok(t('espalda') > t('lateral'), 'y el lateral, más que de espaldas');
  ok(t('lateral') > t('normal'), 'pero más lento que el trote');
});

test('un pase corto nunca dura menos de lo que se tarda en verlo', () => {
  aprox(duracionDe(18, 'pase'), 2, 1e-9);
  eq(duracionDe(0.5, 'pase'), PASE_MINIMO_S);
  ok(VELOCIDAD_PASE > RITMOS.sprint, 'el balón vuela más que nadie');
});

test('el rótulo dice metros y segundos, con coma', () => {
  const t = nuevoTrazo({ x: 0.3, y: 0.5 }, { x: aX(0.3, 8), y: 0.5 });
  eq(rotulo(t, P, 'normal'), '8,0 m · 2,0 s');
});

/* ── 5. Suavizar lo hecho a pulso ────────────────────────── */

test('doscientas muestras se quedan en un puñado de nodos agarrables', () => {
  const puntos = [];
  for (let i = 0; i < 200; i++) puntos.push({ x: 0.15 + i * 0.003, y: 0.4 + Math.sin(i / 25) * 0.05 });
  const t = suavizar(puntos, { pista: P });
  ok(t.length >= 3 && t.length <= NODOS_MAX, `salieron ${t.length} nodos; deberían caber en ${NODOS_MAX}`);
});

test('el suavizado no se aleja del gesto más de la tolerancia', () => {
  const puntos = [];
  for (let i = 0; i <= 100; i++) puntos.push({ x: 0.2 + i * 0.005, y: 0.5 + Math.sin(i / 15) * 0.03 });
  const t = suavizar(puntos, { pista: P, tolerancia: 0.5 });
  // el trazo suavizado tiene que pasar cerca de los puntos originales
  const flat = flattenPath(t);
  let peor = 0;
  for (const p of puntos) {
    let d = Infinity;
    for (const q of flat) d = Math.min(d, Math.hypot((p.x - q.x) * M.ancho, (p.y - q.y) * M.alto));
    peor = Math.max(peor, d);
  }
  ok(peor < 2.0, `el trazo suavizado se aleja ${peor.toFixed(2)} m del gesto`);
});

test('una recta dibujada a pulso se queda en dos nodos', () => {
  const puntos = [];
  for (let i = 0; i <= 50; i++) puntos.push({ x: 0.2 + i * 0.01, y: 0.5 });
  eq(suavizar(puntos, { pista: P }).length, 2, 'no hay nada que conservar en medio:');
});

test('los extremos de un trazo a pulso se quedan RECTOS', () => {
  const puntos = [];
  for (let i = 0; i <= 80; i++) puntos.push({ x: 0.2 + i * 0.006, y: 0.4 + Math.sin(i / 12) * 0.06 });
  const t = suavizar(puntos, { pista: P });
  ok(!esCurvo(t[0]), 'el origen lo pone la ficha');
  ok(!esCurvo(t[t.length - 1]), 'curvar el final lo movería de sitio');
  ok(t.slice(1, -1).every(esCurvo), 'los de en medio sí van curvos');
});

test('el suavizado mide en METROS: la misma forma da lo mismo en los dos ejes', () => {
  const largo = [], ancho = [];
  for (let i = 0; i <= 60; i++) {
    largo.push({ x: 0.5 + Math.sin(i / 10) * (0.6 / M.ancho), y: aY(0.2, i * 0.2) });
    ancho.push({ x: aX(0.2, i * 0.2), y: 0.5 + Math.sin(i / 10) * (0.6 / M.alto) });
  }
  const a = suavizar(largo, { pista: P }).length;
  const b = suavizar(ancho, { pista: P }).length;
  eq(a, b, 'el mismo garabato girado 90° debería simplificarse igual:');
});

test('un garabato que vuelve sobre sí mismo no rompe la simplificación', () => {
  const puntos = [];
  for (let i = 0; i <= 40; i++) puntos.push({ x: 0.5 + Math.cos(i / 6) * 0.05, y: 0.5 + Math.sin(i / 6) * 0.05 });
  const t = suavizar(puntos, { pista: P });
  ok(t.length >= 2 && t.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), 'nodos rotos');
});

test('entradas imposibles no rompen nada', () => {
  eq(suavizar([], { pista: P }), []);
  eq(suavizar(null, { pista: P }), []);
  eq(suavizar([{ x: 0.5, y: 0.5 }], { pista: P }).length, 1);
  eq(suavizar([{ x: NaN, y: 0 }, { x: 0.5, y: 0.5 }], { pista: P }).length, 1, 'los puntos rotos se descartan:');
});

test('la tolerancia es la de la especificación', () => {
  eq(TOLERANCIA_SUAVIZADO, 0.25);
});

/* ── Acertar: con qué se ha pinchado ─────────────── */

test('se acierta un nodo dentro del agarre, y fuera no', () => {
  const t = nuevoTrazo({ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.7 });
  eq(nodoEn(t, { x: 0.3, y: 0.3 }, { tolerancia: 0.5 }), 0, 'justo encima del primero:');
  eq(nodoEn(t, { x: 0.7, y: 0.7 }, { tolerancia: 0.5 }), 1, 'justo encima del segundo:');
  eq(nodoEn(t, { x: 0.5, y: 0.5 }, { tolerancia: 0.5 }), -1, 'en medio no hay ningún nodo:');
  eq(nodoEn([], { x: 0.5, y: 0.5 }), -1, 'un trazo vacío no acierta nada');
  eq(nodoEn(null, { x: 0.5, y: 0.5 }), -1, 'ni uno que no existe');
});

test('gana el nodo MÁS CERCANO, no el primero que pille', () => {
  /* En un trazo apretado dos nodos caen dentro del agarre a la vez.
     Cogiendo siempre el de menor índice, el último de un rizo no se
     podría tocar nunca. */
  const t = desdePuntos([{ x: 0.50, y: 0.50 }, { x: 0.52, y: 0.50 }, { x: 0.90, y: 0.90 }]);
  eq(nodoEn(t, { x: 0.519, y: 0.50 }, { tolerancia: 1.5 }), 1, 'pinchando pegado al segundo:');
  eq(nodoEn(t, { x: 0.501, y: 0.50 }, { tolerancia: 1.5 }), 0, 'y pegado al primero:');
});

test('EL AGARRE SE MIDE EN METROS, y por eso el marco estirado no engaña', () => {
  /* La entera son 18 × 27 m sobre un marco cuadrado: el mismo 0,02
     normalizado son 36 cm a lo ancho y 54 a lo largo. Con un agarre de
     0,45 m, el de a lo ancho entra y el de a lo largo no. En unidades
     normalizadas los dos darían lo mismo, que es el fallo. */
  const t = nuevoTrazo({ x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 });
  const o = { pista: 'entera', tolerancia: 0.45 };
  eq(nodoEn(t, { x: 0.52, y: 0.50 }, o), 0, '36 cm a lo ancho: se acierta');
  eq(nodoEn(t, { x: 0.50, y: 0.52 }, o), -1, '54 cm a lo largo: no');
});

test('se acierta la LÍNEA, y dice en qué segmento y dónde', () => {
  const t = desdePuntos([{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.8, y: 0.2 }]);
  const a = segmentoEn(t, { x: 0.35, y: 0.2 }, { tolerancia: 0.5 });
  eq(a.seg, 0, 'la primera mitad es el segmento 0:');
  const b = segmentoEn(t, { x: 0.65, y: 0.2 }, { tolerancia: 0.5 });
  eq(b.seg, 1, 'la segunda es el 1:');
  aprox(b.punto.y, 0.2, 1e-6, 'el punto cae sobre la línea:');
  eq(segmentoEn(t, { x: 0.35, y: 0.6 }, { tolerancia: 0.5 }), null, 'lejos de la línea no acierta');
});

test('SE ACIERTA LA CURVA QUE SE VE, no la recta entre sus nodos', () => {
  /* Es la razón de aplanar. En un trazo curvado la recta de nodo a
     nodo pasa por dentro del arco: pinchando sobre la línea dibujada
     diría «no has acertado», y pinchando en el hueco diría que sí. */
  const curvo = curvar(desdePuntos([{ x: 0.2, y: 0.5 }, { x: 0.5, y: 0.35 }, { x: 0.8, y: 0.5 }]), 1);
  const flat = flattenPath(curvo);
  const enLaCurva = flat[Math.floor(flat.length / 4)];
  ok(segmentoEn(curvo, enLaCurva, { tolerancia: 0.15 }), 'sobre la curva dibujada hay que acertar');
  const cuerda = nuevoTrazo(curvo[0], curvo[2]);
  eq(segmentoEn(cuerda, enLaCurva, { tolerancia: 0.15 }), null, 'contra la cuerda, ese punto no acierta');
});

test('un trazo de menos de dos nodos no tiene línea que acertar', () => {
  eq(segmentoEn([], { x: 0.5, y: 0.5 }), null);
  eq(segmentoEn([{ x: 0.5, y: 0.5 }], { x: 0.5, y: 0.5 }), null);
  eq(segmentoEn(null, { x: 0.5, y: 0.5 }), null);
});

test('PINCHAR LA LÍNEA E INSERTAR NO CAMBIA EL TRAZO', () => {
  /* Las dos piezas del §5.2 juntas: se pincha, sale un segmento y un
     punto, y `insertarEn` mete ahí un nodo ya curvado y tangente. Si el
     trazo cambiara de forma al insertar, el entrenador vería dar un
     tirón a lo que acaba de dibujar. */
  const t = curvar(desdePuntos([{ x: 0.2, y: 0.7 }, { x: 0.5, y: 0.4 }, { x: 0.8, y: 0.7 }]), 1);
  const antes = longitudMetros(t, 'entera');
  const golpe = segmentoEn(t, flattenPath(t)[6], { tolerancia: 0.3 });
  ok(golpe, 'tiene que acertar sobre su propia curva');
  const t2 = insertarEn(t, golpe.seg, golpe.punto);
  eq(t2.length, t.length + 1, 'hay un nodo más:');
  ok(esCurvo(t2[golpe.seg + 1]), 'y sale curvo, como manda el §5.2');
  const despues = longitudMetros(t2, 'entera');
  ok(Math.abs(despues - antes) < 0.35, `el trazo no puede pegar un tirón: ${antes} a ${despues}`);
});

test('el radio de reserva es un número de METROS razonable en una pista', () => {
  ok(RADIO_NODO > 0.2 && RADIO_NODO < 1.5, `${RADIO_NODO} m no es un agarre de nodo`);
});

/* ── Reanclado (§5.5) ────────────────────────── */

test('EL DESTINO SE QUEDA QUIETO y el trazo se estira desde el nuevo origen', () => {
  /* Lo que dice el §5.5, y lo único que tiene sentido: el final de un
     trazo es una decisión —ahí quiere que llegue— y el arranque es una
     consecuencia de dónde acabó lo anterior. */
  const t = desdePuntos([{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.8 }]);
  const r = reanclar(t, { x: 0.3, y: 0.1 }, 'entera');
  aprox(r[0].x, 0.3, 1e-12, 'el origen va donde se le dice:');
  aprox(r[0].y, 0.1, 1e-12);
  aprox(r[2].x, 0.8, 1e-12, 'y el destino NO se mueve:');
  aprox(r[2].y, 0.8, 1e-12);
});

test('los de en medio se reparten, ni se quedan ni se van del todo', () => {
  const t = desdePuntos([{ x: 0.2, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }]);
  const r = reanclar(t, { x: 0.2, y: 0.9 }, 'entera');
  ok(r[1].y > 0.5 && r[1].y < 0.9, `el de en medio tiene que quedar entre los dos: ${r[1].y}`);
  // a mitad de camino en longitud, la mitad del desplazamiento
  aprox(r[1].y, 0.7, 1e-9, 'justo en la mitad:');
});

test('SE REPARTE POR LONGITUD, no por número de nodo', () => {
  /* Tres nodos apretados al principio y uno lejos al final. Repartiendo
     por índice, los tres primeros se moverían casi lo mismo y la curva
     saldría deformada. */
  const t = desdePuntos([
    { x: 0.10, y: 0.5 }, { x: 0.12, y: 0.5 }, { x: 0.14, y: 0.5 }, { x: 0.90, y: 0.5 },
  ]);
  const r = reanclar(t, { x: 0.10, y: 0.9 }, 'entera');
  const d = r.map((n, i) => n.y - t[i].y);
  ok(d[1] > 0.35 && d[2] > 0.35, `los pegados al origen se van casi entero con él: ${d}`);
  aprox(d[3], 0, 1e-12, 'y el último no se mueve:');
  ok(d[0] > d[1] && d[1] > d[2] && d[2] > d[3], `tiene que ir bajando: ${d}`);
});

test('los manejadores van con su nodo, o la curva se deforma', () => {
  const t = curvar(desdePuntos([{ x: 0.2, y: 0.7 }, { x: 0.5, y: 0.4 }, { x: 0.8, y: 0.7 }]), 1);
  const r = reanclar(t, { x: 0.1, y: 0.8 }, 'entera');
  ok(r[1].handle_in && r[1].handle_out, 'siguen existiendo');
  aprox(r[1].handle_in.x - r[1].x, t[1].handle_in.x - t[1].x, 1e-12, 'el manejador guarda su distancia al nodo:');
  aprox(r[1].handle_out.y - r[1].y, t[1].handle_out.y - t[1].y, 1e-12);
});

test('reanclar al mismo sitio no toca nada', () => {
  const t = desdePuntos([{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]);
  eq(reanclar(t, { x: 0.2, y: 0.2 }, 'entera'), t);
});

test('no muta el trazo que recibe', () => {
  const t = desdePuntos([{ x: 0.2, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.8 }]);
  const copia = JSON.parse(JSON.stringify(t));
  reanclar(t, { x: 0.9, y: 0.1 }, 'entera');
  eq(t, copia, 'el original ha cambiado:');
});

test('un trazo de longitud cero se mueve entero en vez de darse la vuelta', () => {
  const t = desdePuntos([{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }]);
  const r = reanclar(t, { x: 0.7, y: 0.3 }, 'entera');
  aprox(r[0].x, 0.7, 1e-12); aprox(r[1].x, 0.7, 1e-12);
  ok(r.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)), 'nada de NaN');
});

test('entradas imposibles devuelven lo que había', () => {
  eq(reanclar(null, { x: 0.5, y: 0.5 }), null);
  eq(reanclar([], { x: 0.5, y: 0.5 }), []);
  const uno = [{ x: 0.5, y: 0.5 }];
  eq(reanclar(uno, { x: 0.1, y: 0.1 }), uno);
  const t = desdePuntos([{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]);
  eq(reanclar(t, null), t);
});

console.log(`\nResumen: ${pasan}/${pasan + fallan} pasaron (${fallan} fallos)`);
process.exit(fallan ? 1 : 0);
