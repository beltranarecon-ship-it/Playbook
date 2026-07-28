/* ============================================================
   thumbnail.js — miniatura de la biblioteca (§19). Genera en el
   cliente, durante el guardado: un PNG del primer frame (póster en
   reposo) y un GIF en bucle corto (hover). Usa gif.js (única librería
   de terceros permitida) cargada desde CDN.
   ============================================================ */

import { PISTAS } from './court.js';
import { AnimationEngine } from './engine.js';

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

/** Lienzo offscreen de tamaño fijo que imita la interfaz que usa el motor. */
class Off {
  constructor(w, h, pistaKey) {
    this.canvas = document.createElement('canvas'); this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d'); this.w = w; this.h = h;
    this.pista = PISTAS[pistaKey] || PISTAS.entera;
  }
  toPx(x, y) { return [x * this.w, y * this.h]; }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); }
  basket(which) { return this.pista.baskets[which] || this.pista.baskets.norte; }
}

/** @returns {{poster:string, gif:(string|null)}} data URLs */
export async function generarThumbnail(animacion, { width = 260, frames = 28, fps = 12 } = {}) {
  const pistaKey = animacion.pista || 'entera';
  const pista = PISTAS[pistaKey] || PISTAS.entera;
  const h = Math.round(width / pista.aspect);
  const bg = await loadImg(pista.src).catch(() => null);

  const off = new Off(width, h, pistaKey);
  const engine = new AnimationEngine(off, animacion, { autoplay: false, loop: false });

  const comp = document.createElement('canvas'); comp.width = width; comp.height = h;
  const cctx = comp.getContext('2d');
  const drawFrame = (u) => {
    engine.seek(u);                      // posiciona el motor y renderiza en off
    cctx.clearRect(0, 0, width, h);
    if (bg) cctx.drawImage(bg, 0, 0, width, h); else { cctx.fillStyle = '#0b2330'; cctx.fillRect(0, 0, width, h); }
    cctx.drawImage(off.canvas, 0, 0);
  };

  // póster (primer frame) — siempre disponible
  drawFrame(0);
  const poster = comp.toDataURL('image/png');

  // GIF — best-effort (si gif.js o el worker fallan, devolvemos solo póster)
  let gif = null;
  try {
    const GIF = await loadGif();
    const enc = new GIF({ workers: 2, quality: 14, width, height: h, workerScript: _workerUrl });
    const n = Math.max(2, frames);
    for (let i = 0; i < n; i++) { drawFrame(i / (n - 1)); enc.addFrame(cctx, { copy: true, delay: Math.round(1000 / fps) }); }
    gif = await new Promise((res, rej) => {
      enc.on('finished', (blob) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
      enc.on('abort', () => rej(new Error('gif abortado')));
      enc.render();
    });
  } catch { gif = null; }

  engine.destroy();
  return { poster, gif };
}
