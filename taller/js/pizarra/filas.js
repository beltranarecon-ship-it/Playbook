/* ============================================================
   pizarra/filas.js — un cono que es cola (§7.4.2).

   Módulo PURO: sin DOM, sin canvas. Lo prueba en Node
   taller/tools/eval-filas.mjs.

   ── QUIÉNES SON LOS DE LA COLA ──────────────────────────────
   Jugadores de verdad (§7.1): fichas del equipo de la fila, con
   `fila_de` apuntando a su cono y `puesto` diciendo en qué lugar
   esperan. El primero (puesto 0) está EN el cono y es el que sale; los
   demás esperan detrás, sin dorsal y sin contar para la defensa (§7.1,
   §8.2), porque no están en juego.

   ── LA MISMA COLA QUE PINTA EL PROYECTOR ────────────────────
   El motor dibuja la cola de un cono de fila (`drawFila`) empezando a
   un paso del cono y en la dirección de `direccion_grados` —0° hacia la
   derecha del lienzo, en el sentido de las agujas del reloj—, a
   1,95 radios de jugador de uno a otro. Los que esperan en la Pizarra se
   ponen EXACTAMENTE ahí: si no, el entrenador los vería en un sitio al
   dibujar y en otro al proyectar.
   ============================================================ */

import { escalaDe } from '../canvas/escala.js';
import { crear, renumerar, asignarBalon, quitar, mover, seguirAlPortador } from './elementos.js';

/** Los números de una fila. */
export const FILAS = Object.freeze({
  /* De uno a otro de la cola, en metros: 1,95 veces el radio de la ficha
     (0,65 m), que es el paso con el que la pinta el motor. */
  hueco: 1.95 * 0.65,
  minimo: 1,
  maximo: 12,
  /* El tirador de la orientación se imanta cada 15° (libre con Mayús). */
  iman: 15,
});

/** Una orientación en grados, entre 0 y 359. */
export const normalizarGrados = (g) => {
  const n = Number.isFinite(g) ? g % 360 : 0;
  return n < 0 ? n + 360 : n;
};

/** La orientación del tirador: imantada cada 15°, o libre con Mayús. */
export function orientacionImantada(grados, { libre = false } = {}) {
  const g = normalizarGrados(grados);
  if (libre) return g;
  return normalizarGrados(Math.round(g / FILAS.iman) * FILAS.iman);
}

/**
 * La orientación que marca un punto arrastrado alrededor del cono: la
 * dirección del cono a ese punto, EN METROS (la pista no escala igual en
 * los dos ejes: 18 × 27 en la entera).
 */
export function orientacionHacia(cono, punto, pista = 'entera', opciones = {}) {
  const e = escalaDe(pista);
  const dx = (punto.x - cono.x) * e.x, dy = (punto.y - cono.y) * e.y;
  if (Math.hypot(dx, dy) < 1e-9) return null;
  return orientacionImantada((Math.atan2(dy, dx) * 180) / Math.PI, opciones);
}

/**
 * Dónde espera cada uno de la cola: el puesto 0 en el cono y los demás
 * detrás, a un hueco de distancia, en la orientación de la fila.
 */
