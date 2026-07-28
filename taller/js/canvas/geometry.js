/* ============================================================
   geometry.js — easing (§9.4) y muestreo de paths con nodos
   lineales y Bézier (§9.3 / §10). Todo en coordenadas normalizadas.
   ============================================================ */

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
