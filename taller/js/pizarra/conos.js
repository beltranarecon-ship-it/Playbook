/* ============================================================
   pizarra/conos.js — qué hace cada cono con un trazo (§7.4).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-conos.mjs.

   ── UN SOLO TIPO DE CONO ────────────────────────────────────
   El §7.4 lo dice en una línea: hay UN cono, y el papel se lo da el
   contexto mientras dibujas. Un cono junto al trazo se rodea; tres
   alineados son un slalom; dos cerca, con el trazo cruzando entre
   ellos, son una puerta. Nada de elegir el tipo en un menú: el
   entrenador pone conos donde los pondría en el pabellón y la pizarra
   lee lo que significan.

   Aquí solo se LEE. Curvar el trazo, pintar el iconito o cambiar el
   lado con un clic es de quien dibuja; esto contesta «con este trazo y
   estos conos, qué pasa», que es lo que se puede probar sin pantalla.

   ── TODO EN METROS ──────────────────────────────────────────
   Los números del §7.4 son metros (1,5 m del trazo, 3 m entre los dos
   de una puerta), y la pista no escala igual en los dos ejes: 18 × 27
   en la entera. Medir en coordenadas [0,1] haría que un cono «a 1,5 m»
   lo estuviera en horizontal y no en vertical.

   ── EL LADO ES POR DÓNDE PASA EL JUGADOR ────────────────────
   `lado` dice por dónde pasa EL JUGADOR respecto del cono, que es lo
   que se guarda como intención («sorteando el cono 3 por la
   izquierda») y lo que un clic cambia. Con el cono a la derecha del
   camino, el jugador pasa por su izquierda.
   ============================================================ */

import { metrosEntre, escalaDe } from '../canvas/escala.js';
import { flattenPath } from '../canvas/geometry.js';

/** Los números del §7.4, en metros. Ajustables por el club más adelante. */
export const CONOS = Object.freeze({
  rodeo: 1.5,       // un cono a menos de esto del trazo se rodea
  puerta: 3.0,      // dos conos a menos de esto entre sí pueden ser puerta
  extremos: 1.0,    // pegado al origen o al destino no cuenta: se sale o se llega
  /* Cuánto puede torcerse una hilera de conos y seguir siendo un slalom:
     los conos de un pabellón nunca están en línea recta perfecta. */
  alineados: 1.2,
});

const punto = (e) => ({ x: e.x, y: e.y });

/* El punto del segmento a–b más cercano a p, y su parámetro t. Todo en
   metros, que es donde las distancias significan algo. */
function enElSegmento(pista, p, a, b) {
  const e = escalaDe(pista);
  const ax = a.x * e.x, ay = a.y * e.y;
  const dx = (b.x - a.x) * e.x, dy = (b.y - a.y) * e.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((p.x * e.x - ax) * dx + (p.y * e.y - ay) * dy) / l2)) : 0;
  return { t, punto: { x: (ax + dx * t) / e.x, y: (ay + dy * t) / e.y }, dx, dy };
}

/**
 * Dónde queda este cono respecto del trazo.
 *
 * @returns { metros, en, lado } — a cuántos metros pasa el trazo de él,
 *          en qué fracción de su longitud, y por qué lado pasa EL
 *          JUGADOR ('izq' o 'der'); o null si el trazo no vale.
 */
export function respectoAlTrazo(trazo, cono, pista = 'entera') {
  const flat = flattenPath(trazo || []);
  if (flat.length < 2 || !cono || !Number.isFinite(cono.x)) return null;
  const largos = [];
  let total = 0;
  for (let i = 1; i < flat.length; i++) { const l = metrosEntre(pista, flat[i - 1], flat[i]); largos.push(l); total += l; }
  if (!(total > 0)) return null;
  let recorrido = 0;
  let mejor = null;
  for (let i = 1; i < flat.length; i++) {
    const c = enElSegmento(pista, cono, flat[i - 1], flat[i]);
    const metros = metrosEntre(pista, cono, c.punto);
    if (!mejor || metros < mejor.metros - 1e-9) {
      /* A qué lado del camino queda el cono, en metros y desde el punto
         de vista del que corre. La pista se mira con la y hacia abajo,
         así que el producto cruzado positivo es «a su derecha»: con el
         trazo yendo hacia arriba, un cono con más x le queda a la
         derecha. El jugador pasa por el lado CONTRARIO. */
      const e = escalaDe(pista);
      const vx = (cono.x - c.punto.x) * e.x, vy = (cono.y - c.punto.y) * e.y;
      const cruz = c.dx * vy - c.dy * vx;
      mejor = {
        metros,
        en: (recorrido + c.t * largos[i - 1]) / total,
        lado: cruz >= 0 ? 'der' : 'izq',   // el cono queda a ese lado…
        cruz,
      };
    }
    recorrido += largos[i - 1];
  }
  if (!mejor) return null;
  // …y el jugador pasa por el otro
  return { metros: mejor.metros, en: mejor.en, lado: mejor.lado === 'izq' ? 'der' : 'izq' };
}

/** El contrario de un lado. */
export const otroLado = (lado) => (lado === 'izq' ? 'der' : 'izq');

/* ¿Cruza el trazo el segmento que une dos conos? En metros, y con los
   dos conos a lados distintos del trazo, que es lo que hace una puerta:
   se pasa ENTRE ellos. */
