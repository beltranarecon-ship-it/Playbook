/* ============================================================
   proyector.js — modo proyector a pantalla completa (§14, §14.1).
   Fullscreen API, fondo negro, canvas grande + datos esenciales,
   controles que se ocultan tras 3s y atajos de teclado.
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView } from './court.js';
import { AnimationEngine } from './engine.js';
import { controls } from './controls.js';

export function abrirProyector(animacion, meta = {}) {
  // Modo proyector: la pista ocupa toda la pantalla en paisaje (§14). Sin barra
  // lateral de datos; solo el nombre del ejercicio como rótulo que se desvanece
  // junto con los controles.
  const view = new CourtView({ pista: animacion.pista || 'entera', rotate: 90 });
  const engine = new AnimationEngine(view, animacion, { autoplay: true, loop: true });
  const ctrl = controls(engine);

  const root = h('div', { class: 'proyector proyector--full' },
    h('div', { class: 'proyector__title' }, meta.nombre || 'Ejercicio'),
    h('div', { class: 'proyector__stage' }, view.root, h('div', { class: 'proyector__controls' }, ctrl.el)),
    h('p', { class: 'proyector__hint mono' }, 'Espacio play · ← → fases · R reinicio · L bucle · 1/2/3 velocidad · Esc salir'),
  );
  document.body.append(root);
  if (root.requestFullscreen) root.requestFullscreen().catch(() => {});

  // ocultar controles tras 3s de inactividad
  let hideTimer;
  const showControls = () => { root.classList.remove('is-idle'); clearTimeout(hideTimer); hideTimer = setTimeout(() => root.classList.add('is-idle'), 3000); };
  root.addEventListener('mousemove', showControls);
  showControls();

  // atajos §14.1
  const onKey = (e) => {
    switch (e.key) {
      case ' ': e.preventDefault(); engine.toggle(); break;
      case 'ArrowRight': engine.nextPhase(); break;
      case 'ArrowLeft': engine.prevPhase(); break;
      case 'r': case 'R': engine.restart(); break;
      case 'l': case 'L': engine.setLoop(!engine.loop); break;
      case '1': engine.setSpeed(0.5); break;
      case '2': engine.setSpeed(1); break;
      case '3': engine.setSpeed(2); break;
      case 'Escape': cerrar(); break;
      default: return;
    }
    showControls();
  };
  document.addEventListener('keydown', onKey);
  const onFs = () => { if (!document.fullscreenElement) cerrar(); };
  document.addEventListener('fullscreenchange', onFs);

  function cerrar() {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFs);
    clearTimeout(hideTimer);
    engine.destroy();
    view.destroy();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    root.remove();
  }

  return { cerrar };
}
