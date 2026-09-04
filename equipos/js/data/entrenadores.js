/* ============================================================
   entrenadores.js — el cuadro técnico de un equipo.
   Módulo PURO: sin red, sin DOM. Lo importan la pantalla de
   administración y el banco Node.

   ── POR QUÉ ESTO EXISTE ─────────────────────────────────────
   Hasta ahora un entrenador entraba en un equipo SOLO al darse de alta,
   por los equipos que llevara su invitación. Si te equivocabas al
   invitar, o llegaba un ayudante a mitad de temporada, había que entrar
   en Supabase. Esto es lo que hace falta para arreglarlo desde la app.

   ── EL GUARD QUE DE VERDAD IMPORTA ──────────────────────────
   Quitar al ÚLTIMO entrenador de un equipo no lo deja «sin entrenador»:
   lo hace DESAPARECER. `getMisEquipos` descarta los equipos con el
   cuadro vacío (teams.js), así que el equipo se cae de la lista de todo
   el mundo —incluida esta pantalla de administración, que bebe de la
   misma consulta— y solo se recupera desde el editor SQL.

   La base de datos no lo impide: la policy de `team_coaches` (007) solo
   pregunta si eres admin, no cuántos quedan. Así que el único sitio
   donde esa regla puede vivir es aquí, y por eso está suelta y con
   banco: una regla que solo existe dentro de un `onClick` no se puede
   comprobar.
   ============================================================ */

/** Los dos papeles que acepta la tabla (007: CHECK rol IN …). */
export const ROLES = ['principal', 'ayudante'];

export const ROL_LABEL = {
  principal: 'Principal',
  ayudante: 'Ayudante',
};

/** ¿Este papel existe? Lo que no, no se manda a la base. */
export const rolValido = (rol) => ROLES.includes(rol);

/** ¿Está ya este entrenador en el equipo? (007: UNIQUE (team_id, coach_id)) */
export const yaEsta = (cuadro, coachId) =>
  (cuadro || []).some((c) => c && c.coach_id === coachId);

/**
 * ¿Se puede quitar a este del equipo?
 *
 * @returns {{ok: boolean, porque: string|null}} — `porque` se enseña tal
 *   cual, así que dice la consecuencia y no la regla: «el equipo
 *   desaparecería» explica por qué el botón no va; «viola una
 *   restricción» no explica nada.
 */
export function puedeQuitar(cuadro, coachId) {
  const lista = (cuadro || []).filter(Boolean);
  if (!yaEsta(lista, coachId)) {
    return { ok: false, porque: 'Ese entrenador no está en este equipo.' };
  }
  if (lista.length <= 1) {
    return {
      ok: false,
      porque: 'Es el único entrenador. Un equipo sin ninguno desaparece de la lista '
        + 'de todos y solo se recupera desde la base de datos. Añade antes a otro.',
    };
  }
  return { ok: true, porque: null };
}

/**
 * ¿Se puede añadir a éste?
 *
 * No se comprueba el papel de nadie: un admin también entrena, y a la
 * tabla le da igual. Lo único que rechaza la base es repetir.
 */
export function puedeAñadir(cuadro, coachId, rol) {
  if (!coachId) return { ok: false, porque: 'Elige a quién añadir.' };
  if (!rolValido(rol)) return { ok: false, porque: 'Ese papel no existe.' };
  if (yaEsta(cuadro, coachId)) {
    return { ok: false, porque: 'Ya está en este equipo.' };
  }
  return { ok: true, porque: null };
}

/**
 * Los que se pueden añadir: todos los del club menos los que ya están.
 *
 * OJO con lo que llega aquí: la RLS de `profiles` (001) solo deja ver el
 * propio perfil salvo a un administrador. Esta pantalla es solo de
 * administración justamente por eso; a cualquier otro le llegaría una
 * lista de uno y parecería que el club no tiene entrenadores.
 */
export function candidatos(perfiles, cuadro) {
  const dentro = new Set((cuadro || []).filter(Boolean).map((c) => c.coach_id));
  return (perfiles || [])
    .filter((p) => p && p.id && !dentro.has(p.id))
    .slice()
    .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), 'es'));
}

/**
 * Cómo llamar a alguien que quizá no ha puesto su nombre.
 *
 * `profiles.full_name` es NULLABLE (001) y hay cuentas recién invitadas
 * que todavía no lo han rellenado. Un desplegable con una fila vacía no
 * se puede usar: al menos hay que poder distinguirlas.
 */
export function nombreDe(perfil) {
  const n = (perfil?.full_name || '').trim();
  if (n) return n;
  const id = String(perfil?.id || '');
  return id ? `Sin nombre (${id.slice(0, 8)})` : 'Sin nombre';
}

/** El cuadro ordenado como se lee: principales delante, y por nombre. */
export function ordenarCuadro(cuadro) {
  return (cuadro || []).filter(Boolean).slice().sort((a, b) => {
    if (a.rol !== b.rol) return a.rol === 'principal' ? -1 : 1;
    return (a.nombre || '').localeCompare(b.nombre || '', 'es');
  });
}
