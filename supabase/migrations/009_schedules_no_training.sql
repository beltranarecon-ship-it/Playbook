-- ============================================================
-- 009_schedules_no_training.sql — Horarios semanales + periodos
-- sin entreno (calendario escolar). Módulo Sesiones · M2.
--   · team_schedules: slots semanales del equipo (día ISO 1-7 + horas
--     + lugar). Disparan la auto-generación de sesiones preliminares.
--   · no_training_periods: rangos de fechas en los que NO se auto-genera
--     (festivos/vacaciones). team_id NULL = club (todos los equipos).
--     SOLO condicionan la auto-generación: el coach puede crear sesiones
--     manuales cualquier día.
-- Idempotente. Depende de: 007 (helper current_user_can_access_team).
-- ============================================================

-- ── 1) team_schedules ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  season_id    uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  weekday      smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),  -- ISO 1=lun..7=dom
  hora_inicio  time NOT NULL,
  hora_fin     time NOT NULL,
  lugar        text,
  activo       boolean NOT NULL DEFAULT true,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_schedules_horas_check CHECK (hora_fin > hora_inicio)
);
ALTER TABLE public.team_schedules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS team_schedules_team ON public.team_schedules (team_id, season_id);
DROP TRIGGER IF EXISTS team_schedules_updated_at ON public.team_schedules;
CREATE TRIGGER team_schedules_updated_at BEFORE UPDATE ON public.team_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- SIN policy de DELETE: los slots se DESACTIVAN (activo=false), nunca se
-- borran — la poda de la reconciliación depende de que las sesiones auto
-- conserven su slot_id. (El CASCADE de borrar un equipo no pasa por RLS.)
DROP POLICY IF EXISTS "team_schedules: acceso por equipo" ON public.team_schedules;
DROP POLICY IF EXISTS "team_schedules: lectura por equipo" ON public.team_schedules;
CREATE POLICY "team_schedules: lectura por equipo" ON public.team_schedules
  FOR SELECT TO authenticated
  USING (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "team_schedules: alta por equipo" ON public.team_schedules;
CREATE POLICY "team_schedules: alta por equipo" ON public.team_schedules
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_access_team(team_id));

DROP POLICY IF EXISTS "team_schedules: edición por equipo" ON public.team_schedules;
CREATE POLICY "team_schedules: edición por equipo" ON public.team_schedules
  FOR UPDATE TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));

-- ── 2) no_training_periods ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.no_training_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  team_id       uuid REFERENCES public.teams(id) ON DELETE CASCADE,  -- NULL = club
  fecha_inicio  date NOT NULL,
  fecha_fin     date NOT NULL,
  motivo        text,
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  periodo       daterange GENERATED ALWAYS AS
                (daterange(fecha_inicio, fecha_fin, '[]')) STORED,
  CONSTRAINT no_training_rango_check CHECK (fecha_fin >= fecha_inicio)
);
ALTER TABLE public.no_training_periods ENABLE ROW LEVEL SECURITY;
-- Consulta caliente del motor: ¿la fecha D cae en algún periodo? → periodo @> D
CREATE INDEX IF NOT EXISTS no_training_periodo_gist
  ON public.no_training_periods USING GIST (periodo);
CREATE INDEX IF NOT EXISTS no_training_season
  ON public.no_training_periods (season_id, team_id);

-- Lectura: los periodos de club los ve todo autenticado (condicionan su
-- calendario); los de equipo, sus coaches.
DROP POLICY IF EXISTS "no_training: lectura" ON public.no_training_periods;
CREATE POLICY "no_training: lectura" ON public.no_training_periods
  FOR SELECT TO authenticated
  USING (team_id IS NULL OR public.current_user_can_access_team(team_id));

-- Escritura: club-wide (team_id NULL) SOLO admin — un coach no puede
-- sabotear la auto-generación de todos los equipos. Por equipo, sus coaches.
DROP POLICY IF EXISTS "no_training: escritura" ON public.no_training_periods;
CREATE POLICY "no_training: escritura" ON public.no_training_periods
  FOR ALL TO authenticated
  USING (
    (team_id IS NULL AND public.current_user_role() = 'admin')
    OR (team_id IS NOT NULL AND public.current_user_can_access_team(team_id))
  )
  WITH CHECK (
    (team_id IS NULL AND public.current_user_role() = 'admin')
    OR (team_id IS NOT NULL AND public.current_user_can_access_team(team_id))
  );
