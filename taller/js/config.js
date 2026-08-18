/* ============================================================
   config.js — constantes del taller (§5, §6, §12).
   ============================================================ */

import { PISTAS } from './canvas/court.js';

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

// El selector de pista del paso 0. `src` y la relación de aspecto se leen
// del registro de canvas/court.js en vez de repetirse aquí: esta lista tenía
// su propia copia de las cuatro rutas y se quedó apuntando a ficheros que ya
// no existen en cuanto se redibujaron las pistas.
export const PISTA_OPCIONES = [
  { key: 'entera', label: 'Pista entera', sub: 'Sin triple' },
  { key: 'media', label: 'Media pista', sub: 'Sin triple' },
  { key: 'entera_fiba', label: 'Pista entera', sub: 'Triple FIBA' },
  { key: 'media_fiba', label: 'Media pista', sub: 'Triple FIBA' },
].map((o) => ({ ...o, src: PISTAS[o.key].src, aspect: PISTAS[o.key].aspect }));

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
/* Las etiquetas se sugieren desde el VOCABULARIO compartido
   (ia/vocabulario.js#TAGS), no desde aquí. La lista que había en este
   sitio tenía siete y tres no existían en el vocabulario: la app
   sugería etiquetas que su propio linter rechaza (Tramo 2.12). */
