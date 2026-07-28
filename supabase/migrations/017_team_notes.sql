-- ============================================================
-- 017_team_notes.sql — Notas del cuerpo técnico. Módulo Sesiones · M7.
--   Lo que no cabe en una sesión ni en un partido y aun así explica la
--   temporada: "Marta se incorpora en enero", "el club pide más 1x1",
--   "cambio de pabellón hasta Navidad". Son el contexto que el dossier
--   exportable pone por delante para que quien lo lea (o Claude) entienda
--   los números.
--   Fecha OPCIONAL: una nota puede ser un apunte de un día concreto o una
--   verdad de toda la temporada.
-- Idempotente. Depende de: 007 (helper de equipo), 001 (teams, seasons,
--   profiles, update_updated_at).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES public.teams(id)   ON DELETE CASCADE,
  season_id  uuid NOT NULL REFERENCES public.seasons(id) ON DELETE RESTRICT,
  fecha      date,                       -- NULL = vale para toda la temporada
  titulo     text,
  cuerpo     text NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_notes_cuerpo_check CHECK (btrim(cuerpo) <> '')
);
ALTER TABLE public.team_notes ENABLE ROW LEVEL SECURITY;
-- consulta del dossier: las del equipo en la temporada, por fecha
CREATE INDEX IF NOT EXISTS team_notes_team ON public.team_notes (team_id, season_id, fecha);
DROP TRIGGER IF EXISTS team_notes_updated_at ON public.team_notes;
CREATE TRIGGER team_notes_updated_at BEFORE UPDATE ON public.team_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Autoría no falsificable e identidad inmutable (patrón de objectives_guard,
-- 011): una nota no se muda de equipo ni de temporada.
CREATE OR REPLACE FUNCTION public.team_notes_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    IF NEW.team_id IS DISTINCT FROM OLD.team_id
       OR NEW.season_id IS DISTINCT FROM OLD.season_id THEN
      RAISE EXCEPTION 'team_id/season_id de una nota son inmutables';
    END IF;
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.team_notes_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS team_notes_guard ON public.team_notes;
CREATE TRIGGER team_notes_guard
  BEFORE INSERT OR UPDATE ON public.team_notes
  FOR EACH ROW EXECUTE FUNCTION public.team_notes_guard();

-- Acceso por equipo. A diferencia de sesiones/partidos/objetivos, una nota
-- SÍ se borra: es un apunte, no un registro histórico del que dependa nada.
DROP POLICY IF EXISTS "team_notes: acceso por equipo" ON public.team_notes;
CREATE POLICY "team_notes: acceso por equipo" ON public.team_notes
  FOR ALL TO authenticated
  USING (public.current_user_can_access_team(team_id))
  WITH CHECK (public.current_user_can_access_team(team_id));
