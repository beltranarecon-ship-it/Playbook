/* ============================================================
   proyector.js — modo proyector a pantalla completa (§14, §14.1).
   Fullscreen API, fondo negro, canvas grande + datos esenciales,
   controles que se ocultan tras 3s y atajos de teclado.

   ── EL VÍDEO DE LA ACCIÓN (Tramo 2.14) ───────────────
   La animación dibuja POR DÓNDE va cada uno; el gesto no lo dibuja
   nadie. Si la acción de una fase tiene vídeo de referencia, al
   empezar esa fase la animación se para, salen los segundos del gesto
   y sigue sola (§12.36). Se para al EMPEZAR la fase y no al acabarla
   porque así se ve primero cómo se hace y luego por dónde va.

   Cada vídeo interrumpe UNA vez por sesión de proyector. Un ejercicio
   de seis en fila son seis rondas de las mismas acciones, y la
   proyección va en bucle: sin esa regla, el mismo clip saltaría cada
   veinte segundos hasta que alguien apagara el proyector. Para verlo
   otra vez están los chips de la cabecera, y con V se apagan todos.

   ── Y TOCAR LA PISTA PARA PAUSAR (Tramo 2.15) ───────────
   Con el móvil en una mano y un balón en la otra no se acierta un
   botón de veinte píxeles que además se ha desvanecido. Un toque en
   la pista para, otro sigue, y un rótulo grande dice cuál de las dos
   cosas está pasando.
   ============================================================ */

import { h } from '../ui/dom.js';
import { CourtView } from './court.js';
import { AnimationEngine } from './engine.js';
import { controls } from './controls.js';
import { textoDosis, nivelesDe } from '../ficha.js';
import { abrirVideo } from '../ui/video.js';
import { seIncrusta, textoTramo } from '../ia/video.js';

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

  /* ---- vídeos de referencia (Tramo 2.14) -------------------------
     `meta.catalogo` es el catálogo de acciones YA con sus vídeos
     puestos (ia/acciones.js#conVideos). El proyector no consulta nada:
     quien lo abre le pasa lo que hay, y sin catálogo —o sin vídeos— se
     comporta exactamente como siempre (§11). */
  const porSlug = new Map((Array.isArray(meta.catalogo) ? meta.catalogo : [])
    .filter((a) => a && a.slug && a.video).map((a) => [a.slug, a]));
  const vistos = new Set();
  let capaVideo = null;
  let videosOn = true;
  let cerrando = false;

  const chipsVideo = [...porSlug.values()].filter((a) => seIncrusta(a.video) || a.video?.tipo === 'tiktok');
  const barraVideos = chipsVideo.length ? h('div', { class: 'proy-videos' },
    ...chipsVideo.map((a) => h('button', {
      class: 'proy-video-chip', type: 'button',
      title: [a.nombre, textoTramo(a.video)].filter(Boolean).join(' · '),
      onClick: () => { vistos.add(a.slug); mostrarVideo(a); },
    }, '▶ ', a.nombre)),
  ) : null;

  /* El rótulo de pausa. Desde el fondo de la pista no se ve si el
     icono de una barra de 30 px es un triángulo o dos rayas, y la
     animación tiene momentos en los que nadie se mueve: sin esto, «se
     ha parado» y «aquí no pasa nada» se leen igual. */
  const rotuloPausa = h('div', { class: 'proy-pausa' }, 'En pausa');

  const root = h('div', { class: 'proyector proyector--full' },
    h('div', { class: 'proyector__cab' },
      h('div', { class: 'proyector__title' }, meta.nombre || 'Ejercicio'),
      ficha ? ficha.el : null,
      barraVideos,
    ),
    btnCerrar,
    h('div', { class: 'proyector__stage' }, view.root, rotuloPausa, h('div', { class: 'proyector__controls' }, ctrl.el)),
    h('p', { class: 'proyector__hint mono' },
      'Toca la pista o Espacio: pausa · ← → fases · R reinicio · L bucle · 1/2/3 velocidad'
      + (ficha?.hayNiveles ? ' · N nivel' : '')
      + (chipsVideo.length ? ' · V vídeos' : '') + ' · Esc salir'),
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

  /* ---- tocar la pista para pausar (Tramo 2.15) -------------------
     Sobre el canvas, no sobre `root`: la barra de controles y el botón
     de salir están fuera de él, así que darle al play no cuenta dos
     veces y cerrar no pausa antes de cerrar. */
  view.canvas.addEventListener('click', () => { if (!capaVideo) engine.toggle(); });

  const pintarPausa = () => root.classList.toggle('is-pausado', !engine.playing && !capaVideo);
  engine.on('play', pintarPausa);
  engine.on('pause', pintarPausa);
  pintarPausa();

  /* ---- el vídeo de la acción de esta fase (Tramo 2.14) ----------- */
  function mostrarVideo(a) {
    if (capaVideo) return;
    const iba = engine.playing;
    engine.pause();
    showControls();
    capaVideo = abrirVideo(a.video, {
      titulo: a.nombre,
      // DENTRO del proyector: lo que cuelga del body queda por debajo
      // del elemento en pantalla completa y no se vería.
      host: root,
      alCerrar: () => {
        capaVideo = null;
        if (cerrando) return;   // se está saliendo del proyector
        // «continúa sola»: solo si venía andando. Si el entrenador la
        // había parado él, se queda donde la dejó.
        if (iba) engine.play();
        pintarPausa();
        showControls();
      },
    });
    // después de asignar `capaVideo`: mientras el vídeo está delante no
    // se anuncia la pausa, porque no es una pausa, es un vídeo
    pintarPausa();
  }

  function mirarFase(acciones) {
    if (!videosOn || capaVideo) return;
    for (const slug of acciones || []) {
      const a = porSlug.get(slug);
      // Un TikTok no para la proyección: es un enlace (§12.36).
      if (!a || !seIncrusta(a.video) || vistos.has(slug)) continue;
      vistos.add(slug);
      mostrarVideo(a);
      return;   // uno por fase: dos seguidos no se ven, se atropellan
    }
  }
  engine.on('phase', (info) => mirarFase(info.acciones));
  /* Y la fase que YA está sonando. El motor anuncia la fase 1 al
     cargar la animación, y eso pasa dentro del `new AnimationEngine`
     de arriba —antes de que exista este oyente—. Sin esta línea, un
     ejercicio cuya primera acción tiene vídeo no lo enseñaría nunca:
     justo el caso más normal. */
  mirarFase(engine.accionesDeFase(engine.k));

  // atajos §14.1
  const onKey = (e) => {
    switch (e.key) {
      case ' ': e.preventDefault(); engine.toggle(); break;
      case 'v': case 'V':
        videosOn = !videosOn;
        root.classList.toggle('sin-videos', !videosOn);
        break;
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
    cerrando = true;
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('fullscreenchange', onFs);
    clearTimeout(hideTimer);
    // el vídeo cuelga de `root`, pero su temporizador y su escucha de
    // teclado no: se cierra a mano o seguirían vivos tras salir
    capaVideo?.cerrar('manual');
    capaVideo = null;
    engine.destroy();
    view.destroy();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    root.remove();
  }

  return { cerrar };
}
