/* ============================================================
   pizarra/trazo.js — el camino que recorre una ficha (§5).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-trazo.mjs.

   Se apoya en canvas/geometry.js, que ya sabe lo de bajo nivel
   —manejadores tangentes, aplanar cúbicas y recorrer por longitud de
   arco— y lleva funcionando desde el motor anterior. Aquí va lo que
   falta: crear, editar y medir un trazo.

   ── LOS TRES GESTOS PRODUCEN EL MISMO DATO ──────────────────
   Un clic en el destino, varios clics marcando el camino, o un
   arrastre a pulso: los tres acaban en la misma lista de nodos. Eso es
   lo que permite que después se editen igual, se guarden igual y se
   animen igual, y que añadir un gesto nuevo no toque nada más.

   ── LOS NODOS NUEVOS SALEN CURVOS ───────────────────────────
   Decidido en el §5.2, y no es un capricho: un nodo insertado en medio
   de un trazo casi siempre se pone para redondear una trayectoria, no
   para hacerle un pico. Salen curvos y TANGENTES, así que insertar uno
   no cambia el trazo — solo lo deja listo para curvarlo.

   ── TODO LO QUE SE MIDE, EN METROS ──────────────────────────
   La longitud de un trazo y la tolerancia del suavizado van en metros
   de pista. En normalizado no se puede: el marco de la entera es
   18 × 27 m, así que un mismo número vale metro y medio más por un eje
   que por el otro, y un trazo diagonal se suavizaría distinto según su
   inclinación.
   ============================================================ */

import { manejadoresTangentes, flattenPath } from '../canvas/geometry.js';
import { marcoDe } from '../canvas/medidas.js';
import { metrosEntre, escalaDe } from '../canvas/escala.js';

/** Radio de agarre de un nodo por defecto, en METROS. Es solo el
 *  valor de reserva: quien pincha manda el suyo, sacado de sus 44 px
 *  de agarre (§2.6) y del zoom que haya en ese momento. */
export const RADIO_NODO = 0.50;

/** Cuánto se simplifica un trazo hecho a pulso, en METROS (§5.1). */
export const TOLERANCIA_SUAVIZADO = 0.25;

/** Cuántos nodos deja como mucho un trazo a pulso. Más no se editan:
 *  se convierten en una madeja imposible de agarrar. */
export const NODOS_MAX = 8;

/**
 * A qué velocidad se recorre un trazo, en metros por segundo (§6.2).
 *
 * No son inventados: andar son 1,5; correr de verdad, 6,5; y el 4,0 de
 * «normal» es el trote al que se hacen casi todos los desplazamientos
 * de un ejercicio. El lateral defensivo es más lento que andar de
 * frente, y de espaldas más todavía.
 */
export const RITMOS = {
  andando: 1.5,
  normal: 4.0,
  sprint: 6.5,
  lateral: 2.5,
  espalda: 2.0,
};

/** El balón vuela más rápido que nadie, y un pase corto no puede durar
 *  menos de lo que se tarda en verlo salir. */
export const VELOCIDAD_PASE = 9.0;
export const PASE_MINIMO_S = 0.25;

/** Cuánto dura recorrer estos metros. El modelo completo de tiempos
 *  —arranques, carriles, la fase que dura lo que el carril más largo—
 *  es de la capa 3; esto es lo justo para poder decirlo mientras se
 *  dibuja. */
export function duracionDe(metros, ritmo = 'normal') {
  if (ritmo === 'pase') return Math.max(PASE_MINIMO_S, metros / VELOCIDAD_PASE);
  const v = RITMOS[ritmo] || RITMOS.normal;
  return metros / v;
}

/* ── Crear ─────────────────────────────────────────────────── */

const nodo = (p, extra = {}) => ({
  x: p.x, y: p.y, tipo_nodo: 'lineal', handle_in: null, handle_out: null, ...extra,
});

/** Un trazo recto entre dos puntos: el gesto de un solo clic. */
export function nuevoTrazo(desde, hasta) {
  return [nodo(desde), nodo(hasta)];
}

/** Una polilínea: el gesto de ir marcando puntos. */
export function desdePuntos(puntos) {
  return (puntos || []).map((p) => nodo(p));
}

/* ── Editar ────────────────────────────────────────────────── */

/**
 * Qué nodos NO se pueden arrastrar, porque son consecuencia de dónde
 * está una ficha y no de lo que el entrenador decidió:
 *
 *   · el origen de cualquier trazo        (lo pone quien lo hace)
 *   · el final de un PASE o de un TIRO     (lo pone quien lo recibe,
 *                                            o el aro)
 *
 * Dejar arrastrarlos sería mentir: al recalcular vuelven a su sitio.
 *
 * OJO CON LA PALABRA. Lo que circula por la Pizarra como `tipo` es el
 * TIPO DE FLECHA —'run', 'pass', 'cut', 'gesto'— y no el nombre de la
 * acción. Esto comparó durante un tiempo con 'pase', que no existe en
 * ningún sitio, así que la condición no se cumplía nunca y el final de
 * un pase se podía arrastrar y borrar. No dio ningún error — solo
 * dejaba de proteger. El banco tampoco lo vio, porque llamaba a esta
 * función con la palabra equivocada.
 */
