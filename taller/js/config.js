/* ============================================================
   config.js — constantes del taller (§5, §6, §12).
   ============================================================ */

// Claves PÚBLICAS de Supabase. Mismas que cbp-v2: un único backend para todo
// Playbook CBP, así los ejercicios del Taller salen también en la biblioteca.
// La anon/publishable key es pública (la protege RLS); la service_role NUNCA va aquí.
export const SUPABASE_URL = 'https://tsskjoewviqixnwonpkx.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Y4wglMhBuyK12njiTdASHQ_oRO8OeuE';
export const SESSION_STORAGE_KEY = 'cbp-auth'; // misma sesión que cbp-v2 (mismo origen en producción)

export const TIPOS_EJERCICIO = [
  'Tiro', 'Bote', 'Pase', '1vs1', '2vs2', '3vs3', '4vs4', '5vs5',
  'Contraataque', 'Defensa', 'Calentamiento', 'Físico', 'Situaciones especiales', 'Otro',
];

export const PISTA_OPCIONES = [
  { key: 'entera', label: 'Pista entera', sub: 'Minibasket', src: '/taller/assets/pistas/pista-mini-entera.svg' },
  { key: 'media', label: 'Media pista', sub: 'Minibasket', src: '/taller/assets/pistas/pista-mini-mitad.svg' },
  { key: 'entera_fiba', label: 'Pista entera', sub: 'Triple FIBA', src: '/taller/assets/pistas/pista-fiba-entera.svg' },
  { key: 'media_fiba', label: 'Media pista', sub: 'Triple FIBA', src: '/taller/assets/pistas/pista-fiba-mitad.svg' },
];

export const CATEGORIAS = {
  Minibasket: ['Escuela', 'Benjamín', 'Alevín'],
  Basket: ['Infantil', 'Cadete', 'Junior'],
};

/** Dificultad 1–6 -> etiqueta y clase de color (§12). */
export function dificultadDe(v) {
  if (v <= 2) return { label: 'Iniciación', clase: 'dif--ini' };
  if (v <= 4) return { label: 'Medio', clase: 'dif--med' };
  return { label: 'Avanzado', clase: 'dif--adv' };
}

// Objetivos de temporada: configurables por el admin en Ajustes (vacío por ahora).
export const OBJETIVOS_TEMPORADA = [];

// Tags ya usados en la biblioteca (autocompletado §12); se llenará desde Supabase.
export const TAGS_SUGERIDOS = ['transición', 'pick and roll', 'tiro exterior', 'defensa individual', 'contraataque', '2x1', 'bloqueo directo'];
