/* ============================================================
   canvas/zonas.js — zonas de la pista (Tramo 2.7). Módulo PURO:
   sin DOM, sin red. Lo usan el tablero, el compilador, el linter y
   los bancos Node.

   Una zona es un trozo de pista con nombre: «la zona de tiro», «el
   pasillo central», «la línea de fondo hasta el codo». Sirve para
   dos cosas y solo para dos:

     1. DECIR DÓNDE. Su nombre es un sitio al que mandar a alguien
        desde el paso 2, igual que «el codo derecho». Y su contorno
        da puntos sobre los que repartir conos a distancia regular.
     2. VERSE. Se dibuja difuminada, con su nombre en el centro, para
        que el ejercicio se entienda de un vistazo.

   LO QUE NO HACE, Y ES DELIBERADO: no restringe trayectorias. La
   regla de juego —«no se puede salir de la zona»— se escribe en la
   ficha y la hace cumplir el entrenador, no el motor. Un motor que
   impidiera salirse convertiría cada error de colocación en una
   animación imposible de depurar, y obligaría a modelar reglas de
   juego que cambian con cada ejercicio.

   ── FORMA ────────────────────────────────────────────────────
   Las tres formas se describen con DOS PUNTOS, en normalizado:

     rect     (x,y) y (x2,y2) son esquinas opuestas
     circulo  (x,y) es el centro y (x2,y2) un punto del borde
     linea    de (x,y) a (x2,y2)

   Dos puntos es exactamente lo que produce arrastrar el ratón, así
   que crear una zona es un gesto y no un formulario.

   El RADIO de un círculo se mide en METROS y se dibuja en metros: en
   un marco que no es cuadrado, tomar el radio en unidades
   normalizadas daría una elipse. Es el mismo motivo por el que se
   redibujaron las pistas (canvas/medidas.js).
   ============================================================ */

import { metrosEntre } from './escala.js';
import { marcoDe } from './medidas.js';

export const TIPOS_ZONA = ['rect', 'circulo', 'linea'];

/** Nombre libre siguiente: ZONA 1, ZONA 2… mirando las que ya hay. */
export function siguienteNombre(zonas = []) {
  const usados = new Set();
  for (const z of zonas) {
    const m = /^ZONA\s+(\d+)$/i.exec(String(z?.nombre ?? '').trim());
    if (m) usados.add(Number(m[1]));
  }
  let n = 1;
  while (usados.has(n)) n += 1;
  return `ZONA ${n}`;
}

/** Zona nueva a partir del arrastre. */
export function crearZona(tipo, x, y, x2, y2, zonas = []) {
  return {
    kind: 'zona',
    tipo: TIPOS_ZONA.includes(tipo) ? tipo : 'rect',
    nombre: siguienteNombre(zonas),
    visible: true,
    x, y, x2, y2,
  };
}

/** Radio de un círculo, en metros. 0 para las otras formas. */
export function radioMetros(pista, z) {
  if (!z || z.tipo !== 'circulo') return 0;
  return metrosEntre(pista, [z.x, z.y], [z.x2, z.y2]);
}

/**
 * Caja que contiene la zona, en normalizado: { x0, y0, x1, y1 }.
 * Para el círculo se calcula desde el radio en metros, así que sale
 * cuadrada en la pista aunque no lo parezca en el lienzo.
 */
export function cajaDe(pista, z) {
  if (!z) return null;
  if (z.tipo === 'circulo') {
    const m = marcoDe(pista);
    const r = radioMetros(pista, z);
    const rx = r / m.ancho, ry = r / m.alto;
    return { x0: z.x - rx, y0: z.y - ry, x1: z.x + rx, y1: z.y + ry };
  }
  return {
    x0: Math.min(z.x, z.x2), y0: Math.min(z.y, z.y2),
    x1: Math.max(z.x, z.x2), y1: Math.max(z.y, z.y2),
  };
}

/** Centro de la zona. Es lo que resuelve su NOMBRE como destino. */
export function centroDe(pista, z) {
  if (!z) return null;
  if (z.tipo === 'circulo') return { x: z.x, y: z.y };
  return { x: (z.x + z.x2) / 2, y: (z.y + z.y2) / 2 };
}

/**
 * El contorno, como lista de vértices en normalizado. El círculo se
 * devuelve como polígono de 48 lados: para repartir conos por encima o
 * para dibujarlo, la diferencia con la curva es de milímetros.
 * @returns { puntos, cerrado }
 */
export function contornoDe(pista, z, lados = 48) {
  if (!z) return { puntos: [], cerrado: false };
  if (z.tipo === 'linea') {
    return { puntos: [{ x: z.x, y: z.y }, { x: z.x2, y: z.y2 }], cerrado: false };
  }
  if (z.tipo === 'rect') {
    const c = cajaDe(pista, z);
    return {
      puntos: [
        { x: c.x0, y: c.y0 }, { x: c.x1, y: c.y0 },
        { x: c.x1, y: c.y1 }, { x: c.x0, y: c.y1 },
      ],
      cerrado: true,
    };
  }
  const m = marcoDe(pista);
  const r = radioMetros(pista, z);
  const rx = r / m.ancho, ry = r / m.alto;
  const puntos = [];
  for (let i = 0; i < lados; i++) {
    const a = (i / lados) * Math.PI * 2;
    puntos.push({ x: z.x + Math.cos(a) * rx, y: z.y + Math.sin(a) * ry });
  }
  return { puntos, cerrado: true };
}

/**
 * Sitios con nombre de una zona: su centro y los vértices de su
 * contorno (las esquinas de un rectángulo, los extremos de una línea).
 * Es lo que la especificación llama «sus esquinas y su trazado son
 * sitios a los que referirse».
 *
 * El círculo devuelve los cuatro puntos cardinales y no sus 48
 * vértices: nadie manda a nadie «al vértice 31».
 */
