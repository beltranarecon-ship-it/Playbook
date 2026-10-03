/* ============================================================
   proyector.js — modo proyector a pantalla completa (§14, §14.1).
   Fullscreen API, fondo negro, canvas grande + datos esenciales,
   controles que se ocultan tras 3s y atajos de teclado.

   ── EL VÍDEO DE LA VARIANTE, EN UNA COLUMNA (ESPEC-PIZARRA-v3 §10.2) ──
   La animación dibuja POR DÓNDE va cada uno; el gesto no lo dibuja
   nadie. Mientras la pista se anima, a la derecha se repite el clip de
   la variante de la fase en curso (pizarra/variantes.js#videoDeFase):
   mudo, en bucle, los primeros segundos. Al cambiar de fase cambia el
   clip; sin clip, la columna se pliega y la pista ocupa todo.

   La interrupción a pantalla completa de antes (Tramo 2.14) se conserva
   para explicar el gesto despacio: al tocar la columna, o un botón de la
   cabecera, la animación se para y sale el vídeo en grande; al cerrarlo,
   sigue (lo decidió el entrenador, 2026-09-30). Con V se apagan.

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
import { seIncrusta, textoTramo, urlEnBucle, clipDeColumna } from '../ia/video.js';
import { videoDeFase, videosDeAnimacion } from '../pizarra/variantes.js';

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
  /* En un cruce de ramas (§6.7) se para y pregunta: es donde se explica. */
  const engine = new AnimationEngine(view, animacion, { autoplay: true, loop: true, elegirRamas: true });
  /* Con la narración (§9.3): el proyector es donde más se usa. */
  const ctrl = controls(engine, { voz: true });
  /* Repintar al tomar tamaño. Reproduciendo da igual —cada fotograma
     vuelve a pintar—, pero una colocación sola no se reproduce: sin
     esto se quedaba la pista vacía, pintada cuando aún medía 0×0. */
  view.onResize = () => engine.render();
  /* Una colocación sola (un ejercicio de antes de la Pizarra, o uno sin
     nada dibujado, §11.4) no tiene nada que reproducir: ni barra de
     mandos ni «En pausa», que dirían que algo se ha parado. */
  const sinFases = !(animacion.fases || []).length;

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

  /* ---- vídeos de referencia (Tramo 2.14, §10) ---------------------
     `meta.videos` son los vídeos puestos, por slug (los de las acciones
     y los de las variantes, `accion__variante`), y `meta.catalogo` el
     catálogo de acciones con los suyos (ia/acciones.js#conVideos). El
     proyector no consulta nada: quien lo abre le pasa lo que hay, y sin
     vídeos se comporta exactamente como siempre (§11). */
  const tablaVideos = meta.videos && typeof meta.videos === 'object' ? meta.videos : {};
  const catalogo = Array.isArray(meta.catalogo) ? meta.catalogo : [];
  let capaVideo = null;
  let videosOn = true;
  let cerrando = false;

  /* Los botones de la cabecera: los vídeos de ESTE ejercicio. */
  const chipsVideo = videosDeAnimacion(animacion, { videos: tablaVideos, catalogo })
    .filter((c) => seIncrusta(c.video) || c.video.tipo === 'tiktok');
  const barraVideos = chipsVideo.length ? h('div', { class: 'proy-videos' },
    ...chipsVideo.map((c) => h('button', {
      class: 'proy-video-chip', type: 'button',
      title: [c.titulo, textoTramo(c.video)].filter(Boolean).join(' · '),
      onClick: () => mostrarVideo({ nombre: c.titulo, video: c.video }),
    }, '▶ ', c.titulo)),
  ) : null;

  /* LA COLUMNA (§10.2): el clip de la variante de la fase en curso. */
  const columna = h('div', { class: 'proy-columna' });
  let enColumna = null;   // { clave, video, titulo }
  let bucle = null;
  /* YouTube, en bucle, vuelve al segundo 0 y no al principio del trozo:
     cada vez que se acaba el trozo se le pide que vuelva, con un mensaje
     (sin cargar su librería, como en el resto del Taller). */
  const volverAlPrincipio = (marco, desde) => {
    const enviar = (func, args) => {
      try { marco.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com'); } catch { /* sin ventana todavía */ }
    };
    enviar('seekTo', [desde, true]);
    enviar('playVideo', []);
  };
  /* UN REPRODUCTOR POR CLIP, QUE SE GUARDA. Las fases duran dos o tres
     segundos y la proyección va en bucle: creando uno nuevo en cada cambio
     de fase, la columna enseñaría sobre todo a YouTube cargando. Los ya
     cargados se esconden y, al volver su fase, se enseñan desde el
     principio del trozo. Como mucho, unos pocos a la vez. */
  const MARCOS_MAX = 6;
  const marcos = new Map();   // clave -> { marco, clip }
  const titulo = h('span', { class: 'proy-columna__t' });
  const hueco = h('div', { class: 'proy-columna__videos' });
  const tocar = h('button', {
    class: 'proy-columna__tocar', type: 'button',
    onClick: (e) => { e.stopPropagation(); if (enColumna) mostrarVideo({ nombre: enColumna.titulo, video: enColumna.video }); },
  });
  columna.append(titulo, hueco, h('span', { class: 'proy-columna__mas mono' }, 'Toca para verlo en grande'), tocar);
  const mandar = (marco, func, args = []) => {
    try { marco.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com'); } catch { /* sin ventana todavía */ }
  };
  function pintarColumna() {
    const c = videosOn ? videoDeFase({ acciones: engine.accionesDeFase(engine.k), variantes: engine.variantesDeFase(engine.k) }, { videos: tablaVideos, catalogo }) : null;
    if ((c && c.clave) === (enColumna && enColumna.clave)) return;
    clearInterval(bucle);
    bucle = null;
    enColumna = c;
    root.classList.toggle('con-columna', !!c);
    for (const [clave, m] of marcos) {
      const suyo = !!c && clave === c.clave;
      m.marco.hidden = !suyo;
      if (!suyo) mandar(m.marco, 'pauseVideo');
    }
    if (!c) return;
    titulo.textContent = c.titulo;
    tocar.setAttribute('aria-label', `Ver en grande el vídeo de ${c.titulo}`);
    let m = marcos.get(c.clave);
    if (m) {
      volverAlPrincipio(m.marco, m.clip.desde);
    } else {
      const marco = h('iframe', {
        class: 'proy-columna__video', src: urlEnBucle(c.video), title: `Vídeo de ${c.titulo}`, tabindex: '-1',
        allow: 'autoplay; encrypted-media',
        // el iframe es de un tercero: se le deja lo justo para reproducir
        sandbox: 'allow-scripts allow-same-origin allow-presentation',
        referrerpolicy: 'strict-origin-when-cross-origin', frameborder: '0',
      });
      m = { marco, clip: clipDeColumna(c.video) };
      /* El más viejo se va si ya hay muchos. */
      if (marcos.size >= MARCOS_MAX) {
        const [vieja, v] = marcos.entries().next().value;
        v.marco.remove();
        marcos.delete(vieja);
      }
      marcos.set(c.clave, m);
      hueco.append(marco);
    }
    const { marco, clip } = m;
    bucle = setInterval(() => volverAlPrincipio(marco, clip.desde), Math.max(1, clip.hasta - clip.desde) * 1000);
  }

  /* El rótulo de pausa. Desde el fondo de la pista no se ve si el
     icono de una barra de 30 px es un triángulo o dos rayas, y la
     animación tiene momentos en los que nadie se mueve: sin esto, «se
     ha parado» y «aquí no pasa nada» se leen igual. */
  const rotuloPausa = h('div', { class: 'proy-pausa' }, 'En pausa');

  /* EL CARTEL DE RAMA (§6.7, §10.2): al llegar a un cruce la animación se
     para y salen los nombres de las ramas. Se elige tocando uno, o con ←
     → y Intro; con 1, 2, 3, directamente. Espera a que se elija (lo
     decidió el entrenador). */
  const cartel = h('div', { class: 'proy-cartel', role: 'dialog', 'aria-label': '¿Por dónde sigue?' });
  cartel.hidden = true;
  let marcada = 0;
  const pintarCartel = () => {
    const c = engine.cruce;
    cartel.hidden = !c;
    if (!c) return;
    cartel.replaceChildren(
      h('p', { class: 'proy-cartel__t' }, '¿Por dónde sigue?'),
      h('div', { class: 'proy-cartel__opciones' }, ...c.opciones.map((o, i) => h('button', {
        class: 'proy-cartel__op' + (i === marcada ? ' is-marcada' : ''), type: 'button',
        onClick: (e) => { e.stopPropagation(); elegir(i); },
      }, h('span', { class: 'proy-cartel__n mono' }, String(i + 1)), o.nombre))),
    );
  };
  const elegir = (i) => { if (!engine.cruce) return; marcada = 0; engine.elegirRama(i); pintarCartel(); pintarPausa(); };
  engine.on('cruce', () => { marcada = 0; pintarCartel(); showControls(); });

  const root = h('div', { class: 'proyector proyector--full' },
    h('div', { class: 'proyector__cab' },
      h('div', { class: 'proyector__title' }, meta.nombre || 'Ejercicio'),
      ficha ? ficha.el : null,
      barraVideos,
    ),
    btnCerrar,
    h('div', { class: 'proyector__stage' }, view.root, rotuloPausa, cartel, sinFases ? null : h('div', { class: 'proyector__controls' }, ctrl.el)),
    columna,
    h('p', { class: 'proyector__hint mono' },
      (sinFases ? 'Solo la colocación: no hay nada que reproducir'
        : 'Toca la pista o Espacio: pausa · ← → fases · R reinicio · L bucle · 1/2/3 velocidad'
          + ((animacion.ramas || []).length ? ' · en un cruce, ← → e Intro eligen la rama' : ''))
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
  view.canvas.addEventListener('click', () => { if (!capaVideo && !engine.cruce) engine.toggle(); });

  /* Con el cartel delante no se anuncia la pausa: es una pregunta. */
  const pintarPausa = () => root.classList.toggle('is-pausado', !engine.playing && !capaVideo && !sinFases && !engine.cruce);
  engine.on('play', pintarPausa);
  engine.on('pause', pintarPausa);
  /* Volver atrás, reiniciar o mover la barra con el cartel delante lo
     quita: esa pregunta ya no toca. */
  engine.on('phase', () => { pintarCartel(); pintarPausa(); });
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
        /* Y no en un cruce: ahí el play elige rama, y el cruce espera a que
           se elija (§6.7). */
        if (iba && !engine.cruce) engine.play();
        pintarPausa();
        showControls();
      },
    });
    // después de asignar `capaVideo`: mientras el vídeo está delante no
    // se anuncia la pausa, porque no es una pausa, es un vídeo
    pintarPausa();
  }

  /* La columna cambia con la fase. Y la fase que YA está sonando: el
     motor anuncia la fase 1 dentro del `new AnimationEngine` de arriba,
     antes de que exista este oyente. */
  engine.on('phase', pintarColumna);
  pintarColumna();

  // atajos §14.1
  const onKey = (e) => {
    /* Con el vídeo en grande delante, las teclas son suyas (Espacio y Esc
       lo cierran): si no, la animación y la voz correrían por debajo. */
    if (capaVideo) return;
    /* En un cruce, las flechas y los números eligen rama. */
    if (engine.cruce) {
      const n = engine.cruce.opciones.length;
      if (e.key === 'ArrowLeft') { marcada = (marcada + n - 1) % n; pintarCartel(); e.preventDefault(); showControls(); return; }
      if (e.key === 'ArrowRight') { marcada = (marcada + 1) % n; pintarCartel(); e.preventDefault(); showControls(); return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); elegir(marcada); showControls(); return; }
      if (/^[1-9]$/.test(e.key) && Number(e.key) <= n) { elegir(Number(e.key) - 1); showControls(); return; }
    }
    switch (e.key) {
      case ' ': e.preventDefault(); engine.toggle(); break;
      case 'v': case 'V':
        videosOn = !videosOn;
        root.classList.toggle('sin-videos', !videosOn);
        pintarColumna();
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
    clearInterval(bucle);
    /* Los mandos se sueltan: con ellos la voz, que si no seguía leyendo
       con el proyector ya cerrado (§9.3). */
    ctrl.destroy();
    engine.destroy();
    view.destroy();
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    root.remove();
    meta.alCerrar?.();
  }

  return { cerrar };
}
