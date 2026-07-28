/* ============================================================
   editor.js — editor a pantalla completa (§2.2, §3 modo edición).
   Canvas grande editable (nodos de flecha §9.3), storyboard de fases
   reordenable, panel lateral de la fase, metadatos plegables,
   deshacer/rehacer (§15) y atajos de teclado (§16).
   ============================================================ */

import { h, mount, icon } from '../ui/dom.js';
import { savebar } from '../ui/chrome.js';
import { slider, rangeSlider, collapsible } from '../ui/components.js';
import { toast } from '../ui/toast.js';
import { EditorCanvas } from '../canvas/editor-canvas.js';
import { History } from '../history.js';
import { getEjercicio, actualizarEjercicio } from '../supabase/ejercicios.js';

const UNDO = 'M9 5 4 10l5 5M4 10h10a5 5 0 0 1 0 10h-2';
const REDO = 'M15 5l5 5-5 5M20 10H10a5 5 0 0 0 0 10h2';

export function render(root, { id } = {}) {
  let ec = null; let anim = null; let ej = null; let k = 0; let history = null;

  const canvasHost = h('div', { class: 'editor-canvas' }, h('div', { class: 'detalle-loading' }, h('span', { class: 'spinner-lg' })));
  const sideHost = h('aside', { class: 'editor-side panel' });
  const storyHost = h('div', { class: 'editor-storyboard panel' });
  const titleEl = h('input', { class: 'header-title header-title__edit', 'aria-label': 'Nombre', value: '' });
  const btnUndo = h('button', { class: 'icon-btn', type: 'button', title: 'Deshacer (Ctrl+Z)', 'aria-label': 'Deshacer', disabled: true, onClick: () => history?.undo() }, icon(UNDO, { size: 18 }));
  const btnRedo = h('button', { class: 'icon-btn', type: 'button', title: 'Rehacer (Ctrl+Y)', 'aria-label': 'Rehacer', disabled: true, onClick: () => history?.redo() }, icon(REDO, { size: 18 }));

  const bar = savebar({ onSave: guardar, saveLabel: 'Guardar cambios', hint: 'Edita fases y trayectorias · Ctrl+Z deshace.' });
  const btnGuardar = bar.querySelector('#btn-guardar');

  const view = h('div', { class: 'taller taller--editor' },
    h('header', { class: 'taller-header' },
      h('a', { class: 'header-back', href: '/app.html' }, icon('M15 18l-6-6 6-6', { size: 18 }), 'Salir'),
      titleEl,
      h('div', { class: 'header-tools' }, btnUndo, btnRedo),
    ),
    h('div', { class: 'taller-body' }, h('div', { class: 'editor-grid' }, canvasHost, sideHost, storyHost)),
    bar,
  );
  titleEl.addEventListener('input', () => { if (ej) { ej.name = titleEl.value; markDirty(); } });
  document.addEventListener('keydown', onKey);
  root.append(view);

  (async () => {
    try {
      ej = await getEjercicio(id);
      anim = JSON.parse(JSON.stringify(ej.animacion || { pista: ej.tipo_pista || 'entera', jugadores: [], balones: [], conos: [], fases: [] }));
      build();
    } catch (e) {
      mount(canvasHost, h('div', { class: 'detalle-error card' }, h('h2', { class: 'section-title' }, 'No se pudo cargar'), h('p', { class: 'muted' }, e.message)));
    }
  })();

  function markDirty() { btnGuardar.textContent = 'Guardar cambios *'; }

  function build() {
    titleEl.value = ej.name;
    ec = new EditorCanvas(anim);
    ec.on('change', () => { markDirty(); paintSide(); record(); });
    ec.on('select', () => paintSide());
    mount(canvasHost, ec.el);
    if (!anim.fases.length) anim.fases.push(nuevaFase());
    selectFase(0);
    paintStory();
    history = new History(() => JSON.parse(JSON.stringify(anim)), restore);
    history.onChange = updHist;
    history.push();
    if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') window.__editor = { anim, ec, history, addFase, selectFase, reorder, deleteFase, get k() { return k; } };
  }

  function restore(s) {
    anim.jugadores = s.jugadores; anim.balones = s.balones; anim.conos = s.conos; anim.fases = s.fases;
    ec.refresh(); k = Math.min(k, anim.fases.length - 1); ec.setFase(k);
    paintStory(); paintSide(); markDirty();
  }
  function record() { history?.push(); }
  function updHist() { btnUndo.disabled = !history?.canUndo(); btnRedo.disabled = !history?.canRedo(); }

  const nuevaFase = () => ({ id: `fase_${anim.fases.length + 1}`, duracion_ms: 1000, pausa_post_ms: 400, movimientos: [], pases: [], bloqueos: [], tiros: [] });
  function selectFase(i) { k = Math.max(0, Math.min(anim.fases.length - 1, i)); ec.setFase(k); paintStory(); paintSide(); }
  function addFase() { anim.fases.push(nuevaFase()); markDirty(); ec.refresh(); selectFase(anim.fases.length - 1); record(); }
  function deleteFase(i) { if (anim.fases.length <= 1) { toast('Debe quedar al menos una fase.', { type: 'warn' }); return; } anim.fases.splice(i, 1); markDirty(); ec.refresh(); selectFase(Math.min(k, anim.fases.length - 1)); record(); }
  function reorder(from, to) { if (from === to || to < 0 || to >= anim.fases.length) return; const [f] = anim.fases.splice(from, 1); anim.fases.splice(to, 0, f); markDirty(); ec.refresh(); selectFase(to); record(); }

  /* ---- storyboard reordenable ---- */
  function paintStory() {
    const cards = anim.fases.map((f, i) => {
      const card = h('button', {
        class: 'fase-card' + (i === k ? ' is-active' : ''), type: 'button', draggable: 'true',
        onClick: () => selectFase(i),
        ondragstart: (e) => { e.dataTransfer.setData('text/plain', String(i)); e.dataTransfer.effectAllowed = 'move'; },
        ondragover: (e) => { e.preventDefault(); card.classList.add('drop'); },
        ondragleave: () => card.classList.remove('drop'),
        ondrop: (e) => { e.preventDefault(); card.classList.remove('drop'); reorder(+e.dataTransfer.getData('text/plain'), i); },
      }, h('span', { class: 'fase-card__n' }, `F${i + 1}`), h('span', { class: 'fase-card__d mono' }, `${f.duracion_ms}ms`));
      return card;
    });
    mount(storyHost,
      h('div', { class: 'story-head' }, h('span', { class: 'eyebrow' }, 'Storyboard')),
      h('div', { class: 'story-strip' }, ...cards, h('button', { class: 'fase-add', type: 'button', onClick: addFase, title: 'Añadir fase' }, '+')),
    );
  }

  /* ---- panel lateral de la fase ---- */
  function paintSide() {
    const f = anim.fases[k]; if (!f) { mount(sideHost); return; }
    const movs = (f.movimientos || []).length + (f.pases || []).length + (f.tiros || []).length;
    mount(sideHost, h('div', { class: 'editor-side__in flow' },
      h('p', { class: 'eyebrow' }, `Fase ${k + 1} de ${anim.fases.length}`),
      h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Duración'), slider({ min: 300, max: 4000, step: 100, value: f.duracion_ms, onInput: (v) => { f.duracion_ms = v; markDirty(); paintStory(); }, format: (v) => `${v} ms` })),
      h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Pausa al final'), slider({ min: 0, max: 2000, step: 100, value: f.pausa_post_ms ?? 400, onInput: (v) => { f.pausa_post_ms = v; markDirty(); }, format: (v) => `${v} ms` })),
      h('div', { class: 'mov-list' },
        h('small', { class: 'field__label' }, `Movimientos (${movs})`),
        ...(f.movimientos || []).map((m) => h('div', { class: 'mov-row' }, h('span', null, m.elemento_id), h('span', { class: 'muted mono' }, m.tipo_movimiento))),
        ...(f.pases || []).map((p) => h('div', { class: 'mov-row' }, h('span', null, `${p.de_id} → ${p.a_id}`), h('span', { class: 'muted mono' }, 'pase'))),
        ...(f.tiros || []).map((t) => h('div', { class: 'mov-row' }, h('span', null, t.jugador_id), h('span', { class: 'muted mono' }, 'tiro'))),
        movs === 0 ? h('p', { class: 'muted' }, 'Selecciona una flecha en el lienzo para editar sus nodos.') : null,
      ),
      h('button', { class: 'btn btn--ghost act-danger btn--sm', type: 'button', onClick: () => deleteFase(k) }, 'Eliminar fase'),
      collapsible({ label: 'Metadatos', open: false, content: metaForm() }),
    ));
  }

  function metaForm() {
    return h('div', { class: 'flow' },
      h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Duración estimada'), rangeSlider({ min: 1, max: 60, valueMin: ej.duration_min || 10, valueMax: ej.duration_max || ej.duration_min || 20, onInput: ({ min, max }) => { ej.duration_min = min; ej.duration_max = max; markDirty(); }, format: (a, b) => (a === b ? `${a} min` : `${a}–${b} min`) })),
      h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Dificultad'), slider({ min: 1, max: 6, value: ej.difficulty || 3, onInput: (v) => { ej.difficulty = v; markDirty(); }, format: (v) => String(v) })),
      h('div', { class: 'field' }, h('label', { class: 'field__label' }, 'Intensidad física'), slider({ min: 1, max: 5, value: ej.intensidad || 3, onInput: (v) => { ej.intensidad = v; markDirty(); }, format: (v) => String(v) })),
    );
  }

  /* ---- atajos §16 ---- */
  function onKey(e) {
    if (!anim) return;
    const mod = e.ctrlKey || e.metaKey; const key = e.key.toLowerCase();
    if (mod && key === 's') { e.preventDefault(); guardar(); return; }
    if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); history?.undo(); return; }
    if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); history?.redo(); return; }
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
    if (typing) return;
    if (e.key === 'ArrowLeft') selectFase(k - 1);
    else if (e.key === 'ArrowRight') selectFase(k + 1);
  }

  async function guardar() {
    if (!ec) return;
    const prev = btnGuardar.textContent; btnGuardar.disabled = true; btnGuardar.textContent = 'Guardando…';
    try {
      await actualizarEjercicio(id, { animacion: anim, name: ej.name, duration_min: ej.duration_min, duration_max: ej.duration_max, difficulty: ej.difficulty, intensidad: ej.intensidad ?? null });
      toast('Cambios guardados.', { type: 'ok' }); btnGuardar.textContent = 'Guardar cambios';
    } catch (e) {
      toast('No se pudo guardar: ' + e.message, { type: 'error' }); btnGuardar.textContent = prev;
    } finally { btnGuardar.disabled = false; }
  }

  return { destroy() { document.removeEventListener('keydown', onKey); ec?.destroy(); view.remove(); } };
}
