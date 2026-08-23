-- ============================================================
-- 036_reflexion_upsert.sql — Que se pueda guardar la reflexión.
--
-- ── EL FALLO ────────────────────────────────────────────────
-- Al pulsar «Guardar y cerrar sesión» salía:
--
--   «there is no unique or exclusion constraint matching the
--    ON CONFLICT specification»
--
-- La 027 dejó DOS índices únicos PARCIALES sobre `reflection_answers`:
--
--   (session_id, clave_snapshot)             WHERE player_id IS NULL
--   (session_id, clave_snapshot, player_id)  WHERE player_id IS NOT NULL
--
-- Están bien pensados —hacían falta dos porque un NULL no colisiona con
-- otro NULL— pero con ellos el upsert NO FUNCIONA. Un `ON CONFLICT
-- (session_id, clave_snapshot)` solo puede resolverse contra un índice
-- parcial si la sentencia repite además su predicado (`WHERE player_id
-- IS NULL`), y eso desde la API REST no se puede mandar. Resultado: la
-- reflexión de la sesión no se guardaba nunca.
--
-- ── EL ARREGLO ──────────────────────────────────────────────
-- Un solo índice sobre las tres columnas, con NULLS NOT DISTINCT
-- (PostgreSQL 15+, que es lo que corre Supabase). Con esa cláusula dos
-- filas con el mismo (sesión, clave) y `player_id` NULL SÍ colisionan,
-- que era justo lo que los índices parciales conseguían por separado.
--
-- Y como ya no es parcial, el upsert puede apuntarle con las tres
-- columnas y vale para los dos casos: la respuesta del equipo y la de
-- cada jugador.
--
-- Lo que se protege sigue siendo lo mismo: una respuesta por sesión,
-- pregunta y jugador. No se relaja nada.
--
-- Idempotente. Depende de: 015, 027.
-- ============================================================

DO $$
BEGIN
  /* NULLS NOT DISTINCT es de PostgreSQL 15. Si la base fuese anterior,
     mejor quedarse con los índices parciales de la 027 —que protegen
     igual, aunque el upsert tenga que ir a mano— que quedarse SIN
     índice, que es lo que dejaría duplicar respuestas. */
  IF current_setting('server_version_num')::int < 150000 THEN
    RAISE NOTICE 'PostgreSQL < 15: se dejan los índices parciales de la 027.';
    RETURN;
  END IF;

  DROP INDEX IF EXISTS public.reflection_answers_equipo;
  DROP INDEX IF EXISTS public.reflection_answers_jugador;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'reflection_answers_una_por_pregunta'
  ) THEN
    CREATE UNIQUE INDEX reflection_answers_una_por_pregunta
      ON public.reflection_answers (session_id, clave_snapshot, player_id)
      NULLS NOT DISTINCT;
  END IF;
END $$;

COMMENT ON INDEX public.reflection_answers_una_por_pregunta IS
  'Una respuesta por sesión, pregunta y jugador. NULLS NOT DISTINCT para que las del EQUIPO (player_id NULL) también colisionen entre sí, que es lo que permite el upsert (036).';

-- ── La función de borrado, sin depender de la 018 ───────────
/* `borrar_temporada_del_todo` (035) borra tabla por tabla, y una de
   ellas es `session_slot_exclusions`, que la trae la 018. En una base
   sin esa migración la función entera reventaba con «relation
   public.session_slot_exclusions does not exist» y no se podía borrar
   NADA — ni siquiera lo que sí existía.

   Ahora cada borrado va dentro de su propio bloque: si la tabla no
   está, se salta y sigue. Una tabla que no existe no tiene filas que
   estorben, así que saltársela es exactamente lo correcto. */
CREATE OR REPLACE FUNCTION public.borrar_temporada_del_todo(
  p_season_id uuid,
  p_confirmacion text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_label text;
  v_ses int; v_par int; v_obj int;
  v_tabla text;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede borrar una temporada.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT label INTO v_label FROM public.seasons WHERE id = p_season_id;
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'Esa temporada ya no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF btrim(coalesce(p_confirmacion, '')) IS DISTINCT FROM btrim(v_label) THEN
    RAISE EXCEPTION 'Para borrar la temporada «%» hay que escribir su nombre exacto.', v_label
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_ses FROM public.sessions   WHERE season_id = p_season_id;
  SELECT count(*) INTO v_par FROM public.matches    WHERE season_id = p_season_id;
  SELECT count(*) INTO v_obj FROM public.objectives WHERE season_id = p_season_id;

  /* El orden no es alfabético, es de dependencias: partidos y sesiones
     primero —sus cascadas se llevan actas, estadísticas, bloques,
     asistencias y reflexiones—, los objetivos DESPUÉS de las sesiones
     porque `session_objectives` los sujeta con RESTRICT, y los horarios
     los últimos por `sessions.slot_id`. */
  FOREACH v_tabla IN ARRAY ARRAY[
    'session_slot_exclusions', 'matches', 'sessions',
    'objectives', 'team_notes', 'team_schedules', 'no_training_periods'
  ] LOOP
    IF to_regclass('public.' || v_tabla) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE season_id = $1', v_tabla) USING p_season_id;
    END IF;
  END LOOP;

  DELETE FROM public.seasons WHERE id = p_season_id;

  RETURN jsonb_build_object(
    'nombre', v_label, 'sesiones', v_ses, 'partidos', v_par, 'objetivos', v_obj);
END;
$$;

REVOKE ALL ON FUNCTION public.borrar_temporada_del_todo(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.borrar_temporada_del_todo(uuid, text) TO authenticated;
