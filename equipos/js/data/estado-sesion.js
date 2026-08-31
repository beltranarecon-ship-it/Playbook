/* ============================================================
   estado-sesion.js — EL ESTADO QUE NO SE GUARDA (Tramo 3.4).
   Módulo PURO: sin DOM, sin Supabase. Lo importan el calendario, el
   planificador y el banco Node.

   ── LOS CINCO ESTADOS, Y POR QUÉ SOLO CUATRO ESTÁN EN LA BASE ─
   Guardados hay cuatro: preliminar, programada, realizada y
   cancelada. El quinto —ACTIVA, «esto está pasando ahora mismo»— se
   DEDUCE del reloj y no se guarda (decisión #17).

   Es lo que evita el problema de §11: una sesión que nadie abre. Con
   una columna, alguien —un botón, una tarea programada— tendría que
   ponerla en activa a las 18:00 y quitarla a las 19:30, y el día que
   eso no pasara la sesión se quedaría colgada en «activa» para
   siempre, o no llegaría a estarlo nunca. Deducida del reloj no hay
   nada que pueda fallar: a las 18:00 está activa porque son las 18:00.

   ── LA VENTANA ──────────────────────────────────────────────
   Cinco minutos antes del inicio y cinco después del fin (§5.6). Son
   los números de la especificación y no una estimación: dan para abrir
   la pantalla mientras los críos se cambian y para el alargue de
   siempre, y mantienen «activa» pegada a la hora de pista de verdad.

   Cerrar la sesión —pasar lista, la reflexión— no necesita esta
   ventana: la pantalla de cierre se abre cuando se quiera.

   ── QUÉ SESIONES PUEDEN ESTARLO ─────────────────────────────
   Las que van a ocurrir: `preliminar` y `programada`. La diferencia
   entre esas dos es si alguien la ha PLANIFICADO, no si va a pasar —y
   un martes a las seis se entrena, esté el plan escrito o no—. Una
   `realizada` ya pasó y una `cancelada` no va a pasar: esas dos son
   finales y el reloj no las toca.
   ============================================================ */

/** El quinto estado. No existe en la base de datos a propósito. */
export const ACTIVA = 'activa';

/** Minutos de margen alrededor de la hora de pista. */
export const ANTES_MIN = 5;
export const DESPUES_MIN = 5;

/** Los cinco, en el orden en que ocurren. */
export const ESTADOS = ['preliminar', 'programada', ACTIVA, 'realizada', 'cancelada'];

/** Las que el reloj puede volver activas. */
const DEDUCIBLES = new Set(['preliminar', 'programada']);

/**
 * `fecha` (ISO) + `hora` (HH:MM[:SS]) como instante LOCAL.
 *
 * Local y no UTC: la hora de pista es la del pabellón, y un
 * entrenamiento de las 18:00 empieza a las 18:00 mire quien lo mire.
 */
function instante(fecha, hora) {
  const f = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return NaN;
  const [Y, M, D] = f.split('-').map(Number);
  const [h = 0, m = 0] = String(hora || '00:00').split(':').map(Number);
  return new Date(Y, M - 1, D, h, m, 0, 0).getTime();
}

/**
 * Desde cuándo y hasta cuándo una sesión está «pasando ahora».
 *
 * Sin hora de inicio no hay ventana: una sesión sin hora no se puede
 * situar en el reloj, y ponerle una por defecto sería inventarse a qué
 * hora entrena un equipo.
 *
 * Sin hora de fin se usa la duración del hueco (`slot_duracion_min`) y,
 * a falta de eso, hora y media, que es lo que dura un entrenamiento.
 *
 * @returns {desde, hasta} en ms, o null
 */
export function ventanaActiva(sesion) {
  const ini = instante(sesion?.fecha, sesion?.hora_inicio);
  if (!Number.isFinite(ini) || !sesion?.hora_inicio) return null;

  let fin = instante(sesion?.fecha, sesion?.hora_fin);
  if (!Number.isFinite(fin) || !sesion?.hora_fin || fin <= ini) {
    const dur = Number(sesion?.slot_duracion_min) || 90;
    fin = ini + dur * 60000;
  }
  return { desde: ini - ANTES_MIN * 60000, hasta: fin + DESPUES_MIN * 60000 };
}

/** ¿Está pasando ahora mismo? */
export function esActiva(sesion, ahora = Date.now()) {
  if (!sesion || !DEDUCIBLES.has(sesion.estado)) return false;
  const v = ventanaActiva(sesion);
  if (!v) return false;
  const t = Number(ahora);
  return t >= v.desde && t <= v.hasta;
}

/**
 * El estado que hay que ENSEÑAR: el guardado, o `activa` si el reloj
 * dice que está pasando. Lo que se guarda no cambia nunca por esto.
 */
export function estadoEfectivo(sesion, ahora = Date.now()) {
  if (!sesion?.estado) return 'preliminar';
  return esActiva(sesion, ahora) ? ACTIVA : sesion.estado;
}

/**
 * Cuánto queda para que empiece, o cuánto lleva. Negativo = falta.
 * null si no se puede situar en el reloj.
 */
export function minutosDesdeInicio(sesion, ahora = Date.now()) {
  const ini = instante(sesion?.fecha, sesion?.hora_inicio);
  if (!Number.isFinite(ini) || !sesion?.hora_inicio) return null;
  return Math.round((Number(ahora) - ini) / 60000);
}

/**
 * La sesión que hay que enseñar arriba en «lo de hoy» (§34): la que
 * está pasando, y si no la próxima que vaya a pasar hoy.
 */
export function laDeAhora(sesiones, ahora = Date.now()) {
  const lista = (sesiones || []).filter((s) => DEDUCIBLES.has(s?.estado));
  const activa = lista.find((s) => esActiva(s, ahora));
  if (activa) return activa;
  let mejor = null, mejorIni = Infinity;
  for (const s of lista) {
    const ini = instante(s.fecha, s.hora_inicio);
    if (!Number.isFinite(ini) || !s.hora_inicio || ini < ahora) continue;
    if (ini < mejorIni) { mejor = s; mejorIni = ini; }
  }
  return mejor;
}

/**
 * ¿La sesión YA PASÓ? Es lo que decide si existe la pestaña de cierre.
 *
 * Se DEDUCE del reloj, igual que `activa` y por la misma razón
 * (decisión #17): si `realizada` se escribiera sola al pasar la hora,
 * las sesiones que nunca ocurrieron —vacaciones, un puente, un
 * entrenamiento suspendido que nadie canceló— quedarían marcadas como
 * hechas para siempre y ensuciarían la progresión y el dosier. La
 * columna solo cambia cuando el entrenador guarda el cierre.
 *
 * Una CANCELADA no pasó: no se le pasa lista ni se reflexiona sobre
 * ella, así que no tiene cierre.
 *
 * Sin hora de inicio no hay ventana que mirar y vale el día: la sesión
 * se da por pasada cuando ha terminado su fecha. Suponerle una hora
 * sería inventarse a qué hora entrena un equipo.
 */
export function yaPaso(sesion, ahora = Date.now()) {
  if (!sesion || sesion.estado === 'cancelada') return false;
  if (sesion.estado === 'realizada') return true;

  const v = ventanaActiva(sesion);
  if (v) return Number(ahora) > v.hasta;

  const f = String(sesion.fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  const [Y, M, D] = f.split('-').map(Number);
  return Number(ahora) >= new Date(Y, M - 1, D + 1, 0, 0, 0, 0).getTime();
}
