/* ============================================================
   geometry.js — easing (§9.4) y muestreo de paths con nodos
   lineales y Bézier (§9.3 / §10). Todo en coordenadas normalizadas.
   ============================================================ */

/**
 * Manejadores de curva de un nodo, TANGENTES al camino (Tramo 2.10).
 *
 * Antes salían siempre en horizontal (`n.x ± 0.06`), así que en una
 * flecha que bajaba salían atravesados: curvar un nodo pegaba un tirón
 * lateral que nadie había pedido y había que recolocar los dos
 * manejadores para volver a donde estabas. Tangentes, curvar no cambia
 * el trazo — solo lo deja listo para curvarlo, que es lo que se quería.
 *
 * La dirección es la del segmento que ENTRA y el que SALE juntos
 * (`siguiente − anterior`), que es lo que hace que la curva pase suave
 * por el nodo; en los extremos, la del único segmento que hay. El largo
 * es un tercio del segmento vecino —la regla de siempre para que una
 * cúbica siga de cerca a la polilínea— con un mínimo para que el
 * cuadradito se pueda agarrar.
 *
 * Función pura y sin DOM: la usa el editor de flechas y la comprueba el
 * banco de Node.
 *
 * @returns { handle_in, handle_out }
 */
export function manejadoresTangentes(path, i, minimo = 0.02) {
  const n = path[i];
  const antes = path[i - 1] || null;
  const despues = path[i + 1] || null;
  let dx, dy;
  if (antes && despues) { dx = despues.x - antes.x; dy = despues.y - antes.y; }
  else if (antes) { dx = n.x - antes.x; dy = n.y - antes.y; }
  else if (despues) { dx = despues.x - n.x; dy = despues.y - n.y; }
  else { dx = 1; dy = 0; }
  const norma = Math.hypot(dx, dy) || 1;
  dx /= norma; dy /= norma;
  const tercio = (a, b) => (a && b ? Math.hypot(b.x - a.x, b.y - a.y) / 3 : 0);
  const dentro = Math.max(tercio(antes, n), minimo);
  const fuera = Math.max(tercio(n, despues), minimo);
  return {
    handle_in: { x: n.x - dx * dentro, y: n.y - dy * dentro },
    handle_out: { x: n.x + dx * fuera, y: n.y + dy * fuera },
  };
}

/** Cúbica ease-in-out estándar (§9.4). */
export const easeInOut = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function cubic(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

/**
 * Aplana un path (nodos {x,y,handle_in,handle_out}) en una polilínea.
 * Cada segmento se trata como cúbica: si no hay handles, es una recta.
 */
export function flattenPath(path, perSeg = 22) {
  if (!path || path.length === 0) return [];
  if (path.length === 1) return [{ x: path[0].x, y: path[0].y }];
  const out = [{ x: path[0].x, y: path[0].y }];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    const p0 = { x: a.x, y: a.y }, p3 = { x: b.x, y: b.y };
    const straight = !a.handle_out && !b.handle_in;
    if (straight) { out.push(p3); continue; }
    const p1 = a.handle_out ? { x: a.handle_out.x, y: a.handle_out.y } : p0;
    const p2 = b.handle_in ? { x: b.handle_in.x, y: b.handle_in.y } : p3;
    for (let s = 1; s <= perSeg; s++) out.push(cubic(p0, p1, p2, p3, s / perSeg));
  }
  return out;
}

/**
 * Devuelve una función f(u∈[0,1]) -> {x,y} que recorre el path a
 * velocidad constante (por longitud de arco). Expone f.flat y f.length.
 */
export function makeSampler(path) {
  const flat = flattenPath(path);
  if (flat.length <= 1) {
    const p = flat[0] || { x: 0.5, y: 0.5 };
    const f = () => ({ ...p });
    f.flat = flat; f.totalLen = 0;
    return f;
  }
  const cum = [0];
  for (let i = 1; i < flat.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(flat[i].x - flat[i - 1].x, flat[i].y - flat[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;
  const f = (u) => {
    u = u <= 0 ? 0 : u >= 1 ? 1 : u;
    const d = u * total;
    let i = 1;
    while (i < cum.length && cum[i] < d) i++;
    const i0 = i - 1, seg = (cum[i] - cum[i0]) || 1, lt = (d - cum[i0]) / seg;
    return { x: flat[i0].x + (flat[i].x - flat[i0].x) * lt, y: flat[i0].y + (flat[i].y - flat[i0].y) * lt };
  };
  f.flat = flat; f.totalLen = total;
  return f;
}

export const lerp = (a, b, t) => a + (b - a) * t;
