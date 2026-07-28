/* ============================================================
   store.js — estado de UI del módulo (pub/sub mínimo).
   Persiste SOLO preferencias (último filtro/vista) en localStorage;
   los datos de dominio SIEMPRE se leen frescos de Supabase (v1 online).
   ============================================================ */

const PREFS_KEY = 'cbp_equipos_prefs';

function leerPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; }
  catch { return {}; }
}

const state = {
  perfil: null,            // profile del usuario (role admin|coach)
  temporada: null,         // temporada activa (cacheada por sesión de página)
  equipos: null,           // getMisEquipos() cacheado por navegación
  filtroCalendario: leerPrefs().filtroCalendario || 'todos',
  vistaCal: leerPrefs().vistaCal || 'mes',
};

const subs = new Set();

export const getState = () => state;

export function setState(patch) {
  Object.assign(state, patch);
  subs.forEach((fn) => fn(state));
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({
      filtroCalendario: state.filtroCalendario,
      vistaCal: state.vistaCal,
    }));
  } catch { /* prefs no críticas */ }
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Invalida la caché de equipos (tras crear/editar). */
export function invalidarEquipos() { state.equipos = null; }

/** Invalida la temporada cacheada (tras crear o activar otra). */
export function invalidarTemporada() { state.temporada = null; }

export const esAdmin = () => state.perfil?.role === 'admin';
