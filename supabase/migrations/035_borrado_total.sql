-- ============================================================
-- 035_borrado_total.sql — Que el administrador pueda borrar de verdad.
--
-- La 033 dejó borrar solo lo que NO dejó rastro: un equipo o una
-- temporada con entrenamientos o partidos dentro se quedaban, porque
-- «eso es el histórico del club». Es una buena regla por defecto y se
-- queda tal cual — pero el club es suyo y sus datos también, y un
-- equipo creado en pruebas con nueve entrenamientos inventados no es
-- histórico de nada: es basura que no se puede quitar.
--
-- ── DOS PUERTAS, NO UNA MÁS ANCHA ───────────────────────────
-- Lo fácil habría sido relajar las políticas de la 033. No se hace: un
-- borrado accidental desde cualquier pantalla se llevaría el año por
-- delante. En vez de eso, el borrado total pasa por una FUNCIÓN que hay
-- que llamar a propósito, que solo atiende al administrador y que
-- EXIGE ESCRIBIR EL NOMBRE. Las políticas de la 033 siguen guardando la
-- puerta de todos los días; ésta es la de la caja fuerte.
--
-- ── POR QUÉ EL NOMBRE ESCRITO Y NO OTRO «¿SEGURO?» ──────────
-- Porque un segundo «¿seguro?» se pulsa con el mismo dedo y la misma
-- inercia que el primero. Escribir «Alevín Tello Téllez» obliga a mirar
-- QUÉ se está borrando, que es justo lo que hay que comprobar. Es lo
-- que hacen GitHub y Stripe para lo mismo, y es la única confirmación
-- que de verdad frena.
--
-- ── SE DEVUELVE LO QUE SE LLEVÓ POR DELANTE ─────────────────
-- La función devuelve el recuento de lo borrado. No es adorno: es lo
-- único que queda como recibo de una operación que no tiene vuelta
-- atrás, y sale en pantalla al terminar.
--
-- Idempotente. Depende de: 001, 007-018, 028, 029, 033.
-- ============================================================

-- ── 1. Un equipo, con toda su historia ──────────────────────
/* `teams` reparte ON DELETE CASCADE a todo lo suyo —jugadores,
   ajustes, horarios, sesiones, objetivos, preguntas, partidos, notas y
   clasificación— y esas cascadas arrastran a su vez las asistencias,
   las reflexiones, los bloques y las estadísticas del acta.

   Aun así las sesiones y los partidos se borran ANTES y a mano. El
   motivo es `sessions.slot_id → team_schedules`, que es NO ACTION: si
   la cascada llegara a los horarios antes que a las sesiones, el
   borrado fallaría a mitad y con un error que no dice nada. */
CREATE OR REPLACE FUNCTION public.borrar_equipo_del_todo(
  p_team_id uuid,
  p_confirmacion text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_ses int; v_par int; v_jug int;
BEGIN
  IF public.current_user_role() <> 'admin' THEN
    RAISE EXCEPTION 'Solo el administrador puede borrar un equipo con su historial.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT name INTO v_nombre FROM public.teams WHERE id = p_team_id;
  IF v_nombre IS NULL THEN
    RAISE EXCEPTION 'Ese equipo ya no existe.' USING ERRCODE = 'no_data_found';
  END IF;

  IF btrim(coalesce(p_confirmacion, '')) IS DISTINCT FROM btrim(v_nombre) THEN
    RAISE EXCEPTION 'Para borrar «%» hay que escribir su nombre exacto.', v_nombre
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT count(*) INTO v_ses FROM public.sessions WHERE team_id = p_team_id;
  SELECT count(*) INTO v_par FROM public.matches  WHERE team_id = p_team_id;
  SELECT count(*) INTO v_jug FROM public.players  WHERE team_id = p_team_id;

  DELETE FROM public.matches  WHERE team_id = p_team_id;
  DELETE FROM public.sessions WHERE team_id = p_team_id;
  DELETE FROM public.teams    WHERE id = p_team_id;

  RETURN jsonb_build_object(
    'nombre', v_nombre, 'sesiones', v_ses, 'partidos', v_par, 'jugadores', v_jug);
END;
$$;

REVOKE ALL ON FUNCTION public.borrar_equipo_del_todo(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.borrar_equipo_del_todo(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.borrar_equipo_del_todo(uuid, text) IS
  'Borra un equipo y TODA su historia. Solo admin y exigiendo el nombre escrito (035).';

-- ── 2. Una temporada, con todo lo que colgaba de ella ───────
/* Aquí no vale con la cascada: casi todo lo que apunta a `seasons` lo
   hace con ON DELETE RESTRICT, a propósito, para que nadie se lleve un
   año por descuido. Hay que ir tabla por tabla y EN ORDEN.

   El orden no es alfabético, es de dependencias:
     · los partidos y las sesiones primero — sus cascadas se llevan
       actas, estadísticas, bloques, asistencias y reflexiones;
     · los objetivos DESPUÉS de las sesiones, porque `session_objectives`
       apunta a ellos con RESTRICT y muere con su sesión;
     · los horarios DESPUÉS de las sesiones, por `sessions.slot_id`.

   Si algún día se añade una tabla nueva que apunte a `seasons` con
   RESTRICT y no se meta en esta lista, el DELETE final fallará con el
   nombre de esa tabla. Eso es lo correcto: mejor un error que dice qué
   falta que un borrado a medias. */
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

  DELETE FROM public.session_slot_exclusions WHERE season_id = p_season_id;
  DELETE FROM public.matches                 WHERE season_id = p_season_id;
  DELETE FROM public.sessions                WHERE season_id = p_season_id;
  DELETE FROM public.objectives              WHERE season_id = p_season_id;
  DELETE FROM public.team_notes              WHERE season_id = p_season_id;
  DELETE FROM public.team_schedules          WHERE season_id = p_season_id;
  DELETE FROM public.no_training_periods     WHERE season_id = p_season_id;
  DELETE FROM public.seasons                 WHERE id = p_season_id;

  RETURN jsonb_build_object(
    'nombre', v_label, 'sesiones', v_ses, 'partidos', v_par, 'objetivos', v_obj);
END;
$$;

REVOKE ALL ON FUNCTION public.borrar_temporada_del_todo(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.borrar_temporada_del_todo(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.borrar_temporada_del_todo(uuid, text) IS
  'Borra una temporada y todo lo que colgaba de ella. Solo admin y exigiendo el nombre escrito (035).';
