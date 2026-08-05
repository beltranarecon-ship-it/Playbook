/* ============================================================
   detalle.js — vista de detalle del ejercicio (§14).
   Dos columnas: canvas con animación + ficha de metadatos.
   Acciones: Editar, Duplicar, Favorito, Eliminar, Proyector.
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { header } from '../ui/chrome.js';
import { Stage } from '../canvas/stage.js';
import { abrirProyector } from '../canvas/proyector.js';
import { toast } from '../ui/toast.js';
import { confirmModal } from '../ui/modal.js';
import { getEjercicio, duplicarEjercicio, setFavorito, eliminarEjercicio } from '../supabase/ejercicios.js';
import { dificultadDe } from '../config.js';
import {
  PISTA_LABEL, DENSIDAD_AYUDA, OPOSICION_AYUDA, PRESION_AYUDA,
  textoDosis, textoJugadores, textoCanastas, textoDuracion, nivelesDe,
} from '../ficha.js';

const STAR = 'M11.48 3.5a.56.56 0 0 1 1.04 0l2.17 4.4 4.85.7a.56.56 0 0 1 .31.96l-3.51 3.42.83 4.83a.56.56 0 0 1-.81.59L12 16.9l-4.34 2.28a.56.56 0 0 1-.81-.59l.83-4.83-3.51-3.42a.56.56 0 0 1 .31-.96l4.85-.7Z';

export function render(root, { id } = {}) {
  let stage = null; let proj = null; let curEj = null; let curAnim = null; let favBtnRef = null;
  const body = h('div', { class: 'taller-body' }, h('div', { class: 'detalle-loading' }, h('span', { class: 'spinner-lg' })));
  const titleEl = h('div', { class: 'header-title' }, 'Cargando…');
  const view = h('div', { class: 'taller taller--detalle' },
    h('header', { class: 'taller-header' },
      h('a', { class: 'header-back', href: '/app.html' }, icon('M15 18l-6-6 6-6', { size: 18 }), 'Biblioteca'),
      titleEl,
      h('div', { class: 'header-tools' }),
    ),
    body,
  );
  root.append(view);

  (async () => {
    try {
      const ej = await getEjercicio(id);
      pintar(ej);
    } catch (e) {
      mount(body, h('div', { class: 'detalle-error card' },
        h('h2', { class: 'section-title' }, 'No se pudo cargar el ejercicio'),
        h('p', { class: 'muted' }, e.message === 'JSON object requested, multiple (or no) rows returned' ? 'El ejercicio no existe o no tienes acceso.' : e.message),
        h('a', { class: 'btn btn--secondary', href: '/app.html' }, 'Volver a la biblioteca'),
      ));
    }
  })();

  function pintar(ej) {
    titleEl.textContent = ej.name;
    titleEl.title = ej.name;
    const anim = ej.animacion || { pista: ej.tipo_pista || 'entera', jugadores: [], balones: [], conos: [], fases: [] };
    stage = new Stage({ pista: ej.tipo_pista || 'entera' });
    stage.showAnimation(anim);
    curEj = ej; curAnim = anim;

    mount(body, h('div', { class: 'detalle-grid' },
      h('section', { class: 'detalle-canvas' }, stage.el),
      h('aside', { class: 'detalle-side' }, acciones(ej, anim), ...ficha(ej)),
    ));
  }

  function acciones(ej, anim) {
    let fav = !!ej.favorito;
    const favBtn = h('button', { class: 'btn btn--secondary act-fav' + (fav ? ' is-fav' : ''), type: 'button', title: 'Favorito' },
      icon(STAR, { size: 18, fill: fav ? 'currentColor' : 'none' }), 'Favorito');
    favBtn.addEventListener('click', async () => {
      fav = !fav;
      favBtn.classList.toggle('is-fav', fav);
      favBtn.replaceChildren(icon(STAR, { size: 18, fill: fav ? 'currentColor' : 'none' }), document.createTextNode('Favorito'));
      try { await setFavorito(ej.id, fav); } catch (e) { toast('No se pudo actualizar: ' + e.message, { type: 'error' }); }
    });
    favBtnRef = favBtn;

    return h('div', { class: 'detalle-actions card' },
      h('a', { class: 'btn btn--primary has-arrow', href: `/ejercicios/${ej.id}/editar`, 'data-link': true }, 'Editar ', icon('M9 18l6-6-6-6', { size: 16 })),
      h('button', { class: 'btn btn--secondary', type: 'button', onClick: () => abrir(anim, ej) }, 'Proyector'),
      favBtn,
      h('button', { class: 'btn btn--ghost', type: 'button', onClick: () => duplicar(ej) }, 'Duplicar'),
      h('button', { class: 'btn btn--ghost act-danger', type: 'button', onClick: () => borrar(ej) }, 'Eliminar'),
    );
  }

  function abrir(anim, ej) {
    proj = abrirProyector(anim, { nombre: ej.name, tipo: ej.type, dificultad_label: ej.dificultad_label, duracion_min: ej.duration_min, categoria_rama: ej.categoria_rama, categoria_nivel: ej.categoria_nivel, requisitos: ej.requisitos });
  }

  async function duplicar(ej) {
    try { const { id: nid } = await duplicarEjercicio(ej); toast('Ejercicio duplicado.', { type: 'ok' }); nav(`/ejercicios/${nid}`); }
    catch (e) { toast('No se pudo duplicar: ' + e.message, { type: 'error' }); }
  }

  async function borrar(ej) {
    const ok = await confirmModal({ title: 'Eliminar ejercicio', message: '¿Eliminar este ejercicio? Esta acción no se puede deshacer.' });
    if (!ok) return;
    try { await eliminarEjercicio(ej.id); toast('Ejercicio eliminado.', { type: 'ok' }); nav('/app.html'); }
    catch (e) { toast('No se pudo eliminar: ' + e.message, { type: 'error' }); }
  }

  // atajos §16: F favorito · P proyector · Espacio play/pausa
  function onKey(e) {
    if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (e.key === 'f' || e.key === 'F') favBtnRef?.click();
    else if (e.key === 'p' || e.key === 'P') { if (curAnim && curEj) abrir(curAnim, curEj); }
    else if (e.key === ' ') { e.preventDefault(); stage?.engine?.toggle(); }
  }
  document.addEventListener('keydown', onKey);

  return { destroy() { document.removeEventListener('keydown', onKey); proj?.cerrar?.(); stage?.destroy(); view.remove(); } };
}

/* ============================================================
   Ficha del ejercicio (§14).

   Orden pensado para el pabellón, no para la base de datos: primero
   lo que decide si el ejercicio se puede montar HOY (gente, aros,
   material, dosis), después cómo se juega, después cómo se sube o se
   baja de nivel, y al final los datos de catálogo.

   Antes esta función pintaba `requisitos.jugadores`, `.balones` y
   `.conos` — tres campos que NINGUNA ficha de la biblioteca tiene: las
   tres filas se descartaban en silencio y el panel quedaba casi vacío.
   Lo que sí hay (jugadores_min/max, canastas, material, densidad,
   oposicion, requisito_previo, dosis, criterio_exito, aplicacion) no se
   enseñaba en ninguna parte, y el desarrollo del ejercicio —el campo
   más largo y más útil— tampoco.
   ============================================================ */