export function nodosFijos(tipo, n) {
  const fijos = new Set([0]);
  if (tipo === 'pass' && n > 1) fijos.add(n - 1);
  return fijos;
}

/** Mueve un nodo, y sus manejadores con él: si se quedaran quietos, la
 *  curva se deformaría de una manera que nadie ha pedido. */
export function moverNodo(trazo, i, punto) {
  const n = trazo[i];
  if (!n) return trazo;
  const dx = punto.x - n.x, dy = punto.y - n.y;
  const desplaza = (h) => (h ? { x: h.x + dx, y: h.y + dy } : null);
  return trazo.map((m, k) => (k === i
    ? { ...m, x: punto.x, y: punto.y, handle_in: desplaza(m.handle_in), handle_out: desplaza(m.handle_out) }
    : m));
}

/**
 * Inserta un nodo en el segmento `seg` (entre seg y seg+1), CURVO
 * (§5.2). Tangente, así que el trazo no cambia de forma al insertarlo.
 */
export function insertarEn(trazo, seg, punto) {
  if (seg < 0 || seg >= trazo.length - 1) return trazo;
  const nuevo = [...trazo.slice(0, seg + 1), nodo(punto), ...trazo.slice(seg + 1)];
  return curvar(nuevo, seg + 1);
}

/** Curva un nodo. Los manejadores salen tangentes al camino: por eso
 *  curvar no da el tirón lateral que daba el editor anterior. */
export function curvar(trazo, i, minimo = 0.02) {
  const n = trazo[i];
  if (!n) return trazo;
  const { handle_in, handle_out } = manejadoresTangentes(trazo, i, minimo);
  return trazo.map((m, k) => (k === i
    ? { ...m, tipo_nodo: 'bezier', handle_in, handle_out } : m));
}

export function enderezar(trazo, i) {
  const n = trazo[i];
  if (!n) return trazo;
  return trazo.map((m, k) => (k === i
    ? { ...m, tipo_nodo: 'lineal', handle_in: null, handle_out: null } : m));
}

export const esCurvo = (n) => !!(n && (n.handle_in || n.handle_out));

/** Curva lo recto y endereza lo curvo: el doble clic del §5.2. */
export function alternarCurva(trazo, i, minimo = 0.02) {
  return esCurvo(trazo[i]) ? enderezar(trazo, i) : curvar(trazo, i, minimo);
}

/** Borra un nodo. Nunca deja menos de dos: un trazo con un solo punto
 *  no es un trazo, y los fijos no se tocan. */
export function borrarNodo(trazo, i, tipo = 'run') {
  if (trazo.length <= 2) return trazo;
  if (nodosFijos(tipo, trazo.length).has(i)) return trazo;
  return trazo.filter((_, k) => k !== i);
}

/* ── Acertar ────────────────────────────────────────

   Con qué se ha acertado al pinchar: un nodo, la línea, o nada.

   Va aquí y no en el editor porque es geometría del trazo, se prueba
   en Node y no necesita ni canvas ni punteros. Quien pincha solo tiene
   que traducir su área de agarre — 44 px con el dedo (§2.6) — a metros
   con el zoom que haya en ese momento, y preguntar.

   EN METROS, como todo lo demás: en píxeles se acertaría más lejos al
   alejar el zoom, y en normalizado el margen valdría distinto a lo
   ancho que a lo largo, así que la misma línea sería más fácil de
   agarrar en diagonal que en vertical.
   ────────────────────────────────────────────────── */

/** El punto de `a`→`b` más cercano a `p`, y a cuántos metros queda.
 *  Se proyecta en el espacio de METROS —multiplicando cada eje por su
 *  escala— y se vuelve: proyectar en normalizado daría el pie de
 *  perpendicular de un marco estirado, que no es el de la pista. */
function masCercaDelSegmento(p, a, b, e) {
  const ax = a.x * e.x, ay = a.y * e.y;
  const bx = b.x * e.x, by = b.y * e.y;
  const px = p.x * e.x, py = p.y * e.y;
  const dx = bx - ax, dy = by - ay;
  const largo = dx * dx + dy * dy;
  const t = largo > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo)) : 0;
  const qx = ax + dx * t, qy = ay + dy * t;
  return { t, metros: Math.hypot(px - qx, py - qy), punto: { x: qx / e.x, y: qy / e.y } };
}

/**
 * Con qué nodo se ha acertado, o -1 si con ninguno.
 *
 * Gana el MÁS CERCANO y no el primero: en un trazo apretado dos nodos
 * caen dentro del área de agarre a la vez, y coger siempre el de menor
 * índice haría que el último de un rizo no se pudiera tocar nunca.
 */
export function nodoEn(trazo, punto, { pista = 'entera', tolerancia = RADIO_NODO } = {}) {
  let mejor = -1, corta = Infinity;
  for (let i = 0; i < (trazo || []).length; i++) {
    const d = metrosEntre(pista, trazo[i], punto);
    if (d <= tolerancia && d < corta) { corta = d; mejor = i; }
  }
  return mejor;
}

