-- ============================================================
-- 018_session_slot_exclusions.sql — Ocurrencias descartadas a mano.
--
-- EL PROBLEMA QUE RESUELVE
-- La auto-generación usa la EXISTENCIA DE LA FILA como única memoria de que
-- una ocurrencia teórica ya está resuelta: planRegeneracion() mete en
-- `aInsertar` toda ocurrencia cuya clave (slot_id, slot_date) no tenga fila
-- en `sessions`, sin mirar el estado. Consecuencia: si el entrenador BORRA
-- una preliminar auto, la clave desaparece y la siguiente regeneración la
-- vuelve a crear idéntica. Cancelas un entrenamiento y semanas después
-- reaparece, justo cuando ya nadie lo relaciona con lo que canceló.
--
-- Una fila 'cancelada' no tiene ese problema (sigue contando como ocupada),
-- pero deja el calendario lleno de tachones de sesiones que nunca llegaron a
-- programarse. Esta tabla permite lo que se pidió — que desaparezcan de
-- verdad — sin que resuciten: la ocurrencia queda anotada aquí y el motor la
-- salta.
--
-- El agujero YA EXISTÍA con el botón "Eliminar preliminar"; esto lo cierra.
--
-- Idempotente. Depende de: 007 (current_user_can_access_team),
--   009 (team_schedules), 010 (sessions), 001 (teams, seasons, profiles).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.session_slot_exclusions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id)           ON DELETE CASCADE,
  -- RESTRICT como en 009, 010, 011, 016 y 017: una temporada no se borra
  -- mientras le cuelgue algo. Borrar el equipo ya se lleva sus exclusiones por
  -- el CASCADE de arriba, así que esto no estorba al reinicio de datos.
  season_id   uuid NOT NULL REFERENCES public.seasons(id)         ON DELETE RESTRICT,
  -- el slot puede desactivarse (activo=false) pero no se borra nunca; si un día
  -- se borrase, la exclusión deja de tener sentido y se va con él.
  slot_id     uuid NOT NULL REFERENCES public.team_schedules(id)  ON DELETE CASCADE,
  slot_date   date NOT NULL,                 -- la fecha TEÓRICA, no la pintada
  motivo      text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- misma clave que el índice de idempotencia de sessions (010:56-58): una
  -- ocurrencia teórica está excluida o no lo está.
  CONSTRAINT session_slot_exclusions_unica UNIQUE (slot_id, slot_date)
);

ALTER TABLE public.session_slot_exclusions ENABLE ROW LEVEL SECURITY;

-- Consulta caliente: previewRegeneracion carga las del equipo y la temporada.
CREATE INDEX IF NOT EXISTS session_slot_exclusions_team
  ON public.session_slot_exclusions (team_id, season_id);
-- Soporte del chequeo de la FK RESTRICT al borrar una temporada: sin un índice
-- que empiece por season_id, Postgres barre la tabla entera (mismo criterio que
-- sessions_slot en 010).
CREATE INDEX IF NOT EXISTS session_slot_exclusions_season
  ON public.session_slot_exclusions (season_id);

-- Mismo criterio de acceso que sessions y team_schedules: por equipo.
DROP POLICY IF EXISTS "exclusiones: lectura por equipo" ON public.session_slot_exclusions;
CREATE POLICY "exclusiones: lectura por equipo" ON public.session_slot_exclusions
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "exclusiones: alta por equipo" ON public.session_slot_exclusions;
CREATE POLICY "exclusiones: alta por equipo" ON public.session_slot_exclusions
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_team(team_id));

-- Borrar la exclusión = "que vuelva a generarse". Es la vuelta atrás, y por eso
-- se expone: sin ella, descartar una ocurrencia sería irreversible.
DROP POLICY IF EXISTS "exclusiones: borrado por equipo" ON public.session_slot_exclusions;
CREATE POLICY "exclusiones: borrado por equipo" ON public.session_slot_exclusions
  FOR DELETE TO authenticated
  USING (public.current_user_can_access_team(team_id));

-- No hay UPDATE a propósito: una exclusión existe o no existe. La prohibición
-- vive TAMBIÉN en el guard de abajo, no solo en este comentario: si mañana
-- alguien añade una policy de UPDATE, el trigger sigue negándolo.

-- El guard hace dos cosas:
--  1. sella created_by con auth.uid() — nunca lo pone el cliente (010, 016);
--  2. comprueba que el horario referenciado es del MISMO equipo y temporada.
--     Las tres claves foráneas son independientes entre sí, así que sin esto un
--     entrenador podría anotar una exclusión con su propio team_id y el slot_id
--     de OTRO equipo, y bloquearle la generación. Es la regla 5 del CONTRACT, la
--     misma comprobación que hacen 010 (sessions.slot_id), 014 (attendance) y
--     015 (reflection_answers).
CREATE OR REPLACE FUNCTION public.session_slot_exclusions_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_team   uuid;
  v_season uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'session_slot_exclusions no se actualiza: se crea o se borra';
  END IF;

  SELECT ts.team_id, ts.season_id INTO v_team, v_season
  FROM public.team_schedules ts WHERE ts.id = NEW.slot_id;

  IF v_team IS DISTINCT FROM NEW.team_id OR v_season IS DISTINCT FROM NEW.season_id THEN
    RAISE EXCEPTION 'el horario referenciado no pertenece a ese equipo y temporada';
  END IF;

  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

-- Convención del CONTRACT: ninguna función SECURITY DEFINER queda ejecutable
-- desde fuera. Es la única línea que le faltaba respecto a las otras trece.
REVOKE EXECUTE ON FUNCTION public.session_slot_exclusions_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS session_slot_exclusions_guard ON public.session_slot_exclusions;
CREATE TRIGGER session_slot_exclusions_guard
  BEFORE INSERT OR UPDATE ON public.session_slot_exclusions
  FOR EACH ROW EXECUTE FUNCTION public.session_slot_exclusions_guard();
