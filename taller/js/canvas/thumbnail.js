/* ============================================================
   thumbnail.js — miniatura de la biblioteca (§19). Genera en el
   cliente, durante el guardado: un PNG del primer frame (póster en
   reposo) y un GIF en bucle corto (hover). Usa gif.js (única librería
   de terceros permitida) cargada desde CDN.
   ============================================================ */

import { PISTAS } from './court.js';
import { AnimationEngine } from './engine.js';
import { soloPrimeraRonda } from '../ia/rondas.js';

const GIFJS = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js';
const GIFWORKER = 'https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js';

let _gifLib = null; let _workerUrl = null;

async function loadGif() {
  if (_gifLib) return _gifLib;
  await new Promise((res, rej) => { const s = document.createElement('script'); s.src = GIFJS; s.onload = res; s.onerror = () => rej(new Error('gif.js no disponible')); document.head.append(s); });
  // worker same-origin vía blob (un Worker cross-origin se bloquea)
  const blob = await (await fetch(GIFWORKER)).blob();
  _workerUrl = URL.createObjectURL(blob);
  _gifLib = window.GIF;
  return _gifLib;
}

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('pista no cargó')); i.src = src; });
}

/** Lienzo offscreen de tamaño fijo que imita la interfaz que usa el motor.
 *  Con rot=90 gira las coordenadas igual que CourtView en modo proyector —
 *  (x,y) → (1−y, x)— y las fichas se siguen dibujando DERECHAS, así que los
 *  dorsales quedan legibles. */
class Off {
  constructor(w, h, pistaKey, rot = 0) {
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d'); this.w = w; this.h = h;
    this.rot = rot === 90 ? 90 : 0;
    this.pista = PISTAS[pistaKey] || PISTAS.entera;
  }
  toPx(x, y) { return this.rot ? [(1 - y) * this.w, x * this.h] : [x * this.w, y * this.h]; }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
  basket(which) { return this.pista.baskets[which] || this.pista.baskets.norte; }
}

/** Dibuja el fondo de pista girado 90° dentro de una caja apaisada, que es
 *  lo que .court--landscape hace por CSS en el proyector. */
function fondoApaisado(ctx, img, w, h) {
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(img, -h / 2, -w / 2, h, w);   // el retrato original, ya girado
  ctx.restore();
}

/* Formato del póster. WebP en vez de PNG porque el fondo es una pista
   con textura de madera —una foto, a efectos prácticos— y ahí PNG pesa
   varias veces más sin verse mejor. Importa: el póster de CADA ejercicio
   viaja en la consulta que pinta la rejilla de la biblioteca entera.
   Si el navegador no supiera hacer WebP, toDataURL devuelve un PNG y se
   detecta por el prefijo del data URL. */
const POSTER_TIPO = 'image/webp';
const POSTER_CALIDAD = 0.72;

/**
 * @param opts.soloPoster  salta el GIF (una animación sin fases son N
 *        fotogramas idénticos: pesa y no enseña nada).
 * @returns {{poster:string, gif:(string|null), formato:string}} data URLs
 */
export async function generarThumbnail(animacion, {
  width = 260, frames = 28, fps = 12, soloPoster = false,
  gifWidth = null, gifQuality = 14,
} = {}) {
  /* De un ejercicio de seis en fila, la miniatura enseña UNA ronda: las
     seis son la misma y el gif saldría seis veces más largo para
     enseñar seis veces lo mismo (Tramo 2.8). */
  if (animacion.rondas > 1) {
    animacion = { ...animacion, fases: soloPrimeraRonda(animacion.fases) };
  }
  const pistaKey = animacion.pista || 'entera';
  const pista = PISTAS[pistaKey] || PISTAS.entera;
  /* APAISADA, como el proyector y como el visor del planificador. Las
     pistas se dibujan en retrato (210×297) y la tarjeta de la biblioteca
     es apaisada (16:10): una miniatura en retrato entraba recortada por
     arriba y por abajo con object-fit:cover, y lo que se perdía eran
     justo las bandas, donde hay gente en medio ejercicio. */
  const h = Math.round(width * pista.aspect);
  const bg = await loadImg(pista.src).catch(() => null);
  const sinMovimiento = !(animacion.fases || []).length;

  const off = new Off(width, h, pistaKey, 90);
  const engine = new AnimationEngine(off, animacion, { autoplay: false, loop: false });

  const comp = document.createElement('canvas'); comp.width = width; comp.height = h;
  const cctx = comp.getContext('2d');
  const drawFrame = (u) => {
    engine.seek(u);                      // posiciona el motor y renderiza en off
    cctx.clearRect(0, 0, width, h);
    if (bg) fondoApaisado(cctx, bg, width, h); else { cctx.fillStyle = '#0b2330'; cctx.fillRect(0, 0, width, h); }
    cctx.drawImage(off.canvas, 0, 0);
  };

  // póster (primer frame) — siempre disponible
  drawFrame(0);
  const poster = comp.toDataURL(POSTER_TIPO, POSTER_CALIDAD);
  const formato = poster.slice(5, poster.indexOf(';'));

  // GIF — best-effort (si gif.js o el worker fallan, devolvemos solo póster)
  let gif = null;
  if (soloPoster || sinMovimiento) { engine.destroy(); return { poster, gif: null, formato }; }
  try {
    const GIF = await loadGif();
    /* El GIF se codifica MÁS PEQUEÑO que el póster. GIF es de paleta y
       redibuja el fondo de madera entero en cada fotograma: a la misma
       medida que el póster salían 900 kB por ejercicio —casi 60 MB de
       biblioteca, y un mega por cada vez que el ratón pasa por encima—.
       A menor tamaño y con la paleta más basta, la textura importa poco
       (a esa escala es ruido) y lo que se lee, que es por dónde se
       mueven las fichas, se lee igual. */
    const gw = Math.max(80, Math.round(gifWidth || width * 0.62));
    const gh = Math.round(gw * pista.aspect);   // apaisado, igual que el póster
    const mini = document.createElement('canvas'); mini.width = gw; mini.height = gh;
    const mctx = mini.getContext('2d');

    const enc = new GIF({ workers: 2, quality: gifQuality, width: gw, height: gh, workerScript: _workerUrl });
    const n = Math.max(2, frames);
    for (let i = 0; i < n; i++) {
      drawFrame(i / (n - 1));
      mctx.clearRect(0, 0, gw, gh);
      mctx.drawImage(comp, 0, 0, gw, gh);
      enc.addFrame(mctx, { copy: true, delay: Math.round(1000 / fps) });
    }
    gif = await new Promise((res, rej) => {
      enc.on('finished', (blob) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      enc.on('abort', () => rej(new Error('gif abortado')));
      enc.render();
    });
  } catch { gif = null; }

  engine.destroy();
  return { poster, gif, formato };
}
