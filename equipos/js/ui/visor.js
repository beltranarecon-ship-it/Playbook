/* ============================================================
   visor.js — visor de ejercicio embebido en el planificador.

   Enseña el ejercicio del bloque seleccionado SIN salir de la
   sesión: la pista animada en apaisado (el mismo motor del Taller,
   la misma vista que el proyector), el guion determinista fase a
   fase y la ficha del ejercicio. Ese "sin salir" es el punto: antes
   el título del bloque abría el Taller en otra pestaña y el plan a
   medio escribir se quedaba atrás.

   Reutiliza el canvas del Taller tal cual (CourtView + Engine +
   controls). No se copia nada: si mañana el motor dibuja mejor los
   bloqueos, el planificador los dibuja mejor también.

   Una sola CourtView y un solo Engine para toda la vida del visor:
   cambiar de bloque llama a setPista()/load(), no reconstruye el
   lienzo (reconstruirlo parpadea y filtra ResizeObservers).
   ============================================================ */

import { h, mount, icon } from './dom.js';
import { CourtView } from '../../../taller/js/canvas/court.js';
import { AnimationEngine } from '../../../taller/js/canvas/engine.js';
import { controls } from '../../../taller/js/canvas/controls.js';
import { abrirProyector } from '../../../taller/js/canvas/proyector.js';
import { urlIncrustado, urlPublica, textoTramo, seIncrusta } from '../../../taller/js/ia/video.js';
import { cargarCatalogoConVideos } from '../../../taller/js/supabase/acciones.js';
import { dificultadDe } from '../../../taller/js/config.js';
import { guionDeAnimacion, resumenMaterial } from '../data/guion.js';
import { getEjercicioCompleto } from '../data/ejercicios.js';
import { INTENSIDAD_LABEL, INTENSIDAD_MAX } from '../data/carga.js';
import {
  PISTA_LABEL, DENSIDAD_AYUDA, OPOSICION_AYUDA, PRESION_AYUDA,
  textoDosis, textoJugadores, textoCanastas, textoDuracion, nivelesDe,
} from '../../../taller/js/ficha.js';

const ICO = {
  proyector: 'M4 5h16v10H4zM8 19h8M12 15v4',
  abrir: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  diana: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
};

const chip = (txt, clase = '') => (txt ? h('span', { class: 'eq-vchip ' + clase }, txt) : null);
const parrafos = (texto) => String(texto).split(/\n{2,}/).map((p) => h('p', {}, p.trim()));

/** Bloque de texto con título; null si no hay texto que enseñar. */
function seccionTexto(titulo, texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  return h('div', { class: 'eq-vsec' },
    h('h4', { class: 'eq-vsec-t' }, titulo),
    ...parrafos(t));
}

/** Medidor de intensidad 1-5 en modo lectura (mismo lenguaje visual
 *  que el selector de los bloques, pero sin ser pulsable). */
function medidorIntensidad(n) {
  const v = Number(n) || 0;
  if (!v) return null;
  return h('span', {
    class: 'eq-vint', title: `Intensidad ${v} · ${INTENSIDAD_LABEL[v] || ''}`,
    'aria-label': `Intensidad ${v} de ${INTENSIDAD_MAX}`,
  }, ...Array.from({ length: INTENSIDAD_MAX }, (_, i) =>
    h('i', { class: 'eq-vint-seg' + (i < v ? ' on' : '') })));
}

/**
 * Crea el visor. Devuelve un nodo suelto: el planificador decide si lo
 * cuelga de la columna pegajosa (escritorio) o de un modal (móvil).
 *
 * @param onNotas (bloque, texto) — el planificador marca "sucio" y guarda
 * @param soloLectura boolean o función: sesiones realizadas/canceladas se
 *        miran, no se tocan. Admite función porque el visor se construye
 *        ANTES de saber en qué estado está la sesión (aún no ha llegado).
 */
