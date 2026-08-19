import { requireAuth, getProfile, logout, onAuthChange } from './auth.js';
import { getEjercicios, getThumbnailGif } from './modules/ejercicios.js';
// La etiqueta de dificultad sale del Taller, no de una tabla propia: había
// DOS escalas para la misma columna (aquí 1-5 con cinco nombres, allí 1-6
// con tres) y el mismo ejercicio se anunciaba distinto en la tarjeta y en
// su ficha.
import { dificultadDe } from '../taller/js/config.js';
import { getDuracionesReales } from './modules/duraciones.js';
import { duracionPropuesta } from '../taller/js/duracion.js';

// ── Estado global de la sesión ───────────────────────────
let currentUser    = null;
let currentProfile = null;
let ejercicios     = [];
let searchTimeout  = null;

// ── Inicialización ───────────────────────────────────────

async function init() {
  console.log('[CBP] init: arrancando…');

  const session = await requireAuth();
  if (!session) return;

  currentUser = session.user;
  console.log('[CBP] sesión OK ->', currentUser.email);

  try {
    currentProfile = await getProfile(currentUser.id);
  } catch {
    await new Promise(r => setTimeout(r, 800));
    try { currentProfile = await getProfile(currentUser.id); } catch { /* sin perfil */ }
  }

  renderTopbar();
  setupNavigation();
  setupAuthListener();
  setupNuevoEjercicioBtn(); // siempre, sin depender de getEjercicios

  await showEjercicios();
}

// ── Topbar ───────────────────────────────────────────────

function renderTopbar() {
  const name = currentProfile?.full_name ?? currentUser.email;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  document.getElementById('user-name').textContent = name.split(' ')[0];
  document.getElementById('user-avatar').textContent = initials;
}

function setupNavigation() {
  document.getElementById('btn-logout').addEventListener('click', () => logout());

  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      setActiveView(view);
    });
  });
}

function setActiveView(view) {
  document.querySelectorAll('[data-view]').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.view === view)
  );
  document.querySelectorAll('[data-view-panel]').forEach(panel =>
    panel.hidden = panel.dataset.viewPanel !== view
  );

  if (view === 'ejercicios') showEjercicios();
}

function setupAuthListener() {
  onAuthChange((event) => {
    if (event === 'SIGNED_OUT') {
      window.location.replace('/index.html');
    }
  });
}

// ── Vista: Ejercicios ────────────────────────────────────

