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
-- (PostgreSQL 15+). Con esa cláusula dos filas con el mismo (sesión,
-- clave) y `player_id` NULL SÍ colisionan, que era justo lo que los
-- índices parciales conseguían por separado. Y como ya no es parcial,
-- el upsert puede apuntarle con las tres columnas y vale para los dos
-- casos: la respuesta del equipo y la de cada jugador.
--
-- Lo que se protege sigue siendo lo mismo: una respuesta por sesión,
-- pregunta y jugador. No se relaja nada.
--
-- ── POR QUÉ ESTA VERSIÓN GRITA ──────────────────────────────
-- La primera redacción, cuando no podía seguir, hacía RAISE NOTICE y se
-- volvía. El editor SQL de Supabase NO enseña los NOTICE. Y la línea
-- del COMMENT quedaba FUERA del bloque, así que se ejecutaba igual, no
-- encontraba el índice y tiraba abajo la migración entera por una línea
-- de documentación. Entre las dos cosas, correrla no dejaba ni el
-- arreglo ni una explicación: solo un `false` en la comprobación.
--
-- Aquí todo lo que impide seguir es un RAISE EXCEPTION que dice en
-- castellano qué pasa y qué hacer, y el COMMENT va dentro. Un error
-- rojo que se entiende vale infinitamente más que un «Success» que
-- miente.
--
-- Y al final hay un SELECT: al terminar se ve cómo ha quedado, sin
-- tener que ir a comprobarlo aparte.
--
-- Idempotente: correrla dos veces no cambia nada la segunda.
-- Depende de: 015 (reflection_answers), 027 (player_id), 035.
-- ============================================================

DO $bloque$
DECLARE
  v_version int := current_setting('server_version_num')::int;
  v_repes   int;
BEGIN
  -- ── 1. ¿Está la tabla, y con su columna? ──────────────────
  IF to_regclass('public.reflection_answers') IS NULL THEN
    RAISE EXCEPTION
      'Falta la migración 015: no existe la tabla reflection_answers. Aplica la 015 y la 027 antes que ésta.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'reflection_answers'
       AND column_name  = 'player_id'
  ) THEN
    RAISE EXCEPTION
      'Falta la migración 027: reflection_answers no tiene la columna player_id. Aplica la 027 antes que ésta.';
  END IF;

  -- ── 2. ¿La base es lo bastante nueva? ─────────────────────
  /* NULLS NOT DISTINCT es de PostgreSQL 15. Antes no existe, y sin ella
     este arreglo no se puede hacer. Que se sepa: NO hay que buscarle
     otra vuelta. La app tiene plan B —guarda fila a fila— así que la
     reflexión se guarda igual, solo que con más peticiones. */
  IF v_version < 150000 THEN
    RAISE EXCEPTION
      'Esta base es PostgreSQL % y NULLS NOT DISTINCT necesita la 15. No hay nada que aplicar: la app se da cuenta sola y guarda fila a fila, que funciona igual. Se dejan los índices de la 027 como están.',
      current_setting('server_version');
  END IF;

  -- ── 3. ¿Hay respuestas repetidas que impidan el índice? ───
  /* Un índice ÚNICO no se puede crear sobre datos que ya se repiten, y
     el error de Postgres («could not create unique index») no dice
     cuáles son. Se cuentan antes para poder decirlo. GROUP BY trata los
     NULL como iguales, que es justo lo que hará el índice. */
  SELECT count(*) INTO v_repes FROM (
    SELECT 1 FROM public.reflection_answers
     GROUP BY session_id, clave_snapshot, player_id
    HAVING count(*) > 1
  ) AS d;

  IF v_repes > 0 THEN
    RAISE EXCEPTION
      'Hay % pregunta(s) con más de una respuesta guardada; el índice único no se puede crear encima. Míralas con: SELECT session_id, clave_snapshot, player_id, count(*) FROM reflection_answers GROUP BY 1,2,3 HAVING count(*) > 1;',
      v_repes;
  END IF;

  -- ── 4. Ahora sí ───────────────────────────────────────────
  DROP INDEX IF EXISTS public.reflection_answers_equipo;
  DROP INDEX IF EXISTS public.reflection_answers_jugador;

  IF to_regclass('public.reflection_answers_una_por_pregunta') IS NULL THEN
    CREATE UNIQUE INDEX reflection_answers_una_por_pregunta
      ON public.reflection_answers (session_id, clave_snapshot, player_id)
      NULLS NOT DISTINCT;
  END IF;

  /* El COMMENT va DENTRO del bloque a propósito: fuera se ejecutaba
     siempre, también cuando el índice no llegaba a existir. */
  EXECUTE 'COMMENT ON INDEX public.reflection_answers_una_por_pregunta IS '
    || quote_literal('Una respuesta por sesión, pregunta y jugador. NULLS NOT DISTINCT para que las del EQUIPO (player_id NULL) también colisionen entre sí, que es lo que permite el upsert (036).');
END
$bloque$;

-- ── La función de borrado, sin depender de la 018 ───────────
/* `borrar_temporada_del_todo` (035) borra tabla por tabla, y una de
   ellas es `session_slot_exclusions`, que la trae la 018. En una base
   sin esa migración la función entera reventaba con «relation
   public.session_slot_exclusions does not exist» y no se podía borrar
   NADA — ni siquiera lo que sí existía.

   Ahora cada borrado mira antes si la tabla está. Una tabla que no
   existe no tiene filas que estorben, así que saltársela es justo lo
   correcto. */
CREATE OR REPLACE FUNCTION public.borrar_temporada_del_todo(
  p_season_id uuid,
  p_confirmacion text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $fn$
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
$fn$;

REVOKE ALL ON FUNCTION public.borrar_temporada_del_todo(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.borrar_temporada_del_todo(uuid, text) TO authenticated;

-- ── Y se dice cómo ha quedado ───────────────────────────────
SELECT
  current_setting('server_version') AS postgres,
  to_regclass('public.reflection_answers_una_por_pregunta') IS NOT NULL
    AS indice_036_puesto,
  to_regclass('public.reflection_answers_equipo')      IS NOT NULL
    OR to_regclass('public.reflection_answers_jugador') IS NOT NULL
    AS quedan_los_parciales_de_la_027;
