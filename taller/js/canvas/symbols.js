/* ============================================================
   symbols.js — dibujo de los símbolos del canvas (§17) con la
   Canvas API (fallback siempre disponible; los SVG de assets/simbolos
   se usarían si existieran). Todas las funciones reciben coordenadas
   en píxeles ya convertidas y un radio en píxeles.
   ============================================================ */

import { COLORS, TAU } from './colors.js';
import { radioPx, escalaTrazo, pxPorMetro, MATERIAL } from './medidas.js';

const OSWALD = "'Oswald','Arial Narrow',sans-serif";

/**
 * Radios de los elementos, en píxeles, a partir del ancho del lienzo.
 *
 * Los tamaños se declaran en METROS (medidas.js → TAMANOS) y se convierten
 * aquí. Antes eran fracciones del lienzo ("el 4,2 % del ancho") corregidas
 * por un factor por pista, porque la media estaba dibujada a otro zoom que
 * la entera; con las cuatro pistas a escala eso sobra y, sobre todo, deja de
 * ser verdad a medias: un jugador mide 1,30 m en la ficha, en el gif y en el
 * proyector, y en las cuatro pistas.
 *
 * El suelo en píxeles es lo único que rompe la promesa, y a propósito: en
 * una miniatura de 300 px un jugador a escala sale de 10 px y no se le ve el
 * dorsal. Por debajo de ese tamaño manda la legibilidad.
 */
export function radii(w, pistaKey) {
  const W = w || 600;
  return {
    jugador: Math.max(11, radioPx(pistaKey, 'jugador', W)),
    balon: Math.max(6, radioPx(pistaKey, 'balon', W)),
    cono: Math.max(8, radioPx(pistaKey, 'cono', W)),
    pelota: Math.max(4, radioPx(pistaKey, 'pelota', W)),
    metro: pxPorMetro(pistaKey, W),
    // grosor de flechas y aspas: atado al jugador, que está en metros, y
    // no al ancho del lienzo (ver medidas.js#escalaTrazo)
    scale: escalaTrazo(pistaKey, W),
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

  /* Arco de defensor. Medido sobre el símbolo de referencia del club
     (web/DEFENSOR (1).svg): no es un halo pegado a la ficha, es un arco
     ANCHO y plano, con su centro por debajo del jugador —a 1,145 radios—
     y radio 1,95, que corona la cabeza como una visera. El anterior
     (radio 1,16 centrado en la ficha) se confundía con el anillo de
     selección, que es exactamente igual salvo por que cierra.

     Va en el color del equipo, como en la referencia, y encima de un
     trazo blanco más grueso: sobre el azul de la pista un arco terracota
     solo se pierde, y el borde blanco es lo que pidió la especificación. */
  if (defender) {
    const cy = y + r * 1.145;
    const arco = () => { ctx.beginPath(); ctx.arc(x, cy, r * 1.95, Math.PI * 1.142, Math.PI * 1.858, false); ctx.stroke(); };
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(5, r * 0.62);
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    arco();
    ctx.lineWidth = Math.max(3, r * 0.40);
    ctx.strokeStyle = color;
    arco();
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

/**
 * Una zona: relleno difuminado, borde suave y su nombre en el centro,
 * también difuminado. No compite con las fichas — es el escenario, no
 * los actores —, y por eso todo va a media tinta.
 *
 * `forma` viene ya en píxeles desde el llamador (canvas/zonas.js hace la
 * geometría en metros y aquí solo se pinta):
 *   { puntos: [{x,y}…], cerrado, centro: {x,y}, nombre }
 */
export function drawZona(ctx, forma, o = {}) {
  const { puntos, cerrado, centro, nombre } = forma;
  if (!puntos || puntos.length < 2) return;
  const sel = o.selected;
  ctx.save();

  ctx.beginPath();
  ctx.moveTo(puntos[0].x, puntos[0].y);
  for (let i = 1; i < puntos.length; i++) ctx.lineTo(puntos[i].x, puntos[i].y);
  if (cerrado) ctx.closePath();

  if (cerrado) {
    ctx.fillStyle = sel ? 'rgba(0,111,148,.22)' : 'rgba(255,255,255,.10)';
    ctx.fill();
  }
  ctx.setLineDash(cerrado ? [] : [o.trazo * 2.2, o.trazo * 1.6]);
  ctx.lineWidth = Math.max(1.5, o.trazo);
  ctx.strokeStyle = sel ? 'rgba(120,220,255,.95)' : 'rgba(255,255,255,.42)';
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);

  if (nombre && centro) {
    ctx.fillStyle = sel ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.34)';
    ctx.font = `600 ${Math.round(o.texto)}px ${OSWALD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '0.08em';
    ctx.fillText(String(nombre).toUpperCase(), centro.x, centro.y);
  }
  ctx.restore();
}

/**
 * Pelota de tenis. Se distingue del balón por el color —verde lima, que
 * no se usa para nada más— y por el tamaño: un tercio. Sin líneas de
 * balón; a este tamaño solo serían ruido.
 */
export function drawPelotaTenis(ctx, x, y, r, o = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,25,56,.30)';
  ctx.shadowBlur = r * 0.6;
  ctx.shadowOffsetY = r * 0.22;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = COLORS.tenis;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = Math.max(1, r * 0.2);
  ctx.strokeStyle = 'rgba(255,255,255,.85)';
  ctx.stroke();
  // la costura, un solo arco: es lo que lee como "pelota de tenis"
  ctx.beginPath();
  ctx.arc(x - r * 0.55, y, r * 0.95, -Math.PI * 0.38, Math.PI * 0.38);
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.stroke();
  if (o.selected) ring(ctx, x, y, r);
  ctx.restore();
}

/**
 * Escalera de coordinación, a su tamaño real (4,00 × 0,50 m, un peldaño
 * cada 40 cm — medidas.js#MATERIAL). No es un icono: es material que
 * ocupa sitio en el suelo, y dibujarlo a su medida es lo que deja ver si
 * caben dos escaleras en paralelo o si estorban a la fila de al lado.
 *
 * `metro` son los píxeles que mide un metro en este lienzo; `grados`, la
 * orientación (0 = tumbada hacia la derecha).
 */
export function drawEscalera(ctx, x, y, metro, grados = 0, o = {}) {
  const { largo, ancho, peldano } = MATERIAL.escalera;
  const L = largo * metro, A = ancho * metro;
  const n = Math.round(largo / peldano);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.translate(-L / 2, -A / 2);

  ctx.fillStyle = 'rgba(255,255,255,.10)';
  ctx.fillRect(0, 0, L, A);

  ctx.lineWidth = Math.max(1.5, metro * 0.05);
  ctx.strokeStyle = o.selected ? COLORS.accent : 'rgba(255,255,255,.88)';
  ctx.lineCap = 'butt';
  ctx.strokeRect(0, 0, L, A);
  ctx.beginPath();
  for (let i = 1; i < n; i++) { const px = (L * i) / n; ctx.moveTo(px, 0); ctx.lineTo(px, A); }
  ctx.stroke();
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
