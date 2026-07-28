/* ============================================================
   arrows.js — los 4 tipos de flecha (§9.2). Reciben la polilínea
   ya convertida a píxeles y un factor de escala.
     run  = carrera con balón  (blanca sólida 4.5, punta rellena)
     pass = pase / tiro         (naranja punteada 3.5, punta rellena)
     cut  = corte sin balón     (blanca discontinua 65%, punta hueca)
     bloqueo = rectángulo perpendicular (pick)
   ============================================================ */

import { COLORS } from './colors.js';

function arrowhead(ctx, from, to, size, { fill, stroke, lineWidth }) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const p1 = { x: to.x + Math.cos(ang + Math.PI - 0.42) * size, y: to.y + Math.sin(ang + Math.PI - 0.42) * size };
  const p2 = { x: to.x + Math.cos(ang + Math.PI + 0.42) * size, y: to.y + Math.sin(ang + Math.PI + 0.42) * size };
  ctx.beginPath();
  ctx.moveTo(to.x, to.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill; ctx.fill();
    ctx.lineWidth = Math.max(1, size * 0.12); ctx.strokeStyle = 'rgba(11,35,48,.45)'; ctx.setLineDash([]); ctx.stroke();
  } else {
    ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.setLineDash([]); ctx.stroke();
  }
}

const STYLE = {
  run:  { w: 4.5, dash: [],     color: COLORS.arrowRun,  alpha: 1,    head: 'fill' },
  pass: { w: 3.5, dash: [3, 4], color: COLORS.arrowPass, alpha: 1,    head: 'fill' },
  cut:  { w: 3.5, dash: [8, 5], color: COLORS.arrowRun,  alpha: 0.65, head: 'hollow' },
};

export function drawArrow(ctx, pts, type, scale = 1) {
  if (!pts || pts.length < 2) return;
  const s = STYLE[type] || STYLE.run;
  const last = pts[pts.length - 1], prev = pts[pts.length - 2];
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = type === 'cut' ? 'butt' : 'round';

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  };

  // halo oscuro para contraste sobre pista clara (mantiene el color del §9.2)
  ctx.globalAlpha = s.alpha;
  ctx.lineWidth = (s.w + 2.4) * scale;
  ctx.strokeStyle = 'rgba(11,35,48,.45)';
  ctx.setLineDash(s.dash.map((d) => d * scale));
  trace();

  // trazo de color
  ctx.lineWidth = s.w * scale;
  ctx.strokeStyle = s.color;
  ctx.setLineDash(s.dash.map((d) => d * scale));
  trace();
  ctx.setLineDash([]);
  const hsz = 10 * scale;
  if (s.head === 'fill') arrowhead(ctx, prev, last, hsz, { fill: s.color });
  else arrowhead(ctx, prev, last, hsz, { stroke: s.color, lineWidth: 2.5 * scale });
  ctx.restore();
}

/** Bloqueo / pick (§9.2): rectángulo perpendicular junto al bloqueador. */
export function drawBloqueo(ctx, a, b, scale = 1) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const perp = ang + Math.PI / 2;
  const cx = a.x + Math.cos(ang) * 16 * scale;
  const cy = a.y + Math.sin(ang) * 16 * scale;
  const half = 15 * scale;
  ctx.save();
  ctx.strokeStyle = COLORS.arrowRun;
  ctx.lineWidth = 5 * scale;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(perp) * half, cy + Math.sin(perp) * half);
  ctx.lineTo(cx - Math.cos(perp) * half, cy - Math.sin(perp) * half);
  ctx.stroke();
  ctx.restore();
}
