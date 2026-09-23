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
import { segmentoEn, insertarEn } from './trazo.js';

/** Los números del §7.4, en metros. Ajustables por el club más adelante. */
export const CONOS = Object.freeze({
  rodeo: 1.5,       // un cono a menos de esto del trazo se rodea
  puerta: 3.0,      // dos conos a menos de esto entre sí pueden ser puerta
  extremos: 1.0,    // pegado al origen o al destino no cuenta: se sale o se llega
  /* Cuánto puede torcerse una hilera de conos y seguir siendo un slalom:
     los conos de un pabellón nunca están en línea recta perfecta. */
  alineados: 1.2,
  /* A cuánto se pasa del cono al rodearlo. Ni pisándolo ni dando un
     rodeo que no ha pedido nadie. */
  paso: 0.9,
  /* LA BANDA DE LA PUERTA (§7.4.1): lo que se pasa por fuera de uno de
     sus palos y todavía cuenta como «ir por la puerta». Un trazo que
     cruza por ahí se imanta a pasar por dentro; más lejos ya no es cosa
     de la puerta. */
  banda: 0.6,
  /* Cuánto tiene que cruzar de través: un trazo que va A LO LARGO de la
     línea de dos conos —los de un slalom— no pasa por una puerta, la
     recorre. 45° como mínimo. */
  traves: Math.SQRT1_2,
});

const punto = (e) => ({ x: e.x, y: e.y });

/* Por dónde va el trazo en el punto más cercano a `p`: el vector unidad
   del camino, en metros. */
function direccionEn(trazo, p, pista) {
  const flat = flattenPath(trazo || []);
  let mejor = null;
  for (let i = 1; i < flat.length; i++) {
    const c = enElSegmento(pista, p, flat[i - 1], flat[i]);
    const metros = metrosEntre(pista, p, c.punto);
    if (!mejor || metros < mejor.metros - 1e-9) mejor = { metros, dx: c.dx, dy: c.dy, punto: c.punto };
  }
  if (!mejor) return null;
  const largo = Math.hypot(mejor.dx, mejor.dy);
  if (!(largo > 0)) return null;
  return { dx: mejor.dx / largo, dy: mejor.dy / largo, punto: mejor.punto };
}

/**
 * Por dónde tiene que pasar el jugador para dejar el cono a un lado:
 * a `metros` del cono, en perpendicular al camino y por el lado que se
 * diga (el del JUGADOR, mirando hacia donde va).
 */
export function sitioAlPasar(trazo, cono, lado, { pista = 'entera', metros = CONOS.paso } = {}) {
  const d = direccionEn(trazo, cono, pista);
  if (!d) return null;
  const e = escalaDe(pista);
  /* Con la y hacia abajo, la derecha del que corre es (-dy, dx). */
  const rx = -d.dy, ry = d.dx;
  const signo = lado === 'der' ? 1 : -1;
  return {
    x: cono.x + (rx * signo * metros) / e.x,
    y: cono.y + (ry * signo * metros) / e.y,
  };
}

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

/**
 * ¿CRUZA EL TRAZO LA PUERTA a–b? En metros, y DE TRAVÉS.
 *
 * Se busca dónde corta el trazo la recta de los dos conos. Si la corta
 * entre ellos, pasa por dentro; si la corta un poco por fuera de un palo
 * —dentro de la banda—, cuenta como la puerta pero hay que imantarlo.
 * Si la recorre a lo largo —los conos de un slalom—, no es una puerta.
 *
 * @returns { en, dentro } o null
 */