export function puntosDe(pista, z) {
  const centro = centroDe(pista, z);
  if (!centro) return [];
  const out = [{ nombre: 'centro', x: centro.x, y: centro.y }];
  if (z.tipo === 'linea') {
    out.push({ nombre: 'inicio', x: z.x, y: z.y }, { nombre: 'fin', x: z.x2, y: z.y2 });
  } else if (z.tipo === 'rect') {
    const c = cajaDe(pista, z);
    out.push(
      { nombre: 'esquina_1', x: c.x0, y: c.y0 }, { nombre: 'esquina_2', x: c.x1, y: c.y0 },
      { nombre: 'esquina_3', x: c.x1, y: c.y1 }, { nombre: 'esquina_4', x: c.x0, y: c.y1 },
    );
  } else {
    const c = cajaDe(pista, z);
    out.push(
      { nombre: 'arriba', x: z.x, y: c.y0 }, { nombre: 'abajo', x: z.x, y: c.y1 },
      { nombre: 'izquierda', x: c.x0, y: z.y }, { nombre: 'derecha', x: c.x1, y: z.y },
    );
  }
  return out;
}

/** Largo total del contorno, en metros. */
export function largoMetros(pista, z) {
  const { puntos, cerrado } = contornoDe(pista, z);
  if (puntos.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < puntos.length; i++) total += metrosEntre(pista, puntos[i - 1], puntos[i]);
  if (cerrado) total += metrosEntre(pista, puntos[puntos.length - 1], puntos[0]);
  return total;
}

/**
 * Reparte `n` puntos a distancia REGULAR sobre el contorno. Es lo que
 * hace el Shift del paso 1: pinchar una zona con Shift y que salgan
 * los conos ya alineados y equidistantes, en vez de colocarlos a ojo
 * uno a uno y que el ejercicio salga torcido.
 *
 * La distancia es regular EN METROS, no en unidades de lienzo: sobre
 * un rectángulo alargado, repartir por unidades normalizadas juntaría
 * los conos en los lados cortos.
 *
 * En un contorno cerrado los n puntos se reparten por toda la vuelta;
 * en una línea, el primero y el último caen en los extremos.
 */
export function repartirSobre(pista, z, n) {
  const cuantos = Math.max(0, Math.floor(n));
  if (!cuantos) return [];
  const { puntos, cerrado } = contornoDe(pista, z);
  if (puntos.length < 2) return [];

  const vertices = cerrado ? [...puntos, puntos[0]] : puntos;
  const tramos = [];
  let total = 0;
  for (let i = 1; i < vertices.length; i++) {
    const d = metrosEntre(pista, vertices[i - 1], vertices[i]);
    tramos.push({ a: vertices[i - 1], b: vertices[i], d, hasta: total + d });
    total += d;
  }
  if (total <= 0) return [];

  // cerrado: el punto n+1 coincidiría con el 1, así que se reparte en n
  // tramos; abierto: n−1 tramos, para que haya punto en los dos extremos.
  const paso = cerrado ? total / cuantos : total / Math.max(1, cuantos - 1);
  const out = [];
  for (let i = 0; i < cuantos; i++) {
    const s = Math.min(total, paso * i);
    const t = tramos.find((tr) => s <= tr.hasta) || tramos[tramos.length - 1];
    const antes = t.hasta - t.d;
    const u = t.d > 0 ? (s - antes) / t.d : 0;
    out.push({ x: t.a.x + (t.b.x - t.a.x) * u, y: t.a.y + (t.b.y - t.a.y) * u });
  }
  return out;
}

/**
 * Ajusta el segundo punto de un arrastre cuando se mantiene SHIFT.
 * En una línea, a la horizontal, la vertical o la diagonal exacta —que
 * es lo que hace falta para dibujar un pasillo recto o una diagonal de
 * esquina a esquina—. En rectángulo y círculo, a proporción cuadrada.
 *
 * Se hace en METROS: un cuadrado en unidades normalizadas no sería
 * cuadrado en la pista, y una diagonal a 45° del lienzo no sería 45°
 * sobre el suelo.
 */
export function ajustarConShift(pista, tipo, x, y, x2, y2) {
  const m = marcoDe(pista);
  let dx = (x2 - x) * m.ancho;      // metros
  let dy = (y2 - y) * m.alto;
  const ax = Math.abs(dx), ay = Math.abs(dy);

  if (tipo === 'linea') {
    // horizontal, vertical o 45°, lo que más se parezca a lo dibujado
    if (ax > ay * 2.4142) dy = 0;                       // tan(67.5°)
    else if (ay > ax * 2.4142) dx = 0;
    else { const d = (ax + ay) / 2; dx = Math.sign(dx) * d; dy = Math.sign(dy) * d; }
  } else {
    const d = Math.max(ax, ay);
    dx = Math.sign(dx || 1) * d;
    dy = Math.sign(dy || 1) * d;
  }
  return { x2: x + dx / m.ancho, y2: y + dy / m.alto };
}

/** Forma que se guarda en la animación (lo mismo que se dibuja). */
export function zonaGuardable(z, i = 0) {
  return {
    id: z.id || `zona_${i + 1}`,
    tipo: z.tipo,
    nombre: z.nombre,
    visible: z.visible !== false,
    puntos: [[z.x, z.y], [z.x2, z.y2]],
  };
}

/** Y la vuelta: de lo guardado al objeto con el que trabaja el tablero. */
export function zonaDesdeGuardada(g) {
  const [[x, y], [x2, y2]] = g.puntos;
  return { id: g.id, kind: 'zona', tipo: g.tipo, nombre: g.nombre, visible: g.visible !== false, x, y, x2, y2 };
}
