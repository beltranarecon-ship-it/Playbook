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
 * Un camino que ya viene MUESTREADO EN EL TIEMPO: [{ t, x, y }].
 *
 * Lo produce el seguimiento de la defensa (§8.4), que calcula dónde está
 * en cada instante. Se recorre en el tiempo y sin curva: cada muestra
 * dice dónde estaba en ese milisegundo, y una curva encima deformaría el
 * retardo que se acaba de calcular. Por eso se marca `lineal`, y quien
 * muestrea (posicionEn) no le aplica el easeInOut.
 *
 * @returns f(u ∈ [0,1]) -> { x, y }, con u la fracción del tramo
 */
export function muestreadorPorTiempo(muestras) {
  const ms = (muestras || []).filter((m) => m && Number.isFinite(m.t) && Number.isFinite(m.x) && Number.isFinite(m.y))
    .slice().sort((a, b) => a.t - b.t);
  if (!ms.length) { const f = () => ({ x: 0.5, y: 0.5 }); f.flat = []; f.lineal = true; return f; }
  const total = ms[ms.length - 1].t - ms[0].t;
  const f = (u) => {
    const k = u <= 0 ? 0 : u >= 1 ? 1 : u;
    if (total <= 0) return { x: ms[0].x, y: ms[0].y };
    const t = ms[0].t + k * total;
    let i = 1;
    while (i < ms.length && ms[i].t < t) i++;
    const a = ms[i - 1], b = ms[i] || ms[ms.length - 1];
    const d = (b.t - a.t) || 1;
    const q = Math.max(0, Math.min(1, (t - a.t) / d));
    return { x: a.x + (b.x - a.x) * q, y: a.y + (b.y - a.y) * q };
  };
  f.flat = ms.map((m) => ({ x: m.x, y: m.y }));
  f.totalLen = 0;
  f.lineal = true;
  return f;
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
    /* Lo dibujado se recorre con la curva de siempre; lo muestreado en el
       tiempo —la defensa— tal cual, que para eso ya trae sus instantes. */
    if (t <= x.fin) return x.sampler(x.sampler.lineal ? (t - x.inicio) / x.dur : easeInOut((t - x.inicio) / x.dur));
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