export function cruceConPuerta(trazo, a, b, pista = 'entera') {
  const flat = flattenPath(trazo || []);
  if (flat.length < 2 || !a || !b) return null;
  const e = escalaDe(pista);
  const A = { x: a.x * e.x, y: a.y * e.y };
  const gx = (b.x - a.x) * e.x, gy = (b.y - a.y) * e.y;
  const glen = Math.hypot(gx, gy);
  if (!(glen > 0)) return null;
  const ext = CONOS.banda / glen;
  const largos = [];
  let total = 0;
  for (let i = 1; i < flat.length; i++) { const l = metrosEntre(pista, flat[i - 1], flat[i]); largos.push(l); total += l; }
  if (!(total > 0)) return null;
  let recorrido = 0;
  for (let i = 1; i < flat.length; i++) {
    const P = { x: flat[i - 1].x * e.x, y: flat[i - 1].y * e.y };
    const dx = (flat[i].x - flat[i - 1].x) * e.x, dy = (flat[i].y - flat[i - 1].y) * e.y;
    const den = dx * gy - dy * gx;
    const largo = largos[i - 1];
    if (Math.abs(den) > 1e-12 && largo > 0) {
      const wx = A.x - P.x, wy = A.y - P.y;
      const t = (wx * gy - wy * gx) / den;        // por dónde del tramo del trazo
      const sG = (wx * dy - wy * dx) / den;       // por dónde de la recta de la puerta
      const deTraves = Math.abs(dx * gx + dy * gy) / (largo * glen) <= CONOS.traves;
      if (t >= 0 && t <= 1 && sG >= -ext && sG <= 1 + ext && deTraves) {
        return { en: (recorrido + t * largo) / total, dentro: sG >= 0 && sG <= 1 };
      }
    }
    recorrido += largo;
  }
  return null;
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
export function interpretarConos(trazo, conos = [], { pista = 'entera', forzadas = null } = {}) {
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

  /* 1 · PUERTAS: dos conos a menos de 3 m con el trazo cruzando DE
     TRAVÉS la recta que los une, entre ellos o rozando uno por fuera.
     Se miran también los que están lejos del trazo: una puerta ancha
     tiene los dos palos a más de 1,5 m del camino y sigue siendo una
     puerta.

     Una puerta FORZADA —el entrenador ha llevado el trazo por fuera a
     propósito— se sigue leyendo aunque no se cruce: es la que hay que
     marcar en rojo (§7.4.1), y no se imanta. */
  const todos = (conos || []).filter((c) => c && !c.fila && Number.isFinite(c.x) && Number.isFinite(c.y));
  for (let i = 0; i < todos.length; i++) {
    for (let k = i + 1; k < todos.length; k++) {
      const a = todos[i], b = todos[k];
      if (usados.has(a.id) || usados.has(b.id)) continue;
      if (metrosEntre(pista, a, b) > CONOS.puerta) continue;
      const forzada = forzadas && (forzadas.has(a.id) || forzadas.has(b.id));
      const cruce = cruceConPuerta(trazo, a, b, pista);
      if (!cruce && !forzada) continue;
      usados.add(a.id); usados.add(b.id);
      if (forzada) {
        const medio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const r = respectoAlTrazo(trazo, medio, pista);
        salida.push({ tipo: 'puerta', conos: [a.id, b.id], lado: null, en: r ? r.en : 0, forzada: true, dentro: !!(cruce && cruce.dentro) });
        continue;
      }
      salida.push({ tipo: 'puerta', conos: [a.id, b.id], lado: null, en: cruce.en, ...(cruce.dentro ? {} : { imantada: true }) });
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
 * EL TRAZO QUE SORTEA LO LEÍDO (§7.4): el camino que pasa por donde
 * tiene que pasar.
 *
 * Se mete un nodo curvo por cada cono, a `paso` metros de él y por el
 * lado que diga la lectura. Ni el origen ni el destino se tocan: lo que
 * cambia es por dónde se va, no de dónde se sale ni a dónde se llega.
 *
 * Los conos se meten de atrás adelante para que insertar uno no mueva el
 * sitio de los que faltan.
 *
 * @param lecturas  las de `interpretarConos`
 * @param conos     los de la pista, para saber dónde está cada uno
 */
export function trazoSorteando(trazo, lecturas = [], conos = [], { pista = 'entera' } = {}) {
  if (!Array.isArray(trazo) || trazo.length < 2) return trazo;
  const porId = new Map((conos || []).filter((c) => c && c.id).map((c) => [c.id, c]));
  /* Cada cono con su lado, ya alternado si era un slalom. */
  const pasos = [];
  /* Las puertas IMANTADAS: el trazo se lleva por el medio de los dos
     palos. Las que ya se cruzan por dentro no se tocan. */
  const imanes = [];
  for (const l of lecturas || []) {
    if (!l || l.tipo !== 'puerta' || !l.imantada || l.forzada) continue;
    const a = porId.get(l.conos[0]), b = porId.get(l.conos[1]);
    if (a && b) imanes.push({ a, b, en: l.en, medio: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } });
  }
  for (const l of lecturas || []) {
    if (!l || l.tipo === 'puerta') continue;
    l.conos.forEach((id, i) => {
      const c = porId.get(id);
      if (!c) return;
      const lado = l.tipo === 'zigzag' && i % 2 ? otroLado(l.lado) : l.lado;
      pasos.push({ cono: c, lado, en: l.en });
    });
  }
  if (!pasos.length && !imanes.length) return trazo;
  let salida = trazo;
  /* Los nodos de las puertas imantadas se meten como los de los conos, y
     por el mismo orden: de atrás adelante. */
  const deLasPuertas = imanes
    .map((p) => ({ ...p, seg: segmentoEn(trazo, p.medio, { pista, tolerancia: 99 }) }))
    .filter((p) => p.seg);
  const conSitio = pasos
    .map((p) => ({ ...p, sitio: sitioAlPasar(trazo, p.cono, p.lado, { pista }) }))
    .filter((p) => p.sitio)
    .map((p) => ({ ...p, seg: segmentoEn(trazo, p.cono, { pista, tolerancia: 99 }) }))
    .filter((p) => p.seg)
    .sort((a, b) => b.seg.seg - a.seg.seg || b.en - a.en);
  const todos = [
    ...conSitio.map((p) => ({ seg: p.seg.seg, en: p.en, sitio: p.sitio, marca: { por_cono: p.cono.id, lado: p.lado } })),
    ...deLasPuertas.map((p) => ({ seg: p.seg.seg, en: p.en, sitio: p.medio, marca: { por_cono: p.a.id, puerta: true } })),
  ].sort((a, b) => b.seg - a.seg || b.en - a.en);
  for (const p of todos) {
    salida = insertarEn(salida, p.seg, p.sitio);
    /* El nodo queda MARCADO con el cono que lo puso (y por qué lado, o
       que es de una puerta): es lo que permite deshacerlo y volver a
       hacerlo cuando el cono se mueve o cuando un clic lo cambia. */
    salida = salida.map((n, i) => (i === p.seg + 1 ? { ...n, ...p.marca } : n));
  }
  return salida;
}

/**
 * El trazo SIN los nodos que puso un cono: el camino tal y como se
 * dibujó.
 *
 * @param conos  si se pasa un Set de ids, solo se quitan los de esos
 *               conos; sin él, todos
 */
export function sinSorteos(trazo, conos = null) {
  const limpio = (trazo || []).filter((n) => n && (!n.por_cono || (conos && !conos.has(n.por_cono))));
  /* Nunca menos de dos nodos: un trazo con uno solo no es un trazo. */
  return limpio.length >= 2 ? limpio.map((n) => ({ ...n })) : (trazo || []);
}

/**
 * VOLVER A SORTEAR: el trazo dibujado, leído otra vez con los conos
 * donde estén ahora.
 *
 * Es lo que hace que mover un cono rehaga la curva (§7.4): se guardó la
 * intención —qué cono y por qué lado—, no la curva.
 *
 * @param lados  { [cono]: 'izq'|'der' } para forzar el lado de alguno
 *               (lo que cambia un clic sobre el iconito)
 */
export function volverASortear(trazo, conos = [], { pista = 'entera', lados = null, anulados = null, forzadas = null } = {}) {
  const base = sinSorteos(trazo);
  /* Lo que el entrenador ANULÓ no se vuelve a leer: si no, el siguiente
     cono que se moviera lo devolvería. */
  const quedan = anulados && anulados.size ? (conos || []).filter((c) => c && !anulados.has(c.id)) : conos;
  const lecturas = interpretarConos(base, quedan, { pista, forzadas }).map((l) => {
    const forzado = lados && l.conos.length && lados[l.conos[0]];
    return forzado && l.tipo !== 'puerta' ? { ...l, lado: forzado } : l;
  });
  return { trazo: trazoSorteando(base, lecturas, quedan, { pista }), lecturas };
}

/**
 * De la intención guardada en un tramo, lo que hay que respetar al
 * volver a leer: el lado de cada lectura (por su primer cono) y lo
 * anulado.
 */
export function intencionDe(sorteando = []) {
  const lados = {};
  const anulados = new Set();
  const forzadas = new Set();
  let enSlalom = false;
  for (const x of sorteando || []) {
    if (!x || !x.cono) continue;
    if (x.anulado) { anulados.add(x.cono); continue; }
    if (x.tipo === 'puerta') {
      if (x.forzada) for (const id of x.puerta || [x.cono]) forzadas.add(id);
      enSlalom = false;
      continue;
    }
    /* En un slalom solo manda el lado del PRIMERO: los demás alternan. */
    if (x.tipo === 'zigzag') {
      if (!enSlalom) lados[x.cono] = x.lado;
      enSlalom = true;
      continue;
    }
    enSlalom = false;
    if (x.lado) lados[x.cono] = x.lado;
  }
  return { lados, anulados, forzadas };
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
    if (l.tipo === 'puerta') {
      r.push({ cono: l.conos[0], puerta: l.conos.slice(0, 2), tipo: 'puerta', ...(l.forzada ? { forzada: true } : {}) });
      continue;
    }
    const lados = l.tipo === 'zigzag'
      ? l.conos.map((id, i) => ({ cono: id, lado: i % 2 === 0 ? l.lado : otroLado(l.lado), tipo: 'zigzag' }))
      : l.conos.map((id) => ({ cono: id, lado: l.lado, tipo: 'rodeo' }));
    r.push(...lados);
  }
  return r;
}
