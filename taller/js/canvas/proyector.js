/* ============================================================
   proyector.js — modo proyector a pantalla completa (§14, §14.1).
   Fullscreen API, fondo negro, canvas grande + datos esenciales,
   controles que se ocultan tras 3s y atajos de teclado.
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView } from './court.js';
import { AnimationEngine } from './engine.js';
import { controls } from './controls.js';
import { textoDosis, nivelesDe } from '../ficha.js';

/* ── Lo que hace falta saber con el balón en la mano ─────────
   El proyector recibía seis datos de la ficha y usaba uno: el nombre.
   Todo lo demás —la dosis, el criterio de éxito, cómo se reparte el
   grupo, los tres niveles de exigencia— se le pasaba y se tiraba, en
   la única pantalla que se mira DENTRO de la pista.

   Aquí va lo justo: cuánto, cuándo está bien hecho, y el escalón de
   exigencia que se está corriendo. Se desvanece con los controles, así
   que no ensucia la proyección; vuelve al mover el ratón o tocar. */
function panelFicha(meta, alCambiarNivel) {
  const r = meta.requisitos || {};
  const dosis = textoDosis(r.dosis);
  const escalones = nivelesDe({ requisitos: r, variantes: meta.variantes });
  if (!dosis && !r.criterio_exito && !escalones) return null;

  const dato = (etq, txt) => (txt ? h('div', { class: 'proy-dato' },
    h('small', null, etq), h('span', null, txt)) : null);

  const cuerpoNivel = h('p', { class: 'proy-nivel-txt' });
  let elegido = 0;

  const chips = (escalones || []).map((n, i) => {
    const b = h('button', { class: 'proy-chip', type: 'button', onClick: () => elegir(i) }, n.nivel);
    return b;
  });

  /* `avisar` distingue pintar de elegir. El primer nivel se pinta al
     construir el panel, y entonces avisar despertaría a unos controles
     que todavía no existen (`showControls` se define más abajo, y una
     const no se puede leer antes de su línea). */
  function elegir(i, avisar = true) {
    if (!escalones || !escalones.length) return;
    elegido = ((i % escalones.length) + escalones.length) % escalones.length;
    chips.forEach((b, k) => b.classList.toggle('is-on', k === elegido));
    cuerpoNivel.textContent = escalones[elegido].texto;
    if (avisar) alCambiarNivel?.();
  }

  const panel = h('div', { class: 'proy-ficha' },
    dato('Dosis', dosis),
    dato('Bien hecho cuando', r.criterio_exito),
    escalones ? h('div', { class: 'proy-nivel' },
      h('div', { class: 'proy-chips' }, ...chips), cuerpoNivel) : null,
  );

  // arranca en el escalón de en medio: es el que se corre por defecto
  if (escalones) elegir(Math.min(1, escalones.length - 1), false);

  return { el: panel, siguienteNivel: () => elegir(elegido + 1), hayNiveles: !!escalones };
}

export function abrirProyector(animacion, meta = {}) {
  // Modo proyector: la pista ocupa toda la pantalla en paisaje (§14). Sin barra
  // lateral de datos; solo el nombre del ejercicio como rótulo que se desvanece
  // junto con los controles.
  const view = new CourtView({ pista: animacion.pista || 'entera', rotate: 90 });
  const engine = new AnimationEngine(view, animacion, { autoplay: true, loop: true });
  const ctrl = controls(engine);

  // Botón de salida SIEMPRE presente. Hasta ahora las únicas salidas eran la
  // tecla Escape y el evento fullscreenchange: en un iPhone no existe
  // Element.requestFullscreen, así que no se entraba en pantalla completa,
  // fullscreenchange no se disparaba nunca y sin teclado no había Escape —
  // el proyector tapaba la app entera sin forma de cerrarlo salvo recargar
  // (perdiendo el plan a medio escribir). Desde el visor del planificador se
  // abre justo desde el móvil, así que la trampa era alcanzable de verdad.
  const btnCerrar = h('button', {
    class: 'proyector__cerrar', type: 'button',
    title: 'Salir del proyector', 'aria-label': 'Salir del proyector',
  }, '×');
  btnCerrar.addEventListener('click', () => cerrar());

  const ficha = panelFicha(meta, () => showControls());

  const root = h('div', { class: 'proyector proyector--full' },
    h('div', { class: 'proyector__cab' },
      h('div', { class: 'proyector__title' }, meta.nombre || 'Ejercicio'),
      ficha ? ficha.el : null,
    ),
    btnCerrar,
    h('div', { class: 'proyector__stage' }, view.root, h('div', { class: 'proyector__controls' }, ctrl.el)),
    h('p', { class: 'proyector__hint mono' },
      'Espacio play · ← → fases · R reinicio · L bucle · 1/2/3 velocidad'
      + (ficha?.hayNiveles ? ' · N nivel' : '') + ' · Esc salir'),
  );
  document.body.append(root);
  if (root.requestFullscreen) root.requestFullscreen().catch(() => {});

  // Ocultar controles tras 3s de inactividad. En táctil no hay mousemove, así
  // que también despierta al tocar: si no, el botón de salir se desvanecía a
  // los 3 segundos y en un móvil ya no había forma de traerlo de vuelta.
  let hideTimer;
  const showControls = () => { root.classList.remove('is-idle'); clearTimeout(hideTimer); hideTimer = setTimeout(() => root.classList.add('is-idle'), 3000); };
  root.addEventListener('mousemove', showControls);
  root.addEventListener('pointerdown', showControls);
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
      case 'n': case 'N': ficha?.siguienteNivel(); break;
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
