/* ============================================================
   migraciones.js — QUÉ MIGRACIÓN FALTA, DICHO EN CASTELLANO.
   Módulo PURO: sin DOM, sin red.

   ── DE DÓNDE SALE ESTO ──────────────────────────────────────
   Un entrenador intentó crear un equipo y le salió:

     «No se pudo crear el equipo: Could not find the table
      'public.session_slot_exclusions' in the schema cache»

   Dos cosas mal en esa frase. La primera, que no dice qué hacer: nadie
   sabe que esa tabla la trae la migración 018 ni dónde se aplica. La
   segunda es peor — el equipo SÍ se había creado; lo que falló fue el
   calendario, un paso posterior. Al leer «no se pudo», el entrenador lo
   intentó otra vez, y así salen los equipos duplicados.

   ── QUÉ HACE ────────────────────────────────────────────────
   Traduce el error de PostgREST a una frase que dice qué falta y dónde
   arreglarlo. Y expone `faltaTabla`, para que quien pueda seguir sin esa
   tabla siga: una consulta de exclusiones que no encuentra su tabla
   significa «no hay ninguna ocurrencia descartada», que es una respuesta
   perfectamente buena, no un motivo para tirar la pantalla.
   ============================================================ */

/** Qué migración trae cada tabla. Solo las que el cliente pide a mano. */
export const TABLA_DE = {
  session_slot_exclusions: { migracion: '018', para: 'quitar entrenamientos del calendario sin que vuelvan a generarse' },
  acciones: { migracion: '020', para: 'el catálogo de acciones del taller' },
  videos_accion: { migracion: '021', para: 'los vídeos de las acciones' },
  session_stars: { migracion: '023', para: 'la estrella rápida de la sesión activa' },
  rubrica_niveles: { migracion: '024', para: 'la rúbrica de progresión' },
  objetivos_individuales: { migracion: '026', para: 'los objetivos de cada jugador' },
  partido_estadisticas: { migracion: '028', para: 'el acta del partido' },
  clasificacion: { migracion: '029', para: 'la clasificación de la liga' },
  avisos: { migracion: '031', para: 'los avisos' },
  push_suscripciones: { migracion: '031', para: 'los avisos en el móvil' },
  invitaciones: { migracion: '032', para: 'la lista de quién puede entrar' },
};

/** Códigos con los que PostgREST y Postgres dicen «eso no existe». */
const NO_EXISTE = new Set([
  'PGRST205',   // tabla que no está en la caché de esquema
  'PGRST202',   // función que no existe
  '42P01',      // undefined_table
  '42883',      // undefined_function
]);

const texto = (error) => `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;

/**
 * ¿Este error es «falta ESTA tabla»? Se comprueba el nombre además del
 * código: dar por ausente una tabla por un error que hablaba de otra
 * apagaría media pantalla sin motivo.
 */
export function faltaTabla(error, tabla) {
  if (!error || !tabla) return false;
  const m = texto(error).toLowerCase();
  if (!m.includes(String(tabla).toLowerCase())) return false;
  return NO_EXISTE.has(error.code) || /could not find the table|does not exist/i.test(m);
}

/** ¿Falta alguna tabla conocida? Devuelve su nombre, o null. */
export function tablaQueFalta(error) {
  if (!error) return null;
  for (const tabla of Object.keys(TABLA_DE)) {
    if (faltaTabla(error, tabla)) return tabla;
  }
  return null;
}

/**
 * El error tal y como se le enseña a una persona: qué falta, para qué
 * servía y dónde se arregla. Si no es un problema de migración, se
 * devuelve el mensaje original — inventar uno mejor es esconder la
 * causa de verdad.
 */
export function explica(error, { queSeIntentaba = null } = {}) {
  const tabla = tablaQueFalta(error);
  if (!tabla) return error?.message || 'Ha fallado algo y no ha dicho qué.';
  const { migracion, para } = TABLA_DE[tabla];
  return `${queSeIntentaba ? `${queSeIntentaba}: f` : 'F'}alta aplicar la migración ${migracion} `
    + `en Supabase (es la de ${para}). Todo lo demás sigue funcionando.`;
}
