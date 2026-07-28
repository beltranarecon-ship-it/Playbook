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
      h('aside', { class: 'detalle-side' }, acciones(ej, anim), ficha(ej)),
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

/* ---- Ficha de metadatos (§14) ---- */
function ficha(ej) {
  const dif = ej.difficulty ? dificultadDe(ej.difficulty) : null;
  const row = (label, val) => (val == null || val === '' || (Array.isArray(val) && !val.length)) ? null
    : h('div', { class: 'ficha-row' }, h('small', null, label), h('span', null, Array.isArray(val) ? val.join(' · ') : String(val)));
  const reqs = ej.requisitos || {};
  return h('div', { class: 'ficha card flow' },
    h('p', { class: 'eyebrow' }, 'Ficha'),
    h('div', { class: 'ficha-rows' },
      row('Tipo', ej.type),
      row('Categoría', [ej.categoria_rama, ...(ej.categoria_nivel || [])].filter(Boolean)),
      dif ? h('div', { class: 'ficha-row' }, h('small', null, 'Dificultad'), h('span', { class: `dif-pill ${dif.clase}` }, ej.dificultad_label || dif.label)) : null,
      row('Duración', ej.duration_min ? (ej.duration_max && ej.duration_max !== ej.duration_min ? `${ej.duration_min}–${ej.duration_max} min` : `${ej.duration_min} min`) : null),
      row('Autor', ej.autor_nombre),
      row('Jugadores', reqs.jugadores),
      row('Balones', reqs.balones),
      row('Conos', reqs.conos),
    ),
    (ej.tags && ej.tags.length) ? h('div', { class: 'ficha-tags' }, ...ej.tags.map((t) => h('span', { class: 'tag' }, t))) : null,
    ej.objetivos ? seccion('Objetivos', ej.objetivos) : null,
    ej.variantes ? seccion('Variantes', ej.variantes) : null,
    ej.notas ? seccion('Notas', ej.notas) : null,
  );
}

function seccion(titulo, texto) {
  return h('div', { class: 'ficha-sec' }, h('small', { class: 'ficha-sec__t' }, titulo), h('p', null, texto));
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
