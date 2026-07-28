/* ============================================================
   colors.js — colores literales para dibujo en Canvas.
   La Canvas API necesita strings de color; estos valores espejan
   §18 (los tokens CSS siguen siendo la fuente de verdad para el DOM).
   ============================================================ */

export const COLORS = {
  A: '#D18347',          // atacantes — terracota
  B: '#1A6B3C',          // defensores — verde oscuro
  C: '#AD1A0A',          // rojo
  D: '#001938',          // azul marino
  ball: '#EA580C',       // balón / conos / pases
  cono: '#EA580C',
  accent: '#006F94',     // selección
  favorite: '#D18347',
  ink: '#001938',
  white: '#FFFFFF',
  arrowRun: '#FFFFFF',   // carrera con balón
  arrowPass: '#EA580C',  // pase / tiro
};

// Nombre visible de cada equipo. Internamente seguimos usando A/B/C/D (claves de
// COLORS, ids de jugador, etc.); de cara al usuario y a la IA son "Equipo 1..4".
// Los roles (atacante/defensor) NO dependen del equipo: los decide la descripción
// de la acción y pueden cambiar por fase.
export const TEAM_LABEL = { A: 'Equipo 1', B: 'Equipo 2', C: 'Equipo 3', D: 'Equipo 4' };
export const TEAM_FROM_NUM = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

export const TAU = Math.PI * 2;