async function showEjercicios() {
  const grid = document.getElementById('exercises-grid');
  renderSkeletons(grid, 6);

  try {
    ejercicios = await getEjercicios();
    renderEjerciciosGrid(ejercicios);

    /* Las duraciones reales llegan DESPUÉS y repintan (Tramo 3.6): la
       rejilla no se queda esperando por un dato que solo mejora una
       etiqueta. Si falla, las tarjetas siguen con lo de la ficha. */
    getDuracionesReales()
      .then((d) => {
        if (!d || !Object.keys(d).length) return;
        realesPorId = d;
        repintarRejilla();
      })
      .catch(() => {});
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"/>
      </svg>
      <h3>Error al cargar ejercicios</h3>
      <p style="font-size:.875rem">${err.message}</p>
    </div>`;
  }

  setupEjerciciosToolbar();
}

/* Lo que de verdad ha durado cada ejercicio en los entrenamientos de
   quien mira (Tramo 3.6). Llega por red DESPUÉS de la primera pintada:
   la rejilla no espera por un dato de adorno. */
let realesPorId = {};
/* Repinta la rejilla RESPETANDO el filtro que haya puesto. Se apunta
   aquí porque `applyFilters` vive dentro del montaje de los filtros y,
   sin esto, repintar con las duraciones reales borraría la búsqueda que
   el entrenador acababa de escribir. */
let repintarRejilla = () => {};

/**
 * La duración de la tarjeta. Si el ejercicio se ha dado alguna vez,
 * manda lo que duró —con la marca de que es real—; si no, lo que
 * estimó la ficha.
 */
function badgeDuracion(ej) {
  const p = duracionPropuesta(realesPorId[ej.id], ej.duration_min);
  if (!p.minutos) return '';
  const real = p.origen === 'real';
  const titulo = real
    ? (p.veces === 1 ? 'Lo que duró la última vez que lo diste' : `Lo que dura tus últimas ${p.veces} veces`)
    : 'Lo que estima la ficha';
  return `<span class="badge badge-duration${real ? ' badge-real' : ''}" title="${titulo}">${p.minutos} min${real ? ' reales' : ''}</span>`;
}

function renderEjerciciosGrid(data) {
  const grid = document.getElementById('exercises-grid');

  if (!data.length) {
    grid.innerHTML = `<div class="empty-state">
      <svg width="56" height="56" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">
        <path d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"/>
      </svg>
      <h3>Sin ejercicios todavía</h3>
      <p style="font-size:.875rem;color:var(--color-muted)">Crea el primer ejercicio con el botón «Nuevo»</p>
    </div>`;
    return;
  }

  grid.innerHTML = data.map((ej, i) => `
    <article class="exercise-card animate-fadeIn" data-id="${ej.id}"
      style="animation-delay:${i * 30}ms">
      ${ej.poster ? `<div class="exercise-card-thumb"><img class="thumb-img" src="${ej.poster}" alt="" loading="lazy"></div>` : ''}
      <div class="exercise-card-header">
        <h3 class="exercise-card-name">${escapeHtml(ej.name)}</h3>
      </div>
      <div class="exercise-card-meta">
        ${ej.type ? `<span class="badge badge-type">${ej.type}</span>` : ''}
        ${ej.difficulty ? `<span class="badge badge-difficulty">${escapeHtml(ej.dificultad_label || dificultadDe(ej.difficulty).label)}</span>` : ''}
        ${badgeDuracion(ej)}
      </div>
      ${ej.description ? `<p class="exercise-card-desc">${escapeHtml(ej.description)}</p>` : ''}
    </article>
  `).join('');

  grid.querySelectorAll('.exercise-card').forEach(card => {
    card.addEventListener('click', () => openEjercicioDetail(card.dataset.id));
    // miniatura: póster en reposo, GIF en hover (carga diferida) §19
    const img = card.querySelector('.thumb-img');
    if (img) {
      const poster = img.src; let gif = null; let loading = false;
      card.addEventListener('mouseenter', async () => {
        if (gif) { img.src = gif; return; }
        if (loading) return;
        loading = true;
        const g = await getThumbnailGif(card.dataset.id);
        loading = false;
        if (g) { gif = g; img.src = g; }
      });
      card.addEventListener('mouseleave', () => { img.src = poster; });
    }
  });
}

function renderSkeletons(grid, n) {
  grid.innerHTML = Array.from({ length: n }, () => `
    <div class="exercise-card">
      <div class="skeleton" style="height:1.25rem;width:70%;margin-bottom:.75rem"></div>
      <div style="display:flex;gap:.5rem;margin-bottom:.75rem">
        <div class="skeleton" style="height:1.25rem;width:60px;border-radius:4px"></div>
        <div class="skeleton" style="height:1.25rem;width:50px;border-radius:4px"></div>
      </div>
      <div class="skeleton" style="height:.875rem;width:90%;margin-bottom:.25rem"></div>
      <div class="skeleton" style="height:.875rem;width:60%"></div>
    </div>
  `).join('');
}

/* ── Buscador y filtros ───────────────────────────────────
   Los dos desplegables se construyen DESDE LOS DATOS, no desde una
   lista escrita a mano. La lista a mano existía y se había
   desincronizado del todo: ofrecía «técnico / táctico / físico / juego»
   cuando los tipos reales son «Tiro, Bote, 1vs1…», así que las cuatro
   opciones devolvían cero ejercicios; y de las diez categorías, cuatro
   no existían y faltaban ocho de los bloques de contenido reales, con
   lo que 52 de los 97 ejercicios no se podían encontrar por categoría.

   Generándolos desde la biblioteca no pueden volver a desincronizarse:
   si mañana aparece un bloque nuevo, aparece solo en el filtro. Y el
   número entre paréntesis dice cuántos hay antes de elegir, que es
   media respuesta. */

/** Sin tildes y en minúsculas: en el pabellón nadie escribe «penetración». */
const sinTildes = (s) => String(s ?? '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Texto sobre el que busca el buscador: nombre, descripción y etiquetas. */
const textoBuscable = (ej) => sinTildes([
  ej.name, ej.description, ej.category, ej.type, ...(ej.tags || []),
].filter(Boolean).join(' '));

function rellenaFiltro(select, valores, etiquetaTodos) {
  const previo = select.value;
  const cuenta = new Map();
  for (const v of valores) if (v) cuenta.set(v, (cuenta.get(v) || 0) + 1);
  const ordenadas = [...cuenta.keys()].sort((a, b) => a.localeCompare(b, 'es'));

  select.replaceChildren();
  select.append(new Option(etiquetaTodos, ''));
  for (const v of ordenadas) select.append(new Option(`${v} (${cuenta.get(v)})`, v));
  // conservar la elección del entrenador si sigue existiendo
  if (previo && cuenta.has(previo)) select.value = previo;
}

function setupEjerciciosToolbar() {
  const searchEl   = document.getElementById('search-ejercicios');
  const typeSelect = document.getElementById('filter-type');
  const catSelect  = document.getElementById('filter-category');
  const countEl    = document.getElementById('results-count');

  rellenaFiltro(typeSelect, ejercicios.map(e => e.type), 'Todos los tipos');
  rellenaFiltro(catSelect, ejercicios.map(e => e.category), 'Todos los contenidos');

  const applyFilters = () => {
    const busqueda = sinTildes(searchEl.value.trim());
    const type     = typeSelect.value;
    const category = catSelect.value;
    // varias palabras = todas tienen que aparecer ("tiro entrada")
    const palabras = busqueda ? busqueda.split(/\s+/) : [];

    const filtered = ejercicios.filter(ej => {
      if (type && ej.type !== type) return false;
      if (category && ej.category !== category) return false;
      if (!palabras.length) return true;
      const texto = ej._buscable ??= textoBuscable(ej);
      return palabras.every(p => texto.includes(p));
    });

    renderEjerciciosGrid(filtered);
    const filtrando = busqueda || type || category;
    countEl.textContent = filtrando
      ? `${filtered.length} de ${ejercicios.length} ejercicios`
      : `${ejercicios.length} ejercicio${ejercicios.length !== 1 ? 's' : ''}`;
  };

  // Se vuelven a vincular en cada entrada a la vista, así que primero se
  // sueltan los de la vez anterior: si no, volver cinco veces a la
  // pestaña dejaba cinco escuchadores y cada tecla repintaba cinco veces.
  searchEl.oninput = () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 200);
  };
  typeSelect.onchange = applyFilters;
  catSelect.onchange = applyFilters;

  // el repintado de las duraciones reales (3.6) pasa por aquí para no
  // borrar la búsqueda que el entrenador tenga escrita
  repintarRejilla = applyFilters;
  applyFilters();   // deja el contador y la rejilla de acuerdo con los filtros vivos
}

function setupNuevoEjercicioBtn() {
  document.getElementById('btn-nuevo-ejercicio')
    .addEventListener('click', () => { window.location.href = '/ejercicios/nuevo'; });
}

// ── Abrir en el Taller ───────────────────────────────────

function openEjercicioDetail(id) {
  window.location.href = '/ejercicios/' + id;
}

// ── Toast ────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// ── Helpers ──────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Atajos de teclado globales ───────────────────────────

document.addEventListener('keydown', (e) => {
  // / → enfocar búsqueda
  if (e.key === '/' && !isInputFocused()) {
    e.preventDefault();
    document.getElementById('search-ejercicios')?.focus();
  }
  // N → nuevo ejercicio (abre el Taller)
  if (e.key === 'n' && !isInputFocused() && !hasOpenModal()) {
    window.location.href = '/ejercicios/nuevo';
  }
});

function isInputFocused() {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/* Cualquier modal visible, no uno concreto: cuando el modal de "nuevo
   ejercicio" se quitó (el botón abre el Taller desde hace tiempo, así que
   era código muerto), preguntar por su id devolvía `!undefined` = true y
   el atajo N dejaba de funcionar para siempre. */
function hasOpenModal() {
  return !!document.querySelector('.modal-overlay:not([hidden])');
}

// ── Arrancar ─────────────────────────────────────────────
init();