export function crearVisor({ onNotas = null, soloLectura = false } = {}) {
  const esSoloLectura = () => (typeof soloLectura === 'function' ? !!soloLectura() : !!soloLectura);
  let bloque = null;         // bloque seleccionado ahora mismo
  let ficha = null;          // fila de exercises del bloque (si tiene ejercicio)
  let turno = 0;             // token: una respuesta vieja nunca pisa a una nueva
  let vivo = true;
  let pestaña = 'guion';     // 'guion' | 'ficha'
  let engine = null;
  let ctrl = null;
  let guion = null;
  let proyector = null;      // handle del proyector abierto, para poder cerrarlo
  /* Catálogo de acciones con sus vídeos de referencia (Tramo 2.14).
     Se pide UNA vez al abrir el visor y se le pasa al proyector; sin
     él —sin red— el proyector se comporta como siempre (§11). */
  let catalogo = [];
  cargarCatalogoConVideos().then(({ acciones }) => { catalogo = acciones || []; }).catch(() => {});

  // ── lienzo (se construye UNA vez) ───────────────────────────
  // rotate 90: apaisado, como el proyector. En una columna lateral de
  // ~420 px un lienzo vertical mediría 590 px de alto y no cabría; en
  // apaisado mide 300 y se ve entera la pista.
  const view = new CourtView({ pista: 'entera', rotate: 90 });
  view.onResize = () => engine?.render();
  const ranuraCtrl = h('div', { class: 'eq-vctrl' });
  const notaPista = h('p', { class: 'eq-vnota' });
  const lienzo = h('div', { class: 'eq-vpista' }, view.root, ranuraCtrl, notaPista);

  // ── nodos que se repintan ───────────────────────────────────
  const elTitulo = h('h3', { class: 'eq-vtitulo' });
  const elChips = h('div', { class: 'eq-vchips' });
  const elAcciones = h('div', { class: 'eq-vacciones' });
  const elTabs = h('div', { class: 'eq-vtabs', role: 'tablist' });
  // El panel que gobiernan las pestañas. Sin role=tabpanel ni aria-labelledby,
  // un lector de pantalla anuncia "pestaña" y no encuentra qué controla.
  const elCuerpo = h('div', {
    class: 'eq-vcuerpo', id: 'eq-vpanel', role: 'tabpanel', tabindex: '0',
  });

  const el = h('aside', { class: 'eq-visor', 'aria-live': 'polite' },
    h('div', { class: 'eq-vhead' },
      h('div', { class: 'eq-vhead-txt' }, elTitulo, elChips),
      elAcciones),
    lienzo, elTabs, elCuerpo);

  // ── pista ───────────────────────────────────────────────────
  function pintaPista(anim) {
    if (!anim) {
      lienzo.classList.add('is-sin-anim');
      ranuraCtrl.replaceChildren();
      notaPista.textContent = 'Este ejercicio no tiene pizarra guardada.';
      engine?.destroy();
      view.clear();
      return;
    }
    lienzo.classList.remove('is-sin-anim');
    view.setPista(anim.pista || 'entera');
    if (!engine) {
      engine = new AnimationEngine(view, anim, { autoplay: true, loop: true });
      ctrl = controls(engine);
      engine.on('phase', ({ k }) => marcaFase(k));
    } else {
      engine.preview = null;
      engine.load(anim);
    }
    // Sin fases no hay nada que reproducir: se ve la colocación inicial
    // y la barra de transporte sobra (botones que no harían nada).
    const conFases = !!(anim.fases || []).length;
    ranuraCtrl.replaceChildren(conFases ? ctrl.el : '');
    notaPista.textContent = conFases ? '' : 'Sin animación por fases: se ve la colocación inicial.';
  }

  /** Resalta en el guion la fase que el motor está reproduciendo. */
  function marcaFase(k) {
    for (const li of elCuerpo.querySelectorAll('.eq-vfase')) {
      li.classList.toggle('is-activa', Number(li.dataset.fase) === k);
    }
  }

  /** Salta a una fase desde el guion y deja el fotograma quieto para leerlo. */
  function irAFase(k) {
    if (!engine || !engine.totalDuration) return;
    engine.seek((engine.cumDur[k] || 0) / engine.totalDuration);
    engine.pause();
  }

  // ── pestañas ────────────────────────────────────────────────
  function pintaTabs() {
    if (!bloque) { elTabs.replaceChildren(); return; }
    const tab = (id, txt) => h('button', {
      class: 'eq-vtab' + (pestaña === id ? ' is-activa' : ''), type: 'button',
      role: 'tab', id: `eq-vtab-${id}`, 'aria-selected': String(pestaña === id),
      'aria-controls': 'eq-vpanel',
      // fuera del flujo de tabulación la que no está activa: el patrón de
      // pestañas se recorre con flechas, no con Tab
      tabindex: pestaña === id ? '0' : '-1',
      onKeydown: (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const otras = [...elTabs.querySelectorAll('.eq-vtab')];
        const i = otras.indexOf(e.currentTarget);
        otras[(i + (e.key === 'ArrowRight' ? 1 : otras.length - 1)) % otras.length]?.click();
      },
      onClick: () => { pestaña = id; pintaTabs(); pintaCuerpo(); elTabs.querySelector('.is-activa')?.focus(); },
    }, txt);
    elTabs.replaceChildren(
      tab('guion', 'Cómo se juega'),
      bloque.exercise_id ? tab('ficha', 'Ficha') : '',
    );
  }

  // ── cuerpo ──────────────────────────────────────────────────
  function pintaCuerpo() {
    if (!bloque) return;
    mount(elCuerpo, pestaña === 'ficha' ? vistaFicha() : vistaGuion(), campoNotas());
    // El motor emite 'phase' al cargar, ANTES de que exista esta lista, así
    // que el primer resaltado se perdía y no se encendía nada hasta que la
    // animación pasaba de fase. Se pinta a mano al terminar.
    if (engine) marcaFase(engine.k);
  }

  function vistaGuion() {
    if (!bloque.exercise_id) {
      /* Un bloque libre CON vídeo (Tramo 3.3) enseña el vídeo. Es el
         único bloque del plan que se mira en vez de correrse, así que
         aquí no hay pizarra que dibujar: hay algo que ver. */
      if (bloque.video) return vistaVideo();
      return h('p', { class: 'eq-ayuda' },
        'Bloque libre: no sale de la biblioteca, así que no hay pizarra. Descríbelo en las notas de abajo para acordarte en el pabellón.');
    }
    if (!ficha) return null;

    // La idea del ejercicio, tal y como la escribió quien lo creó. Va
    // primero: el guion explica el CÓMO, esto explica el PARA QUÉ.
    const idea = ficha.descripcion_texto || ficha.objetivos || ficha.description;

    if (!guion || guion.vacio) {
      return h('div', { class: 'eq-vguion' },
        seccionTexto('La idea', idea),
        h('p', { class: 'eq-ayuda' }, 'Sin fases animadas: no hay guion que contar.'));
    }

    return h('div', { class: 'eq-vguion' },
      seccionTexto('La idea', idea),
      h('h4', { class: 'eq-vsec-t' }, 'Paso a paso'),
      h('ol', { class: 'eq-vfases' },
        ...guion.fases.map((f) => h('li', {
          class: 'eq-vfase', dataset: { fase: String(f.n - 1) },
          onClick: () => irAFase(f.n - 1),
          title: 'Ir a esta fase',
        },
          h('span', { class: 'eq-vfase-n' }, String(f.n)),
          h('span', { class: 'eq-vfase-txt' },
            f.lineas.length
              ? f.lineas.join('. ') + '.'
              : h('em', {}, 'Pausa (nadie se mueve).')),
        ))),
      h('p', { class: 'eq-vpie' },
        'Guion generado a partir de la pizarra. Toca una fase para saltar a ella.'),
    );
  }

  /**
   * El vídeo de un bloque libre.
   *
   * YouTube se incrusta con su tramo; TikTok es un enlace que se abre
   * aparte, por lo mismo que en el proyector (§12.36): su incrustado no
   * admite segundo de entrada ni mando desde fuera.
   */
  function vistaVideo() {
    const v = bloque.video;
    const tramo = textoTramo(v);
    return h('div', { class: 'eq-vvideo' },
      seIncrusta(v)
        ? h('iframe', {
            // sin autoplay: aquí se salta de un bloque a otro, y que
            // cada clic arranque un vídeo es insoportable
            class: 'eq-vvideo-frame', src: urlIncrustado(v, { autoplay: false }),
            title: `Vídeo de ${bloque.titulo || 'el bloque'}`,
            allow: 'encrypted-media; picture-in-picture',
            sandbox: 'allow-scripts allow-same-origin allow-presentation',
            referrerpolicy: 'strict-origin-when-cross-origin',
            allowfullscreen: 'true', frameborder: '0',
          })
        : h('div', { class: 'eq-vvideo-enlace' },
            h('p', {}, 'TikTok no se puede incrustar con tramo, así que se abre aparte.'),
            h('a', {
              class: 'btn btn-primary', href: urlPublica(v) || '#',
              target: '_blank', rel: 'noopener noreferrer',
            }, 'Abrir el vídeo')),
      h('p', { class: 'eq-vpie' },
        [tramo, 'Ocupa minutos de pista y no cuenta como minutos activos: nadie entrena mirando.']
          .filter(Boolean).join(' · ')),
    );
  }

  /* La pestaña Ficha responde a "¿puedo montar esto hoy y cómo sé que
     va bien?". El desarrollo y el paso a paso ya viven en la otra
     pestaña, así que aquí no se repiten: van los números (gente, aros,
     material, dosis), el criterio de éxito y los escalones de
     exigencia — que es lo que se consulta con el grupo ya en la pista.

     Antes esta vista buscaba requisitos.jugadores/.balones/.conos, tres
     campos que ninguna ficha de la biblioteca tiene, y dejaba fuera los
     trece que sí existen. */
  function vistaFicha() {
    if (!ficha) return null;
    const req = ficha.requisitos || {};
    const material = resumenMaterial(guion?.resumen);
    const dosis = textoDosis(req.dosis);
    const escalones = nivelesDe(ficha);
    const fila = (lbl, val) => (val == null || val === '' || (Array.isArray(val) && !val.length)
      ? null
      : h('div', { class: 'eq-vfila' },
          h('span', { class: 'eq-vfila-l' }, lbl),
          h('span', { class: 'eq-vfila-v' }, Array.isArray(val) ? val.join(' · ') : String(val))));

    return h('div', { class: 'eq-vficha' },
      h('div', { class: 'eq-vfilas' },
        fila('Jugadores', textoJugadores(req)),
        fila('Estaciones', req.estaciones > 1 ? `${req.estaciones} a la vez` : null),
        fila('Canastas', textoCanastas(req)),
        // Material: manda lo que hay DIBUJADO en la pizarra (es lo que se
        // va a ver); los requisitos escritos a mano son el respaldo.
        fila('Material', material || (req.material || []).join(' · ')),
        fila('Pista', PISTA_LABEL[ficha.tipo_pista] || null),
        fila('Duración de referencia', textoDuracion(ficha)),
        fila('Tipo', ficha.type),
        fila('Contenido', ficha.category),
        fila('Categoría', [ficha.categoria_rama, ...(ficha.categoria_nivel || [])].filter(Boolean)),
        fila('Autor', ficha.autor_nombre),
      ),
      dosis
        ? h('div', { class: 'eq-vdosis' }, h('span', { class: 'eq-vdosis-l' }, 'Dosis'), h('strong', null, dosis))
        : null,
      // Cómo se reparte el grupo: lo primero que se mira al plantear el
      // bloque, así que va antes que los textos largos.
      seccionTexto('Con el grupo entero', req.organizacion),
      h('div', { class: 'eq-vejes' }, ...[
        req.densidad ? h('span', { class: `eq-veje dens--${req.densidad}`, title: DENSIDAD_AYUDA[req.densidad] || '' }, `densidad ${req.densidad}`) : null,
        req.oposicion ? h('span', { class: `eq-veje opo--${req.oposicion}`, title: OPOSICION_AYUDA[req.oposicion] || '' }, `oposición ${req.oposicion}`) : null,
        req.presion ? h('span', { class: `eq-veje pres--${req.presion}`, title: PRESION_AYUDA[req.presion] || '' }, `presión ${req.presion}`) : null,
      ].filter(Boolean)),
      seccionTexto('Está bien hecho cuando', req.criterio_exito),
      seccionTexto('Antes hace falta saber', req.requisito_previo),
      seccionTexto('Se aplica en', req.aplicacion),
      seccionTexto('Objetivos', ficha.objetivos),
      escalones
        ? h('div', { class: 'eq-vsec' },
            h('h4', { class: 'eq-vsec-t' }, 'Niveles de exigencia'),
            h('div', { class: 'eq-vniveles' }, ...escalones.map((e) => h('div', { class: 'eq-vnivel' },
              h('span', { class: 'eq-vnivel-l' }, e.nivel), h('p', null, e.texto)))))
        : seccionTexto('Variantes', ficha.variantes),
      seccionTexto('Puntos clave y errores frecuentes', ficha.notas),
      (ficha.tags || []).length
        ? h('div', { class: 'eq-vtags' }, ...ficha.tags.map((t) => h('span', { class: 'eq-vtag' }, t)))
        : null,
    );
  }

  /** Notas del bloque: son de ESTA sesión, no del ejercicio de la
   *  biblioteca. Por eso viven aquí y no en la ficha. */
  function campoNotas() {
    const b = bloque;
    if (!b) return null;
    if (esSoloLectura()) {
      return b.notas
        ? h('div', { class: 'eq-vnotas' },
            h('h4', { class: 'eq-vsec-t' }, 'Notas de esta sesión'),
            ...parrafos(b.notas))
        : null;
    }
    return h('div', { class: 'eq-vnotas' },
      h('label', { class: 'eq-vsec-t', for: 'eq-vnotas-txt' }, 'Notas para esta sesión'),
      h('textarea', {
        id: 'eq-vnotas-txt', class: 'field-input eq-vnotas-txt', rows: 3,
        placeholder: 'Variante de hoy, a quién vigilar, material extra…',
        value: b.notas || '',
        // se escribe en el bloque en vivo; el guardado va con el plan
        onInput: (e) => { b.notas = e.target.value; onNotas?.(b, e.target.value); },
      }),
    );
  }

  // ── cabecera ────────────────────────────────────────────────
  function pintaCabecera() {
    if (!bloque) return;
    elTitulo.textContent = bloque.exercise_id
      ? (ficha?.name || bloque.titulo || 'Ejercicio')
      : (bloque.titulo || 'Bloque libre');

    const dif = ficha?.difficulty ? dificultadDe(ficha.difficulty) : null;
    elChips.replaceChildren(...[
      chip(bloque.exercise_id ? (ficha?.type || null) : (bloque.video ? 'Vídeo' : 'Bloque libre'), 'eq-vchip-tipo'),
      dif ? chip(ficha.dificultad_label || dif.label, `eq-vchip-dif ${dif.clase}`) : null,
      chip(`${bloque.duracion_min} min`),
      medidorIntensidad(bloque.intensidad),
    ].filter(Boolean));

    elAcciones.replaceChildren(...[
      ficha?.animacion ? h('button', {
        class: 'eq-vbtn', type: 'button', title: 'Ver a pantalla completa (proyector)',
        'aria-label': 'Abrir en el proyector',
        // se guarda el handle: si el entrenador navega fuera con el proyector
        // abierto, destroy() lo cierra en vez de dejar un telón negro encima
        // se le pasan los requisitos: el proyector enseña dosis, criterio
        // y el nivel de exigencia que se está corriendo
        onClick: () => { proyector = abrirProyector(ficha.animacion, { nombre: ficha.name, requisitos: ficha.requisitos, variantes: ficha.variantes, catalogo }); },
      }, icon(ICO.proyector, { size: 18 })) : null,
      bloque.exercise_id ? h('a', {
        class: 'eq-vbtn', href: `/ejercicios/${bloque.exercise_id}`,
        target: '_blank', rel: 'noopener',
        title: 'Abrir la ficha en el Taller (pestaña nueva)', 'aria-label': 'Abrir en el Taller',
      }, icon(ICO.abrir, { size: 18 })) : null,
    ].filter(Boolean));
  }

  // ── API ─────────────────────────────────────────────────────

  /** Enseña un bloque del plan. Async solo si tiene ejercicio detrás. */
  async function mostrar(b) {
    const mio = ++turno;
    bloque = b;
    ficha = null;
    guion = null;
    el.classList.remove('is-vacio');

    if (!b.exercise_id) {
      pestaña = 'guion';
      pintaPista(null);
      pintaCabecera(); pintaTabs(); pintaCuerpo();
      return;
    }

    // esqueleto mientras llega la ficha: el hueco no se colapsa
    pintaCabecera();
    pintaTabs();
    mount(elCuerpo, h('div', { class: 'eq-vskel' }, h('i'), h('i'), h('i')));

    try {
      const f = await getEjercicioCompleto(b.exercise_id);
      if (!vivo || mio !== turno) return;         // llegó tarde: no manda
      ficha = f;
      guion = guionDeAnimacion(f.animacion);
      pintaPista(f.animacion || null);
      pintaCabecera(); pintaTabs(); pintaCuerpo();
    } catch (e) {
      if (!vivo || mio !== turno) return;
      pintaPista(null);
      // sin ficha no hay nada que enseñar en las pestañas, y dejarlas puestas
      // hacía que un clic en "Ficha" borrase el mensaje de error y dejara el
      // panel en blanco sin manera de recuperarlo
      elTabs.replaceChildren();
      mount(elCuerpo, h('p', { class: 'eq-ayuda' },
        e.message === 'NO_EXISTE'
          ? 'Este ejercicio ya no está en la biblioteca. El bloque sigue en el plan con su nombre.'
          : `No se pudo cargar la ficha: ${e.message}`), campoNotas());
    }
  }

  /** Estado sin selección: explica qué hace el panel en vez de dejarlo en blanco. */
  function vaciar() {
    turno++;
    bloque = null; ficha = null; guion = null;
    el.classList.add('is-vacio');
    elTitulo.textContent = 'Visor de ejercicio';
    elChips.replaceChildren();
    elAcciones.replaceChildren();
    elTabs.replaceChildren();
    engine?.destroy();
    engine = null; ctrl = null;
    view.clear();
    ranuraCtrl.replaceChildren();
    notaPista.textContent = '';
    mount(elCuerpo, h('div', { class: 'eq-vvacio' },
      icon(ICO.diana, { size: 32 }),
      h('p', { class: 'eq-vvacio-t' }, 'Toca un bloque del plan'),
      h('p', { class: 'eq-ayuda' }, 'Aquí verás la pizarra animada, el paso a paso y la ficha, sin salir de la sesión.'),
    ));
  }

  vaciar();

  return {
    el,
    mostrar,
    vaciar,
    /** Re-pinta la cabecera cuando cambian duración o intensidad del bloque. */
    refrescarCabecera: () => { if (bloque) pintaCabecera(); },
    /**
     * Para el reloj de la animación sin perder el bloque cargado. Lo llama el
     * planificador al cerrar el modal en móvil: allí el visor vuelve a una
     * columna con display:none, y el motor seguía repintando un lienzo
     * invisible a 60 fps (CourtView no llega a poner w=0 al ocultarse, así
     * que la guarda de render() tampoco cortaba). Batería del entrenador.
     */
    pausar: () => engine?.pause(),
    get bloqueActual() { return bloque; },
    destroy() {
      vivo = false;
      proyector?.cerrar?.();
      engine?.destroy();
      view.destroy();
    },
  };
}