function cruzaEntre(trazo, a, b, pista) {
  const ra = respectoAlTrazo(trazo, a, pista);
  const rb = respectoAlTrazo(trazo, b, pista);
  if (!ra || !rb) return null;
  if (ra.lado === rb.lado) return null;          // los dos al mismo lado: no se pasa entre ellos
  const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const rm = respectoAlTrazo(trazo, medio, pista);
  if (!rm) return null;
  /* Y el trazo tiene que pasar POR ENTRE los dos, no por fuera y lejos:
     el punto medio de la puerta le queda cerca. */
  const separacion = metrosEntre(pista, a, b);
  if (rm.metros > separacion / 2 + CONOS.rodeo) return null;
  return { en: rm.en, metros: rm.metros };
}

/* ¿Están estos conos en hilera? Se mide lo que se aparta cada uno de la
   recta que une el primero y el último. */
function enHilera(conos, pista) {
  if (conos.length < 3) return false;
  const a = conos[0], b = conos[conos.length - 1];
  if (metrosEntre(pista, a, b) < 1e-6) return false;
  for (const c of conos.slice(1, -1)) {
    const { punto: q } = enElSegmento(pista, c, a, b);
    if (metrosEntre(pista, c, q) > CONOS.alineados) return false;
  }
  return true;
}

/**
 * QUÉ HACE CADA CONO CON ESTE TRAZO (§7.4).
 *
 * Por orden: primero las puertas —dos conos cerca con el trazo pasando
 * entre ellos—, después los slalom —tres o más de los que quedan, en
 * hilera— y al final los rodeos sueltos. Así dos conos de una puerta no
 * salen además como dos rodeos, y tres en hilera no salen como tres.
 *
 * @param trazo  el trazo dibujado (§11.1)
 * @param conos  [{ id, x, y, fila }] — los de la pista
 * @returns [{ tipo: 'puerta'|'zigzag'|'rodeo', conos: [id], lado, en }]
 *          ordenados por dónde caen en el trazo. `lado` es por dónde
 *          pasa el jugador respecto del cono (del primero, en un
 *          slalom); en una puerta no hay lado: se pasa por dentro.
 */
export function interpretarConos(trazo, conos = [], { pista = 'entera' } = {}) {
  const flat = flattenPath(trazo || []);
  if (flat.length < 2) return [];
  const inicio = flat[0], fin = flat[flat.length - 1];
  /* Un cono que es fila nunca se sortea: es un sitio, no un obstáculo. Y
     uno pegado al origen o al destino tampoco: de ahí se sale o ahí se
     llega. */
  const candidatos = (conos || [])
    .filter((c) => c && c.kind !== 'zona' && !c.fila && Number.isFinite(c.x) && Number.isFinite(c.y))
    .filter((c) => metrosEntre(pista, c, inicio) > CONOS.extremos && metrosEntre(pista, c, fin) > CONOS.extremos)
    .map((c) => ({ c, r: respectoAlTrazo(trazo, c, pista) }))
    .filter((x) => x.r)
    .sort((a, z) => a.r.en - z.r.en);

  const salida = [];
  const usados = new Set();

  /* 1 · PUERTAS: dos conos a menos de 3 m, uno a cada lado del trazo. Se
     miran también los que están lejos del trazo: una puerta ancha tiene
     los dos palos a más de 1,5 m del camino y sigue siendo una puerta. */
  const todos = (conos || []).filter((c) => c && !c.fila && Number.isFinite(c.x) && Number.isFinite(c.y));
  for (let i = 0; i < todos.length; i++) {
    for (let k = i + 1; k < todos.length; k++) {
      const a = todos[i], b = todos[k];
      if (usados.has(a.id) || usados.has(b.id)) continue;
      if (metrosEntre(pista, a, b) > CONOS.puerta) continue;
      const cruce = cruzaEntre(trazo, a, b, pista);
      if (!cruce) continue;
      usados.add(a.id); usados.add(b.id);
      salida.push({ tipo: 'puerta', conos: [a.id, b.id], lado: null, en: cruce.en });
    }
  }

  /* 2 · SLALOM: tres o más de los que quedan cerca del trazo, en hilera.
     Se alterna desde el lado por el que se entra al primero. */
  const cerca = candidatos.filter((x) => !usados.has(x.c.id) && x.r.metros <= CONOS.rodeo);
  if (cerca.length >= 3 && enHilera(cerca.map((x) => x.c), pista)) {
    for (const x of cerca) usados.add(x.c.id);
    salida.push({
      tipo: 'zigzag',
      conos: cerca.map((x) => x.c.id),
      lado: cerca[0].r.lado,
      en: cerca[0].r.en,
    });
  }

  /* 3 · RODEOS: cada uno por su lado de entrada. */
  for (const x of candidatos) {
    if (usados.has(x.c.id) || x.r.metros > CONOS.rodeo) continue;
    usados.add(x.c.id);
    salida.push({ tipo: 'rodeo', conos: [x.c.id], lado: x.r.lado, en: x.r.en });
  }

  return salida.sort((a, b) => a.en - b.en);
}

/**
 * Lo que se guarda en el tramo (§11.1, `args.sorteando`): la intención,
 * no la curva. Mover el cono rehace el trazo porque lo que se guardó fue
 * «sorteando el cono 3 por la izquierda».
 */
export function sorteandoDe(lecturas = []) {
  const r = [];
  for (const l of lecturas || []) {
    if (!l) continue;
    if (l.tipo === 'puerta') { r.push({ puerta: l.conos.slice(0, 2) }); continue; }
    const lados = l.tipo === 'zigzag'
      ? l.conos.map((id, i) => ({ cono: id, lado: i % 2 === 0 ? l.lado : otroLado(l.lado) }))
      : l.conos.map((id) => ({ cono: id, lado: l.lado }));
    r.push(...lados);
  }
  return r;
}
