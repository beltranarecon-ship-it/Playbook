import { requireAuth, getProfile, logout, onAuthChange } from './auth.js';
import { getEjercicios, createEjercicio, archivarEjercicio, getThumbnailGif } from './modules/ejercicios.js';
import { EXERCISE_TYPES, EXERCISE_CATEGORIES, DIFFICULTY_LABELS } from './config.js';

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
        ${ej.difficulty ? `<span class="badge badge-difficulty">${DIFFICULTY_LABELS[ej.difficulty] ?? ej.difficulty}</span>` : ''}
        ${ej.duration_min ? `<span class="badge badge-duration">${ej.duration_min} min</span>` : ''}
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

function setupEjerciciosToolbar() {
  const searchEl   = document.getElementById('search-ejercicios');
  const typeSelect = document.getElementById('filter-type');
  const catSelect  = document.getElementById('filter-category');

  const applyFilters = () => {
    const busqueda = searchEl.value.trim().toLowerCase();
    const type     = typeSelect.value;
    const category = catSelect.value;

    const filtered = ejercicios.filter(ej => {
      const matchName = !busqueda || ej.name.toLowerCase().includes(busqueda);
      const matchType = !type || ej.type === type;
      const matchCat  = !category || ej.category === category;
      return matchName && matchType && matchCat;
    });

    renderEjerciciosGrid(filtered);
    document.getElementById('results-count').textContent =
      `${filtered.length} ejercicio${filtered.length !== 1 ? 's' : ''}`;
  };

  searchEl.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(applyFilters, 250);
  });

  typeSelect.addEventListener('change', applyFilters);
  catSelect.addEventListener('change', applyFilters);
}

function setupNuevoEjercicioBtn() {
  document.getElementById('btn-nuevo-ejercicio')
    .addEventListener('click', () => { window.location.href = '/ejercicios/nuevo'; });
}

// ── Abrir en el Taller ───────────────────────────────────

function openEjercicioDetail(id) {
  window.location.href = '/ejercicios/' + id;
}

// ── Modal: Nuevo ejercicio ───────────────────────────────

function openModalNuevoEjercicio() {
  const overlay = document.getElementById('modal-nuevo-ejercicio');
  overlay.hidden = false;

  const form = overlay.querySelector('form');
  form.reset();

  overlay.querySelector('.modal-close').onclick = () => closeModal(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(overlay); });

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') { closeModal(overlay); document.removeEventListener('keydown', onEsc); }
  });

  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Guardando…';

    try {
      const nuevo = await createEjercicio({
        name:         form.elements.name.value,
        type:         form.elements.type.value,
        category:     form.elements.category.value,
        difficulty:   form.elements.difficulty.value,
        duration_min: form.elements.duration_min.value,
        description:  form.elements.description.value,
      });
      ejercicios.unshift(nuevo);
      renderEjerciciosGrid(ejercicios);
      closeModal(overlay);
      showToast(`Ejercicio «${nuevo.name}» creado`, 'success');
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar ejercicio';
    }
  };
}

function closeModal(overlay) {
  overlay.hidden = true;
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

function hasOpenModal() {
  return !document.getElementById('modal-nuevo-ejercicio')?.hidden;
}

// ── Arrancar ─────────────────────────────────────────────
init();