/**
 * Dónde cae un punto sobre la LÍNEA: en qué segmento, en qué sitio
 * exacto de la curva y a cuántos metros. `null` si no se acertó.
 *
 * Se mide sobre la curva APLANADA, no sobre la recta de nodo a nodo:
 * en un trazo curvado la recta pasa por dentro del arco, así que
 * pinchar sobre la línea que se ve daría «no has acertado» y pinchar
 * en el hueco daría «has acertado». Se aplana con el mismo
 * `flattenPath` que dibuja y que mide, de dos nodos en dos nodos, para
 * saber a qué segmento pertenece cada tramo.
 */
export function segmentoEn(trazo, punto, {
  pista = 'entera', tolerancia = RADIO_NODO, porSegmento = 22,
} = {}) {
  if (!trazo || trazo.length < 2) return null;
  const e = escalaDe(pista);
  let mejor = null;
  for (let i = 0; i < trazo.length - 1; i++) {
    const flat = flattenPath([trazo[i], trazo[i + 1]], porSegmento);
    for (let k = 1; k < flat.length; k++) {
      const c = masCercaDelSegmento(punto, flat[k - 1], flat[k], e);
      if (c.metros <= tolerancia && (!mejor || c.metros < mejor.metros)) {
        mejor = { seg: i, punto: c.punto, metros: c.metros };
      }
    }
  }
  return mejor;
}

/* ── Medir ─────────────────────────────────────────────────── */

/** Lo que mide el trazo recorrido, EN METROS. Se mide sobre la curva
 *  aplanada y no de nodo a nodo: un rodeo mide lo que se anda. */
export function longitudMetros(trazo, pista = 'entera') {
  const flat = flattenPath(trazo);
  let m = 0;
  for (let i = 1; i < flat.length; i++) m += metrosEntre(pista, flat[i - 1], flat[i]);
  return m;
}

/** Lo que se enseña mientras se dibuja: «8,4 m · 2,1 s». */
export function rotulo(trazo, pista = 'entera', ritmo = 'normal') {
  const m = longitudMetros(trazo, pista);
  const s = duracionDe(m, ritmo);
  const num = (v) => v.toFixed(1).replace('.', ',');
  return `${num(m)} m · ${num(Math.max(0.1, s))} s`;
}

/* ── Suavizar lo dibujado a pulso ──────────────────────────── */

/* Ramer–Douglas–Peucker sobre puntos EN METROS. Quitar los puntos que
   no dicen nada es lo que convierte doscientas muestras de un dedo en
   media docena de nodos que se pueden agarrar. */
function rdp(puntos, tol) {
  if (puntos.length < 3) return puntos.slice();
  let peor = 0, iPeor = 0;
  const a = puntos[0], b = puntos[puntos.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y;
  const largo = Math.hypot(dx, dy);
  for (let i = 1; i < puntos.length - 1; i++) {
    const p = puntos[i];
    /* Distancia del punto a la recta a→b. Con a y b en el mismo sitio
       —un garabato que vuelve al origen— la recta no existe y se mide
       contra el punto. */
    const d = largo < 1e-9
      ? Math.hypot(p.x - a.x, p.y - a.y)
      : Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / largo;
    if (d > peor) { peor = d; iPeor = i; }
  }
  if (peor <= tol) return [a, b];
  return [
    ...rdp(puntos.slice(0, iPeor + 1), tol).slice(0, -1),
    ...rdp(puntos.slice(iPeor), tol),
  ];
}

/**
 * Convierte lo dibujado a pulso en un trazo editable (§5.1).
 *
 * Tres pasos: pasar a metros, quitar lo que no dice nada, y curvar los
 * nodos de en medio para que el resultado se parezca al gesto y no a
 * una polilínea de picos.
 *
 * Los extremos se dejan RECTOS: el primero porque lo pone la ficha, y
 * el último porque es el destino y curvarlo lo movería de sitio.
 */
export function suavizar(puntos, { pista = 'entera', tolerancia = TOLERANCIA_SUAVIZADO, max = NODOS_MAX } = {}) {
  const ps = (puntos || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  if (ps.length < 2) return ps.length ? [nodo(ps[0])] : [];

  const m = marcoDe(pista);
  const aMetros = (p) => ({ x: p.x * m.ancho, y: p.y * m.alto });
  const aNorm = (p) => ({ x: p.x / m.ancho, y: p.y / m.alto });

  let tol = tolerancia;
  let simple = rdp(ps.map(aMetros), tol);
  /* Si aun así salen demasiados nodos, se afloja la tolerancia hasta
     que quepan. Un trazo de treinta nodos es imposible de agarrar con
     el dedo, y nadie los va a colocar uno a uno. */
  let vueltas = 0;
  while (simple.length > max && vueltas < 12) { tol *= 1.6; simple = rdp(simple, tol); vueltas++; }

  const trazo = simple.map(aNorm).map((p) => nodo(p));
  let salida = trazo;
  for (let i = 1; i < trazo.length - 1; i++) salida = curvar(salida, i);
  return salida;
}
