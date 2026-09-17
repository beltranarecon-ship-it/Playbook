/* ============================================================
   canvas/instante.js — dónde está cada uno en el instante t.

   Módulo PURO: sin DOM. Lo prueba en Node taller/tools/eval-instante.mjs.

   ── POR QUÉ UN SOLO SITIO ────────────────────────────────────
   El motor de reproducción (engine.js) y el repaso de la Pizarra
   (pizarra/repaso.js) tenían cada uno su copia de esta cuenta, y la
   defensa de la capa 5 necesita una tercera: seguir al par exactamente
   por donde se le ve. Con tres copias, lo que se ve al dibujar y lo que
   se ve al proyectar acaban siendo cosas distintas, y el principio 4 de
   la especificación dice que tienen que ser la misma.

   La curva es la de siempre: cada tramo se reparte por longitud de arco
   y se suaviza con easeInOut.
   ============================================================ */

import { makeSampler, easeInOut } from './geometry.js';
export { easeInOut };

const ultimoNodo = (path) => (path && path.length ? { x: path[path.length - 1].x, y: path[path.length - 1].y } : null);

/* Un camino de LONGITUD CERO —soltar el destino encima de la ficha, un
   balón que ya está en las manos a las que va— hace que `makeSampler`
   reparta por una longitud de arco que no existe, se salga de su propia
   tabla y reviente a mitad del recorrido. Aquí eso es simplemente
   quedarse quieto. */
export function muestreador(path) {
  const s = makeSampler(path);
  const flat = s.flat || [];
  let largo = 0;
  for (let i = 1; i < flat.length; i++) largo += Math.hypot(flat[i].x - flat[i - 1].x, flat[i].y - flat[i - 1].y);
  if (largo > 0) return s;
  const p = flat[flat.length - 1] || ultimoNodo(path) || { x: 0.5, y: 0.5 };
  const quieto = () => ({ x: p.x, y: p.y });
  quieto.flat = flat.length ? flat : [p];
  quieto.totalLen = 0;
  return quieto;
}

/**
 * Dónde está alguien en el instante t, con sus tramos ordenados por
 * arranque. Tres casos, y los tres importan: mientras uno está activo,
 * sobre su camino; ANTES del primero, en su salida —si no, esperaría de
 * pie en el destino—; y ENTRE dos, donde acabó el anterior.
 *
 * @param movs [{ sampler, inicio, fin, dur }] ordenados por `inicio`
 * @returns { x, y } o null si no tiene tramos
 */
export function posicionEn(movs, t) {
  if (!movs || !movs.length) return null;
  let ultimo = null;
  for (const x of movs) {
    if (t < x.inicio) break;
    if (t <= x.fin) return x.sampler(easeInOut((t - x.inicio) / x.dur));
    ultimo = x;
  }
  return ultimo ? ultimo.sampler(1) : movs[0].sampler(0);
}

/**
 * La inversa de la curva: en qué fracción del TIEMPO de un tramo se llega
 * a una fracción de su RECORRIDO. Con easeInOut se sale despacio, así que
 * la mitad del camino se alcanza a la mitad del tiempo, pero el primer
 * cuarto tarda más de un cuarto.
 *
 * Lo necesita quien espera a que otro PASE por un sitio (el bloqueador
 * que aguanta hasta que su compañero le roza): el sitio se mide en
 * recorrido, y la espera, en tiempo.
 */
export function tiempoDeRecorrido(s) {
  if (!(s > 0)) return 0;
  if (s >= 1) return 1;
  let a = 0, b = 1;
  for (let i = 0; i < 50; i++) {
    const m = (a + b) / 2;
    if (easeInOut(m) < s) a = m; else b = m;
  }
  return (a + b) / 2;
}

/**
 * De quién es un balón en el instante t: el último cambio de manos que
 * ya haya ocurrido, o el dueño con el que empezó la fase.
 *
 * @param eventos [{ t, quien }] ordenados por `t`
 */
export function duenoEn(eventos, t, inicial) {
  let quien = inicial ?? null;
  for (const ev of eventos || []) { if (ev.t <= t) quien = ev.quien; else break; }
  return quien;
}
