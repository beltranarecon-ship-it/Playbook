// Claves públicas de Supabase — no son secretas (van al cliente)
// Reemplazar con los valores reales del proyecto Supabase tras crearlo
export const SUPABASE_URL = 'https://tsskjoewviqixnwonpkx.supabase.co';
// AQUÍ SOLO VA LA CLAVE ANÓNIMA. Nunca la de servicio ni una sb_secret_:
// este fichero se sirve al navegador de cualquiera que abra la app.
// La clave de servicio vive en .env, que está en .gitignore.
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzc2tqb2V3dmlxaXhud29ucGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0ODQyMTQsImV4cCI6MjA5ODA2MDIxNH0.O1z-p3C04RtYmBrdrLzPrk1hv2ZS_edq4eEGa_YFixw';

// Nombre de la app
export const APP_NAME = 'Playbook CBP';
export const APP_SHORT_NAME = 'CBP';

// Configuración de sesión
export const SESSION_STORAGE_KEY = 'cbp-auth';

// Tipos y categorías de ejercicios
export const EXERCISE_TYPES = ['técnico', 'táctico', 'físico', 'juego'];
export const EXERCISE_CATEGORIES = [
  'ataque', 'defensa', 'transición', 'tiro', 'pase',
  'bote', 'bloqueo', 'rebote', 'contraataque', 'presión',
];
export const DIFFICULTY_LABELS = {
  1: 'Iniciación',
  2: 'Básico',
  3: 'Medio',
  4: 'Avanzado',
  5: 'Experto',
};
