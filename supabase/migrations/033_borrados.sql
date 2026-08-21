-- ============================================================
-- 033_borrados.sql — Poder borrar lo que se creó por error.
--
-- Tres cosas que la aplicación pedía y la base de datos no permitía:
--
--   1. una sesión CANCELADA que no llegó a ocurrir;
--   2. una TEMPORADA (§5.10: «crear y eliminar temporadas: solo el
--      administrador»);
--   3. un EQUIPO creado por error.
--
-- ── LA REGLA QUE LAS TRES COMPARTEN ─────────────────────────
-- Se borra lo que NO DEJÓ RASTRO. Si hay asistencia, reflexión, acta o
-- estadísticas, eso es histórico del club y se queda: un club que
-- pierde la temporada pasada por un clic no vuelve a fiarse de la app.
-- Y donde no hay nada apuntado, no hay nada que perder — y sí un
-- calendario lleno de cosas tachadas que nadie puede quitar.
--
-- Idempotente. Depende de: 001, 007, 010, 013, 014, 015, 016, 028.
-- ============================================================

-- ── 1. Sesiones ─────────────────────────────────────────────
/* Antes solo se podía borrar el andamiaje: `origen='auto' AND
   estado='preliminar'`. El problema: cancelar una sesión desde el
   planificador la deja en 'cancelada', y a partir de ahí NADIE puede
   quitarla. Se queda tachada en el calendario para siempre.

   Se añade la cancelada, con las mismas dos condiciones de siempre: sin
   lista y sin reflexión. Una sesión cancelada sin nada apuntado no
   ocurrió; no es histórico, es ruido. */
DROP POLICY IF EXISTS "sessions: borrado solo andamiaje" ON public.sessions;
CREATE POLICY "sessions: borrado solo andamiaje" ON public.sessions
  FOR DELETE TO authenticated
  USING (
    public.current_user_can_access_team(team_id)
    AND (
      (origen = 'auto' AND estado = 'preliminar')
      OR estado = 'cancelada'
    )
    AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.session_id = sessions.id)
    AND NOT EXISTS (SELECT 1 FROM public.reflection_answers r WHERE r.session_id = sessions.id)
  );

-- ── 2. Temporadas ───────────────────────────────────────────
/* §5.10: crear y eliminar temporadas es SOLO del administrador. Y solo
   una temporada vacía: con sesiones o partidos dentro, borrarla se
   llevaría por delante el año entero. La app enseña el recuento antes
   de ofrecer el botón, pero la puerta de verdad está aquí. */
DROP POLICY IF EXISTS "seasons: borrado solo admin y vacías" ON public.seasons;
CREATE POLICY "seasons: borrado solo admin y vacías" ON public.seasons
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.sessions s WHERE s.season_id = seasons.id)
    AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.season_id = seasons.id)
  );

-- ── 3. Equipos ──────────────────────────────────────────────
/* Un equipo creado por error se borra; uno con historia, no. `players`
   no cuenta como historia a propósito: pegar la plantilla es lo primero
   que se hace al crear un equipo, y también lo primero que se hace mal.
   Lo que cuenta es que haya PASADO algo — un entrenamiento o un
   partido—, y entonces el equipo se archiva, no se borra.

   El borrado en cascada de las FK se lleva ajustes, jugadores,
   horarios, objetivos y entrenadores del equipo, que es lo correcto:
   sin equipo no significan nada. */
DROP POLICY IF EXISTS "teams: borrado solo admin y sin historia" ON public.teams;
CREATE POLICY "teams: borrado solo admin y sin historia" ON public.teams
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() = 'admin'
    AND NOT EXISTS (SELECT 1 FROM public.sessions s WHERE s.team_id = teams.id)
    AND NOT EXISTS (SELECT 1 FROM public.matches m WHERE m.team_id = teams.id)
  );

COMMENT ON TABLE public.seasons IS
  'Temporadas del club. Solo el administrador las crea y las borra (§5.10), y solo si están vacías.';
