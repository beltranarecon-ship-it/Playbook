/* ============================================================
   controls.js — barra de reproducción (§11). Botones, pills de
   velocidad, barra de progreso scrubable e indicador de fase.
   Se sincroniza con el motor vía eventos 'frame' y 'phase'.
   ============================================================ */

import { h } from '../ui/dom.js';

const ICON = {
  restart: 'M7 5h2.2v14H7zM20 5v14l-10.5-7z',
  prev: 'M11 5v14l-9-7zM13 5v14l-9-7z',
  next: 'M2 5l9 7-9 7zM13 5l9 7-9 7z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z',
  loop: 'M17 2l3.5 3.5L17 9M20 5.5H8A4 4 0 0 0 4 9.5v1M7 22l-3.5-3.5L7 15M4 18.5h12a4 4 0 0 0 4-4v-1',
};

function svg(d, { fill = 'currentColor', stroke = 'none', w = 2 } = {}) {
  const paths = d.split('|').map((p) => h('path', { d: p, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill, stroke, 'stroke-width': w, 'aria-hidden': 'true' }, ...paths);
}

export function controls(engine) {
  let scrubbing = false;

  const btn = (cls, title, node, on) => h('button', { class: 'ac-btn ' + cls, type: 'button', title, 'aria-label': title, onClick: on }, node);

  const playBtn = btn('ac-play', 'Reproducir o pausar', svg(ICON.play), () => engine.toggle());
  const loopBtn = btn('ac-loop' + (engine.loop ? ' is-active' : ''), 'Bucle', svg(ICON.loop, { fill: 'none', stroke: 'currentColor' }), () => {
    engine.setLoop(!engine.loop);
    loopBtn.classList.toggle('is-active', engine.loop);
  });

  const SPEEDS = [0.5, 1, 2];
  const setPill = (s) => pills.forEach((p, i) => p.classList.toggle('is-active', SPEEDS[i] === s));
  const pills = SPEEDS.map((s) => h('button', {
    class: 'ac-pill' + (s === engine.speed ? ' is-active' : ''), type: 'button',
    onClick: () => { engine.setSpeed(s); setPill(s); },
  }, '×' + s));

  const phase = h('span', { class: 'ac-phase mono' }, 'Fase 1 / 1');
  const progress = h('input', {
    class: 'ac-progress', type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': 'Progreso de la animación',
    onInput: (e) => { scrubbing = true; engine.seek(+e.target.value / 1000); },
    onChange: () => { scrubbing = false; },
  });

  const setPlayIcon = (playing) => { playBtn.replaceChildren(svg(playing ? ICON.pause : ICON.play)); playBtn.title = playing ? 'Pausar' : 'Reproducir'; };

  const el = h('div', { class: 'anim-controls' },
    h('div', { class: 'anim-controls__row' },
      btn('', 'Reiniciar', svg(ICON.restart), () => engine.restart()),
      btn('', 'Fase anterior', svg(ICON.prev), () => engine.prevPhase()),
      playBtn,
      btn('', 'Fase siguiente', svg(ICON.next), () => engine.nextPhase()),
      loopBtn,
      h('div', { class: 'ac-speed' }, ...pills),
      phase,
    ),
    progress,
  );

  engine.on('frame', (f) => {
    if (!scrubbing) progress.value = Math.round(f.progress * 1000);
    phase.textContent = `Fase ${f.phase}`;
    setPlayIcon(f.playing);
    setPill(engine.speed);
  });
  engine.on('phase', (p) => { phase.textContent = `Fase ${Math.min(p.k + 1, p.n) || 0} / ${p.n}`; });

  setPlayIcon(engine.playing);
  return { el };
}
