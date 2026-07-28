/* ============================================================
   config.js — constantes de dominio del módulo Sesiones/Equipos.
   Convenciones de CONTRACT.md: weekday ISO 1-7, posiciones con
   'sin definir' (espacio), estados de sesión en español.
   ============================================================ */

export const WEEKDAYS = [
  { iso: 1, corto: 'L', nombre: 'Lunes' },
  { iso: 2, corto: 'M', nombre: 'Martes' },
  { iso: 3, corto: 'X', nombre: 'Miércoles' },
  { iso: 4, corto: 'J', nombre: 'Jueves' },
  { iso: 5, corto: 'V', nombre: 'Viernes' },
  { iso: 6, corto: 'S', nombre: 'Sábado' },
  { iso: 7, corto: 'D', nombre: 'Domingo' },
];
export const weekdayNombre = (iso) => WEEKDAYS.find((d) => d.iso === iso)?.nombre || '—';
export const weekdayCorto = (iso) => WEEKDAYS.find((d) => d.iso === iso)?.corto || '·';

export const POSICIONES = ['base', 'escolta', 'alero', 'ala-pivot', 'pivot', 'sin definir'];

export const ESTADOS_SESION = {
  preliminar: 'Preliminar',
  programada: 'Programada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export const ESTADOS_JUGADOR = {
  activo: 'Activo',
  lesionado: 'Lesionado',
  baja: 'Baja',
};

// Categorías de objetivo (CONTRACT: con tilde, casan con exercises.type).
export const CATEGORIAS_OBJETIVO = ['técnico', 'táctico', 'físico'];
export const CATEGORIA_ABREV = { 'técnico': 'TÉC', 'táctico': 'TÁC', 'físico': 'FÍS' };

export const ESTADOS_OBJETIVO = {
  activo: 'Activo',
  conseguido: 'Conseguido',
  archivado: 'Archivado',
};

// Paleta curada de colores de equipo: identidad (bandas/puntos), nunca color
// de acción (la acción es siempre papaya). Armonizan con papaya y dan AA.
export const TEAM_COLORS = [
  '#1F6FEB', // azul
  '#2FA968', // verde
  '#8957E5', // violeta
  '#D4318C', // magenta
  '#C89B00', // mostaza
  '#0B8B8B', // teal
  '#C0392B', // teja
  '#5A6572', // gris pizarra
];

export const CATEGORIAS_EQUIPO = [
  'babybasket', 'premini', 'minibasket', 'alevin', 'infantil',
  'cadete', 'junior', 'senior',
];