function ficha(ej) {
  const dif = ej.difficulty ? dificultadDe(ej.difficulty) : null;
  const r = ej.requisitos || {};
  const row = (label, val) => (val == null || val === '' || (Array.isArray(val) && !val.length)) ? null
    : h('div', { class: 'ficha-row' }, h('small', null, label), h('span', null, Array.isArray(val) ? val.join(' · ') : String(val)));

  const dosis = textoDosis(r.dosis);
  const escalones = nivelesDe(ej);

  /* --- 1 · se puede montar hoy? ------------------------------- */
  const montaje = h('div', { class: 'ficha card flow' },
    h('p', { class: 'eyebrow' }, 'Montaje'),
    h('div', { class: 'ficha-rows' },
      row('Jugadores', textoJugadores(r)),
      row('Estaciones', r.estaciones > 1 ? `${r.estaciones} a la vez` : null),
      row('Canastas', textoCanastas(r)),
      row('Material', r.material),
      row('Pista', PISTA_LABEL[ej.tipo_pista] || null),
      row('Duración', textoDuracion(ej)),
    ),
    dosis ? h('div', { class: 'ficha-dosis' }, h('small', null, 'Dosis'), h('strong', null, dosis)) : null,
    // Cómo se reparte el grupo: es lo que se consulta con doce niños ya
    // en la pista, así que va aquí y no enterrado entre los textos.
    seccion('Con el grupo entero', r.organizacion),
  );

  /* --- 2 · cómo se juega -------------------------------------- */
  const juego = h('div', { class: 'ficha card flow' },
    h('p', { class: 'eyebrow' }, 'Cómo se juega'),
    ej.description ? h('p', { class: 'ficha-idea' }, ej.description) : null,
    seccion('Desarrollo', ej.descripcion_texto),
    seccion('Objetivo', ej.objetivos),
    seccion('Está bien hecho cuando', r.criterio_exito),
    seccion('Antes hace falta saber', r.requisito_previo),
    seccion('Se aplica en', r.aplicacion),
  );

  /* --- 3 · subir y bajar el listón ---------------------------- */
  const exigencia = h('div', { class: 'ficha card flow' },
    h('p', { class: 'eyebrow' }, 'Exigencia'),
    h('div', { class: 'ficha-chips' },
      r.densidad ? h('span', { class: `ficha-chip dens--${r.densidad}`, title: DENSIDAD_AYUDA[r.densidad] || '' }, `densidad ${r.densidad}`) : null,
      r.oposicion ? h('span', { class: `ficha-chip opo--${r.oposicion}`, title: OPOSICION_AYUDA[r.oposicion] || '' }, `oposición ${r.oposicion}`) : null,
      // Qué aprieta cuando no hay rival. Sin este chip, un ejercicio de
      // manejo en un espacio que se estrecha y una serie de tiro en
      // silencio se leían igual: los dos «sin oposición».
      r.presion ? h('span', { class: `ficha-chip pres--${r.presion}`, title: PRESION_AYUDA[r.presion] || '' }, `presión ${r.presion}`) : null,
      ej.intensidad ? h('span', { class: 'ficha-chip' }, `intensidad ${ej.intensidad}/5`) : null,
    ),
    r.justificacion_densidad ? seccion('Por qué se acepta esta densidad', r.justificacion_densidad) : null,
    escalones
      ? h('div', { class: 'ficha-niveles' }, ...escalones.map((e) => h('div', { class: 'ficha-nivel' },
          h('small', null, e.nivel), h('p', null, e.texto))))
      : seccion('Variantes', ej.variantes),
    seccion('Puntos clave y errores frecuentes', ej.notas),
  );

  /* --- 4 · catálogo ------------------------------------------- */
  const datos = h('div', { class: 'ficha card flow' },
    h('p', { class: 'eyebrow' }, 'Datos'),
    h('div', { class: 'ficha-rows' },
      row('Contenido', ej.category),
      row('Tipo', ej.type),
      dif ? h('div', { class: 'ficha-row' }, h('small', null, 'Dificultad'), h('span', { class: `dif-pill ${dif.clase}` }, ej.dificultad_label || dif.label)) : null,
      row('Categoría', [ej.categoria_rama, ...(ej.categoria_nivel || [])].filter(Boolean)),
      row('Autor', ej.autor_nombre),
    ),
    (ej.tags && ej.tags.length) ? h('div', { class: 'ficha-tags' }, ...ej.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
  );

  return [montaje, juego, exigencia, datos];
}

/** Sección de texto; null si no hay nada que enseñar (así una ficha
 *  incompleta no deja títulos huérfanos). Respeta los saltos dobles. */
function seccion(titulo, texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  return h('div', { class: 'ficha-sec' },
    h('small', { class: 'ficha-sec__t' }, titulo),
    ...t.split(/\n{2,}/).map((p) => h('p', null, p.trim())),
  );
}

// Navegación: las rutas internas del Taller (/ejercicios/*) van por el router
// SPA (sin recarga); cualquier destino externo (p.ej. /app.html, la biblioteca
// de cbp-v2) necesita navegación real del navegador — si se hiciera por pushState
// el router no reconocería la ruta y caería al fallback /ejercicios/nuevo (abriría
// el creador). Ese era el bug "al eliminar se abre el creador".
function nav(path) {
  if (path.startsWith('/ejercicios')) { history.pushState({}, '', path); window.dispatchEvent(new PopStateEvent('popstate')); }
  else window.location.assign(path);
}
