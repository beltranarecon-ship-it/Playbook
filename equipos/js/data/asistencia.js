/* ============================================================
   asistencia.js — motor PURO de la asistencia (módulo Sesiones · M5).
   Sin DOM, sin Supabase: lo importan la vista de cierre y el banco
   Node (equipos/tools/eval-asistencia.mjs).

   Modelo: SNAPSHOT DENSO. Pasar lista escribe una fila por jugador
   del roster, no solo por los ausentes; el histórico deja de moverse
   cuando el roster cambia. Este motor calcula la lista densa a partir
   del roster + lo que ya hay en BD, y los resúmenes que se pintan.
   ============================================================ */

/** Estados en el orden en que se pintan (segmentado P·T·J·L·A). */
export const ESTADOS_ASISTENCIA = [
  { clave: 'presente',    corto: 'P', nombre: 'Presente',    tono: 'ok' },
  { clave: 'tarde',       corto: 'T', nombre: 'Tarde',       tono: 'aviso' },
  { clave: 'justificado', corto: 'J', nombre: 'Justificado', tono: 'neutro' },
  { clave: 'lesionado',   corto: 'L', nombre: 'Lesionado',   tono: 'info' },
  { clave: 'ausente',     corto: 'A', nombre: 'Ausente',     tono: 'error' },
];
export const ESTADO_DEFECTO = 'presente';
/** Estados que cuentan como "entrenó" (el resto son falta, avisada o no). */
export const ESTADOS_ENTRENA = ['presente', 'tarde'];
/** Falta avisada: no penaliza el compromiso, pero tampoco entrenó. */
export const ESTADOS_JUSTIFICA = ['justificado', 'lesionado'];

const esValido = (e) => ESTADOS_ASISTENCIA.some((x) => x.clave === e);

/**
 * Lista densa que se pinta y se guarda: un jugador por fila.
 * Incluye a TODO el roster activo + a los de baja QUE YA tengan fila
 * (histórico: el que estuvo, estuvo, aunque luego se diera de baja).
 * @param jugadores [{id, nombre, dorsal, estado}] roster CON bajas
 * @param filasBD   [{player_id, estado, motivo}] lo guardado
 * @returns [{player_id, nombre, dorsal, estado, motivo, esBaja, enBD}]
 */
export function filasDensas(jugadores, filasBD = [], { porDefecto = ESTADO_DEFECTO } = {}) {
  const enBD = new Map((filasBD || []).map((f) => [f.player_id, f]));
  const out = [];
  for (const j of jugadores || []) {
    const fila = enBD.get(j.id);
    const esBaja = j.estado === 'baja';
    if (esBaja && !fila) continue;               // baja sin historia: fuera
    // un lesionado del roster arranca marcado como tal (el coach lo cambia)
    const inicial = j.estado === 'lesionado' ? 'lesionado' : porDefecto;
    out.push({
      player_id: j.id,
      nombre: j.nombre,
      dorsal: j.dorsal ?? null,
      estado: fila && esValido(fila.estado) ? fila.estado : inicial,
      motivo: fila?.motivo ?? null,
      esBaja,
      enBD: !!fila,
    });
  }
  return out;
}

/**
 * Contadores de una lista (densa o de BD).
 * entrenaron = presente + tarde. pct = entrenaron / total (entero).
 */
export function resumenAsistencia(filas) {
  const r = {
    total: 0, presente: 0, tarde: 0, justificado: 0, lesionado: 0, ausente: 0,
    entrenaron: 0, justificadas: 0, pct: 0,
  };
  for (const f of filas || []) {
    if (!esValido(f.estado)) continue;
    r.total++;
    r[f.estado]++;
  }
  r.entrenaron = r.presente + r.tarde;
  r.justificadas = r.justificado + r.lesionado;
  r.pct = r.total ? Math.round((r.entrenaron / r.total) * 100) : 0;
  return r;
}

/**
 * Asistencia acumulada por jugador (ficha del equipo, dossier M7).
 * Solo cuenta las sesiones de las que hay lista pasada.
 * @param jugadores [{id, nombre, dorsal}]
 * @param filas     [{player_id, estado}] de TODAS las sesiones del rango
 * @returns [{player_id, nombre, dorsal, total, entrenaron, ausentes, justificadas, pct}]
 *          en el mismo orden que `jugadores`; sin filas → total 0 y pct null.
 */
export function estadisticasJugadores(jugadores, filas) {
  const porJugador = new Map();
  for (const f of filas || []) {
    if (!esValido(f.estado)) continue;
    if (!porJugador.has(f.player_id)) porJugador.set(f.player_id, []);
    porJugador.get(f.player_id).push(f);
  }
  return (jugadores || []).map((j) => {
    const r = resumenAsistencia(porJugador.get(j.id) || []);
    return {
      player_id: j.id,
      nombre: j.nombre,
      dorsal: j.dorsal ?? null,
      total: r.total,
      entrenaron: r.entrenaron,
      ausentes: r.ausente,
      justificadas: r.justificadas,
      pct: r.total ? r.pct : null,     // sin datos ≠ 0 %
    };
  });
}

/** Filas listas para el upsert (quita lo que solo vive en la UI). */
export function filasParaGuardar(sessionId, densas) {
  return (densas || [])
    .filter((f) => esValido(f.estado))
    .map((f) => ({
      session_id: sessionId,
      player_id: f.player_id,
      estado: f.estado,
      motivo: (f.motivo || '').trim() || null,
    }));
}

/** ¿La lista pintada difiere de lo guardado? (aviso de cambios sin guardar) */
export function hayCambios(densas, filasBD) {
  const enBD = new Map((filasBD || []).map((f) => [f.player_id, f]));
  if ((densas || []).length !== enBD.size) return true;
  return (densas || []).some((d) => {
    const f = enBD.get(d.player_id);
    if (!f) return true;
    return f.estado !== d.estado
      || ((f.motivo || '').trim() || null) !== ((d.motivo || '').trim() || null);
  });
}
