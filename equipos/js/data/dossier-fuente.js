/* ============================================================
   dossier-fuente.js — recoge de Supabase TODO lo que el motor puro
   del dossier (dossier.js) necesita, y lo deja en la forma exacta
   que espera. Aquí no se calcula nada: solo se lee y se agrupa.

   Cada bloque degrada por su cuenta: si una migración del módulo aún
   no está aplicada (o una tabla está vacía), el dossier sale igual
   con lo que sí haya, en vez de reventar entero.
   ============================================================ */

import { getEquipo } from './teams.js';
import { getJugadores } from './players.js';
import { getSesionesRango } from './sessions.js';
import { getObjetivos } from './objectives.js';
import { getBloquesSesiones, getObjetivosSesiones } from './blocks.js';
import { getAsistenciaSesiones } from './attendance.js';
import { getRespuestasSesiones, getCumplimientoRango } from './reflection.js';
import { getPartidosRango } from './matches.js';
import { getNotas } from './notes.js';

/**
 * @returns el objeto que construirDossier() consume tal cual, más
 *   `disponible` (qué piezas se pudieron LEER) para avisar en pantalla y
 *   dentro del propio documento.
 *
 * `disponible[x] === false` significa «la consulta falló», NUNCA «no hay
 * datos». Antes se calculaba con `!!lista.length` y las dos cosas quedaban
 * indistinguibles: sin la migración 016 aplicada, el dossier afirmaba
 * "Partidos: ninguno jugado en el periodo" — una frase falsa en el documento
 * que el entrenador pega como registro de la temporada.
 */
export async function recopilarDossier({ teamId, temporada, desde, hasta }) {
  const fallos = new Set();
  /** Degrada la pieza y DEJA CONSTANCIA de que se degradó. */
  const cae = (clave, porDefecto) => () => { fallos.add(clave); return porDefecto; };

  const [equipo, jugadores, sesiones, objetivos, partidos, notas] = await Promise.all([
    getEquipo(teamId),
    getJugadores(teamId, { incluirBajas: true }).catch(cae('jugadores', [])),
    getSesionesRango({ desde, hasta, teamId }).catch(cae('sesiones', [])),
    getObjetivos(teamId, temporada.id).catch(cae('objetivos', [])),
    getPartidosRango({ desde, hasta, teamId }).catch(cae('partidos', [])),
    getNotas(teamId, temporada.id).catch(cae('notas', [])),
  ]);

  const ids = sesiones.map((s) => s.id);
  const [bloquesPorSesion, asistenciaPorSesion, respuestasPorSesion, objetivosIdsPorSesion, cumplimiento] =
    await Promise.all([
      getBloquesSesiones(ids).catch(cae('bloques', {})),
      getAsistenciaSesiones(ids).catch(cae('asistencia', {})),
      getRespuestasSesiones(ids).catch(cae('reflexion', {})),
      getObjetivosSesiones(ids).catch(cae('objetivos_sesion', {})),
      // el cumplimiento SIEMPRE por la vista: es la única puerta que admite
      // el contrato (§columnas). Nadie lee reflection_answers para esto.
      getCumplimientoRango({ desde, hasta, teamId }).catch(cae('cumplimiento', [])),
    ]);

  const cumplimientoPorSesion = {};
  for (const c of cumplimiento) cumplimientoPorSesion[c.session_id] = c.cumplimiento;

  // el motor quiere los objetivos enteros por sesión, no sus ids
  const porId = new Map(objetivos.map((o) => [o.id, o]));
  const objetivosPorSesion = {};
  for (const [sid, lista] of Object.entries(objetivosIdsPorSesion)) {
    objetivosPorSesion[sid] = lista.map((id) => porId.get(id)).filter(Boolean);
  }

  // la asistencia se pinta dos veces: por sesión (quién faltó ese día) y
  // en plano (el % acumulado por jugador). Se reutiliza lo ya traído en vez
  // de pedirla otra vez por equipo.
  const nombres = new Map(jugadores.map((j) => [j.id, j.nombre]));
  const filasAsistencia = [];
  for (const filas of Object.values(asistenciaPorSesion)) {
    for (const f of filas) {
      f.nombre = nombres.get(f.player_id) || null;   // el motor lo usa en "Faltaron:"
      filasAsistencia.push(f);
    }
  }

  const ok = (clave) => !fallos.has(clave);
  return {
    // el color vive en team_settings (teams es admin-only): sin este ?. el
    // punto de color de la cabecera del dossier salía siempre vacío
    equipo: {
      id: equipo.id, name: equipo.name, category: equipo.category,
      color: equipo.team_settings?.color ?? null,
    },
    temporada,
    rango: { desde, hasta },
    jugadores, sesiones, objetivos, partidos, notas,
    bloquesPorSesion, asistenciaPorSesion, respuestasPorSesion, objetivosPorSesion,
    filasAsistencia, cumplimientoPorSesion,
    disponible: {
      jugadores: ok('jugadores'),
      sesiones: ok('sesiones'),
      objetivos: ok('objetivos') && ok('objetivos_sesion'),
      bloques: ok('bloques'),
      asistencia: ok('asistencia'),
      reflexion: ok('reflexion'),
      cumplimiento: ok('cumplimiento'),
      partidos: ok('partidos'),
      notas: ok('notas'),
    },
  };
}
