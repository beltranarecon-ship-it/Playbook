/* ============================================================
   controls.js — barra de reproducción (§11). Botones, pills de
   velocidad, barra de progreso scrubable e indicador de fase.
   Se sincroniza con el motor vía eventos 'frame' y 'phase'.
   ============================================================ */

import { h } from '../ui/dom.js';
import { Narrador, VELOCIDADES_VOZ, hayVoz, tieneFrases } from '../pizarra/voz.js';

const ICON = {
  restart: 'M7 5h2.2v14H7zM20 5v14l-10.5-7z',
  prev: 'M11 5v14l-9-7zM13 5v14l-9-7z',
  next: 'M2 5l9 7-9 7zM13 5l9 7-9 7z',
  play: 'M8 5v14l11-7z',
  pause: 'M7 5h3.2v14H7zM13.8 5H17v14h-3.2z',
  loop: 'M17 2l3.5 3.5L17 9M20 5.5H8A4 4 0 0 0 4 9.5v1M7 22l-3.5-3.5L7 15M4 18.5h12a4 4 0 0 0 4-4v-1',
  voz: 'M3 9v6h4l5 4V5L7 9H3z|M16 8.5a4 4 0 0 1 0 7|M18.5 6a7.5 7.5 0 0 1 0 12',
};

function svg(d, { fill = 'currentColor', stroke = 'none', w = 2 } = {}) {
  const paths = d.split('|').map((p) => h('path', { d: p, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill, stroke, 'stroke-width': w, 'aria-hidden': 'true' }, ...paths);
}

/**
 * @param engine  el motor que se controla
 * @param voz     con la narración (§9.3): el proyector y la ficha del
 *                ejercicio. La columna del asistente, no: se reproduce
 *                sola mientras se escribe la ficha, y hablaría sin parar.
 */
export function controls(engine, { voz = false } = {}) {
  /* Arrastrar la barra con la animación en marcha era pelearse con el
     reloj: se soltaba el dedo en el fotograma que se quería enseñar y
     ese fotograma ya se había ido. Ahora arrastrar SOSTIENE la
     animación —lo que se pidió como «pausar y arrastrar»— y al soltar
     vuelve a como estaba: si iba, sigue; si estaba en pausa, se queda.
     (Tramo 2.15.) */
  let scrubbing = false;
  let reanudar = false;

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

  /* LA VOZ (§9.3): lee la frase automática al empezar cada fase. Solo
     si el navegador tiene voz y la animación tiene frases —las de antes
     de la Pizarra no—. El interruptor y su velocidad se recuerdan. */
  const narrador = voz && hayVoz() && tieneFrases(engine.anim) ? new Narrador(engine) : null;
  const velVoz = narrador ? h('select', {
    class: 'ac-voz-vel', 'aria-label': 'Velocidad de la voz', title: 'Velocidad de la voz',
    /* Suelta el foco al elegir: con él dentro, las flechas y las letras
       de los atajos del proyector cambiaban también la velocidad. */
    onChange: (e) => { narrador.setVelocidad(Number(e.target.value)); e.target.blur(); },
  }, ...VELOCIDADES_VOZ.map((v) => h('option', { value: String(v), selected: v === narrador.velocidad }, `voz ×${String(v).replace('.', ',')}`))) : null;
  if (velVoz) velVoz.hidden = !narrador.activa;
  const vozBtn = narrador ? btn('ac-voz' + (narrador.activa ? ' is-active' : ''), 'Narración: lee lo que pasa al empezar cada fase',
    svg(ICON.voz, { fill: 'none', stroke: 'currentColor' }), () => {
      narrador.activar(!narrador.activa);
      vozBtn.classList.toggle('is-active', narrador.activa);
      vozBtn.setAttribute('aria-pressed', String(narrador.activa));
      velVoz.hidden = !narrador.activa;
    }) : null;
  if (vozBtn) vozBtn.setAttribute('aria-pressed', String(narrador.activa));
  /* Lo guardado puede cambiar desde otros mandos (la ficha y el
     proyector a la vez): al cambiar de fase, el botón se pone al día. */
  const pintarVoz = () => {
    if (!narrador) return;
    const on = narrador.activa;
    vozBtn.classList.toggle('is-active', on);
    vozBtn.setAttribute('aria-pressed', String(on));
    velVoz.hidden = !on;
    velVoz.value = String(narrador.velocidad);
  };

  const phase = h('span', { class: 'ac-phase mono' }, 'Fase 1 / 1');
  const progress = h('input', {
    class: 'ac-progress', type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': 'Progreso de la animación',
    onInput: (e) => {
      if (!scrubbing) { scrubbing = true; reanudar = engine.playing; if (reanudar) engine.pause(); }
      engine.seek(+e.target.value / 1000);
    },
    onChange: () => { scrubbing = false; if (reanudar) { reanudar = false; engine.play(); } },
  });

  const setPlayIcon = (playing) => { playBtn.replaceChildren(svg(playing ? ICON.pause : ICON.play)); playBtn.title = playing ? 'Pausar' : 'Reproducir'; };

  const el = h('div', { class: 'anim-controls' },
    h('div', { class: 'anim-controls__row' },
      btn('', 'Reiniciar', svg(ICON.restart), () => engine.restart()),
      btn('', 'Fase anterior', svg(ICON.prev), () => engine.prevPhase()),
      playBtn,
      btn('', 'Fase siguiente', svg(ICON.next), () => engine.nextPhase()),
      // Salto de RONDA (Tramo 2.8). Solo aparece si el ejercicio de
      // verdad tiene varias: en los demás sería un botón que no hace
      // nada, y eso es peor que no tenerlo.
      ...(engine.rondas > 1 ? [btn('btn--sm', 'Ronda siguiente', '»', () => engine.siguienteRonda())] : []),
      loopBtn,
      h('div', { class: 'ac-speed' }, ...pills),
      ...(vozBtn ? [h('div', { class: 'ac-voz-grupo' }, vozBtn, velVoz)] : []),
      phase,
    ),
    progress,
  );

  // Con rondas manda el contador de RONDA: en un ejercicio de seis en
  // fila, «fase 14 de 24» no le dice nada a nadie, y «ronda 4 de 6» sí.
  const etiqueta = (k, n, ronda, rondas) => (rondas > 1
    ? `Ronda ${ronda} / ${rondas}`
    : `Fase ${Math.min(k + 1, n) || 0} / ${n}`);

  const alFotograma = (f) => {
    if (!scrubbing) progress.value = Math.round(f.progress * 1000);
    if (engine.rondas <= 1) phase.textContent = `Fase ${f.phase}`;
    setPlayIcon(f.playing);
    setPill(engine.speed);
  };
  const alCambiarDeFase = (p) => { phase.textContent = etiqueta(p.k, p.n, p.ronda, p.rondas); pintarVoz(); };
  engine.on('frame', alFotograma);
  engine.on('phase', alCambiarDeFase);

  setPlayIcon(engine.playing);
  /* `destroy` suelta los dos oyentes. Quien sustituye unos mandos por
     otros sobre el MISMO motor tiene que llamarlo: si no, los de antes
     siguen actualizándose en cada fotograma aunque ya no se vean. */
  return {
    el,
    destroy() { engine.off('frame', alFotograma); engine.off('phase', alCambiarDeFase); narrador?.destroy(); },
  };
}
