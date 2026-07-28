/* ============================================================
   symbols.js — dibujo de los símbolos del canvas (§17) con la
   Canvas API (fallback siempre disponible; los SVG de assets/simbolos
   se usarían si existieran). Todas las funciones reciben coordenadas
   en píxeles ya convertidas y un radio en píxeles.
   ============================================================ */

import { COLORS, TAU } from './colors.js';
import { PISTAS } from './court.js';

const OSWALD = "'Oswald','Arial Narrow',sans-serif";

/** Radios y escala de trazo en función del ancho del lienzo (px) y de la
 *  pista: las medias pistas están zoomadas ~1.4× respecto a la entera (el
 *  mismo metro real ocupa ~1.4× más lienzo), así que sus fichas se agrandan
 *  (PISTAS[k].escalaJugador) para representar el mismo tamaño real de
 *  jugador — proporcionado a la llave/círculos del SVG — en todas las vistas. */
export function radii(w, pistaKey) {
  const W = w || 600;
  const esc = PISTAS[pistaKey]?.escalaJugador ?? 1;
  return {
    jugador: Math.max(14, W * 0.042) * esc,
    balon: Math.max(8, W * 0.022) * esc,
    cono: Math.max(10, W * 0.030) * esc,
    scale: Math.max(0.6, W / 600),
  };
}

// extra/lw opcionales: por defecto, el anillo fino de selección.
function ring(ctx, x, y, r, color = COLORS.accent, extra = null, lw = null) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + (extra ?? Math.max(3, r * 0.28)), 0, TAU);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? Math.max(2, r * 0.14);
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.restore();
}

/** Jugador (atacante o defensor §17). */
export function drawPlayer(ctx, x, y, r, o = {}) {
  const { color = COLORS.A, label = '', defender = false, selected = false, carrying = false, alpha = 1 } = o;
  ctx.save();
  ctx.globalAlpha = alpha;

  // cuerpo con sombra
  ctx.shadowColor = 'rgba(0,25,56,.35)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.14;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // borde
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.strokeStyle = 'rgba(255,255,255,.92)';
  ctx.stroke();

  // arco de defensor: corona la parte superior, abre hacia los lados
  if (defender) {
    ctx.beginPath();
    ctx.arc(x, y, r * 1.16, Math.PI * 1.18, Math.PI * 1.82, false);
    ctx.lineWidth = Math.max(3, r * 0.2);
    ctx.strokeStyle = '#fff';
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  // etiqueta (dorsal o número)
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${Math.round(r * 1.05)}px ${OSWALD}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(label), x, y + r * 0.06);

  // anillo de posesión (naranja, más grueso, más alejado del cuerpo que el de
  // selección) — cableado a quién lleva el balón EN LA REPRODUCCIÓN, no a la
  // selección manual. Si coinciden selección + posesión, offsets distintos
  // para que ambos anillos se vean sin solaparse mal.
  if (carrying) ring(ctx, x, y, r, COLORS.ball, Math.max(6, r * 0.46), Math.max(3, r * 0.24));
  if (selected) ring(ctx, x, y, r);
  ctx.restore();
}

/** Balón (§17). */
export function drawBall(ctx, x, y, r, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,25,56,.35)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.18;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = COLORS.ball;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // costuras
  ctx.strokeStyle = 'rgba(40,10,0,.55)';
  ctx.lineWidth = Math.max(1, r * 0.13);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x, y + r);
  ctx.moveTo(x - r, y); ctx.lineTo(x + r, y);
  ctx.stroke();

  // brillo
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.32, r * 0.26, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fill();

  if (o.selected) ring(ctx, x, y, r);
  ctx.restore();
}

/** Cono (§17). */
export function drawCone(ctx, x, y, r, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,25,56,.30)';
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetY = r * 0.2;
  const blx = x - r * 0.82, brx = x + r * 0.82, by = y + r * 0.72;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(brx, by);
  ctx.lineTo(blx, by);
  ctx.closePath();
  ctx.fillStyle = COLORS.cono;
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // banda clara
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, y + r * 0.06);
  ctx.lineTo(x + r * 0.42, y + r * 0.06);
  ctx.lineWidth = Math.max(2, r * 0.22);
  ctx.strokeStyle = 'rgba(255,255,255,.72)';
  ctx.lineCap = 'butt';
  ctx.stroke();

  // base
  ctx.beginPath();
  ctx.moveTo(blx - r * 0.12, by);
  ctx.lineTo(brx + r * 0.12, by);
  ctx.lineWidth = Math.max(2, r * 0.16);
  ctx.strokeStyle = COLORS.cono;
  ctx.lineCap = 'round';
  ctx.stroke();

  if (o.selected) ring(ctx, x, y, r);
  ctx.restore();
}

/** Cola de jugadores reales tras un cono con función "fila" (§7.4).
 *  direccionGrados: 0 = hacia la DERECHA, sentido horario (90 = abajo, 180 =
 *  izquierda, 270 = arriba), independiente de la pista. color = color del equipo
 *  de la fila; cada ficha lleva su número de orden en la cola. */
export function drawFila(ctx, x, y, r, direccionGrados, n, jugadorR, color = COLORS.A) {
  const rad = (direccionGrados * Math.PI) / 180; // 0° = derecha
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const step = jugadorR * 1.95;
  ctx.save();
  for (let i = 1; i <= n; i++) {
    const px = x + dx * step * i;
    const py = y + dy * step * i;
    ctx.globalAlpha = Math.max(0.45, 1 - i * 0.08);
    ctx.beginPath();
    ctx.arc(px, py, jugadorR * 0.82, 0, TAU);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, jugadorR * 0.1);
    ctx.strokeStyle = 'rgba(255,255,255,.9)';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${Math.round(jugadorR * 0.82)}px ${OSWALD}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i), px, py + jugadorR * 0.04);
  }
  ctx.restore();
}
