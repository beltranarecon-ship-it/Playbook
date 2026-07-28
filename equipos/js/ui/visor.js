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
import { dificultadDe } from '../../../taller/js/config.js';
import { guionDeAnimacion, resumenMaterial } from '../data/guion.js';
import { getEjercicioCompleto } from '../data/ejercicios.js';
import { INTENSIDAD_LABEL, INTENSIDAD_MAX } from '../data/carga.js';

const PISTA_LABEL = {
  entera: 'Pista entera', media: 'Media pista',
  entera_fiba: 'Entera · triple FIBA', media_fiba: 'Media · triple FIBA',
};

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

  function vistaFicha() {
    if (!ficha) return null;
    const req = ficha.requisitos || {};
    const material = resumenMaterial(guion?.resumen);
    const fila = (lbl, val) => (val == null || val === '' || (Array.isArray(val) && !val.length)
      ? null
      : h('div', { class: 'eq-vfila' },
          h('span', { class: 'eq-vfila-l' }, lbl),
          h('span', { class: 'eq-vfila-v' }, Array.isArray(val) ? val.join(' · ') : String(val))));

    return h('div', { class: 'eq-vficha' },
      h('div', { class: 'eq-vfilas' },
        fila('Tipo', ficha.type),
        fila('Categoría', [ficha.categoria_rama, ...(ficha.categoria_nivel || [])].filter(Boolean)),
        fila('Duración de referencia', ficha.duration_min
          ? (ficha.duration_max && ficha.duration_max !== ficha.duration_min
              ? `${ficha.duration_min}–${ficha.duration_max} min` : `${ficha.duration_min} min`)
          : null),
        fila('Pista', PISTA_LABEL[ficha.tipo_pista] || null),
        // Material: manda lo que hay DIBUJADO en la pizarra (es lo que se
        // va a ver); los requisitos escritos a mano son el respaldo.
        fila('Material', material || [
          req.jugadores ? `${req.jugadores} jugadores` : null,
          req.balones ? `${req.balones} balones` : null,
          req.conos ? `${req.conos} conos` : null,
        ].filter(Boolean).join(' · ')),
        fila('Autor', ficha.autor_nombre),
      ),
      (ficha.tags || []).length
        ? h('div', { class: 'eq-vtags' }, ...ficha.tags.map((t) => h('span', { class: 'eq-vtag' }, t)))
        : null,
      seccionTexto('Objetivos', ficha.objetivos),
      seccionTexto('Variantes', ficha.variantes),
      seccionTexto('Notas del autor', ficha.notas),
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
      chip(bloque.exercise_id ? (ficha?.type || null) : 'Bloque libre', 'eq-vchip-tipo'),
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
        onClick: () => { proyector = abrirProyector(ficha.animacion, { nombre: ficha.name }); },
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