export function puestosDeFila(cono, n, orientacion = 0, pista = 'entera') {
  const e = escalaDe(pista);
  const rad = (normalizarGrados(orientacion) * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const cuantos = Math.max(0, Math.min(FILAS.maximo, n | 0));
  const r = [];
  for (let k = 0; k < cuantos; k++) {
    r.push({ x: cono.x + (dx * FILAS.hueco * k) / e.x, y: cono.y + (dy * FILAS.hueco * k) / e.y });
  }
  return r;
}

/**
 * EL FINAL DE LA COLA: a donde va quien «vuelve a la fila» (§7.4.2).
 * Un hueco detrás del último que espera.
 */
export function finalDeFila(cono, n, orientacion = 0, pista = 'entera') {
  return puestosDeFila(cono, (n | 0) + 1, orientacion, pista)[Math.max(0, n | 0)] || { x: cono.x, y: cono.y };
}

/** Una fila en condiciones: lo que falte, con lo de serie. */
export function normalizarFila(f) {
  if (!f || typeof f !== 'object') return null;
  const n = Number.isFinite(f.n) ? Math.round(f.n) : 3;
  return {
    n: Math.max(FILAS.minimo, Math.min(FILAS.maximo, n)),
    equipo: ['A', 'B', 'C', 'D'].includes(f.equipo) ? f.equipo : 'A',
    papel: f.papel === 'defensor' ? 'defensor' : 'atacante',
    balon: !!f.balon,
    orientacion: normalizarGrados(Number.isFinite(f.orientacion) ? f.orientacion : 90),
    vuelta: typeof f.vuelta === 'string' && f.vuelta ? f.vuelta : null,
  };
}

/* ── La cola en la lista de fichas ─────────────────────────── */

/** Los de la cola de este cono, por su puesto. */
export function deLaFila(lista, conoId) {
  return (lista || [])
    .filter((e) => e && e.kind === 'jugador' && e.fila_de === conoId)
    .sort((a, b) => (a.puesto ?? 0) - (b.puesto ?? 0));
}

/**
 * QUITA LA COLA de un cono: los que esperaban, y el balón de cada uno.
 * El cono se queda, ya sin ser fila.
 */
export function deshacerFila(lista, conoId) {
  const suyos = new Set(deLaFila(lista, conoId).map((e) => e.id));
  const balones = (lista || []).filter((e) => e.kind === 'balon' && suyos.has(e.portador_id)).map((e) => e.id);
  const quedan = quitar(lista, [...suyos, ...balones]);
  return quedan.map((e) => (e.id === conoId && e.kind === 'cono' ? { ...e, fila: null } : e));
}

/**
 * HACE FILA DE UN CONO (§7.4.2): su configuración y los que esperan,
 * jugadores de verdad (§7.1). El primero, en el cono y en juego; los
 * demás detrás, esperando. Con `balon`, uno por cabeza (§7.3).
 *
 * Si el cono ya era fila, se rehace entera: cambiar cuántos son o de qué
 * equipo es más claro rehaciéndola que parcheando.
 */
export function hacerFila(lista, conoId, fila, pista = 'entera') {
  const cono = (lista || []).find((e) => e.id === conoId && e.kind === 'cono');
  const f = normalizarFila(fila);
  if (!cono || !f) return lista;
  let l = deshacerFila(lista, conoId).map((e) => (e.id === conoId ? { ...e, fila: f } : e));
  puestosDeFila(cono, f.n, f.orientacion, pista).forEach((s, k) => {
    const j = { ...crear({ kind: 'jugador', equipo: f.equipo }, s.x, s.y), fila_de: conoId, puesto: k, en_juego: k === 0 };
    l = [...l, j];
    if (f.balon) {
      const b = crear({ kind: 'balon' }, s.x, s.y);
      l = asignarBalon([...l, b], b.id, j.id, pista);
    }
  });
  return renumerar(l);
}

/**
 * VUELVE A PONER LA COLA en su sitio: tras mover el cono o cambiar su
 * orientación. Cada uno a su puesto, y su balón con él.
 */
export function recolocarFila(lista, conoId, pista = 'entera') {
  const cono = (lista || []).find((e) => e.id === conoId && e.kind === 'cono');
  if (!cono || !cono.fila) return lista;
  const sitios = puestosDeFila(cono, cono.fila.n, cono.fila.orientacion, pista);
  const movidos = {};
  for (const j of deLaFila(lista, conoId)) {
    const s = sitios[j.puesto ?? 0];
    if (s) movidos[j.id] = s;
  }
  return seguirAlPortador(mover(lista, movidos), pista);
}

/** Cambia la orientación de la fila (§7.4.2) y la recoloca. */
export function orientarFila(lista, conoId, grados, pista = 'entera') {
  const l = (lista || []).map((e) => (e.id === conoId && e.kind === 'cono' && e.fila
    ? { ...e, fila: { ...e.fila, orientacion: normalizarGrados(grados) } }
    : e));
  return recolocarFila(l, conoId, pista);
}
